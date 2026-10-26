"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPaymentOrder, verifyPayment } from "@/lib/api";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PlanButton({ plan, popular }: { plan: "starter" | "pro" | "enterprise"; popular?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const order = await createPaymentOrder("pro");
      if (!(await loadCheckout()) || !window.Razorpay) throw new Error("Could not load the payment window. Check your connection.");
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Agreement Analyzer",
        description: order.name,
        theme: { color: "#0f7b5f" },
        handler: async (response: RazorpayResponse) => {
          try {
            await verifyPayment(response);
            router.push("/billing/success");
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.open();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function go() {
    if (plan === "starter") return router.push("/upload");
    if (plan === "enterprise") {
      window.location.href = "mailto:claudesubscription12@gmail.com?subject=Agreement%20Analyzer%20Enterprise";
      return;
    }
    void pay();
  }

  const label = plan === "starter" ? "Start free" : plan === "pro" ? "Pay with UPI or card" : "Contact us";
  return (
    <div className="space-y-2">
      <Button className="w-full" variant={popular ? "default" : "secondary"} onClick={go} disabled={busy}>
        {busy ? "Opening secure payment…" : label}
      </Button>
      {error && <p className="text-xs text-risk-high">{error}</p>}
    </div>
  );
}
