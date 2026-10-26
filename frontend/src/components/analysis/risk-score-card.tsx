"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Eye, HeartHandshake, Gauge } from "lucide-react";
import type { AgreementScores } from "@faa/shared";
import { Progress } from "@/components/ui/progress";

/** Friendly verdict and colour for a 0-100 score (higher is better). */
function verdict(value: number) {
  if (value >= 70) return { word: "Good", tint: "bg-pastel-mint", pop: "text-pop-mint", bar: "bg-risk-safe" };
  if (value >= 40) return { word: "Needs a look", tint: "bg-pastel-lemon", pop: "text-pop-lemon", bar: "bg-risk-caution" };
  return { word: "Risky", tint: "bg-pastel-rose", pop: "text-pop-rose", bar: "bg-risk-high" };
}

export function RiskScoreCards({ scores }: { scores: AgreementScores }) {
  const items = [
    { label: "Trust score", value: scores.trustScore, desc: "How safe this agreement is overall", icon: ShieldCheck },
    { label: "Clarity", value: scores.transparency, desc: "How clearly costs and terms are stated", icon: Eye },
    { label: "Fairness to you", value: scores.consumerFriendliness, desc: "How balanced the terms are", icon: HeartHandshake },
    { label: "Safety level", value: 100 - scores.overallRisk, desc: "Lower means more risk", icon: Gauge },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => {
        const v = verdict(item.value);
        return (
          <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className={`h-full rounded-3xl p-5 ${v.tint}`}>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface/80">
                  <item.icon className={`h-5 w-5 ${v.pop}`} />
                </span>
                <span className={`rounded-full bg-surface/80 px-2.5 py-1 text-xs font-bold ${v.pop}`}>{v.word}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-ink">{item.label}</p>
              <p className="text-4xl font-extrabold text-ink">
                {item.value}
                <span className="text-base font-semibold text-ink/50">/100</span>
              </p>
              <Progress value={item.value} className="mt-3 bg-surface/70" indicatorClassName={v.bar} />
              <p className="mt-2 text-xs text-ink/70">{item.desc}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
