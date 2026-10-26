import { Fragment, type ReactNode } from "react";

/**
 * Renders the small markdown subset used by assistant replies: paragraphs, **bold**,
 * "- " / "• " / "1. " bullets and "> " quotes. Builds React elements (no raw HTML), so
 * text from the model or the document can never inject markup.
 */
export function ChatMessageContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^\s*(?:[-•*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*(?:[-•*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*(?:[-•*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={blocks.length} className="space-y-1.5 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2">
              <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-insight" />
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={blocks.length} className="border-l-2 border-ink/25 pl-3 italic text-ink/60">
          {quote.join(" ")}
        </blockquote>
      );
      continue;
    }

    const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
    const paragraph: string[] = [heading ? `**${heading[1]}**` : line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^\s*(?:[-•*]\s|\d+\.\s|>|#)/.test(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={blocks.length}>
        {paragraph.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-2.5">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
