import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getFreshAgreement } from "../services/analysisPipeline.service";
import { AppError } from "../middleware/errorHandler";
import { localizeAgreement } from "../services/explanations";
import { langQuery } from "./agreements";

export const analysisRouter = Router();

analysisRouter.get("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const agreement = await getFreshAgreement(String(req.params.id), req.userId!);
    if (!agreement) throw new AppError(404, "Analysis not found");

    res.json({
      id: agreement.id,
      status: agreement.status,
      progress: agreement.progress,
      scores: agreement.scores,
      clauses: agreement.clauses,
      summary: agreement.summary,
      riskCounts: agreement.riskCounts,
      negotiationSuggestions: agreement.negotiationSuggestions,
      futureCostPrediction: agreement.futureCostPrediction,
      deadlines: agreement.deadlines,
    });
  } catch (e) {
    next(e);
  }
});

analysisRouter.get("/:id/warnings", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const stored = await getFreshAgreement(String(req.params.id), req.userId!);
    if (!stored) throw new AppError(404, "Not found");
    const { lang } = langQuery.parse(req.query);
    const agreement = lang ? localizeAgreement(stored, lang) : stored;

    const highRisk = agreement.clauses.filter((c) => c.riskLevel === "high");
    // Risk warnings only make sense for real agreements; hidden-text tricks are reported regardless.
    const isAgreement = agreement.documentCheck?.isAgreement !== false;
    const shouldWarn =
      agreement.securityFlags.length > 0 || (isAgreement && (highRisk.length >= 2 || agreement.scores.trustScore < 50));

    res.json({
      showBeforeYouSign: shouldWarn,
      warnings: highRisk.slice(0, 5).map((c) => ({
        id: c.id,
        category: c.category,
        plainEnglish: c.plainEnglish,
        confidence: c.confidence,
      })),
      trustScore: agreement.scores.trustScore,
    });
  } catch (e) {
    next(e);
  }
});
