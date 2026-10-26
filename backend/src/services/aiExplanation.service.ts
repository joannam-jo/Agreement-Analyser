import OpenAI from "openai";
import type { AgreementAnalysis, ClauseAnalysis, ExplanationLanguage } from "@faa/shared";
import { answerFromAnalysis, type RetrievedRange } from "./chatFallback.service";
import { templateExplanation, templateSummary } from "./explanations";
import { asUntrustedDocument, cleanString, cleanStringArray, UNTRUSTED_DOCUMENT_RULE } from "../lib/privacy";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const LANGUAGE_NAME: Record<ExplanationLanguage, string> = { en: "English", hi: "Hindi (Devanagari script)" };

function languageRule(lang: ExplanationLanguage): string {
  return `Write every value in simple ${LANGUAGE_NAME[lang]} that a first-time borrower understands.`;
}

export async function enrichClauseWithAI(partial: Partial<ClauseAnalysis>, lang: ExplanationLanguage = "en"): Promise<ClauseAnalysis> {
  const base = partial as ClauseAnalysis;
  const fallback = templateExplanation(base.text, base.riskLevel, base.category, lang);
  if (!openai) return { ...base, ...fallback };

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You are a financial agreement risk analyst writing for an ordinary consumer. ${UNTRUSTED_DOCUMENT_RULE} ` +
            `Respond in JSON with keys: plainEnglish, whyFlagged, financialImpact (strings), predictedConsequences, recommendedActions, avoidActions (arrays of short strings). ` +
            `${languageRule(lang)} Our classifier rated this clause "${base.riskLevel}" risk, category "${base.category}".`,
        },
        { role: "user", content: asUntrustedDocument(base.text.slice(0, 1500)) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      // Only explanation text is taken from the model. Risk level, scores, ids and positions
      // always come from our own pipeline, so a document cannot talk its way to "safe".
      return {
        ...base,
        plainEnglish: cleanString(parsed.plainEnglish, 600) ?? fallback.plainEnglish,
        whyFlagged: cleanString(parsed.whyFlagged, 600) ?? fallback.whyFlagged,
        financialImpact: cleanString(parsed.financialImpact, 400) ?? fallback.financialImpact,
        predictedConsequences: cleanStringArray(parsed.predictedConsequences, 5, 200) ?? fallback.predictedConsequences,
        recommendedActions: cleanStringArray(parsed.recommendedActions, 5, 200) ?? fallback.recommendedActions,
        avoidActions: cleanStringArray(parsed.avoidActions, 5, 200) ?? fallback.avoidActions,
      };
    }
  } catch (e) {
    console.warn("OpenAI enrichment failed, using fallback", e);
  }
  return { ...base, ...fallback };
}

export async function generateAgreementSummary(
  clauses: ClauseAnalysis[],
  scores: { trustScore: number; overallRisk: number },
  lang: ExplanationLanguage = "en",
  hasSecurityFlags = false
): Promise<{ summary: string; negotiationSuggestions: string[]; futureCostPrediction: string }> {
  const fallback = templateSummary(clauses, scores, lang, hasSecurityFlags);
  if (!openai) return fallback;

  const highRisk = clauses.filter((c) => c.riskLevel === "high");
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Summarize agreement risks for a consumer. ${UNTRUSTED_DOCUMENT_RULE} ${languageRule(lang)} ` +
            `JSON: summary, negotiationSuggestions (array), futureCostPrediction (string).`,
        },
        {
          role: "user",
          content: JSON.stringify({
            trustScore: scores.trustScore,
            highRiskCount: highRisk.length,
            documentHidesText: hasSecurityFlags,
            samples: highRisk.slice(0, 5).map((c) => asUntrustedDocument(c.text.slice(0, 200))),
          }),
        },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}") as Record<string, unknown>;
    return {
      summary: cleanString(parsed.summary, 800) ?? fallback.summary,
      negotiationSuggestions: cleanStringArray(parsed.negotiationSuggestions, 6, 240) ?? fallback.negotiationSuggestions,
      futureCostPrediction: cleanString(parsed.futureCostPrediction, 400) ?? fallback.futureCostPrediction,
    };
  } catch {
    return fallback;
  }
}

export async function chatAboutAgreement(
  agreement: AgreementAnalysis,
  agreementContext: string,
  messages: { role: "user" | "assistant"; content: string }[],
  lang: ExplanationLanguage = "en",
  /** Passages from semantic retrieval, used by the no-model path to choose the clause to quote. */
  retrieved: RetrievedRange[] = []
): Promise<string> {
  const question = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!openai || agreement.documentCheck?.isAgreement === false) {
    return answerFromAnalysis(agreement, question, lang, retrieved);
  }

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: [
            "You are a helpful financial agreement assistant. Use only the agreement context.",
            "Be direct about risk, negotiability, cancellation consequences, hidden catches, and user actions.",
            "Keep answers short: a direct answer first, then at most 4 bullet points. Use **bold** for clause names.",
            `Reply in ${LANGUAGE_NAME[lang]}. This is not legal advice. ${UNTRUSTED_DOCUMENT_RULE}`,
            asUntrustedDocument(agreementContext.slice(0, 10000)),
          ].join("\n"),
        },
        ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      ],
    });
    return response.choices[0]?.message?.content || answerFromAnalysis(agreement, question, lang, retrieved);
  } catch (e) {
    console.warn("OpenAI chat failed, answering from the analysis instead", e);
    return answerFromAnalysis(agreement, question, lang, retrieved);
  }
}
