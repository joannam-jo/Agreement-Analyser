"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { computeLoanCost, type LoanTerms } from "@faa/shared";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TEXT = {
  en: {
    title: "True cost of this loan",
    subtitle: "Filled in from your agreement. Check the numbers and correct anything that was misread.",
    principal: "Loan amount",
    rate: "Interest rate (% per year)",
    tenure: "Tenure (months)",
    fees: "Upfront fees",
    emi: "Monthly EMI",
    received: "You actually receive",
    repay: "You repay in total",
    costOfCredit: "Total cost of borrowing",
    advertised: "Advertised rate",
    realApr: "Real yearly cost (APR)",
    aprWarning: (apr: string, gap: string) => `Fees push the real cost to ${apr} a year: ${gap} percentage points more than the advertised rate.`,
    late: (monthly: string, yearly: string) => `Late payment penalty: ${monthly}% a month, which is about ${yearly}% a year on top of interest.`,
    missing: "Enter the loan amount, interest rate and tenure to see the true cost.",
    foundIn: "Found in",
    note: "APR includes upfront fees and uses the standard reducing-balance EMI formula.",
  },
  hi: {
    title: "इस ऋण की असली लागत",
    subtitle: "आपके समझौते से भरा गया है। संख्याएँ जाँचें और गलत पढ़ी गई चीज़ ठीक करें।",
    principal: "ऋण राशि",
    rate: "ब्याज दर (% प्रति वर्ष)",
    tenure: "अवधि (महीने)",
    fees: "अग्रिम शुल्क",
    emi: "मासिक EMI",
    received: "आपको असल में मिलेगा",
    repay: "आप कुल चुकाएँगे",
    costOfCredit: "उधार की कुल लागत",
    advertised: "बताई गई दर",
    realApr: "असली सालाना लागत (APR)",
    aprWarning: (apr: string, gap: string) => `शुल्क जोड़ने पर असली लागत ${apr} सालाना हो जाती है: बताई गई दर से ${gap} प्रतिशत अंक ज़्यादा।`,
    late: (monthly: string, yearly: string) => `देर से भुगतान का जुर्माना: ${monthly}% प्रति माह, यानी ब्याज के ऊपर लगभग ${yearly}% सालाना।`,
    missing: "असली लागत देखने के लिए ऋण राशि, ब्याज दर और अवधि डालें।",
    foundIn: "यहाँ से लिया गया",
    note: "APR में अग्रिम शुल्क शामिल हैं और यह सामान्य घटती-शेष EMI सूत्र पर आधारित है।",
  },
};

export function LoanCostCard({ terms }: { terms: LoanTerms }) {
  const { lang } = useLanguage();
  const tx = TEXT[lang];
  const [principal, setPrincipal] = useState(terms.principal?.toString() ?? "");
  const [rate, setRate] = useState(terms.annualRatePct?.toString() ?? "");
  const [tenure, setTenure] = useState(terms.tenureMonths?.toString() ?? "");
  const [fees, setFees] = useState(terms.upfrontFees?.toString() ?? "0");

  useEffect(() => {
    setPrincipal(terms.principal?.toString() ?? "");
    setRate(terms.annualRatePct?.toString() ?? "");
    setTenure(terms.tenureMonths?.toString() ?? "");
    setFees(terms.upfrontFees?.toString() ?? "0");
  }, [terms]);

  const result = useMemo(
    () =>
      computeLoanCost({
        principal: Number(principal),
        annualRatePct: Number(rate),
        tenureMonths: Math.round(Number(tenure)),
        upfrontFees: Number(fees || 0),
      }),
    [principal, rate, tenure, fees]
  );

  const money = (n: number) => formatMoney(n, terms.currency);
  const gap = result ? result.aprPct - Number(rate) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ink">
          <Calculator className="h-5 w-5 text-brand-insight" /> {tx.title}
        </CardTitle>
        <CardDescription>{tx.subtitle}</CardDescription>
      </CardHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={tx.principal} value={principal} onChange={setPrincipal} source={terms.sources.principal} foundIn={tx.foundIn} />
        <Field label={tx.rate} value={rate} onChange={setRate} step="0.1" source={terms.sources.annualRatePct} foundIn={tx.foundIn} />
        <Field label={tx.tenure} value={tenure} onChange={setTenure} source={terms.sources.tenureMonths} foundIn={tx.foundIn} />
        <Field label={tx.fees} value={fees} onChange={setFees} source={terms.sources.upfrontFees} foundIn={tx.foundIn} />
      </div>

      {result ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={tx.emi} value={money(result.emi)} />
            <Stat label={tx.received} value={money(result.amountReceived)} />
            <Stat label={tx.repay} value={money(result.totalRepayment)} />
            <Stat label={tx.costOfCredit} value={money(result.totalCostOfCredit)} />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-6 rounded-xl bg-brand-graphite/50 p-4">
            <div>
              <p className="text-xs text-brand-cool">{tx.advertised}</p>
              <p className="text-2xl font-bold text-ink">{Number(rate).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-brand-cool">{tx.realApr}</p>
              <p className={cn("text-3xl font-bold", gap > 2 ? "text-risk-high" : "text-risk-safe")}>{result.aprPct.toFixed(1)}%</p>
            </div>
            {gap > 2 && (
              <p className="min-w-[14rem] flex-1 text-sm text-risk-caution">{tx.aprWarning(`${result.aprPct.toFixed(1)}%`, gap.toFixed(1))}</p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-brand-cool">{tx.missing}</p>
      )}

      {terms.latePenaltyMonthlyPct !== undefined && (
        <p className="mt-3 text-sm text-risk-high">
          {tx.late(String(terms.latePenaltyMonthlyPct), (terms.latePenaltyMonthlyPct * 12).toFixed(0))}
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-cool">
        <Info className="h-3.5 w-3.5 shrink-0" /> {tx.note}
      </p>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  step = "1",
  source,
  foundIn,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  source?: string;
  foundIn: string;
}) {
  return (
    <label className="block text-xs text-brand-cool" title={source ? `${foundIn}: "${source}"` : undefined}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 w-full rounded-lg border bg-brand-graphite px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-insight",
          source ? "border-brand-insight/40" : "border-ink/10"
        )}
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 p-3">
      <p className="text-xs text-brand-cool">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function formatMoney(n: number, currency: LoanTerms["currency"]): string {
  if (currency === "INR") return `₹${Math.round(n).toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${Math.round(n).toLocaleString("en-US")}`;
  return Math.round(n).toLocaleString();
}
