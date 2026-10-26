"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload, BarChart3, GitCompare, MessageSquare, Settings, Lightbulb, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

/** Each section has its own soft colour so the app is easy to scan. */
const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tint: "bg-pastel-mint text-pop-mint" },
  { href: "/upload", label: "Upload", icon: Upload, tint: "bg-pastel-sky text-pop-sky" },
  { href: "/analytics", label: "Risk Analytics", icon: BarChart3, tint: "bg-pastel-lilac text-pop-lilac" },
  { href: "/compare", label: "Compare", icon: GitCompare, tint: "bg-pastel-peach text-pop-peach" },
  { href: "/model", label: "Model Performance", icon: Brain, tint: "bg-pastel-rose text-pop-rose" },
  { href: "/settings", label: "Settings", icon: Settings, tint: "bg-pastel-lemon text-pop-lemon" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-ink/10 bg-surface/60 p-4 lg:block">
      <nav className="space-y-1">
        {items.map(({ href, label, icon: Icon, tint }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-medium transition",
                active ? "bg-surface text-ink shadow-soft ring-1 ring-ink/10" : "text-brand-cool hover:bg-surface hover:text-ink"
              )}
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tint)}>
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 rounded-3xl bg-pastel-lemon p-4">
        <Lightbulb className="mb-2 h-5 w-5 text-pop-lemon" />
        <p className="text-sm font-semibold text-ink">Before you sign</p>
        <p className="mt-1 text-xs text-ink/70">Read every clause marked in red, and ask the lender to explain it in writing.</p>
      </div>
    </aside>
  );
}

export function ChatSidebarLink({ agreementId }: { agreementId: string }) {
  return (
    <Link
      href={`/agreements/${agreementId}/chat`}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-cool hover:text-ink"
    >
      <MessageSquare className="h-4 w-4" />
      AI Assistant
    </Link>
  );
}
