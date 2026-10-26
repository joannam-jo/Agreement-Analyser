import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BillingSuccess() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-ink">Thank you</h1>
      <p className="mt-4 text-brand-cool">Your payment went through. You can keep analysing agreements.</p>
      <Link href="/upload">
        <Button className="mt-8">Analyse an agreement</Button>
      </Link>
    </div>
  );
}
