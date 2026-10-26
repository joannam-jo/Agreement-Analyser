import { cn } from "@/lib/utils";
import type { RiskLevel } from "@faa/shared";

const riskStyles: Record<RiskLevel, string> = {
  safe: "bg-risk-safe/15 text-risk-safe border-risk-safe/30",
  caution: "bg-risk-caution/15 text-risk-caution border-risk-caution/30",
  high: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

export function RiskBadge({ level, label, className }: { level: RiskLevel; label?: string; className?: string }) {
  const labels = { safe: "Safe", caution: "Caution", high: "High Risk" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        riskStyles[level],
        className
      )}
    >
      {label ?? labels[level]}
    </span>
  );
}
