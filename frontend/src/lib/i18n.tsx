"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ExplanationLanguage } from "@faa/shared";

/** UI text in every supported language. Explanations themselves come translated from the API. */
const DICTIONARY = {
  en: {
    language: "Language",
    listen: "Listen",
    stop: "Stop",
    whyFlagged: "Why this was flagged",
    plainEnglish: "In simple words",
    confidence: "Confidence",
    patternMatch: "Pattern match",
    estimatedImpact: "Estimated impact",
    financialImpact: "Financial impact",
    consequences: "Predicted consequences",
    whatToDo: "What you should do",
    whatToAvoid: "What to avoid",
    clauseExcerpt: "Clause excerpt",
    beforeYouSign: "Before You Sign",
    trustScore: "Trust score",
    detected: (n: number) => `We detected ${n} high-risk clause${n === 1 ? "" : "s"} that need your attention.`,
    understand: "I understand the risks",
    uploadAnother: "Upload another",
    aiChat: "AI Chat",
    warnings: "Warnings",
    negotiation: "Negotiation suggestions",
    futureCost: "Future cost prediction",
    deadline: "Deadline",
    hidingTitle: "This document may be trying to hide something",
    notAdvice: "This analysis is automated and is not legal advice. For high-risk agreements, consult a lawyer or a free legal aid service.",
    chatTitle: "AI Contract Assistant",
    chatGreeting: "I'm your agreement assistant. Ask about risky clauses, fees, cancellation, or what to negotiate. Try one of the questions below.",
    chatPlaceholder: "Ask about a clause, fees, or renewal terms...",
    thinking: "Thinking…",
    suggestions: ["Should I sign this?", "What fees will I pay?", "Can I cancel or prepay early?", "What happens if I pay late?", "What should I negotiate?"],
    risk: { high: "High risk", caution: "Caution", safe: "Low risk" },
  },
  hi: {
    language: "भाषा",
    listen: "सुनें",
    stop: "रोकें",
    whyFlagged: "इसे क्यों चिह्नित किया गया",
    plainEnglish: "आसान शब्दों में",
    confidence: "विश्वास स्तर",
    patternMatch: "पैटर्न मिलान",
    estimatedImpact: "अनुमानित असर",
    financialImpact: "आर्थिक असर",
    consequences: "संभावित परिणाम",
    whatToDo: "आपको क्या करना चाहिए",
    whatToAvoid: "किन बातों से बचें",
    clauseExcerpt: "शर्त का अंश",
    beforeYouSign: "हस्ताक्षर करने से पहले",
    trustScore: "भरोसा स्कोर",
    detected: (n: number) => `हमें ${n} उच्च-जोखिम शर्तें मिलीं जिन पर आपको ध्यान देना चाहिए।`,
    understand: "मैं जोखिम समझता/समझती हूँ",
    uploadAnother: "दूसरा दस्तावेज़",
    aiChat: "AI चैट",
    warnings: "चेतावनियाँ",
    negotiation: "मोलभाव के सुझाव",
    futureCost: "भविष्य के खर्च का अनुमान",
    deadline: "समय-सीमा",
    hidingTitle: "यह दस्तावेज़ कुछ छिपाने की कोशिश कर रहा हो सकता है",
    notAdvice: "यह स्वचालित विश्लेषण है, कानूनी सलाह नहीं। उच्च-जोखिम समझौतों के लिए किसी वकील या मुफ़्त कानूनी सहायता सेवा से सलाह लें।",
    chatTitle: "AI समझौता सहायक",
    chatGreeting: "मैं आपका समझौता सहायक हूँ। जोखिम वाली शर्तों, शुल्क, रद्द करने या मोलभाव के बारे में पूछें। नीचे दिए सवालों में से कोई चुनें।",
    chatPlaceholder: "किसी शर्त, शुल्क या नवीनीकरण के बारे में पूछें...",
    thinking: "सोच रहा हूँ…",
    suggestions: ["क्या मुझे इस पर हस्ताक्षर करने चाहिए?", "मुझे कौन-कौन से शुल्क देने होंगे?", "क्या मैं जल्दी रद्द या चुकता कर सकता हूँ?", "देर से भुगतान करने पर क्या होगा?", "मुझे किन बातों पर मोलभाव करना चाहिए?"],
    risk: { high: "उच्च जोखिम", caution: "सावधानी", safe: "कम जोखिम" },
  },
} as const;

/** Display names for risk categories (the API keeps them in English as stable identifiers). */
const CATEGORY_HI: Record<string, string> = {
  "Variable Interest": "बदलने वाली ब्याज दर",
  "Hidden Fees": "छिपे शुल्क",
  "Auto-Renewal Trap": "अपने आप नवीनीकरण",
  "Penalty Clause": "जुर्माने की शर्त",
  "Salary Deduction": "वेतन कटौती",
  "Data Misuse & Harassment Risk": "डेटा दुरुपयोग और उत्पीड़न का खतरा",
  "Binding Arbitration": "बाध्यकारी मध्यस्थता",
  "Hidden Instructions to AI": "AI के लिए छिपे निर्देश",
  "Hidden Text": "छिपा हुआ टेक्स्ट",
  "Cancellation Restriction": "रद्द करने पर रोक",
  "Fraud or Scam Language": "धोखाधड़ी की भाषा",
  "Rights Waiver": "अधिकार छोड़ना",
  Indemnification: "क्षतिपूर्ति",
  "Ambiguous Terms": "अस्पष्ट शर्तें",
  "Dark Pattern": "भ्रामक डिज़ाइन",
  "General Provision": "सामान्य शर्त",
};

type Dictionary = (typeof DICTIONARY)["en"];

interface LanguageContextValue {
  lang: ExplanationLanguage;
  setLang: (lang: ExplanationLanguage) => void;
  t: Dictionary;
  category: (name: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: DICTIONARY.en,
  category: (name) => name,
});

const STORAGE_KEY = "faa-language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<ExplanationLanguage>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "hi") setLangState(saved);
    } catch {
      // Storage can be unavailable (private mode); English is the default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: ExplanationLanguage) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const category = useCallback((name: string) => (lang === "hi" ? CATEGORY_HI[name] ?? name : name), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: DICTIONARY[lang] as Dictionary, category }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const LANGUAGE_OPTIONS: { value: ExplanationLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
];
