import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { isClerkEnabled, isGuestMode, isProduction } from "../lib/config";
import { verifyGuestToken } from "../lib/guestSession";

export interface AuthRequest extends Request {
  userId?: string;
}

/** Single local user for development without Clerk or guest mode. Never used in production. */
export const LOCAL_DEV_USER = "local-dev-user";

/**
 * The user id always comes from a token whose signature the backend verifies: a Clerk session
 * token, or a signed guest token in public demo mode. Client-supplied ids are never trusted.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (isClerkEnabled) {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Please sign in to continue." });
    req.userId = userId;
    return next();
  }

  const bearer = req.headers.authorization?.match(/^Bearer\s+(\S+)$/)?.[1];
  const guestId = bearer ? verifyGuestToken(bearer) : null;
  if (guestId) {
    req.userId = guestId;
    return next();
  }
  if (isGuestMode) return res.status(401).json({ error: "Your session has expired. Please reload the page." });

  if (isProduction) return res.status(401).json({ error: "Authentication is not configured." });
  req.userId = LOCAL_DEV_USER;
  next();
}
