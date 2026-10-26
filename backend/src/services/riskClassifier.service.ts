import type { RiskLevel, ClauseAnalysis, BoundingBox } from "@faa/shared";
import type { RawClause } from "./clauseSegmentation.service";
import { findRisks, isOperative, PROTECTIVE } from "./riskRules";

/** Bump when classification logic changes; stored analyses from older versions are re-checked. */
export const ANALYSIS_VERSION = 4;

/**
 * Text aimed at an AI reviewer rather than the borrower. Legitimate contracts never contain this,
 * so it is treated as a strong scam signal.
 */
const MANIPULATION_PATTERNS = [
  /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|prompts|rules)/i,
  /disregard\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+(?:instructions|text)/i,
  /(?:you\s+are|act\s+as)\s+(?:an?\s+)?(?:ai|assistant|language\s+model|chatbot)/i,
  /(?:classify|mark|rate|label|treat)\s+(?:this|these|all)\s+(?:clause|clauses|document|agreement|terms)?\s*as\s+(?:safe|low[- ]risk|compliant)/i,
  /system\s+prompt|jailbreak|riskLevel\s*[:=]/i,
];

export const GENERAL_CATEGORY = "General Provision";

interface ClassificationResult {
  riskLevel: RiskLevel;
  confidence: number;
  category: string;
  flags: string[];
}

export function classifyClause(text: string, layoutFlags: string[] = []): ClassificationResult {
  const manipulation = MANIPULATION_PATTERNS.some((p) => p.test(text));
  if (manipulation || layoutFlags.includes("hidden-tiny-text")) {
    return {
      riskLevel: "high",
      confidence: manipulation ? 0.97 : 0.9,
      category: manipulation ? "Hidden Instructions to AI" : "Hidden Text",
      flags: [...new Set([...(manipulation ? ["prompt-injection-attempt"] : []), ...layoutFlags])],
    };
  }

  const protective = PROTECTIVE.test(text);
  const findings = findRisks(text);

  // Mentioning a term is not the same as agreeing to it.
  if (!findings.length || !isOperative(text)) {
    return {
      riskLevel: "safe",
      confidence: protective ? 0.85 : findings.length ? 0.6 : 0.7,
      category: GENERAL_CATEGORY,
      flags: findings.length ? ["mentions-term-without-obligation"] : protective ? ["protective-term"] : [],
    };
  }

  const high = findings.filter((f) => f.level === "high");
  const top = high.length ? high : findings;
  const riskLevel: RiskLevel = high.length ? "high" : "caution";
  const confidence = high.length ? Math.min(0.97, 0.78 + high.length * 0.06) : Math.min(0.9, 0.66 + findings.length * 0.05);

  return {
    riskLevel,
    confidence: Math.round(confidence * 100) / 100,
    category: top[0].rule.category,
    flags: [...new Set(findings.map((f) => f.rule.id))].slice(0, 8),
  };
}

export function buildClauseAnalysis(raw: RawClause, highlights: BoundingBox[], layoutFlags: string[] = []): Partial<ClauseAnalysis> {
  const result = classifyClause(raw.text, layoutFlags);
  const firstPage = highlights[0]?.page;
  const onFirstPage = highlights.filter((h) => h.page === firstPage);

  return {
    id: raw.id,
    text: raw.text,
    heading: raw.heading,
    riskLevel: result.riskLevel,
    confidence: result.confidence,
    category: result.category,
    flags: result.flags,
    highlights,
    boundingBox: onFirstPage.length ? unionBox(onFirstPage) : undefined,
    position: { page: firstPage ?? 1, textStart: raw.start, textEnd: raw.end, heading: raw.heading },
  };
}

function unionBox(boxes: BoundingBox[]): BoundingBox {
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.width));
  const y2 = Math.max(...boxes.map((b) => b.y + b.height));
  return { page: boxes[0].page, x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** How much each distinct problem lowers the trust score. Deception and harassment weigh most. */
const HIGH_WEIGHT: Record<string, number> = {
  "Hidden Instructions to AI": 40,
  "Hidden Text": 35,
  "Fraud or Scam Language": 45,
  "Data Misuse & Harassment Risk": 30,
  "Salary Deduction": 20,
};
const DEFAULT_HIGH_WEIGHT = 14;
const CAUTION_WEIGHT = 5;

/**
 * Scores reflect which problems exist, not how many harmless clauses surround them: ten safe
 * clauses do not dilute one clause that lets a lender contact your family.
 */
export function computeAgreementScores(clauses: ClauseAnalysis[]) {
  const highCategories = new Set(clauses.filter((c) => c.riskLevel === "high").map((c) => c.category));
  const cautionCategories = new Set(
    clauses.filter((c) => c.riskLevel === "caution" && !highCategories.has(c.category)).map((c) => c.category)
  );

  const highPenalty = [...highCategories].reduce((sum, cat) => sum + (HIGH_WEIGHT[cat] ?? DEFAULT_HIGH_WEIGHT), 0);
  const cautionPenalty = Math.min(30, cautionCategories.size * CAUTION_WEIGHT);
  const trustScore = clamp(100 - highPenalty - cautionPenalty);

  const opaque = ["Hidden Fees", "Hidden Text", "Hidden Instructions to AI", "Unilateral Changes", "Ambiguous Terms", "Variable Interest"];
  const opacityHits = [...highCategories, ...cautionCategories].filter((c) => opaque.includes(c)).length;
  const transparency = clamp(100 - opacityHits * 18);

  return {
    trustScore,
    consumerFriendliness: clamp(Math.round(trustScore * 0.6 + transparency * 0.4)),
    transparency,
    overallRisk: 100 - trustScore,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
