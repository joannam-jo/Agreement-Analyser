import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createGuestSession } from "../lib/guestSession";
import { isGuestMode } from "../lib/config";
import { AppError } from "../middleware/errorHandler";

export const sessionRouter = Router();

const guestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many new sessions. Please try again later." },
});

/** Issues a private guest session for the public demo (only when GUEST_MODE is on). */
sessionRouter.post("/guest", guestLimiter, (_req, res, next) => {
  try {
    if (!isGuestMode) throw new AppError(404, "Not found");
    res.json(createGuestSession());
  } catch (e) {
    next(e);
  }
});
