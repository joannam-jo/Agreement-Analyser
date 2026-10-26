"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ClauseAnalysis } from "@faa/shared";
import { RiskBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/ui/speak-button";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ClauseExplanationPanel({ clause, onClose }: { clause: ClauseAnalysis | null; onClose: () => void }) {
  const { t, category } = useLanguage();

  return (
    <AnimatePresence>
      {clause && (
        <motion.aside
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed right-0 top-16 z-40 h-[calc(100vh-4rem)] w-full max-w-md overflow-y-auto border-l border-ink/10 bg-surface p-6 shadow-lift lg:static lg:border lg:h-auto lg:max-h-[calc(100vh-8rem)] lg:rounded-2xl"
        >
          <div className="flex items-start justify-between gap-2">
            <RiskBadge level={clause.riskLevel} label={t.risk[clause.riskLevel]} />
            <div className="flex items-center gap-1">
              <SpeakButton text={[clause.plainEnglish, clause.whyFlagged, ...clause.recommendedActions].join(". ")} />
              <Button variant="ghost" size="icon" onClick={onClose} className="text-ink" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="mt-2 text-xs text-brand-cool">{category(clause.category)}</p>
          {clause.heading && <p className="mt-1 text-sm font-medium text-ink">{clause.heading}</p>}

          <div className="mt-4 rounded-xl bg-brand-graphite/50 p-3">
            <p className="text-xs font-medium text-brand-insight">{t.plainEnglish}</p>
            <p className="mt-1 text-sm text-ink">{clause.plainEnglish}</p>
          </div>

          <h3 className="mt-4 text-base font-semibold text-ink">{t.whyFlagged}</h3>
          <p className="mt-1 text-sm text-brand-cool">{clause.whyFlagged}</p>

          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-xs text-brand-cool">{t.confidence}</p>
              <p className="text-xl font-bold text-gradient">{Math.round(clause.confidence * 100)}%</p>
            </div>
            {clause.similarityScore !== undefined && clause.similarityScore > 0 && (
              <div>
                <p className="text-xs text-brand-cool">{t.patternMatch}</p>
                <p className="text-xl font-bold text-ink">{Math.round(clause.similarityScore * 100)}%</p>
              </div>
            )}
          </div>

          <Section title={t.financialImpact} content={clause.financialImpact} />
          <ListSection title={t.consequences} items={clause.predictedConsequences} />
          <ListSection title={t.whatToDo} items={clause.recommendedActions} positive />
          <ListSection title={t.whatToAvoid} items={clause.avoidActions} />

          <p className="mt-4 border-t border-ink/10 pt-4 text-xs italic text-brand-cool">
            {t.clauseExcerpt}: {clause.text.length > 220 ? `${clause.text.slice(0, 220)}…` : clause.text}
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <p className="mt-1 text-sm text-brand-cool">{content}</p>
    </div>
  );
}

function ListSection({ title, items, positive }: { title: string; items: string[]; positive?: boolean }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className={cn("text-sm", positive ? "text-risk-safe" : "text-risk-high")}>
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
