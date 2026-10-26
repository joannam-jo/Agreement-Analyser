"use client";

import { useEffect, useState } from "react";
import { getModelMetrics } from "@/lib/api";
import { useUserId } from "@/hooks/use-user-id";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type Metrics = Awaited<ReturnType<typeof getModelMetrics>>;

const LABELS: Record<string, string> = {
  "personal-loan": "Personal loan",
  "education-loan": "Education loan",
  lease: "Lease / rent",
  "credit-card": "Credit card",
  unknown: "Unknown",
};

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function ModelPage() {
  const userId = useUserId();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getModelMetrics()
      .then(setMetrics)
      .catch((e: Error) => setError(e.message));
  }, [userId]);

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Model performance</h1>
        <p className="text-sm text-ink/70">{error}</p>
      </div>
    );
  }

  if (!metrics) return <p className="text-sm text-ink/60">Loading model metrics…</p>;

  const { documentType, risk } = metrics;
  const classes = Object.keys(documentType.perLabel);
  const [rules, embeddings] = risk.approaches;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Model performance</h1>
        <p className="text-sm text-ink/70">
          How the learned parts of this application score on labelled data. Measured by
          leave-one-out cross-validation, so no example is ever scored against itself. Regenerate
          with <code className="rounded bg-ink/5 px-1">npm run evaluate</code>.
        </p>
      </header>

      {/* ---------- Document type ---------- */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Document type classifier</CardTitle>
          <p className="text-sm text-ink/60">
            {documentType.model} embeddings · {documentType.method} · {documentType.sampleSize} labelled examples
          </p>
        </CardHeader>

        <div className="mb-5 flex items-baseline gap-3">
          <span className="text-4xl font-semibold text-pop-mint">{percent(documentType.accuracy)}</span>
          <span className="text-sm text-ink/60">overall accuracy</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/60">
                <th className="py-2 font-medium">Class</th>
                <th className="py-2 font-medium">Precision</th>
                <th className="py-2 font-medium">Recall</th>
                <th className="py-2 font-medium">F1</th>
                <th className="py-2 font-medium">Examples</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => {
                const m = documentType.perLabel[cls];
                return (
                  <tr key={cls} className="border-b border-ink/5">
                    <td className="py-2 font-medium text-ink">{LABELS[cls] ?? cls}</td>
                    <td className="py-2 text-ink/80">{m.precision.toFixed(2)}</td>
                    <td className="py-2 text-ink/80">{m.recall.toFixed(2)}</td>
                    <td className="py-2 text-ink/80">{m.f1.toFixed(2)}</td>
                    <td className="py-2 text-ink/60">{m.support}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------- Risk: rules vs embeddings ---------- */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Why risk uses rules, not a learned classifier</CardTitle>
          <p className="text-sm text-ink/60">
            Both approaches scored on the same {risk.sampleSize} labelled clauses.
          </p>
        </CardHeader>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {risk.approaches.map((a, i) => (
            <div
              key={a.name}
              className={`rounded-2xl p-4 ${i === 0 ? "bg-pastel-mint" : "bg-pastel-peach"}`}
            >
              <p className="text-sm font-medium text-ink">{a.name}</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{percent(a.accuracy)}</p>
              <p className="mt-1 text-xs text-ink/70">
                precision {a.precision.toFixed(2)} · recall {a.recall.toFixed(2)} · F1 {a.f1.toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <p className="mb-4 text-sm text-ink/80">
          The same k-nearest-neighbour algorithm reaches {percent(documentType.accuracy)} on document
          type but only {percent(embeddings.accuracy)} here, which shows the limitation is the task
          rather than the implementation. Embeddings group clauses by <em>subject</em>, and whether a
          clause is harmful is independent of its subject: a clause promising no prepayment penalty
          sits beside one imposing a heavy prepayment penalty. The rule engine reaches{" "}
          {percent(rules.accuracy)} because it reads negation and obligation, so it is kept as the
          live path for risk, while embeddings are used for retrieval, where grouping by subject is
          exactly what is wanted.
        </p>

        {risk.disagreements.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink">Where the two disagree</h3>
            <ul className="space-y-2">
              {risk.disagreements.slice(0, 5).map((d) => (
                <li key={d.text} className="rounded-xl bg-ink/[0.03] p-3 text-sm">
                  <p className="text-ink/80">“{d.text}”</p>
                  <p className="mt-1 text-xs text-ink/60">
                    correct: <strong className="text-ink/80">{d.expected}</strong> · rules:{" "}
                    <strong className={d.rules === d.expected ? "text-pop-mint" : "text-pop-peach"}>{d.rules}</strong> ·
                    embeddings:{" "}
                    <strong className={d.embeddings === d.expected ? "text-pop-mint" : "text-pop-peach"}>
                      {d.embeddings}
                    </strong>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <p className="text-xs text-ink/50">
        Generated {new Date(metrics.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
