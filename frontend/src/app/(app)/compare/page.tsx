"use client";

import { useEffect, useRef, useState } from "react";
import { compareAgreements, getAgreement, listAgreements, uploadAgreement } from "@/lib/api";
import { useUserId } from "@/hooks/use-user-id";
import type { AgreementAnalysis, CompareResult } from "@faa/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const KIND_LABELS: Record<string, string> = {
  "personal-loan": "Personal loan",
  "education-loan": "Education loan",
  lease: "Lease / rent",
  "credit-card": "Credit card",
  unknown: "Unknown type",
};

const kindOf = (a: AgreementAnalysis) => a.documentCheck?.agreementKind ?? "unknown";

export default function ComparePage() {
  const userId = useUserId();
  const [agreements, setAgreements] = useState<AgreementAnalysis[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"a" | "b" | null>(null);
  const fileA = useRef<HTMLInputElement>(null);
  const fileB = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    listAgreements().then((r) => setAgreements(r.agreements.filter((x) => x.status === "completed" && x.documentCheck?.isAgreement !== false)));
  }, [userId]);

  const first = agreements.find((x) => x.id === a);
  // Only documents of the same kind as the first one can be compared with it.
  const secondOptions = first ? agreements.filter((x) => x.id !== first.id && kindOf(x) === kindOf(first)) : agreements;

  async function handleCompare() {
    if (!a || !b) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await compareAgreements(a, b));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** Uploads a new file, waits for its analysis, adds it to the lists and selects it. */
  async function handleBrowse(side: "a" | "b", file: File | undefined) {
    if (!file) return;
    setUploading(side);
    setError(null);
    try {
      const { agreementId } = await uploadAgreement(file, { documentLanguage: "eng", explanationLanguage: "en" });
      let done: AgreementAnalysis | null = null;
      for (let i = 0; i < 120 && !done; i++) {
        const { agreement } = await getAgreement(agreementId);
        if (agreement.status === "completed") done = agreement;
        else if (agreement.status === "failed") throw new Error("That document could not be analysed.");
        else await new Promise((r) => setTimeout(r, 1500));
      }
      if (!done) throw new Error("The analysis is taking too long. Try again in a moment.");
      if (done.documentCheck?.isAgreement === false) throw new Error("That file does not look like an agreement, so it cannot be compared.");
      setAgreements((prev) => [done!, ...prev.filter((x) => x.id !== done!.id)]);
      if (side === "a") {
        setA(done.id);
        if (b && kindOf(done) !== kindOf(agreements.find((x) => x.id === b) ?? done)) setB("");
      } else setB(done.id);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  const option = (ag: AgreementAnalysis) => (
    <option key={ag.id} value={ag.id}>
      {ag.fileName} · {KIND_LABELS[kindOf(ag)]}
    </option>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-ink">Compare agreements</h1>
      <p className="text-brand-cool">
        Side-by-side trust scores and risk differences. Only agreements of the same kind can be compared, for example an
        education loan with another education loan.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["a", "b"] as const).map((side) => (
          <div key={side} className="space-y-2">
            <select
              className="w-full rounded-xl bg-brand-graphite p-3 text-ink"
              value={side === "a" ? a : b}
              onChange={(e) => {
                const v = e.target.value;
                if (side === "a") {
                  setA(v);
                  const chosen = agreements.find((x) => x.id === v);
                  const current = agreements.find((x) => x.id === b);
                  if (chosen && current && kindOf(chosen) !== kindOf(current)) setB("");
                } else setB(v);
                setResult(null);
                setError(null);
              }}
            >
              <option value="">{side === "a" ? "Agreement A" : first ? `Agreement B (${KIND_LABELS[kindOf(first)]} only)` : "Agreement B"}</option>
              {(side === "a" ? agreements : secondOptions).map(option)}
            </select>
            <input
              ref={side === "a" ? fileA : fileB}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.tif,.tiff,.txt"
              className="hidden"
              onChange={(e) => {
                handleBrowse(side, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={uploading !== null}
              onClick={() => (side === "a" ? fileA : fileB).current?.click()}
            >
              {uploading === side ? "Reading document…" : "Or browse for a new document"}
            </Button>
          </div>
        ))}
      </div>

      {first && secondOptions.length === 0 && (
        <p className="text-sm text-brand-cool">
          You have no other {KIND_LABELS[kindOf(first)].toLowerCase()} yet. Browse for one above to compare.
        </p>
      )}

      {error && <p className="rounded-xl bg-pastel-peach p-3 text-sm text-ink">{error}</p>}

      <Button onClick={handleCompare} disabled={!a || !b || loading || uploading !== null}>
        {loading ? "Comparing…" : "Compare"}
      </Button>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-ink">
              {result.comparison.saferAgreement === "tie" ? "Both are about equally safe" : `Safer: Agreement ${result.comparison.saferAgreement.toUpperCase()}`}
            </CardTitle>
            <CardDescription>
              Trust delta: {result.comparison.trustDelta} · Risk delta: {result.comparison.riskDelta}
            </CardDescription>
          </CardHeader>
          <ul className="space-y-2 px-6 pb-6 text-sm text-brand-cool">
            {result.comparison.keyDifferences.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
