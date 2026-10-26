import type { BoundingBox } from "@faa/shared";

/** A word with its position on the page. Box coordinates are normalized to 0..1 of the page. */
export interface LayoutWord {
  text: string;
  box: BoundingBox;
  confidence: number;
  /** Font height in PDF points, when known (text-layer PDFs only). */
  fontSize?: number;
}

export interface LayoutLine {
  words: LayoutWord[];
}

export interface LayoutPage {
  page: number;
  width: number;
  height: number;
  source: "text-layer" | "ocr";
  confidence: number;
  lines: LayoutLine[];
}

interface IndexedWord {
  start: number;
  end: number;
  page: number;
  line: number;
  word: LayoutWord;
}

/**
 * Full document text built from the layout, plus the character range of every word.
 * Clause segmentation works on `text`; highlights are recovered from `words` by offset,
 * so every highlight lands exactly on the words the clause contains.
 */
export interface TextIndex {
  text: string;
  words: IndexedWord[];
}

export function buildTextIndex(pages: LayoutPage[]): TextIndex {
  let text = "";
  const words: IndexedWord[] = [];
  let lineCounter = 0;

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) text += "\n\n";
    let previous: LayoutLine | undefined;

    for (const line of page.lines) {
      if (!line.words.length) continue;
      if (previous) {
        // A vertical gap noticeably larger than the line height marks a paragraph break.
        text += isParagraphBreak(previous, line) ? "\n\n" : "\n";
      }
      line.words.forEach((word, i) => {
        if (i > 0) text += " ";
        const start = text.length;
        text += word.text;
        words.push({ start, end: text.length, page: page.page, line: lineCounter, word });
      });
      lineCounter++;
      previous = line;
    }
  });

  return { text, words };
}

function isParagraphBreak(prev: LayoutLine, next: LayoutLine): boolean {
  const prevBottom = Math.max(...prev.words.map((w) => w.box.y + w.box.height));
  const nextTop = Math.min(...next.words.map((w) => w.box.y));
  const lineHeight = median(prev.words.map((w) => w.box.height));
  return nextTop - prevBottom > lineHeight * 0.9;
}

/** One rectangle per text line covered by [start, end), padded slightly so highlights read well. */
export function highlightsForRange(index: TextIndex, start: number, end: number): BoundingBox[] {
  const byLine = new Map<number, IndexedWord[]>();
  for (const w of index.words) {
    if (w.end <= start || w.start >= end) continue;
    const list = byLine.get(w.line) || [];
    list.push(w);
    byLine.set(w.line, list);
  }

  return [...byLine.values()].map((lineWords) => {
    const boxes = lineWords.map((w) => w.word.box);
    const x1 = Math.min(...boxes.map((b) => b.x));
    const y1 = Math.min(...boxes.map((b) => b.y));
    const x2 = Math.max(...boxes.map((b) => b.x + b.width));
    const y2 = Math.max(...boxes.map((b) => b.y + b.height));
    const padY = (y2 - y1) * 0.15;
    const padX = 0.003;
    return clampBox({
      page: lineWords[0].page,
      x: x1 - padX,
      y: y1 - padY,
      width: x2 - x1 + padX * 2,
      height: y2 - y1 + padY * 2,
    });
  });
}

export function wordsInRange(index: TextIndex, start: number, end: number): LayoutWord[] {
  return index.words.filter((w) => w.end > start && w.start < end).map((w) => w.word);
}

/** Group loose words (e.g. from Google Vision) into reading-order lines. */
export function groupWordsIntoLines(words: LayoutWord[]): LayoutLine[] {
  const sorted = [...words].sort((a, b) => a.box.y + a.box.height / 2 - (b.box.y + b.box.height / 2));
  const lines: { centerY: number; height: number; words: LayoutWord[] }[] = [];

  for (const word of sorted) {
    const centerY = word.box.y + word.box.height / 2;
    const line = lines.find((l) => Math.abs(l.centerY - centerY) < Math.max(l.height, word.box.height) * 0.5);
    if (line) {
      line.words.push(word);
    } else {
      lines.push({ centerY, height: word.box.height, words: [word] });
    }
  }

  return lines
    .sort((a, b) => a.centerY - b.centerY)
    .map((l) => ({ words: l.words.sort((a, b) => a.box.x - b.box.x) }));
}

export function clampBox(box: BoundingBox): BoundingBox {
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  return {
    page: box.page,
    x,
    y,
    width: Math.max(0, Math.min(1 - x, box.width)),
    height: Math.max(0, Math.min(1 - y, box.height)),
  };
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
