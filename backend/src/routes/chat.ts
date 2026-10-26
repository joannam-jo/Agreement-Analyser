import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getFreshAgreement } from "../services/analysisPipeline.service";
import { rateLimit } from "express-rate-limit";
import { chatAboutAgreement } from "../services/aiExplanation.service";
import { querySemanticIndex } from "../services/semanticIndex.service";
import { AppError } from "../middleware/errorHandler";

const chatSchema = z.object({
  agreementId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
  language: z.enum(["en", "hi"]).default("en"),
});

/** Each chat message costs an AI call; cap it per user. */
const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId || "anonymous",
  message: { error: "Chat limit reached. Please try again later." },
});

export const chatRouter = Router();

chatRouter.post("/", requireAuth, chatLimiter, async (req: AuthRequest, res, next) => {
  try {
    const body = chatSchema.parse(req.body);
    const agreement = await getFreshAgreement(body.agreementId, req.userId!);
    if (!agreement || agreement.status !== "completed") throw new AppError(404, "Agreement not found");

    const question = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    /*
     * Retrieval is hybrid, because the two halves answer different questions.
     *
     * Semantic search finds the passages that are actually about what was asked, including parts of
     * the agreement the rules never flagged — "who insures the vehicle?" matches nothing in the risk
     * set but is answerable from the document. The risk-classified clauses carry the analysis the
     * rules produced, which no amount of similarity search would reconstruct.
     *
     * Supplying both means the answer can be specific to the question and still grounded in the
     * project's own classification.
     */
    const retrieved = await querySemanticIndex(agreement.id, question, 5);

    const context = [
      agreement.summary,
      `Scores: trust ${agreement.scores.trustScore}, consumer friendliness ${agreement.scores.consumerFriendliness}, overall risk ${agreement.scores.overallRisk}`,
      `Deadlines: ${agreement.deadlines.join(", ") || "none detected"}`,
      ...retrieved.map((chunk, i) =>
        [`Retrieved passage ${i + 1} (similarity ${chunk.score.toFixed(2)}):`, chunk.text].join("\n")
      ),
      ...agreement.clauses
        .filter((c) => c.riskLevel !== "safe")
        .slice(0, 10)
        .map((c) => [
          `Clause: ${c.heading || c.category}`,
          `Risk: ${c.riskLevel}; confidence ${Math.round(c.confidence * 100)}%; impact ${c.financialImpact}`,
          `Why: ${c.whyFlagged}`,
          `Text: ${c.text.slice(0, 500)}`,
        ].join("\n")),
    ].join("\n");

    const reply = await chatAboutAgreement(agreement, context, body.messages, body.language, retrieved);
    res.json({
      message: {
        role: "assistant" as const,
        content: reply,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    next(e);
  }
});
