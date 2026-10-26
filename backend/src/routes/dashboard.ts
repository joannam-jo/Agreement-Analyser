import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { listAgreementsByUser } from "../services/storage.service";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const agreements = await listAgreementsByUser(req.userId!);
    // Documents that are not agreements have no meaningful risk score.
    const completed = agreements.filter((a) => a.status === "completed" && a.documentCheck?.isAgreement !== false);

    const totalHigh = completed.reduce((s, a) => s + a.riskCounts.high, 0);
    const avgTrust =
      completed.length > 0
        ? Math.round(completed.reduce((s, a) => s + a.scores.trustScore, 0) / completed.length)
        : 0;

    const riskTrend = completed.slice(0, 6).map((a) => ({
      date: a.createdAt.split("T")[0],
      overallRisk: a.scores.overallRisk,
      trustScore: a.scores.trustScore,
      fileName: a.fileName,
    }));

    res.json({
      totalDocuments: agreements.length,
      analyzedCount: completed.length,
      totalHighRiskClauses: totalHigh,
      averageTrustScore: avgTrust,
      riskTrend,
      recentUploads: completed.slice(0, 5).map((a) => ({
        id: a.id,
        fileName: a.fileName,
        trustScore: a.scores.trustScore,
        riskCounts: a.riskCounts,
        createdAt: a.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});
