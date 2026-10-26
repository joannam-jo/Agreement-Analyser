"use client";

import { useEffect, useState } from "react";
import { listAgreements } from "@/lib/api";
import { useUserId } from "@/hooks/use-user-id";
import type { AgreementAnalysis } from "@faa/shared";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function AnalyticsPage() {
  const userId = useUserId();
  const [agreements, setAgreements] = useState<AgreementAnalysis[]>([]);

  useEffect(() => {
    if (!userId) return;
    listAgreements().then((r) => setAgreements(r.agreements.filter((a) => a.status === "completed")));
  }, [userId]);

  const totals = agreements.reduce(
    (acc, a) => ({
      safe: acc.safe + a.riskCounts.safe,
      caution: acc.caution + a.riskCounts.caution,
      high: acc.high + a.riskCounts.high,
    }),
    { safe: 0, caution: 0, high: 0 }
  );

  const chartData = [
    { name: "Safe", count: totals.safe, fill: "#22C55E" },
    { name: "Caution", count: totals.caution, fill: "#F59E0B" },
    { name: "High Risk", count: totals.high, fill: "#EF4444" },
  ];
  const average = (field: "trustScore" | "consumerFriendliness" | "overallRisk") =>
    agreements.length
      ? Math.round(agreements.reduce((sum, a) => sum + a.scores[field], 0) / agreements.length)
      : 0;
  const deadlineCount = agreements.reduce((sum, agreement) => sum + agreement.deadlines.length, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">Risk analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Uploads analyzed" value={agreements.length} />
        <Metric label="Average trust" value={`${average("trustScore")}%`} />
        <Metric label="Consumer friendly" value={`${average("consumerFriendliness")}%`} />
        <Metric label="Deadlines found" value={deadlineCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-ink">Clause distribution (all documents)</CardTitle>
        </CardHeader>
        <div className="h-72 px-4 pb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#64748B" />
              <YAxis stroke="#64748B" />
              <Tooltip contentStyle={{ background: "#1E293B", border: "none" }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4">
        {agreements.map((a) => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <p className="font-medium text-ink">{a.fileName}</p>
                <p className="text-sm text-brand-cool">
                  Trust {a.scores.trustScore}% | Friendly {a.scores.consumerFriendliness}% | Risk {a.scores.overallRisk}%
                </p>
                {a.deadlines.length > 0 && (
                  <p className="text-xs text-brand-cool">Deadlines: {a.deadlines.slice(0, 2).join(", ")}</p>
                )}
              </div>
              <div className="flex gap-2">
                <RiskBadge level="safe" />
                <span className="text-xs text-brand-cool">{a.riskCounts.safe}</span>
                <RiskBadge level="caution" />
                <span className="text-xs text-brand-cool">{a.riskCounts.caution}</span>
                <RiskBadge level="high" />
                <span className="text-xs text-brand-cool">{a.riskCounts.high}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-brand-cool">{label}</CardTitle>
        <p className="text-2xl font-bold text-ink">{value}</p>
      </CardHeader>
    </Card>
  );
}
