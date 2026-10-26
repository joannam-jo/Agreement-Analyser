"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Menu, Moon, Sun, X, Languages } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LANGUAGE_OPTIONS, useLanguage } from "@/lib/i18n";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/analytics", label: "Analytics" },
  { href: "/compare", label: "Compare" },
  { href: "/model", label: "Model" },
  { href: "/settings", label: "Settings" },
];

export function Navbar() {
  const pathname = usePathname();
  // resolvedTheme is what is actually shown ("system" resolves to light or dark).
  const { resolvedTheme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  // The theme is only known in the browser; render a neutral icon until then to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setMenuOpen(false), [pathname]);
  const isMarketing = pathname === "/" || pathname.startsWith("/sign") || pathname === "/pricing";
  const navLinks = isMarketing
    ? [
        { href: "/#features", label: "Features" },
        { href: "/pricing", label: "Pricing" },
      ]
    : links;

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-bold tracking-tight text-ink">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-trust text-white shadow-soft">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="hidden truncate sm:inline">
            <span className="text-ink">Agreement</span> <span className="text-brand-trust">Analyzer</span>
          </span>
          <span className="sm:hidden">
            <span className="text-brand-trust">Analyzer</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn("text-sm text-brand-cool transition hover:text-ink", pathname === l.href && "text-brand-insight")}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <label className="flex items-center gap-1 rounded-lg border border-ink/10 px-2 py-1 text-xs text-brand-cool">
            <Languages className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{t.language}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
              className="bg-transparent text-ink outline-none [&>option]:bg-surface"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="text-ink"
            aria-label="Toggle dark mode"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {mounted && resolvedTheme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          {isMarketing && (
            <>
              <Link href="/sign-in" className="hidden sm:block">
                <Button variant="ghost" className="text-ink">
                  Sign in
                </Button>
              </Link>
              <Link href="/dashboard" className="hidden sm:block">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-ink md:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-ink/10 px-4 py-2 md:hidden">
          {[...navLinks, ...(isMarketing ? [{ href: "/dashboard", label: "Get Started" }] : [])].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-sm text-brand-cool hover:bg-ink/5 hover:text-ink",
                pathname === l.href && "text-brand-insight"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
