"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-ink/10", className)} value={value}>
      <ProgressPrimitive.Indicator
        className={cn("h-full rounded-full bg-brand-trust transition-all duration-500", indicatorClassName)}
        style={{ width: `${value}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
