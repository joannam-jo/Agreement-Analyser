import { Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlanButton } from "@/components/plan-button";

const plans = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "₹0",
    features: ["3 analyses / month", "OCR + rule-based ML", "PDF text highlights"],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "₹499",
    popular: true,
    features: [
      "Unlimited analyses",
      "OpenAI explanations",
      "Compare agreements",
      "AI chat assistant",
    ],
  },
  {
    key: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    features: ["API access", "Team dashboard", "Custom risk models", "SSO"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20">
      <h1 className="text-center text-4xl font-bold text-ink">Pricing</h1>
      <p className="mt-4 text-center text-brand-cool">
        Protect yourself before signing any financial agreement
      </p>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`${plan.popular ? "ring-2 ring-brand-trust" : ""}`}
          >
            <CardHeader>
              {plan.popular && (
                <span className="text-xs font-medium text-brand-insight">Most popular</span>
              )}
              <CardTitle className="text-ink">{plan.name}</CardTitle>
              <p className="text-3xl font-bold text-gradient">{plan.price}</p>
              <CardDescription>/ month</CardDescription>
            </CardHeader>
            <ul className="space-y-2 px-6 pb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-brand-cool">
                  <Check className="h-4 w-4 text-risk-safe" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="px-6 pb-6">
              <PlanButton plan={plan.key} popular={plan.popular} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
