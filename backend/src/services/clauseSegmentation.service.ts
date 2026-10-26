import { v4 as uuidv4 } from "uuid";

export interface RawClause {
  id: string;
  /** Clause text with whitespace collapsed, used for classification and display. */
  text: string;
  heading?: string;
  index: number;
  /** Character range in the full document text (exact; used to recover highlights). */
  start: number;
  end: number;
}

// Hindi packs more meaning per character than English, so the minimum stays fairly low.
const MIN_CLAUSE_CHARS = 50;
const MAX_CLAUSE_CHARS = 1600;
const SUBCLAUSE_SPLIT_AFTER = 600;

/** Lines that start a new top-level clause. */
const HEADING_PATTERNS = [
  /^\s*(?:section|article|clause|schedule|annexure|appendix|part)\s+[\dIVXLC]+[A-Z]?\b/i,
  // OCR often reads a leading "1" as "|", "l" or "I".
  /^\s*(?:\d{1,2}|[|lI])(?:\.\d{1,2})*[.)]\s+["“(]?[A-Zऀ-ॿ]/,
  /^\s*\d{1,2}\.\d{1,2}(?:\.\d{1,2})*\s+["“(]?[A-Zऀ-ॿ]/,
  /^\s*[A-Z][A-Z0-9 ,&/'’()-]{3,70}:?\s*$/,
  /^\s*(?:WHEREAS|NOW,? THEREFORE|IN WITNESS WHEREOF)\b/,
  // Hindi: धारा (section), खंड (clause), अनुच्छेद (article), with Latin or Devanagari digits.
  /^\s*(?:धारा|खंड|अनुच्छेद)\s*[\d०-९]+/,
  /^\s*[०-९]{1,2}[.)]\s+\S/,
];

/** Lines that start a sub-clause such as "(a)" or "(iv)". */
const SUBCLAUSE_PATTERN = /^\s*\(?(?:[a-z]|[ivx]{1,4})\)\s+\S/;

interface Line {
  start: number;
  end: number;
  text: string;
}

export function segmentClauses(fullText: string): RawClause[] {
  if (!fullText.trim()) return [];

  const lines = splitLines(fullText);
  const boundaries: number[] = [];
  let segmentStart = -1;
  let blankRun = false;

  for (const line of lines) {
    if (!line.text.trim()) {
      blankRun = true;
      continue;
    }
    if (segmentStart === -1) {
      segmentStart = line.start;
      boundaries.push(line.start);
      blankRun = false;
      continue;
    }
    const currentLength = line.start - segmentStart;
    const startsClause =
      HEADING_PATTERNS.some((p) => p.test(line.text)) ||
      blankRun ||
      (SUBCLAUSE_PATTERN.test(line.text) && currentLength > SUBCLAUSE_SPLIT_AFTER);
    if (startsClause) {
      boundaries.push(line.start);
      segmentStart = line.start;
    }
    blankRun = false;
  }

  const ranges = boundaries.map((start, i) => trimRange(fullText, start, boundaries[i + 1] ?? fullText.length));
  const merged = mergeShortRanges(fullText, ranges.filter((r) => r.end > r.start));
  const sized = merged.flatMap((r) => splitLongRange(fullText, r));

  return sized.map((range, index) => {
    const raw = fullText.slice(range.start, range.end);
    return {
      id: uuidv4(),
      text: raw.replace(/\s+/g, " ").trim(),
      heading: detectHeading(raw),
      index,
      start: range.start,
      end: range.end,
    };
  });
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (const part of text.split("\n")) {
    lines.push({ start, end: start + part.length, text: part });
    start += part.length + 1;
  }
  return lines;
}

function trimRange(text: string, start: number, end: number) {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
}

/** Headings, titles and fragments that are too short to judge alone are merged into the next clause. */
function mergeShortRanges(text: string, ranges: { start: number; end: number }[]) {
  const out: { start: number; end: number }[] = [];
  let pendingStart: number | null = null;

  for (const range of ranges) {
    const start: number = pendingStart ?? range.start;
    if (range.end - start < MIN_CLAUSE_CHARS) {
      pendingStart = start;
      continue;
    }
    out.push({ start, end: range.end });
    pendingStart = null;
  }

  if (pendingStart !== null) {
    const tail = ranges[ranges.length - 1];
    if (out.length) out[out.length - 1].end = tail.end;
    else out.push({ start: pendingStart, end: tail.end });
  }
  return out.map((r) => trimRange(text, r.start, r.end));
}

/** Very long clauses are split on sentence boundaries so highlights and explanations stay focused. */
function splitLongRange(text: string, range: { start: number; end: number }) {
  if (range.end - range.start <= MAX_CLAUSE_CHARS) return [range];

  const pieces: { start: number; end: number }[] = [];
  const slice = text.slice(range.start, range.end);
  // "।" (danda) ends sentences in Hindi and other Indic scripts.
  const sentenceEnd = /[.;!?](?=\s+["“(]?[A-Z0-9])|।(?=\s)/g;
  let pieceStart = 0;
  let lastCut = 0;
  let match: RegExpExecArray | null;

  while ((match = sentenceEnd.exec(slice))) {
    const cut = match.index + 1;
    if (cut - pieceStart > MAX_CLAUSE_CHARS * 0.6) {
      pieces.push(trimRange(text, range.start + pieceStart, range.start + cut));
      pieceStart = cut;
    }
    lastCut = cut;
  }
  if (!pieces.length && lastCut === 0) return [range];
  pieces.push(trimRange(text, range.start + pieceStart, range.end));
  return pieces.filter((p) => p.end > p.start);
}

function detectHeading(raw: string): string | undefined {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!lines.length) return undefined;

  // Prefer a numbered heading, even when a document title was merged in front of it.
  for (const line of lines) {
    const numbered = line.match(
      /^((?:section|article|clause)\s+[\dIVXLC]+[A-Z]?\.?\s*[^.:\n]{0,70}|(?:\d{1,2}|[|l])(?:\.\d{1,2})*[.)]?\s+[^.:\n]{2,70})/i
    );
    if (numbered) return numbered[1].replace(/^[|l](?=[.)\s])/, "1").replace(/[.:\s]+$/, "").trim();
    const hindi = line.match(/^((?:(?:धारा|खंड|अनुच्छेद)\s*[\d०-९]+|[०-९]{1,2}[.)])[^।.:\n]{0,70})/);
    if (hindi) return hindi[1].replace(/[.:।\s]+$/, "").trim();
  }

  if (/^[A-Z][A-Z0-9 ,&/'’()-]{3,70}:?$/.test(lines[0])) return lines[0].replace(/:$/, "");
  return undefined;
}
