import path from "path";

export const isProduction = process.env.NODE_ENV === "production";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "..", "..", ".data"));

export const limits = {
  maxUploadBytes: 20 * 1024 * 1024,
  maxPdfPages: Number(process.env.MAX_PDF_PAGES || 40),
  maxOcrPages: Number(process.env.MAX_OCR_PAGES || 15),
  maxImagePixels: 50_000_000,
};

/** Tesseract languages, e.g. "eng" or "eng+hin". Extra languages are downloaded on first use. */
export const OCR_LANGS = process.env.OCR_LANGS || "eng";

export const isClerkEnabled = Boolean(process.env.CLERK_SECRET_KEY);

/** Refuse to boot a production server with insecure defaults. */
export function assertProductionConfig() {
  if (!isProduction) return;
  const missing = ["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "DATA_ENCRYPTION_KEY", "FRONTEND_URL"].filter(
    (name) => !process.env[name]
  );
  if (missing.length) {
    throw new Error(`Missing required production configuration: ${missing.join(", ")}`);
  }
}

/**
 * Public demo without accounts: every visitor gets a signed guest session and only sees their own
 * documents. Used when sharing the app via a public link without Clerk configured.
 */
export const isGuestMode = process.env.GUEST_MODE === "true";
