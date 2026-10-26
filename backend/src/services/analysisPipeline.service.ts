import { v4 as uuidv4 } from "uuid";
import type { AgreementAnalysis, AnalysisProgress, ClauseAnalysis, DocumentLanguage, ExplanationLanguage } from "@faa/shared";
import { extractLoanTerms } from "./loanTerms.service";
import { UnreadableDocumentError } from "./wordDocument.service";
import type { DetectedFileType } from "../lib/fileType";
import { extractDocument } from "./ocr.service";
import { segmentClauses } from "./clauseSegmentation.service";
import { highlightsForRange, wordsInRange } from "./documentLayout";
import { ANALYSIS_VERSION, buildClauseAnalysis, computeAgreementScores, classifyClause } from "./riskClassifier.service";
import { checkDocument } from "./riskRules";
import { templateExplanation, templateSummary } from "./explanations";
import { enrichClauseWithAI, generateAgreementSummary } from "./aiExplanation.service";
import { getAgreementForUser, saveAgreement, saveDocumentFile } from "./storage.service";
import { buildSemanticIndex } from "./semanticIndex.service";
import { classifyDocumentType } from "./documentType.service";

const MAX_CONCURRENT_JOBS = 2;
let running = 0;
const queue: (() => Promise<void>)[] = [];

/**
 * Create the agreement record and queue the analysis. Returns immediately so large or scanned
 * documents never hit an HTTP timeout; the client polls the record for progress.
 */
export async function startAgreementAnalysis(params: {
  userId: string;
  fileName: string;
  buffer: Buffer;
  fileType: DetectedFileType;
  mimeType: string;
  documentLanguage: DocumentLanguage;
  explanationLanguage: ExplanationLanguage;
}): Promise<AgreementAnalysis> {
  const now = new Date().toISOString();
  const pending: AgreementAnalysis = {
    id: uuidv4(),
    userId: params.userId,
    fileName: params.fileName,
    mimeType: params.mimeType,
    status: "processing",
    progress: { stage: "queued", percent: 0, message: "Waiting to start" },
    securityFlags: [],
    language: { document: params.documentLanguage, explanation: params.explanationLanguage },
    extractedText: "",
    ocr: { method: "pending", confidence: 0, warnings: [] },
    clauses: [],
    scores: { trustScore: 0, consumerFriendliness: 0, transparency: 0, overallRisk: 0 },
    summary: "",
    negotiationSuggestions: [],
    deadlines: [],
    riskCounts: { safe: 0, caution: 0, high: 0 },
    createdAt: now,
    updatedAt: now,
  };
  await saveAgreement(pending);

  enqueue(() => runAnalysis(pending, params.buffer, params.fileType));
  return pending;
}

function enqueue(job: () => Promise<void>) {
  queue.push(job);
  drain();
}

function drain() {
  while (running < MAX_CONCURRENT_JOBS && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      drain();
    });
  }
}

async function runAnalysis(initial: AgreementAnalysis, buffer: Buffer, fileType: DetectedFileType) {
  const lang = initial.language?.explanation ?? "en";
  let current = initial;
  let lastSave = 0;
  let saveChain: Promise<void> = Promise.resolve();

  const update = (progress: AnalysisProgress, patch: Partial<AgreementAnalysis> = {}, force = false) => {
    const stageChanged = progress.stage !== current.progress?.stage;
    current = { ...current, ...patch, progress, updatedAt: new Date().toISOString() };
    // Throttle progress writes; stage changes are always saved. Saves run in order so an older
    // progress snapshot can never overwrite a newer one.
    if (force || stageChanged || Date.now() - lastSave > 700) {
      lastSave = Date.now();
      const snapshot = current;
      saveChain = saveChain.catch(() => undefined).then(() => saveAgreement(snapshot));
    }
    return saveChain;
  };

  try {
    await update({ stage: "reading", percent: 3, message: "Reading document" }, {}, true);

    const extraction = await extractDocument(buffer, fileType, (stage, pct, message) => {
      void update({ stage, percent: 3 + Math.round(pct * 0.52), message });
    }, initial.language?.document);
    if (!extraction.index.text.trim()) {
      throw new UserFacingError("No readable text was found. Try a clearer scan or photo with good lighting.");
    }
    if (extraction.displayFile) await saveDocumentFile(current.id, extraction.displayFile.buffer);

    await update(
      { stage: "segmenting", percent: 58, message: "Splitting the agreement into clauses" },
      { extractedText: extraction.index.text, ocr: extraction.metadata, document: extraction.document, securityFlags: extraction.securityFlags },
      true
    );

    const rawClauses = segmentClauses(extraction.index.text);

    // Embedding the document is independent of classifying it, so it runs alongside and is
    // collected at the end rather than adding its own wait to the upload.
    const indexing = buildSemanticIndex(current.id, extraction.index.text);

    await update({ stage: "classifying", percent: 64, message: `Checking ${rawClauses.length} clauses for risk` }, {}, true);
    const partials = rawClauses.map((raw) => {
      const words = wordsInRange(extraction.index, raw.start, raw.end);
      const layoutFlags = words.filter((w) => w.fontSize !== undefined && w.fontSize < 4).length >= 3 ? ["hidden-tiny-text"] : [];
      return buildClauseAnalysis(raw, highlightsForRange(extraction.index, raw.start, raw.end), layoutFlags);
    });

    const enriched: ClauseAnalysis[] = [];
    const batchSize = 5;
    for (let i = 0; i < partials.length; i += batchSize) {
      const batch = partials.slice(i, i + batchSize);
      enriched.push(...(await Promise.all(batch.map((p) => enrichClauseWithAI(p, lang)))));
      await update({
        stage: "explaining",
        percent: 68 + Math.round((enriched.length / Math.max(1, partials.length)) * 26),
        message: `Explaining clauses (${enriched.length}/${partials.length})`,
      });
    }

    const scores = computeAgreementScores(enriched);
    const securityFlags = [...new Set([...extraction.securityFlags, ...enriched.flatMap((c) => c.flags.filter(isSecurityFlag))])];
    const documentCheck = checkDocument(extraction.index.text);
    // The kind of agreement is only meaningful once it is established that this is one at all.
    if (documentCheck.isAgreement) {
      const kind = await classifyDocumentType(extraction.index.text);
      documentCheck.agreementKind = kind.label;
      documentCheck.agreementKindConfidence = kind.confidence;
    }
    const { summary, negotiationSuggestions, futureCostPrediction } = documentCheck.isAgreement
      ? await generateAgreementSummary(enriched, scores, lang, securityFlags.length > 0)
      : templateSummary(enriched, scores, lang, securityFlags.length > 0, false);

    await update(
      { stage: "done", percent: 100, message: "Analysis complete" },
      {
        status: "completed",
        clauses: enriched,
        scores,
        summary,
        loanTerms: extractLoanTerms(extraction.index.text),
        documentCheck,
        analysisVersion: ANALYSIS_VERSION,
        semanticChunks: await indexing,
        negotiationSuggestions,
        futureCostPrediction,
        deadlines: extractDeadlines(extraction.index.text),
        securityFlags,
        riskCounts: {
          safe: enriched.filter((c) => c.riskLevel === "safe").length,
          caution: enriched.filter((c) => c.riskLevel === "caution").length,
          high: enriched.filter((c) => c.riskLevel === "high").length,
        },
      },
      true
    );
  } catch (error) {
    console.error(`Analysis ${current.id} failed`, error);
    const message = error instanceof UserFacingError || error instanceof UnreadableDocumentError ? error.message : "We could not analyze this document. Please try another file.";
    await update({ stage: "failed", percent: 100, message }, { status: "failed", summary: message }, true).catch(() => undefined);
  }
}

class UserFacingError extends Error {}

function isSecurityFlag(flag: string) {
  return flag === "prompt-injection-attempt" || flag === "hidden-tiny-text";
}

function extractDeadlines(text: string): string[] {
  const matches = text.match(/\b(?:within|by|before|no later than)\s+\d+\s+(?:days?|months?|years?)\b/gi);
  return [...new Set(matches || [])].slice(0, 10);
}

export { classifyClause };

/**
 * Loads an agreement for its owner. Analyses saved by an older version of the risk rules are
 * re-classified from their stored text and saved, so improvements reach existing uploads too.
 */
export async function getFreshAgreement(id: string, userId: string): Promise<AgreementAnalysis | null> {
  const stored = await getAgreementForUser(id, userId);
  if (!stored) return null;
  const refreshed = refreshAnalysis(stored);
  if (!refreshed) return stored;
  await saveAgreement(refreshed);
  return refreshed;
}

export function refreshAnalysis(agreement: AgreementAnalysis): AgreementAnalysis | null {
  if (agreement.status !== "completed" || (agreement.analysisVersion ?? 1) >= ANALYSIS_VERSION) return null;
  const lang = agreement.language?.explanation ?? "en";

  const clauses = agreement.clauses.map((clause) => {
    const result = classifyClause(clause.text, clause.flags.filter((f) => f === "hidden-tiny-text"));
    const changed = result.riskLevel !== clause.riskLevel || result.category !== clause.category;
    // Keep AI-written explanations when the verdict is unchanged; otherwise explain the new verdict.
    return {
      ...clause,
      ...result,
      ...(changed || !process.env.OPENAI_API_KEY ? templateExplanation(clause.text, result.riskLevel, result.category, lang) : {}),
    };
  });
  const scores = computeAgreementScores(clauses);

  return {
    ...agreement,
    clauses,
    scores,
    ...templateSummary(clauses, scores, lang, agreement.securityFlags.length > 0, checkDocument(agreement.extractedText).isAgreement),
    riskCounts: {
      safe: clauses.filter((c) => c.riskLevel === "safe").length,
      caution: clauses.filter((c) => c.riskLevel === "caution").length,
      high: clauses.filter((c) => c.riskLevel === "high").length,
    },
    documentCheck: checkDocument(agreement.extractedText),
    analysisVersion: ANALYSIS_VERSION,
    updatedAt: new Date().toISOString(),
  };
}
