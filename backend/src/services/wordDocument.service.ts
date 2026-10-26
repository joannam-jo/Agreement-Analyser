import JSZip from "jszip";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

/**
 * Reads Word documents (.docx and legacy .doc) as plain text with paragraph breaks, and looks for
 * text that Word can hide from a reader: hidden formatting, microscopic fonts and white text.
 */

const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2000;
const MAX_TEXT_CHARS = 400_000;

export interface WordExtraction {
  text: string;
  securityFlags: string[];
  warnings: string[];
}

export class UnreadableDocumentError extends Error {}

export async function extractDocx(buffer: Buffer): Promise<WordExtraction> {
  const zip = await JSZip.loadAsync(buffer);
  assertSafeArchive(zip);

  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new UnreadableDocumentError("This Word file has no document body.");

  const { value } = await mammoth.extractRawText({ buffer });
  const { text, truncated } = normalize(value);
  return {
    text,
    securityFlags: detectHiddenText(documentXml),
    warnings: truncated ? ["The document is very long; only the first part was analyzed."] : [],
  };
}

export async function extractDoc(buffer: Buffer): Promise<WordExtraction> {
  let body: string;
  try {
    const doc = await new WordExtractor().extract(buffer);
    body = [doc.getBody(), doc.getFootnotes(), doc.getEndnotes()].filter((part) => part?.trim()).join("\n\n");
  } catch {
    // Excel/PowerPoint files share the same container format; they are not agreements we can read.
    throw new UnreadableDocumentError("This .doc file could not be read. Try saving it as .docx or PDF.");
  }
  const { text, truncated } = normalize(body);
  return {
    text,
    securityFlags: [],
    warnings: [
      "Old .doc format: formatting tricks such as hidden text cannot be checked. Save as .docx for a full check.",
      ...(truncated ? ["The document is very long; only the first part was analyzed."] : []),
    ],
  };
}

/** Reject zip bombs before anything is decompressed. */
function assertSafeArchive(zip: JSZip) {
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) throw new UnreadableDocumentError("This Word file has too many parts.");
  const total = entries.reduce((sum, entry) => {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    return sum + size;
  }, 0);
  if (total > MAX_UNCOMPRESSED_BYTES) throw new UnreadableDocumentError("This Word file is too large once unpacked.");
}

/**
 * Word run properties that make text invisible or unreadable:
 * <w:vanish/> (hidden), <w:sz w:val="n"/> with n < 8 half-points (under 4pt), and white text.
 */
function detectHiddenText(documentXml: string): string[] {
  const runs = documentXml.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? [];
  let hidden = 0;
  for (const run of runs) {
    if (!/<w:t[ >][^<]*\S/.test(run)) continue;
    const vanish = /<w:vanish\s*\/>|<w:vanish\s+w:val="(?:true|1|on)"\s*\/>/.test(run);
    const size = run.match(/<w:sz\s+w:val="(\d+)"/);
    const tiny = size ? Number(size[1]) < 8 : false;
    const white = /<w:color\s+w:val="(?:FFFFFF|ffffff)"/.test(run) && !/<w:highlight|<w:shd[^>]*w:fill="(?!FFFFFF|ffffff|auto)/.test(run);
    if (vanish || tiny || white) hidden++;
  }
  return hidden > 0 ? ["hidden-tiny-text"] : [];
}

function normalize(raw: string): { text: string; truncated: boolean } {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: text.slice(0, MAX_TEXT_CHARS), truncated: text.length > MAX_TEXT_CHARS };
}
