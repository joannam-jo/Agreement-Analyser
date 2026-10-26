import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-brand-light dark:bg-brand-graphite",
        className
      )}
    />
  );
}
