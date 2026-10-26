import type { Config } from "tailwindcss";

/** Colour values live in globals.css as CSS variables so light and dark themes swap cleanly. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        muted: "hsl(var(--muted))",
        ring: "hsl(var(--ring))",
        // Main text colour.
        ink: token("ink"),
        // Cards, panels and inputs.
        surface: token("surface"),
        brand: {
          // Primary "money green" for buttons and key numbers.
          trust: token("brand-trust"),
          // Friendly blue accent for links, icons and focus rings.
          insight: token("brand-insight"),
          purple: token("pop-lilac"),
          // Page background, secondary surface, borders and muted text.
          navy: token("brand-navy"),
          graphite: token("brand-graphite"),
          slate: token("brand-slate"),
          cool: token("brand-cool"),
          light: token("brand-navy"),
        },
        // Soft section backgrounds and their matching strong colours.
        pastel: {
          mint: token("pastel-mint"),
          sky: token("pastel-sky"),
          peach: token("pastel-peach"),
          lemon: token("pastel-lemon"),
          lilac: token("pastel-lilac"),
          rose: token("pastel-rose"),
        },
        pop: {
          mint: token("pop-mint"),
          sky: token("pop-sky"),
          peach: token("pop-peach"),
          lemon: token("pop-lemon"),
          lilac: token("pop-lilac"),
          rose: token("pop-rose"),
        },
        risk: {
          safe: token("risk-safe"),
          caution: token("risk-caution"),
          high: token("risk-high"),
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(0deg, rgb(var(--brand-trust)), rgb(var(--brand-trust)))",
        "gradient-glow": "none",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
      boxShadow: {
        glow: "0 8px 24px -12px rgb(var(--shadow) / 0.35)",
        glass: "0 1px 2px rgb(var(--shadow) / 0.06), 0 6px 20px -10px rgb(var(--shadow) / 0.18)",
        soft: "0 1px 2px rgb(var(--shadow) / 0.06), 0 6px 20px -10px rgb(var(--shadow) / 0.18)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.06), 0 14px 32px -14px rgb(var(--shadow) / 0.28)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
