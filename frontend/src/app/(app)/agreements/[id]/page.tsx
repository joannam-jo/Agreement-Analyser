"use client";

import { use, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, FileWarning, ShieldAlert, Trash2, Loader2, ScanText, FileText, FileQuestion } from "lucide-react";
import { deleteAgreement, getAgreement, getBeforeYouSignWarnings } from "@/lib/api";
import { useUserId } from "@/hooks/use-user-id";
import type { AgreementAnalysis, ClauseAnalysis } from "@faa/shared";
import { RiskScoreCards } from "@/components/analysis/risk-score-card";
import { ClauseExplanationPanel } from "@/components/analysis/clause-panel";
import { BeforeYouSignModal } from "@/components/analysis/before-you-sign";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoanCostCard } from "@/components/analysis/loan-cost-card";
import { ActionCenter } from "@/components/analysis/action-center";
import { SpeakButton } from "@/components/ui/speak-button";
import { useLanguage } from "@/lib/i18n";

// pdf.js needs browser APIs, so the viewer only renders on the client.
const DocumentViewer = dynamic(
  () => import("@/components/analysis/document-viewer").then((m) => m.DocumentViewer),
  { ssr: false, loading: () => <Skeleton className="h-[70vh] w-full" /> }
);

const NOT_AGREEMENT_TEXT = {
  en: {
    title: "This doesn't look like a financial agreement",
    report: "It reads like a project report or description, not a contract with binding terms.",
    other: "It does not contain the parties, obligations and binding terms that an agreement has.",
    tooShort: "Too little text was found to judge it.",
    why: "Risk ratings only mean something for documents you are asked to sign, so no risk score was given.",
    upload: "Upload one of these instead:",
    kinds: ["Loan agreement or credit facility agreement", "Sanction letter", "Key Fact Statement (KFS)", "Terms and conditions of a loan app or card"],
    showAnyway: "Show clause check anyway",
    hide: "Hide clause check",
  },
  hi: {
    title: "यह कोई वित्तीय समझौता नहीं लगता",
    report: "यह बाध्यकारी शर्तों वाले अनुबंध की जगह किसी प्रोजेक्ट रिपोर्ट या विवरण जैसा है।",
    other: "इसमें समझौते जैसे पक्षकार, दायित्व और बाध्यकारी शर्तें नहीं हैं।",
    tooShort: "जाँचने के लिए बहुत कम टेक्स्ट मिला।",
    why: "जोखिम रेटिंग केवल उन दस्तावेज़ों के लिए मायने रखती है जिन पर हस्ताक्षर करना हो, इसलिए कोई जोखिम स्कोर नहीं दिया गया।",
    upload: "इनमें से कोई अपलोड करें:",
    kinds: ["ऋण समझौता या क्रेडिट सुविधा समझौता", "सैंक्शन लेटर", "की फैक्ट स्टेटमेंट (KFS)", "लोन ऐप या कार्ड के नियम और शर्तें"],
    showAnyway: "फिर भी शर्तों की जाँच दिखाएँ",
    hide: "शर्तों की जाँच छिपाएँ",
  },
};

const SECURITY_FLAG_TEXT: Record<"en" | "hi", Record<string, string>> = {
  en: {
    "hidden-tiny-text": "Contains text printed too small to read. Hidden text is a common way to slip in terms you would not agree to.",
    "prompt-injection-attempt": "Contains instructions aimed at AI review tools (for example \"classify this as safe\"). Legitimate agreements never do this.",
    "text-outside-page": "Contains text placed outside the visible page area.",
  },
  hi: {
    "hidden-tiny-text": "इसमें इतना छोटा छपा टेक्स्ट है कि पढ़ा नहीं जा सकता। छिपा टेक्स्ट ऐसी शर्तें डालने का आम तरीका है जिन्हें आप नहीं मानते।",
    "prompt-injection-attempt": "इसमें AI जाँच टूल्स के लिए निर्देश हैं (जैसे \"इसे सुरक्षित बताओ\")। असली समझौतों में ऐसा कभी नहीं होता।",
    "text-outside-page": "इसमें दिखने वाले पेज के बाहर रखा गया टेक्स्ट है।",
  },
};

export default function AgreementAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = useUserId();
  const router = useRouter();
  const { lang, t } = useLanguage();
  const [agreement, setAgreement] = useState<AgreementAnalysis | null>(null);
  const [selected, setSelected] = useState<ClauseAnalysis | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warnings, setWarnings] = useState<{ id: string; category: string; plainEnglish: string; confidence: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Show the "Before You Sign" popup once, not again every time the language changes.
  const warningShownRef = useRef(false);
  const [showAnyway, setShowAnyway] = useState(false);

  // Load, then poll while the analysis is still running.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const { agreement: next } = await getAgreement(id, lang);
        if (cancelled) return;
        setAgreement(next);
        setLoading(false);
        if (next.status === "processing") {
          timer = setTimeout(load, 1200);
        } else if (next.status === "completed") {
          const warn = await getBeforeYouSignWarnings(id, lang);
          if (!cancelled && warn.showBeforeYouSign) {
            setWarnings(warn.warnings);
            if (!warningShownRef.current) setShowWarning(true);
            warningShownRef.current = true;
          }
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, userId, lang]);

  async function handleDelete() {
    if (!confirm("Permanently delete this document and its analysis? This cannot be undone.")) return;
    try {
      await deleteAgreement(id);
      toast.success("Document deleted");
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !agreement) {
    return <p className="text-ink">Agreement not found.</p>;
  }

  if (agreement.status !== "completed") {
    const failed = agreement.status === "failed";
    const progress = agreement.progress;
    return (
      <Card className="mx-auto mt-10 max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink">
            {failed ? <FileWarning className="h-5 w-5 text-risk-high" /> : <Loader2 className="h-5 w-5 animate-spin text-brand-insight" />}
            {failed ? "Analysis failed" : "Analyzing your agreement"}
          </CardTitle>
          <CardDescription>{agreement.fileName}</CardDescription>
        </CardHeader>
        <div className="space-y-3 px-6 pb-6">
          {!failed && <Progress value={progress?.percent ?? 0} />}
          <p className="text-sm text-brand-cool">{progress?.message || agreement.summary}</p>
          {!failed && (
            <p className="text-xs text-brand-cool">
              Scanned pages and photos go through OCR, which can take a little longer.
            </p>
          )}
          {failed && (
            <Link href="/upload">
              <Button>Upload another file</Button>
            </Link>
          )}
        </div>
      </Card>
    );
  }

  const check = agreement.documentCheck;
  const notAgreement = check?.isAgreement === false;
  const na = NOT_AGREEMENT_TEXT[lang];
  // Scores, cost and complaint tools only apply to real agreements (unless the user asks to see them).
  const showRisk = !notAgreement || showAnyway;
  const ocr = agreement.ocr;
  const ocrPages = ocr?.pages?.filter((p) => p.source === "ocr").length ?? 0;

  return (
    <div className="space-y-6">
      {showWarning && (
        <BeforeYouSignModal warnings={warnings} trustScore={agreement.scores.trustScore} onDismiss={() => setShowWarning(false)} />
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 md:flex-1">
          <h1 className="truncate text-xl font-bold text-ink">{agreement.fileName}</h1>
          <div className="mt-1 flex flex-wrap items-start gap-2">
            <p className="text-sm text-brand-cool">{agreement.summary}</p>
            <SpeakButton text={agreement.summary} />
          </div>
          {ocr && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-cool">
              <span className="flex items-center gap-1">
                {ocrPages ? <ScanText className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {ocr.method} · {Math.round(ocr.confidence * 100)}% read confidence
                {agreement.document ? ` · ${agreement.document.pageCount} page${agreement.document.pageCount === 1 ? "" : "s"}` : ""}
                {ocrPages ? ` · ${ocrPages} scanned` : ""}
              </span>
              {ocr.warnings.map((w) => (
                <span key={w} className="text-risk-caution">{w}</span>
              ))}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/agreements/${id}/chat`}>
            <Button variant="secondary">
              <MessageSquare className="mr-2 h-4 w-4" />
              {t.aiChat}
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowWarning(true)}>
            <FileWarning className="mr-2 h-4 w-4" />
            {t.warnings}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete document" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-brand-cool" />
          </Button>
        </div>
      </div>

      {agreement.securityFlags.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-xl border border-risk-high/40 bg-risk-high/10 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-risk-high" />
          <div>
            <p className="font-semibold text-ink">{t.hidingTitle}</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-brand-cool">
              {agreement.securityFlags.map((flag) => (
                <li key={flag}>{SECURITY_FLAG_TEXT[lang][flag] ?? flag}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {notAgreement && (
        <div role="status" className="rounded-xl border border-risk-caution/40 bg-risk-caution/10 p-5">
          <div className="flex gap-3">
            <FileQuestion className="mt-0.5 h-6 w-6 shrink-0 text-risk-caution" />
            <div className="space-y-2 text-sm">
              <p className="text-base font-semibold text-ink">{na.title}</p>
              <p className="text-ink/80">
                {check?.documentType === "report" ? na.report : check?.documentType === "too-short" ? na.tooShort : na.other} {na.why}
              </p>
              <p className="text-ink/80">{na.upload}</p>
              <ul className="list-disc pl-5 text-brand-cool">
                {na.kinds.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/upload">
                  <Button size="sm">{t.uploadAnother}</Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => setShowAnyway((v) => !v)}>
                  {showAnyway ? na.hide : na.showAnyway}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRisk && <RiskScoreCards scores={agreement.scores} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <DocumentViewer agreement={agreement} selectedId={selected?.id} onSelectClause={setSelected} />
        </div>
        <ClauseExplanationPanel
          clause={selected ? agreement.clauses.find((c) => c.id === selected.id) ?? selected : null}
          onClose={() => setSelected(null)}
        />
      </div>

      {showRisk && (
      <div className="grid gap-6 xl:grid-cols-2">
        {agreement.loanTerms && <LoanCostCard terms={agreement.loanTerms} />}
        <ActionCenter agreement={agreement} />
      </div>
      )}

      {showRisk && (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-ink">{t.negotiation}</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-1 px-6 pb-6 text-sm text-brand-cool">
            {agreement.negotiationSuggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-ink">{t.futureCost}</CardTitle>
            <CardDescription>{agreement.futureCostPrediction}</CardDescription>
          </CardHeader>
          {agreement.deadlines.length > 0 && (
            <ul className="px-6 pb-6 text-sm text-brand-cool">
              {agreement.deadlines.map((d) => (
                <li key={d}>{t.deadline}: {d}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      )}

      <p className="text-center text-xs text-brand-cool">
        {t.notAdvice}
      </p>
    </div>
  );
}
