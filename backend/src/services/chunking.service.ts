/**
 * Sentence-aware chunking for semantic retrieval.
 *
 * Clause segmentation (clauseSegmentation.service) divides the document the way a lawyer would,
 * which is what the risk rules need. Retrieval needs something different: passages of roughly even
 * length that overlap, so a sentence near a boundary is still reachable from either side.
 *
 * Every chunk keeps its character range in the full document text. That is what lets a chunk found
 * by semantic search be highlighted on the original page, exactly like a clause.
 */

export interface TextChunk {
  index: number;
  text: string;
  /** Character range in the full document text. */
  start: number;
  end: number;
}

const CHUNK_CHARS = 1000;
const OVERLAP_CHARS = 200;
const MIN_CHUNK_CHARS = 300;

/**
 * Abbreviations that end in a full stop without ending a sentence. Indian agreements use the
 * currency and numbering forms constantly ("Rs. 50,000", "Clause No. 4"), and splitting there
 * would cut a figure away from the obligation that imposes it.
 */
const ABBREVIATIONS = [
  "rs", "no", "nos", "mr", "mrs", "ms", "dr", "shri", "smt", "m/s", "ltd", "pvt", "co",
  "inc", "vs", "viz", "etc", "i.e", "e.g", "approx", "sec", "cl", "sr", "jr", "st",
];

interface Sentence {
  text: string;
  start: number;
  end: number;
}

/** Splits on sentence punctuation, including the Devanagari danda, keeping exact offsets. */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "।" && ch !== "\n") continue;

    // A newline only ends a sentence when the line break is a real paragraph break.
    if (ch === "\n" && !/\n\s*\n/.test(text.slice(i, i + 3))) continue;

    if (ch === ".") {
      const before = text.slice(Math.max(0, i - 12), i).toLowerCase();
      const word = before.match(/([a-z/.]+)$/)?.[1];
      if (word && ABBREVIATIONS.includes(word)) continue;
      // A decimal point or a numbered reference such as "4.2" is not a sentence end.
      if (/\d$/.test(text.slice(0, i)) && /^\d/.test(text.slice(i + 1))) continue;
    }

    const end = i + 1;
    const body = text.slice(start, end);
    if (body.trim()) sentences.push({ text: body.trim(), start, end });
    start = end;
  }

  const tail = text.slice(start);
  if (tail.trim()) sentences.push({ text: tail.trim(), start, end: text.length });
  return sentences;
}

/**
 * Groups sentences into overlapping chunks. A chunk shorter than the minimum is merged into the
 * previous one rather than kept, so retrieval never returns a fragment too small to interpret.
 */
export function chunkText(fullText: string): TextChunk[] {
  const sentences = splitSentences(fullText);
  if (sentences.length === 0) return [];

  const chunks: TextChunk[] = [];
  let current: Sentence[] = [];
  let length = 0;

  const flush = () => {
    if (current.length === 0) return;
    const text = current.map((s) => s.text).join(" ");
    const start = current[0].start;
    const end = current[current.length - 1].end;

    const previous = chunks[chunks.length - 1];
    if (text.length < MIN_CHUNK_CHARS && previous) {
      previous.text = `${previous.text} ${text}`;
      previous.end = end;
      return;
    }
    chunks.push({ index: chunks.length, text, start, end });
  };

  for (const sentence of sentences) {
    if (length + sentence.text.length > CHUNK_CHARS && current.length > 0) {
      flush();
      current = overlapWindow(current);
      length = current.reduce((sum, s) => sum + s.text.length, 0);
    }
    current.push(sentence);
    length += sentence.text.length;
  }
  flush();

  return chunks;
}

/** The trailing sentences of a chunk that fit inside the overlap, carried into the next chunk. */
function overlapWindow(sentences: Sentence[]): Sentence[] {
  const window: Sentence[] = [];
  let length = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (length + sentences[i].text.length > OVERLAP_CHARS) break;
    window.unshift(sentences[i]);
    length += sentences[i].text.length;
  }
  return window;
}
