"use client";

import { useMemo, useState } from "react";
import { Copy, Download, ExternalLink, Gavel, PhoneCall, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AgreementAnalysis, ExplanationLanguage } from "@faa/shared";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

/** Official Indian resources. Kept in one place so they are easy to review and update. */
const LINKS = {
  nbfcList: "https://www.rbi.org.in/Scripts/BS_NBFCList.aspx",
  sachet: "https://sachet.rbi.org.in",
  rbiCms: "https://cms.rbi.org.in",
  consumer: "https://consumerhelpline.gov.in",
  cyber: "https://cybercrime.gov.in",
};

const TEXT = {
  en: {
    title: "Take action",
    subtitle: "Verify the lender, ask for changes in writing, and know where to complain.",
    verifyTitle: "1. Check the lender is genuine",
    lender: "Lender named in this agreement",
    unknownLender: "Not found. Look for the lender's registered name in the agreement.",
    nbfc: "RBI list of registered NBFCs",
    sachet: "Report an unauthorised lender (RBI Sachet)",
    letterTitle: "2. Ask the lender to fix the unfair terms",
    letterHint: "Fill in the [brackets], then send it to the lender's grievance officer by email or registered post. Keep a copy.",
    copy: "Copy letter",
    download: "Download",
    copied: "Letter copied",
    escalateTitle: "3. If the lender does not respond within 30 days",
    rbi: "Complain to the RBI Ombudsman",
    consumer: "National Consumer Helpline (1915)",
    harassTitle: "Being harassed by recovery agents?",
    harass: "Call the National Cyber Crime Helpline 1930 or report online. Threats and calls to your contacts are not legal recovery practices.",
    cyber: "Report at cybercrime.gov.in",
  },
  hi: {
    title: "कदम उठाएँ",
    subtitle: "ऋणदाता की जाँच करें, बदलाव लिखित में माँगें, और जानें कि शिकायत कहाँ करें।",
    verifyTitle: "1. जाँचें कि ऋणदाता असली है",
    lender: "इस समझौते में ऋणदाता का नाम",
    unknownLender: "नहीं मिला। समझौते में ऋणदाता का पंजीकृत नाम देखें।",
    nbfc: "RBI में पंजीकृत NBFC की सूची",
    sachet: "अनधिकृत ऋणदाता की शिकायत (RBI सचेत)",
    letterTitle: "2. ऋणदाता से अनुचित शर्तें ठीक करने को कहें",
    letterHint: "[कोष्ठक] वाली जगहें भरें, फिर ईमेल या रजिस्टर्ड डाक से ऋणदाता के शिकायत अधिकारी को भेजें। एक कॉपी अपने पास रखें।",
    copy: "पत्र कॉपी करें",
    download: "डाउनलोड",
    copied: "पत्र कॉपी हो गया",
    escalateTitle: "3. अगर 30 दिन में ऋणदाता जवाब न दे",
    rbi: "RBI लोकपाल में शिकायत करें",
    consumer: "राष्ट्रीय उपभोक्ता हेल्पलाइन (1915)",
    harassTitle: "वसूली एजेंट परेशान कर रहे हैं?",
    harass: "राष्ट्रीय साइबर क्राइम हेल्पलाइन 1930 पर कॉल करें या ऑनलाइन शिकायत करें। धमकियाँ और आपके संपर्कों को कॉल करना वैध वसूली का तरीका नहीं है।",
    cyber: "cybercrime.gov.in पर शिकायत करें",
  },
};

export function ActionCenter({ agreement }: { agreement: AgreementAnalysis }) {
  const { lang } = useLanguage();
  const tx = TEXT[lang];
  const lender = agreement.loanTerms?.lenderName;
  const harassmentRisk = agreement.clauses.some((c) => c.category === "Data Misuse & Harassment Risk");
  const initialLetter = useMemo(() => buildLetter(agreement, lang), [agreement, lang]);
  const [letter, setLetter] = useState(initialLetter);
  const [lastInitial, setLastInitial] = useState(initialLetter);
  if (initialLetter !== lastInitial) {
    setLastInitial(initialLetter);
    setLetter(initialLetter);
  }

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      toast.success(tx.copied);
    } catch {
      toast.error("Copy failed");
    }
  }

  function downloadLetter() {
    const url = URL.createObjectURL(new Blob([letter], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = lang === "hi" ? "shikayat-patra.txt" : "complaint-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ink">
          <Gavel className="h-5 w-5 text-brand-insight" /> {tx.title}
        </CardTitle>
        <CardDescription>{tx.subtitle}</CardDescription>
      </CardHeader>

      <section>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-risk-safe" /> {tx.verifyTitle}
        </h4>
        <p className="mt-2 text-sm text-brand-cool">
          {tx.lender}: <strong className="text-ink">{lender || tx.unknownLender}</strong>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ExtLink href={LINKS.nbfcList}>{tx.nbfc}</ExtLink>
          <ExtLink href={LINKS.sachet}>{tx.sachet}</ExtLink>
        </div>
      </section>

      <section className="mt-6">
        <h4 className="text-sm font-semibold text-ink">{tx.letterTitle}</h4>
        <p className="mt-1 text-xs text-brand-cool">{tx.letterHint}</p>
        <textarea
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          rows={12}
          className="mt-2 w-full rounded-xl border border-ink/10 bg-brand-graphite p-3 font-mono text-xs leading-relaxed text-ink/90 outline-none focus:ring-2 focus:ring-brand-insight"
        />
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={copyLetter}>
            <Copy className="mr-1.5 h-4 w-4" /> {tx.copy}
          </Button>
          <Button size="sm" variant="outline" onClick={downloadLetter}>
            <Download className="mr-1.5 h-4 w-4" /> {tx.download}
          </Button>
        </div>
      </section>

      <section className="mt-6">
        <h4 className="text-sm font-semibold text-ink">{tx.escalateTitle}</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          <ExtLink href={LINKS.rbiCms}>{tx.rbi}</ExtLink>
          <ExtLink href={LINKS.consumer}>{tx.consumer}</ExtLink>
        </div>
      </section>

      {harassmentRisk && (
        <section className="mt-6 rounded-xl border border-risk-high/40 bg-risk-high/10 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <PhoneCall className="h-4 w-4 text-risk-high" /> {tx.harassTitle}
          </h4>
          <p className="mt-1 text-sm text-brand-cool">{tx.harass}</p>
          <div className="mt-2">
            <ExtLink href={LINKS.cyber}>{tx.cyber}</ExtLink>
          </div>
        </section>
      )}
    </Card>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 text-xs text-brand-insight transition hover:border-brand-insight"
    >
      {children} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function buildLetter(agreement: AgreementAnalysis, lang: ExplanationLanguage): string {
  const lender = agreement.loanTerms?.lenderName || (lang === "hi" ? "[ऋणदाता का नाम]" : "[Lender name]");
  const issues = agreement.clauses
    .filter((c) => c.riskLevel === "high" && c.category !== "Hidden Instructions to AI")
    .slice(0, 6)
    .map((c, i) => `${i + 1}. ${c.heading || c.category}: ${c.plainEnglish}`);
  const hidden = agreement.securityFlags.length > 0;
  const date = new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });

  if (lang === "hi") {
    return [
      `दिनांक: ${date}`,
      "",
      "सेवा में,",
      "शिकायत निवारण अधिकारी,",
      lender,
      "",
      `विषय: ऋण समझौते (आवेदन/खाता संख्या: [संख्या]) की अनुचित शर्तों के संबंध में`,
      "",
      "महोदय/महोदया,",
      "",
      "मुझे दिए गए ऋण समझौते में निम्नलिखित शर्तें अनुचित और अस्पष्ट हैं:",
      ...issues,
      ...(hidden ? ["", "दस्तावेज़ में ऐसा टेक्स्ट भी है जो पढ़ने लायक नहीं है या छिपाया गया है।"] : []),
      "",
      "मेरा अनुरोध है कि आप:",
      "- ऊपर दी गई शर्तों को हटाएँ या बदलें, और बदला हुआ समझौता लिखित में दें;",
      "- सभी शुल्कों और वार्षिक प्रतिशत दर (APR) सहित मुख्य तथ्य विवरण (Key Fact Statement) दें;",
      "- पुष्टि करें कि मेरे फोन के संपर्कों या निजी डेटा का उपयोग वसूली के लिए नहीं किया जाएगा।",
      "",
      "कृपया 30 दिनों के भीतर लिखित उत्तर दें। उत्तर न मिलने पर मैं RBI लोकपाल (cms.rbi.org.in) में शिकायत दर्ज करूँगा/करूँगी।",
      "",
      "भवदीय,",
      "[आपका नाम]",
      "[पता]",
      "[मोबाइल नंबर]",
    ].join("\n");
  }

  return [
    `Date: ${date}`,
    "",
    "To,",
    "The Grievance Redressal Officer,",
    lender,
    "",
    "Subject: Unfair terms in my loan agreement (application/account no. [number])",
    "",
    "Dear Sir/Madam,",
    "",
    "The loan agreement provided to me contains the following unfair or unclear terms:",
    ...issues,
    ...(hidden ? ["", "The document also contains text that is hidden or too small to read."] : []),
    "",
    "I request that you:",
    "- remove or modify the terms listed above and confirm the revised agreement in writing;",
    "- provide a Key Fact Statement showing all fees and the Annual Percentage Rate (APR);",
    "- confirm that my phone contacts and personal data will not be used for recovery.",
    "",
    "Please reply in writing within 30 days. If I do not receive a satisfactory response, I will file a complaint with the RBI Ombudsman (cms.rbi.org.in).",
    "",
    "Yours faithfully,",
    "[Your name]",
    "[Address]",
    "[Mobile number]",
  ].join("\n");
}
