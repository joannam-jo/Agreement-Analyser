import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/clerk-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

// A rounded, friendly typeface that stays professional for financial content.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Financial Agreement Analyzer | AI Risk Detection",
  description:
    "OCR, NLP, and ML-powered analysis of financial agreements. Detect hidden risks before you sign.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} font-sans`}>
        <AuthProvider>
          <UserProvider>
            <LanguageProvider>
              <ThemeProvider>
                {children}
              </ThemeProvider>
            </LanguageProvider>
          </UserProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
