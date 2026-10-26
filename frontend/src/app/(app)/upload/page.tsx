"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentLanguage } from "@faa/shared";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { LANGUAGE_OPTIONS, useLanguage } from "@/lib/i18n";

const DOCUMENT_LANGUAGES: { value: DocumentLanguage; label: string }[] = [
  { value: "eng", label: "English" },
  { value: "hin", label: "हिन्दी (Hindi)" },
  { value: "mar", label: "मराठी (Marathi)" },
  { value: "ben", label: "বাংলা (Bengali)" },
  { value: "tam", label: "தமிழ் (Tamil)" },
  { value: "tel", label: "తెలుగు (Telugu)" },
  { value: "guj", label: "ગુજરાતી (Gujarati)" },
  { value: "kan", label: "ಕನ್ನಡ (Kannada)" },
  { value: "mal", label: "മലയാളം (Malayalam)" },
];

const TEXT = {
  en: {
    title: "Upload agreement",
    subtitle: "OCR reads the document, clauses are checked for risk, and each one is explained in plain language.",
    docLang: "Document language",
    docLangHint: "The language the agreement is written in. English is always read too.",
    explainLang: "Explain in",
  },
  hi: {
    title: "समझौता अपलोड करें",
    subtitle: "OCR दस्तावेज़ पढ़ता है, हर शर्त का जोखिम जाँचा जाता है, और आसान भाषा में समझाया जाता है।",
    docLang: "दस्तावेज़ की भाषा",
    docLangHint: "समझौता जिस भाषा में लिखा है। अंग्रेज़ी हमेशा साथ में पढ़ी जाती है।",
    explainLang: "किस भाषा में समझाएँ",
  },
};

export default function UploadPage() {
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const tx = TEXT[lang];
  const [documentLanguage, setDocumentLanguage] = useState<DocumentLanguage>(lang === "hi" ? "hin" : "eng");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{tx.title}</h1>
        <p className="text-brand-cool">{tx.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-ink">
          {tx.docLang}
          <select
            value={documentLanguage}
            onChange={(e) => setDocumentLanguage(e.target.value as DocumentLanguage)}
            className="mt-1 w-full rounded-lg border border-ink/10 bg-brand-graphite px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-insight"
          >
            {DOCUMENT_LANGUAGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-brand-cool">{tx.docLangHint}</span>
        </label>
        <label className="block text-sm text-ink">
          {tx.explainLang}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="mt-1 w-full rounded-lg border border-ink/10 bg-brand-graphite px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-insight"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FileDropzone
        documentLanguage={documentLanguage}
        explanationLanguage={lang}
        onComplete={(id) => router.push(`/agreements/${id}`)}
      />
    </div>
  );
}
