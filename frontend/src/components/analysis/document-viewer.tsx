"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ZoomIn, ZoomOut, Maximize2, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import type { AgreementAnalysis, BoundingBox, ClauseAnalysis, RiskLevel } from "@faa/shared";
import { Button } from "@/components/ui/button";
import { getAgreementFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import "react-pdf/dist/Page/TextLayer.css";

// Served from our own bundle (no third-party CDN), matching react-pdf's pdf.js version.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const HIGHLIGHT: Record<RiskLevel, { fill: string; strong: string; line: string }> = {
  high: { fill: "rgba(239, 68, 68, 0.22)", strong: "rgba(239, 68, 68, 0.38)", line: "#EF4444" },
  caution: { fill: "rgba(245, 158, 11, 0.24)", strong: "rgba(245, 158, 11, 0.42)", line: "#F59E0B" },
  safe: { fill: "rgba(34, 197, 94, 0.14)", strong: "rgba(34, 197, 94, 0.32)", line: "#22C55E" },
};

const LEVELS: RiskLevel[] = ["high", "caution", "safe"];
const LEVEL_LABEL: Record<RiskLevel, string> = { high: "High", caution: "Caution", safe: "Safe" };

export function DocumentViewer({
  agreement,
  selectedId,
  onSelectClause,
}: {
  agreement: AgreementAnalysis;
  selectedId?: string;
  onSelectClause: (clause: ClauseAnalysis) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [visible, setVisible] = useState<Set<RiskLevel>>(new Set(["high", "caution", "safe"]));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  const kind = agreement.document?.kind ?? "text";
  const hasFile = Boolean(agreement.document?.hasFile);
  const clauses = agreement.clauses;

  // Fetch the decrypted document with the auth token and show it from a private blob URL.
  useEffect(() => {
    if (!hasFile) return;
    let url: string | null = null;
    let cancelled = false;
    getAgreementFile(agreement.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFileUrl(url);
      })
      .catch(() => !cancelled && setFileError(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [agreement.id, hasFile]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Risky clauses in reading order, for previous/next navigation.
  const riskyInOrder = useMemo(
    () =>
      clauses
        .filter((c) => c.riskLevel !== "safe" && visible.has(c.riskLevel))
        .sort((a, b) => (a.position?.textStart ?? 0) - (b.position?.textStart ?? 0)),
    [clauses, visible]
  );

  const goToRisk = useCallback(
    (direction: 1 | -1) => {
      if (!riskyInOrder.length) return;
      const current = riskyInOrder.findIndex((c) => c.id === selectedId);
      const next =
        current === -1
          ? direction === 1 ? 0 : riskyInOrder.length - 1
          : (current + direction + riskyInOrder.length) % riskyInOrder.length;
      onSelectClause(riskyInOrder[next]);
      setScrollTarget(riskyInOrder[next].id);
    },
    [riskyInOrder, selectedId, onSelectClause]
  );

  useEffect(() => {
    if (!scrollTarget) return;
    const el = containerRef.current?.querySelector(`[data-clause-anchor="${scrollTarget}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollTarget(null);
  }, [scrollTarget, numPages, fileUrl]);

  const counts = useMemo(
    () => ({
      high: clauses.filter((c) => c.riskLevel === "high").length,
      caution: clauses.filter((c) => c.riskLevel === "caution").length,
      safe: clauses.filter((c) => c.riskLevel === "safe").length,
    }),
    [clauses]
  );

  const pageWidth = Math.max(280, Math.min(containerWidth - 24, 900) * zoom);
  const shownClauses = clauses.filter((c) => visible.has(c.riskLevel));
  const layerProps = { clauses: shownClauses, selectedId, hoveredId, onHover: setHoveredId, onSelect: onSelectClause };
  const showText = kind === "text" || !hasFile || fileError;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-brand-graphite/40 p-2">
        <div className="flex items-center gap-1">
          {showText && (
            <span className="px-2 text-xs text-brand-cool">
              {kind === "word" ? "Word document · text view" : kind === "text" ? "Text document" : "Text view"}
            </span>
          )}
          {!showText && (
            <>
              <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs text-brand-cool">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Fit to width" onClick={() => setZoom(1)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Show risk levels">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={visible.has(level)}
              onClick={() =>
                setVisible((prev) => {
                  const next = new Set(prev);
                  if (next.has(level)) next.delete(level);
                  else next.add(level);
                  return next;
                })
              }
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                visible.has(level) ? "border-ink/20 text-ink" : "border-transparent text-brand-cool line-through opacity-60"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: HIGHLIGHT[level].line }} />
              {counts[level]} {LEVEL_LABEL[level]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => goToRisk(-1)} disabled={!riskyInOrder.length} aria-label="Previous risky clause">
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => goToRisk(1)} disabled={!riskyInOrder.length}>
            Next risk <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="max-h-[78vh] overflow-auto rounded-2xl border border-ink/10 bg-brand-graphite/30 p-3"
      >
        {showText ? (
          <TextHighlighter text={agreement.extractedText} {...layerProps} />
        ) : !fileUrl ? (
          <div className="flex h-96 items-center justify-center text-brand-cool">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading document
          </div>
        ) : kind === "pdf" ? (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setFileError(true)}
            loading={<div className="mx-auto h-96 animate-pulse rounded-xl bg-ink/10" style={{ width: pageWidth }} />}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div key={n} className="relative mx-auto mb-4 bg-white shadow-lg" style={{ width: pageWidth }}>
                <Page pageNumber={n} width={pageWidth} renderAnnotationLayer={false} renderTextLayer />
                <HighlightLayer page={n} {...layerProps} />
              </div>
            ))}
          </Document>
        ) : (
          <div className="relative mx-auto bg-white shadow-lg" style={{ width: pageWidth }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl} alt={`Scanned agreement ${agreement.fileName}`} className="block w-full select-none" draggable={false} />
            <HighlightLayer page={1} {...layerProps} />
          </div>
        )}
      </div>
    </div>
  );
}

interface LayerProps {
  clauses: ClauseAnalysis[];
  selectedId?: string;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (clause: ClauseAnalysis) => void;
}

/** Draws one rectangle per text line of every clause on this page, positioned in page percentages. */
function HighlightLayer({ page, clauses, selectedId, hoveredId, onHover, onSelect }: LayerProps & { page: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {clauses.map((clause) => {
        const rects = rectsFor(clause).filter((r) => r.page === page);
        if (!rects.length) return null;
        const isFirstPage = rectsFor(clause)[0]?.page === page;
        const active = clause.id === selectedId || clause.id === hoveredId;
        const colors = HIGHLIGHT[clause.riskLevel];

        return rects.map((rect, i) => (
          <button
            key={`${clause.id}-${i}`}
            type="button"
            data-clause-anchor={isFirstPage && i === 0 ? clause.id : undefined}
            tabIndex={isFirstPage && i === 0 ? 0 : -1}
            aria-hidden={isFirstPage && i === 0 ? undefined : true}
            aria-label={`${clause.heading || clause.category}: ${LEVEL_LABEL[clause.riskLevel]} risk`}
            title={`${LEVEL_LABEL[clause.riskLevel]} risk - ${clause.category}`}
            onClick={() => onSelect(clause)}
            onMouseEnter={() => onHover(clause.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(clause.id)}
            onBlur={() => onHover(null)}
            className="pointer-events-auto absolute cursor-pointer rounded-[2px] transition-colors focus:outline-none"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `max(${rect.height * 100}%, 6px)`,
              background: active ? colors.strong : colors.fill,
              boxShadow: clause.id === selectedId ? `0 0 0 2px ${colors.line}` : `inset 0 -2px 0 ${colors.line}`,
            }}
          />
        ));
      })}
    </div>
  );
}

function rectsFor(clause: ClauseAnalysis): BoundingBox[] {
  if (clause.highlights?.length) return clause.highlights;
  return clause.boundingBox ? [clause.boundingBox] : [];
}

/** For .txt uploads (or if the file cannot be shown): the extracted text with clause ranges marked. */
function TextHighlighter({ text, clauses, selectedId, hoveredId, onHover, onSelect }: LayerProps & { text: string }) {
  const segments = useMemo(() => {
    const ranges = clauses
      .filter((c) => c.position && c.position.textEnd > c.position.textStart)
      .sort((a, b) => a.position!.textStart - b.position!.textStart);
    const out: { text: string; clause?: ClauseAnalysis }[] = [];
    let cursor = 0;
    for (const clause of ranges) {
      const { textStart, textEnd } = clause.position!;
      if (textStart < cursor) continue;
      if (textStart > cursor) out.push({ text: text.slice(cursor, textStart) });
      out.push({ text: text.slice(textStart, textEnd), clause });
      cursor = textEnd;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor) });
    return out;
  }, [text, clauses]);

  return (
    <div className="mx-auto max-w-3xl whitespace-pre-wrap rounded-xl bg-white p-6 font-serif text-[15px] leading-7 text-slate-900 shadow-lg">
      {segments.map((seg, i) =>
        seg.clause ? (
          <mark
            key={i}
            data-clause-anchor={seg.clause.id}
            role="button"
            tabIndex={0}
            title={`${LEVEL_LABEL[seg.clause.riskLevel]} risk - ${seg.clause.category}`}
            onClick={() => onSelect(seg.clause!)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(seg.clause!)}
            onMouseEnter={() => onHover(seg.clause!.id)}
            onMouseLeave={() => onHover(null)}
            className="cursor-pointer rounded-sm text-inherit transition-colors"
            style={{
              background:
                seg.clause.id === selectedId || seg.clause.id === hoveredId
                  ? HIGHLIGHT[seg.clause.riskLevel].strong
                  : HIGHLIGHT[seg.clause.riskLevel].fill,
              boxShadow: seg.clause.id === selectedId ? `0 0 0 2px ${HIGHLIGHT[seg.clause.riskLevel].line}` : undefined,
            }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  );
}
