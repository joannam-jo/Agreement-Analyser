import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { rateLimit } from "express-rate-limit";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

/**
 * Reports how the project's learned components score.
 *
 * The figures are produced offline by `npm run evaluate` and read from disk here, because
 * cross-validation embeds every labelled example and is far too slow to run per request. They
 * describe the models, not any user's document, so nothing here is sensitive — but the route still
 * requires a session, so that the application has no unauthenticated surface at all.
 */

const METRICS_FILE = path.resolve(__dirname, "..", "..", "ml-metrics.json");

const metricsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId || "anonymous",
});

export const mlRouter = Router();

mlRouter.get("/metrics", requireAuth, metricsLimiter, async (_req: AuthRequest, res, next) => {
  try {
    const raw = await fs.readFile(METRICS_FILE, "utf8").catch(() => null);
    if (!raw) throw new AppError(503, "Model metrics have not been generated yet. Run: npm run evaluate");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json(JSON.parse(raw));
  } catch (e) {
    next(e);
  }
});
