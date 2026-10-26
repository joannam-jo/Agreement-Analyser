import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

/**
 * Razorpay payments for the Pro plan (INR; cards, UPI and netbanking).
 *
 * Flow: the server creates an order for a fixed price (the browser never sets the amount), the browser
 * opens Razorpay's own payment window, and the server then verifies Razorpay's HMAC signature before
 * treating the payment as real. Card and UPI details never reach this server.
 *
 * Works with Razorpay test keys (rzp_test_...) and no real money. Plan limits are not enforced yet:
 * marking a user as Pro after payment is the next step.
 */
const PLANS = {
  pro: { name: "Agreement Analyzer Pro", amountPaise: 49900 },
} as const;

const orderSchema = z.object({ plan: z.enum(["pro"]) });
const verifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});

function keys() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new AppError(503, "Payments are not set up on this server yet.");
  return { keyId, keySecret };
}

export const billingRouter = Router();

billingRouter.post("/order", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { plan } = orderSchema.parse(req.body);
    const { keyId, keySecret } = keys();
    const p = PLANS[plan];
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: p.amountPaise,
        currency: "INR",
        receipt: `pro_${crypto.randomUUID().slice(0, 12)}`,
        notes: { userId: req.userId, plan },
      }),
    });
    const data = (await response.json()) as { id?: string; error?: { description?: string } };
    if (!response.ok || !data.id) {
      console.error("Razorpay order failed", data.error?.description);
      throw new AppError(502, "Could not start the payment. Please try again.");
    }
    res.json({ orderId: data.id, amount: p.amountPaise, currency: "INR", keyId, name: p.name });
  } catch (e) {
    next(e);
  }
});

/** Confirms a payment by checking the signature Razorpay produced with the secret key. */
billingRouter.post("/verify", requireAuth, (req: AuthRequest, res, next) => {
  try {
    const body = verifySchema.parse(req.body);
    const { keySecret } = keys();
    const expected = crypto.createHmac("sha256", keySecret).update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest("hex");
    const given = Buffer.from(body.razorpay_signature);
    const want = Buffer.from(expected);
    const ok = given.length === want.length && crypto.timingSafeEqual(given, want);
    if (!ok) throw new AppError(400, "Payment could not be verified.");
    res.json({ paid: true });
  } catch (e) {
    next(e);
  }
});
