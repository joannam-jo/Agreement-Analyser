import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";

/** Errors whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Invalid request." });
  }
  if (err instanceof MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 20 MB)." : "Invalid upload.";
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: message });
  }
  if ((err as { type?: string }).type === "entity.too.large") {
    return res.status(413).json({ error: "Request is too large." });
  }

  // Unexpected error: log the details server-side, return only a reference id.
  const errorId = crypto.randomUUID();
  console.error(`[error ${errorId}]`, err);
  res.status(500).json({ error: "Something went wrong. Please try again.", errorId });
}
