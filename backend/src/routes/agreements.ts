import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getFreshAgreement, startAgreementAnalysis } from "../services/analysisPipeline.service";
import {
  deleteAgreementForUser,
  getAgreementForUser,
  listAgreementsByUser,
  readDocumentFile,
} from "../services/storage.service";
import { AppError } from "../middleware/errorHandler";
import { detectFileType, type DetectedFileType } from "../lib/fileType";
import { limits } from "../lib/config";
import { z } from "zod";
import { localizeAgreement } from "../services/explanations";
import { extractLoanTerms } from "../services/loanTerms.service";

const uploadOptions = z.object({
  documentLanguage: z.enum(["eng", "hin", "ben", "tam", "tel", "mar", "guj", "kan", "mal"]).default("eng"),
  explanationLanguage: z.enum(["en", "hi"]).default("en"),
});

export const langQuery = z.object({ lang: z.enum(["en", "hi"]).optional() });

const ALLOWED_EXTENSIONS = /\.(pdf|docx?|png|jpe?g|webp|tiff?|txt)$/i;

const MIME_BY_TYPE: Record<DetectedFileType, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  tiff: "image/tiff",
  text: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: limits.maxUploadBytes, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    // Cheap early rejection by name; the real check is on the file's bytes after upload.
    if (ALLOWED_EXTENSIONS.test(file.originalname)) cb(null, true);
    else cb(new AppError(415, "Unsupported file type. Upload a PDF, Word (.docx/.doc), image (PNG/JPG/WEBP/TIFF) or .txt file."));
  },
});

/** Uploads are expensive (OCR + AI), so they get a tighter per-user limit. */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId || "anonymous",
  message: { error: "Upload limit reached. Please try again later." },
});

export const agreementsRouter = Router();

agreementsRouter.post("/upload", requireAuth, uploadLimiter, upload.single("file"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");

    const fileType = detectFileType(req.file.buffer);
    if (!fileType) {
      throw new AppError(415, "This file's contents are not a supported PDF, Word, image or text document.");
    }

    const options = uploadOptions.parse(req.body ?? {});
    const agreement = await startAgreementAnalysis({
      ...options,
      userId: req.userId!,
      fileName: sanitizeFileName(req.file.originalname),
      buffer: req.file.buffer,
      fileType,
      mimeType: MIME_BY_TYPE[fileType],
    });

    res.status(202).json({ agreementId: agreement.id, status: agreement.status });
  } catch (e) {
    next(e);
  }
});

agreementsRouter.get("/", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const list = await listAgreementsByUser(req.userId!);
    // The list view does not need full text; keep responses small.
    res.json({ agreements: list.map(({ extractedText: _t, ...rest }) => ({ ...rest, extractedText: "" })) });
  } catch (e) {
    next(e);
  }
});

agreementsRouter.get("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const stored = await getFreshAgreement(String(req.params.id), req.userId!);
    if (!stored) throw new AppError(404, "Agreement not found");
    const { lang } = langQuery.parse(req.query);
    const agreement = lang ? localizeAgreement(stored, lang) : stored;
    // Re-extracted on every read (it is cheap), so older analyses benefit from extractor improvements.
    if (agreement.status === "completed") agreement.loanTerms = extractLoanTerms(agreement.extractedText);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ agreement });
  } catch (e) {
    next(e);
  }
});

/** Streams the decrypted document to its owner for the viewer. */
agreementsRouter.get("/:id/file", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const agreement = await getAgreementForUser(String(req.params.id), req.userId!);
    if (!agreement?.document?.hasFile) throw new AppError(404, "Document not found");

    const file = await readDocumentFile(agreement.id);
    if (!file) throw new AppError(404, "Document not found");

    const mimeType = agreement.document.displayMimeType || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="document.${mimeType === "application/pdf" ? "pdf" : "jpg"}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.send(file);
  } catch (e) {
    next(e);
  }
});

/** Permanently deletes the analysis and the stored document. */
agreementsRouter.delete("/:id", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const deleted = await deleteAgreementForUser(String(req.params.id), req.userId!);
    if (!deleted) throw new AppError(404, "Agreement not found");
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "document";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document";
}
