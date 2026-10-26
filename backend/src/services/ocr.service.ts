import path from "path";
import { pathToFileURL } from "url";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import vision from "@google-cloud/vision";
import type { DocumentInfo, DocumentLanguage, OcrMetadata } from "@faa/shared";
import { DATA_DIR, limits, OCR_LANGS } from "../lib/config";
import type { DetectedFileType } from "../lib/fileType";
import { extractDoc, extractDocx } from "./wordDocument.service";
import {
  buildTextIndex,
  clampBox,
  groupWordsIntoLines,
  type LayoutLine,
  type LayoutPage,
  type LayoutWord,
  type TextIndex,
} from "./documentLayout";

export interface ExtractionResult {
  index: TextIndex;
  pages: LayoutPage[];
  metadata: OcrMetadata;
  document: DocumentInfo;
  /** The file the viewer should display (original PDF, or an upright, resized image). */
  displayFile?: { buffer: Buffer; mimeType: string };
  /** Document-level manipulation signals found while reading the layout. */
  securityFlags: string[];
}

export type ProgressFn = (stage: "reading" | "ocr", percent: number, message: string) => void;

const TINY_FONT_PT = 4;
const MIN_TEXT_LAYER_CHARS = 25;

export async function extractDocument(
  buffer: Buffer,
  fileType: DetectedFileType,
  onProgress: ProgressFn = () => {},
  language?: DocumentLanguage
): Promise<ExtractionResult> {
  const langs = ocrLanguages(language);
  if (fileType === "text") return extractPlainText(buffer);
  if (fileType === "docx" || fileType === "doc") return extractWord(buffer, fileType);
  if (fileType === "pdf") return extractPdf(buffer, onProgress, langs);
  return extractImage(buffer, onProgress, langs);
}

/* ------------------------------------------------------------------ */
/* Plain text                                                          */
/* ------------------------------------------------------------------ */

function extractPlainText(buffer: Buffer): ExtractionResult {
  const text = buffer.toString("utf8").replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  return {
    index: { text, words: [] },
    pages: [],
    metadata: {
      method: "plain-text",
      confidence: 1,
      pageCount: 1,
      warnings: text ? [] : ["The uploaded text file was empty."],
      pages: [{ page: 1, source: "plain-text", confidence: 1 }],
    },
    document: { kind: "text", pageCount: 1, pages: [], hasFile: false },
    securityFlags: [],
  };
}

/* ------------------------------------------------------------------ */
/* Word (.docx / .doc)                                                 */
/* ------------------------------------------------------------------ */

async function extractWord(buffer: Buffer, fileType: "docx" | "doc"): Promise<ExtractionResult> {
  const { text, securityFlags, warnings } = fileType === "docx" ? await extractDocx(buffer) : await extractDoc(buffer);
  if (!text) warnings.push("The Word document contains no text.");
  return {
    index: { text, words: [] },
    pages: [],
    metadata: {
      method: fileType === "docx" ? "word (.docx)" : "word (.doc)",
      confidence: 1,
      pageCount: 1,
      warnings,
      pages: [{ page: 1, source: "plain-text", confidence: 1 }],
    },
    document: { kind: "word", pageCount: 1, pages: [], hasFile: false },
    securityFlags,
  };
}

/* ------------------------------------------------------------------ */
/* PDF: exact text layer, OCR only for pages that are scanned images   */
/* ------------------------------------------------------------------ */

// pdfjs-dist v5 is ESM-only; this keeps TypeScript's CommonJS output from turning import() into require().
const importEsm = new Function("specifier", "return import(specifier)") as (s: string) => Promise<any>;
let pdfjsPromise: Promise<any> | null = null;

function loadPdfjs() {
  pdfjsPromise ??= importEsm(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
  return pdfjsPromise;
}

function pdfjsAssetDir(sub: string): string {
  return path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), sub).replace(/\\/g, "/") + "/";
}

async function extractPdf(buffer: Buffer, onProgress: ProgressFn, langs: string): Promise<ExtractionResult> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: pdfjsAssetDir("standard_fonts"),
    cMapUrl: pdfjsAssetDir("cmaps"),
    cMapPacked: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;

  try {
    const warnings: string[] = [];
    const securityFlags = new Set<string>();
    const totalPages: number = doc.numPages;
    const pageCount = Math.min(totalPages, limits.maxPdfPages);
    if (totalPages > pageCount) {
      warnings.push(`Only the first ${pageCount} of ${totalPages} pages were analyzed.`);
    }

    const pages: LayoutPage[] = [];
    let ocrPagesUsed = 0;

    for (let n = 1; n <= pageCount; n++) {
      onProgress("reading", Math.round(((n - 1) / pageCount) * 100), `Reading page ${n} of ${pageCount}`);
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const lines = textItemsToLines(content.items, viewport, pdfjs.Util, n);

      const charCount = lines.reduce((sum, l) => sum + l.words.reduce((s, w) => s + w.text.length, 0), 0);
      if (charCount >= MIN_TEXT_LAYER_CHARS) {
        for (const flag of detectLayoutTricks(lines)) securityFlags.add(flag);
        pages.push({ page: n, width: viewport.width, height: viewport.height, source: "text-layer", confidence: 0.99, lines });
      } else if (ocrPagesUsed < limits.maxOcrPages) {
        // No usable text layer: this page is a scan. Render it and OCR the image.
        const message = `Scanning page ${n} of ${pageCount} (OCR)`;
        onProgress("ocr", Math.round(((n - 1) / pageCount) * 100), message);
        const png = await renderPdfPage(page);
        const ocr = await ocrImage(png, n, langs, (f) => onProgress("ocr", Math.round(((n - 1 + f) / pageCount) * 100), message));
        ocrPagesUsed++;
        pages.push({ ...ocr, width: viewport.width, height: viewport.height });
      } else {
        warnings.push(`Page ${n} looks scanned but the OCR page limit (${limits.maxOcrPages}) was reached.`);
        pages.push({ page: n, width: viewport.width, height: viewport.height, source: "ocr", confidence: 0, lines: [] });
      }
      page.cleanup();
    }

    const confidence = weightedConfidence(pages);
    warnings.push(...ocrWarnings(pages));
    const usedOcr = pages.some((p) => p.source === "ocr");
    const usedText = pages.some((p) => p.source === "text-layer");

    return {
      index: buildTextIndex(pages),
      pages,
      metadata: {
        method: usedOcr && usedText ? "pdf-text-layer+ocr" : usedOcr ? `pdf-ocr (${ocrEngineName(langs)})` : "pdf-text-layer",
        confidence,
        pageCount,
        warnings,
        pages: pages.map((p) => ({ page: p.page, source: p.source, confidence: p.confidence })),
      },
      document: {
        kind: "pdf",
        pageCount,
        pages: pages.map((p) => ({ page: p.page, width: p.width, height: p.height })),
        hasFile: true,
        displayMimeType: "application/pdf",
      },
      displayFile: { buffer, mimeType: "application/pdf" },
      securityFlags: [...securityFlags],
    };
  } finally {
    await loadingTask.destroy();
  }
}

interface TextRun {
  str: string;
  x: number;
  width: number;
  top: number;
  bottom: number;
  baseline: number;
  fontHeight: number;
}

interface PositionedChar {
  ch: string;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  fontHeight: number;
}

/** Convert pdf.js text items into lines of words with page-normalized boxes. */
function textItemsToLines(items: any[], viewport: any, Util: any, pageNumber: number): LayoutLine[] {
  const runs: TextRun[] = [];
  for (const item of items) {
    if (typeof item.str !== "string" || !item.str.length) continue;
    const tx = Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]) || item.height || 10;
    const width = item.width * viewport.scale;
    if (!width) continue;
    runs.push({
      str: item.str,
      x: tx[4],
      width,
      baseline: tx[5],
      top: tx[5] - fontHeight * 0.82,
      bottom: tx[5] + fontHeight * 0.22,
      fontHeight,
    });
  }

  // Group runs sharing a baseline into lines, top to bottom.
  runs.sort((a, b) => a.baseline - b.baseline || a.x - b.x);
  const grouped: TextRun[][] = [];
  for (const run of runs) {
    const line = grouped[grouped.length - 1];
    if (line && Math.abs(line[0].baseline - run.baseline) <= Math.min(line[0].fontHeight, run.fontHeight) * 0.45) {
      line.push(run);
    } else {
      grouped.push([run]);
    }
  }

  return grouped
    .map((lineRuns) => {
      lineRuns.sort((a, b) => a.x - b.x);
      const chars: PositionedChar[] = [];
      let prevEnd: number | null = null;
      for (const run of lineRuns) {
        const gap = prevEnd === null ? 0 : run.x - prevEnd;
        const last = chars[chars.length - 1];
        if (prevEnd !== null && gap > run.fontHeight * 0.18 && last && last.ch !== " ") {
          chars.push({ ch: " ", x0: prevEnd, x1: run.x, top: run.top, bottom: run.bottom, fontHeight: run.fontHeight });
        }
        const charWidth = run.width / run.str.length;
        [...run.str].forEach((ch, i) => {
          const x0 = run.x + i * charWidth;
          chars.push({ ch, x0, x1: x0 + charWidth, top: run.top, bottom: run.bottom, fontHeight: run.fontHeight });
        });
        prevEnd = run.x + run.width;
      }
      return { words: charsToWords(chars, viewport.width, viewport.height, pageNumber) };
    })
    .filter((line) => line.words.length > 0);
}

function charsToWords(chars: PositionedChar[], pageWidth: number, pageHeight: number, pageNumber: number): LayoutWord[] {
  const words: LayoutWord[] = [];
  let current: PositionedChar[] = [];
  const flush = () => {
    if (!current.length) return;
    const x0 = Math.min(...current.map((c) => c.x0));
    const x1 = Math.max(...current.map((c) => c.x1));
    const top = Math.min(...current.map((c) => c.top));
    const bottom = Math.max(...current.map((c) => c.bottom));
    const rawBox = { page: pageNumber, x: x0 / pageWidth, y: top / pageHeight, width: (x1 - x0) / pageWidth, height: (bottom - top) / pageHeight };
    const outside = rawBox.x > 1 || rawBox.y > 1 || rawBox.x + rawBox.width < 0 || rawBox.y + rawBox.height < 0;
    words.push({
      text: current.map((c) => c.ch).join(""),
      box: clampBox(rawBox),
      confidence: outside ? 0 : 0.99,
      fontSize: Math.min(...current.map((c) => c.fontHeight)),
    });
    current = [];
  };
  for (const c of chars) {
    if (/\s/.test(c.ch)) flush();
    else current.push(c);
  }
  flush();
  return words;
}

/** Text a human reader cannot see but software (including AI models) will read. */
function detectLayoutTricks(lines: LayoutLine[]): string[] {
  const flags: string[] = [];
  const words = lines.flatMap((l) => l.words);
  const tiny = words.filter((w) => w.fontSize !== undefined && w.fontSize < TINY_FONT_PT);
  if (tiny.length >= 3) flags.push("hidden-tiny-text");
  if (words.some((w) => w.confidence === 0)) flags.push("text-outside-page");
  return flags;
}

async function renderPdfPage(page: any): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const base = page.getViewport({ scale: 1 });
  // Roughly 200 DPI, capped so very large pages stay within memory limits.
  const scale = Math.min(200 / 72, 3000 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  return canvas.toBuffer("image/png");
}

/* ------------------------------------------------------------------ */
/* Images: straighten, clean up, OCR                                   */
/* ------------------------------------------------------------------ */

async function extractImage(buffer: Buffer, onProgress: ProgressFn, langs: string): Promise<ExtractionResult> {
  onProgress("ocr", 10, "Cleaning up the image for OCR");
  // Apply EXIF rotation so the stored image and the OCR coordinates share one orientation.
  const upright = await sharp(buffer, { limitInputPixels: limits.maxImagePixels, pages: 1 })
    .rotate()
    .png()
    .toBuffer({ resolveWithObject: true });

  const display = await sharp(upright.data)
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });

  onProgress("ocr", 20, "Reading text from the image (OCR)");
  const page = await ocrImage(upright.data, 1, langs, (f) => onProgress("ocr", 20 + Math.round(f * 80), "Reading text from the image (OCR)"));
  const pages = [{ ...page, width: display.info.width, height: display.info.height }];
  const warnings = ocrWarnings(pages);

  return {
    index: buildTextIndex(pages),
    pages,
    metadata: {
      method: ocrEngineName(langs),
      confidence: page.confidence,
      pageCount: 1,
      warnings,
      pages: [{ page: 1, source: "ocr", confidence: page.confidence }],
    },
    document: {
      kind: "image",
      pageCount: 1,
      pages: [{ page: 1, width: display.info.width, height: display.info.height }],
      hasFile: true,
      displayMimeType: "image/jpeg",
    },
    displayFile: { buffer: display.data, mimeType: "image/jpeg" },
    securityFlags: [],
  };
}

/** Grayscale, contrast-stretch, sharpen and scale to a size Tesseract reads well. */
async function prepareForOcr(image: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const meta = await sharp(image, { limitInputPixels: limits.maxImagePixels }).metadata();
  const width = meta.width || 1600;
  const targetWidth = Math.max(1800, Math.min(width, 3000));
  const { data, info } = await sharp(image, { limitInputPixels: limits.maxImagePixels })
    .resize({ width: targetWidth })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function ocrImage(
  image: Buffer,
  pageNumber: number,
  langs: string,
  onProgress?: (fraction: number) => void
): Promise<Omit<LayoutPage, "width" | "height">> {
  const prepared = await prepareForOcr(image);
  const visionClient = getVisionClient();
  if (visionClient) {
    try {
      return await ocrWithGoogleVision(visionClient, prepared, pageNumber);
    } catch (e) {
      console.warn("Google Vision OCR failed, falling back to Tesseract", e);
    }
  }
  return ocrWithTesseract(prepared, pageNumber, langs, onProgress);
}

const tesseractWorkers = new Map<string, Promise<Tesseract.Worker>>();
let tesseractQueue: Promise<unknown> = Promise.resolve();
let reportOcrProgress: ((fraction: number) => void) | null = null;

/** English is always included: most Indian agreements mix English with the local language. */
function ocrLanguages(language?: DocumentLanguage): string {
  if (!language || language === "eng") return OCR_LANGS;
  return [...new Set(["eng", language, ...OCR_LANGS.split("+")])].join("+");
}

/**
 * One Tesseract worker per language set (language data downloads on first use); jobs run one at
 * a time to keep memory predictable.
 */
function withTesseract<T>(
  langs: string,
  fn: (worker: Tesseract.Worker) => Promise<T>,
  onProgress?: (fraction: number) => void
): Promise<T> {
  let worker = tesseractWorkers.get(langs);
  if (!worker) {
    worker = Tesseract.createWorker(langs, Tesseract.OEM.LSTM_ONLY, {
      // Downloaded language data is cached with the app's data, not in the working directory.
      cachePath: path.join(DATA_DIR, "tessdata"),
      logger: (m) => {
        if (m.status === "recognizing text") reportOcrProgress?.(m.progress);
      },
    });
    tesseractWorkers.set(langs, worker);
  }
  const job = tesseractQueue.then(async () => {
    reportOcrProgress = onProgress ?? null;
    try {
      return await fn(await worker!);
    } finally {
      reportOcrProgress = null;
    }
  });
  tesseractQueue = job.catch(() => undefined);
  return job;
}

async function ocrWithTesseract(
  prepared: { data: Buffer; width: number; height: number },
  pageNumber: number,
  langs: string,
  onProgress?: (fraction: number) => void
): Promise<Omit<LayoutPage, "width" | "height">> {
  const result = await withTesseract(langs, (worker) => worker.recognize(prepared.data), onProgress);
  const lines: LayoutLine[] = (result.data.lines || [])
    .map((line) => ({
      words: (line.words || [])
        .filter((w) => w.text.trim() && (w.confidence >= 20 || /[a-z0-9]/i.test(w.text)))
        .map((w) => ({
          text: w.text.trim(),
          confidence: w.confidence / 100,
          box: clampBox({
            page: pageNumber,
            x: w.bbox.x0 / prepared.width,
            y: w.bbox.y0 / prepared.height,
            width: (w.bbox.x1 - w.bbox.x0) / prepared.width,
            height: (w.bbox.y1 - w.bbox.y0) / prepared.height,
          }),
        })),
    }))
    .filter((line) => line.words.length > 0);

  return { page: pageNumber, source: "ocr", confidence: averageWordConfidence(lines), lines };
}

/** Stop the OCR worker thread (graceful shutdown and tests). */
export async function shutdownOcr(): Promise<void> {
  const workers = [...tesseractWorkers.values()];
  tesseractWorkers.clear();
  await Promise.all(workers.map(async (w) => (await w).terminate()));
}

type VisionClient = InstanceType<typeof vision.ImageAnnotatorClient>;
let visionClient: VisionClient | null = null;

function getVisionClient(): VisionClient | null {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
  visionClient ??= new vision.ImageAnnotatorClient();
  return visionClient;
}

function ocrEngineName(langs: string): string {
  return getVisionClient() ? "google-vision" : `tesseract (${langs})`;
}

async function ocrWithGoogleVision(
  client: VisionClient,
  prepared: { data: Buffer; width: number; height: number },
  pageNumber: number
): Promise<Omit<LayoutPage, "width" | "height">> {
  const [result] = await client.documentTextDetection({ image: { content: prepared.data } });
  const words: LayoutWord[] = [];
  for (const page of (result.fullTextAnnotation?.pages || []) as any[]) {
    const w = page.width || prepared.width;
    const h = page.height || prepared.height;
    for (const block of page.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const word of paragraph.words || []) {
          const text = (word.symbols || []).map((s: { text?: string }) => s.text || "").join("");
          const vertices: { x?: number; y?: number }[] = word.boundingBox?.vertices || [];
          if (!text || !vertices.length) continue;
          const xs = vertices.map((v) => v.x || 0);
          const ys = vertices.map((v) => v.y || 0);
          words.push({
            text,
            confidence: word.confidence ?? 0.9,
            box: clampBox({
              page: pageNumber,
              x: Math.min(...xs) / w,
              y: Math.min(...ys) / h,
              width: (Math.max(...xs) - Math.min(...xs)) / w,
              height: (Math.max(...ys) - Math.min(...ys)) / h,
            }),
          });
        }
      }
    }
  }
  const lines = groupWordsIntoLines(words);
  return { page: pageNumber, source: "ocr", confidence: averageWordConfidence(lines), lines };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function averageWordConfidence(lines: LayoutLine[]): number {
  const words = lines.flatMap((l) => l.words);
  if (!words.length) return 0;
  return round2(words.reduce((s, w) => s + w.confidence, 0) / words.length);
}

function weightedConfidence(pages: LayoutPage[]): number {
  const withText = pages.filter((p) => p.lines.length);
  if (!withText.length) return 0;
  return round2(withText.reduce((s, p) => s + p.confidence, 0) / withText.length);
}

function ocrWarnings(pages: LayoutPage[]): string[] {
  const warnings: string[] = [];
  const lowPages = pages.filter((p) => p.source === "ocr" && p.lines.length && p.confidence < 0.7).map((p) => p.page);
  if (lowPages.length) {
    warnings.push(`OCR confidence is low on page ${lowPages.join(", ")}; the scan may be blurry, skewed or low contrast.`);
  }
  const empty = pages.filter((p) => !p.lines.length).map((p) => p.page);
  if (empty.length) warnings.push(`No readable text found on page ${empty.join(", ")}.`);
  return warnings;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
