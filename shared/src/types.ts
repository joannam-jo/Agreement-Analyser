export type RiskLevel = "safe" | "caution" | "high";

export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClausePosition {
  page: number;
  textStart: number;
  textEnd: number;
  heading?: string;
  boundingBox?: BoundingBox;
}

export interface OcrMetadata {
  method: string;
  confidence: number;
  pageCount?: number;
  warnings: string[];
  /** Per-page extraction details (text layer vs OCR, confidence). */
  pages?: { page: number; source: "text-layer" | "ocr" | "plain-text"; confidence: number }[];
}

export type DocumentKind = "pdf" | "image" | "text" | "word";

export interface DocumentInfo {
  kind: DocumentKind;
  pageCount: number;
  /** Page sizes (points for PDFs, pixels for images); used to keep highlight aspect ratios. */
  pages: { page: number; width: number; height: number }[];
  /** True when an encrypted copy of the document is stored and can be streamed to the viewer. */
  hasFile: boolean;
  displayMimeType?: string;
}

export interface AnalysisProgress {
  stage: "queued" | "reading" | "ocr" | "segmenting" | "classifying" | "explaining" | "done" | "failed";
  percent: number;
  message: string;
}

export interface ClauseAnalysis {
  id: string;
  text: string;
  heading?: string;
  riskLevel: RiskLevel;
  confidence: number;
  category: string;
  flags: string[];
  financialImpactAmount?: number;
  plainEnglish: string;
  whyFlagged: string;
  financialImpact: string;
  predictedConsequences: string[];
  recommendedActions: string[];
  avoidActions: string[];
  /** Union box on the clause's first page (kept for older clients). */
  boundingBox?: BoundingBox;
  /** Exact per-line highlight rectangles, possibly spanning several pages. Coordinates are 0..1. */
  highlights?: BoundingBox[];
  position?: ClausePosition;
  similarityScore?: number;
}

/** Languages the explanations, chat and voice can use. */
export type ExplanationLanguage = "en" | "hi";

/** Tesseract language codes offered for reading documents. English is always included. */
export type DocumentLanguage = "eng" | "hin" | "ben" | "tam" | "tel" | "mar" | "guj" | "kan" | "mal";

export interface LoanTerms {
  lenderName?: string;
  principal?: number;
  /** Nominal annual interest rate, percent. */
  annualRatePct?: number;
  tenureMonths?: number;
  /** Fees charged upfront or deducted from the disbursed amount. */
  upfrontFees?: number;
  /** Late payment penalty, percent per month. */
  latePenaltyMonthlyPct?: number;
  currency: "INR" | "USD" | "OTHER";
  /** The sentence each value was read from, so users can check it. */
  sources: Partial<Record<"lenderName" | "principal" | "annualRatePct" | "tenureMonths" | "upfrontFees" | "latePenaltyMonthlyPct", string>>;
}

/** The kind of agreement, as predicted by the document-type classifier. */
export type AgreementKind = "personal-loan" | "education-loan" | "lease" | "credit-card" | "unknown";

export interface DocumentCheck {
  isAgreement: boolean;
  confidence: number;
  /** "agreement", or what it looks like instead (e.g. a project report). */
  documentType: "agreement" | "report" | "too-short" | "other";
  /** Contract features that were found, e.g. "names the parties". */
  signals: string[];
  /** Which kind of agreement it is; only meaningful when isAgreement is true. */
  agreementKind?: AgreementKind;
  /** Confidence of the agreementKind prediction, 0..1. */
  agreementKindConfidence?: number;
}

export interface AgreementScores {
  trustScore: number;
  consumerFriendliness: number;
  transparency: number;
  overallRisk: number;
}

export interface AgreementAnalysis {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  status: "processing" | "completed" | "failed";
  progress?: AnalysisProgress;
  document?: DocumentInfo;
  /** Document-level manipulation signals, e.g. hidden tiny text or AI prompt-injection attempts. */
  securityFlags: string[];
  language?: { document: DocumentLanguage; explanation: ExplanationLanguage };
  loanTerms?: LoanTerms;
  /** Whether the document is actually an agreement; risk scoring only makes sense for agreements. */
  documentCheck?: DocumentCheck;
  /** Version of the risk rules that produced this analysis; older analyses are re-checked on read. */
  analysisVersion?: number;
  /** Number of passages embedded for semantic retrieval; 0 when the embedding model was unavailable. */
  semanticChunks?: number;
  extractedText: string;
  ocr?: OcrMetadata;
  clauses: ClauseAnalysis[];
  scores: AgreementScores;
  summary: string;
  negotiationSuggestions: string[];
  futureCostPrediction?: string;
  deadlines: string[];
  riskCounts: { safe: number; caution: number; high: number };
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface CompareResult {
  agreementA: AgreementAnalysis;
  agreementB: AgreementAnalysis;
  comparison: {
    trustDelta: number;
    riskDelta: number;
    saferAgreement: "a" | "b" | "tie";
    keyDifferences: string[];
  };
}

export interface UploadResponse {
  agreementId: string;
  status: string;
  message: string;
}
