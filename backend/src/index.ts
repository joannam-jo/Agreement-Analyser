import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { agreementsRouter } from "./routes/agreements";
import { analysisRouter } from "./routes/analysis";
import { chatRouter } from "./routes/chat";
import { compareRouter } from "./routes/compare";
import { dashboardRouter } from "./routes/dashboard";
import { sessionRouter } from "./routes/session";
import { mlRouter } from "./routes/ml";
import { billingRouter } from "./routes/billing";
import { errorHandler } from "./middleware/errorHandler";
import { assertProductionConfig, isClerkEnabled, isProduction } from "./lib/config";
import { failInterruptedAnalyses } from "./services/storage.service";
import { warmUpEmbeddings } from "./services/embedding.service";
import { shutdownOcr } from "./services/ocr.service";

assertProductionConfig();

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.disable("x-powered-by");
// Behind a proxy (hosting platform, or the web app forwarding /api), use the real client IP for rate limits.
app.set("trust proxy", isProduction ? 1 : "loopback");

app.use(
  helmet({
    // The API is called cross-origin by the frontend with a bearer token (no cookies).
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
  })
);

if (isClerkEnabled) {
  app.use(clerkMiddleware({ authorizedParties: [FRONTEND_URL] }));
} else {
  console.warn("[security] CLERK_SECRET_KEY not set - running in single-user local development mode.");
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/agreements", agreementsRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/chat", chatRouter);
app.use("/api/compare", compareRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/session", sessionRouter);
app.use("/api/ml", mlRouter);
app.use("/api/billing", billingRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

failInterruptedAnalyses()
  .catch((e) => console.warn("Could not clean up interrupted analyses", e))
  .finally(() => {
    const server = app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
      // Loading the embedding model takes a few seconds the first time. Doing it now rather than
      // on the first upload keeps that cost off the user's first analysis.
      void warmUpEmbeddings();
    });
    const shutdown = () => {
      server.close();
      shutdownOcr().finally(() => process.exit(0));
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  });
