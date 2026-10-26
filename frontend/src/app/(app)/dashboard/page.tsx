"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, AlertTriangle, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/api";
import { useUserId } from "@/hooks/use-user-id";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function DashboardPage() {
  const userId = useUserId();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDashboardStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const s = stats || {
    totalDocuments: 0,
    analyzedCount: 0,
    totalHighRiskClauses: 0,
    averageTrustScore: 0,
    riskTrend: [],
    recentUploads: [],
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">Your agreements</h1>
          <p className="text-brand-cool">Everything you have checked, in one place.</p>
        </div>
        <Link href="/upload">
          <Button>Check an agreement</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, label: "Documents checked", value: s.totalDocuments, tint: "bg-pastel-sky", pop: "text-pop-sky" },
          { icon: AlertTriangle, label: "Risky clauses found", value: s.totalHighRiskClauses, tint: "bg-pastel-rose", pop: "text-pop-rose" },
          { icon: Shield, label: "Average trust score", value: `${s.averageTrustScore}%`, tint: "bg-pastel-mint", pop: "text-pop-mint" },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className={`rounded-3xl p-6 ${item.tint}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface/80">
                <item.icon className={`h-5 w-5 ${item.pop}`} />
              </span>
              <p className="mt-4 text-3xl font-extrabold text-ink">{item.value}</p>
              <p className="text-sm font-medium text-ink/70">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {s.riskTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>How your agreements compare</CardTitle>
            <CardDescription>Trust score (green) and risk (red) for your recent documents</CardDescription>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.riskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--brand-slate))" />
                <XAxis dataKey="date" stroke="rgb(var(--brand-cool))" fontSize={12} />
                <YAxis stroke="rgb(var(--brand-cool))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--brand-slate))", borderRadius: 14, color: "rgb(var(--ink))" }}
                />
                <Line type="monotone" dataKey="trustScore" name="Trust score" stroke="rgb(var(--brand-trust))" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="overallRisk" name="Risk" stroke="rgb(var(--risk-high))" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recently checked</CardTitle>
        </CardHeader>
        {s.recentUploads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-pastel-sky/60 px-6 py-10 text-center">
            <FileText className="h-8 w-8 text-pop-sky" />
            <p className="font-semibold text-ink">Nothing checked yet</p>
            <p className="max-w-sm text-sm text-ink/70">
              Upload a loan agreement, sanction letter or terms and conditions to see what is inside.
            </p>
            <Link href="/upload">
              <Button size="sm">Check my first agreement</Button>
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-ink/10">
            {s.recentUploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{u.fileName}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        u.trustScore >= 70
                          ? "bg-pastel-mint text-pop-mint"
                          : u.trustScore >= 40
                            ? "bg-pastel-lemon text-pop-lemon"
                            : "bg-pastel-rose text-pop-rose"
                      }`}
                    >
                      Trust {u.trustScore}
                    </span>
                    {u.riskCounts.high > 0 && (
                      <span className="rounded-full bg-pastel-rose px-2 py-0.5 font-semibold text-pop-rose">{u.riskCounts.high} risky</span>
                    )}
                  </p>
                </div>
                <Link href={`/agreements/${u.id}`}>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
