"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export function BeforeYouSignModal({
  warnings,
  trustScore,
  onDismiss,
}: {
  warnings: { id: string; category: string; plainEnglish: string; confidence: number }[];
  trustScore: number;
  onDismiss: () => void;
}) {
  const { t, category } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="max-w-lg rounded-3xl border border-ink/10 bg-surface p-8 shadow-lift"
      >
        <div className="flex items-center gap-3 text-risk-high">
          <AlertTriangle className="h-8 w-8" />
          <h2 className="text-2xl font-bold text-ink">{t.beforeYouSign}</h2>
        </div>
        <p className="mt-4 text-brand-cool">
          {t.trustScore}: <strong className="text-ink">{trustScore}/100</strong>. {t.detected(warnings.length)}
        </p>
        <ul className="mt-4 max-h-48 space-y-3 overflow-y-auto">
          {warnings.map((w) => (
            <li key={w.id} className="rounded-xl bg-risk-high/10 p-3 text-sm text-ink">
              <span className="font-medium text-risk-high">{category(w.category)}</span>
              <p className="mt-1 text-brand-cool">{w.plainEnglish}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-3">
          <Button variant="danger" className="flex-1" onClick={onDismiss}>
            {t.understand}
          </Button>
          <Link href="/upload" className="flex-1">
            <Button variant="outline" className="w-full">
              {t.uploadAnother}
            </Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
