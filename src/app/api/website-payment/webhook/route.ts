// src/app/api/website-payment/webhook/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || "";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    // Verify webhook signature
    if (PAYSTACK_SECRET_KEY) {
      const hash = crypto
        .createHmac("sha512", PAYSTACK_SECRET_KEY)
        .update(rawBody)
        .digest("hex");

      if (hash !== signature) {
        console.warn("Paystack webhook signature mismatch");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const event = JSON.parse(rawBody);

    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event.data);
        break;

      case "charge.failed":
        await handleChargeFailed(event.data);
        break;

      case "subscription.disable":
        await handleSubscriptionDisabled(event.data);
        break;

      default:
        console.log("Unhandled webhook event:", event.event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleChargeSuccess(data: {
  reference: string;
  metadata?: {
    user_id?: string;
    billing_cycle?: "monthly" | "annual";
    is_renewal?: boolean;
    payment_id?: string;
  };
  amount: number;
  currency: string;
}) {
  const { reference, metadata, amount, currency } = data;

  if (!metadata?.user_id) return;

  const userId = metadata.user_id;
  const billingCycle = metadata.billing_cycle || "monthly";
  const isRenewal = metadata.is_renewal || false;

  // Check if we already processed this payment
  const { data: existingPayment } = await supabaseServer
    .from("payments")
    .select("status")
    .eq("paystack_reference", reference)
    .single();

  if (existingPayment?.status === "completed") {
    console.log("Payment already processed:", reference);
    return;
  }

  // Calculate subscription end date
  const days = billingCycle === "annual" ? 365 : 30;
  let subscriptionEndDate: Date;

  if (isRenewal) {
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("subscription_ends_at")
      .eq("id", userId)
      .single();

    const currentEnd = profile?.subscription_ends_at
      ? new Date(profile.subscription_ends_at)
      : new Date();

    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    subscriptionEndDate = new Date(
      baseDate.getTime() + days * 24 * 60 * 60 * 1000
    );
  } else {
    subscriptionEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // Update profile
  await supabaseServer
    .from("profiles")
    .update({
      is_signature: true,
      verified: true,
      subscription_ends_at: subscriptionEndDate.toISOString(),
    })
    .eq("id", userId);

  // Update or create payment record
  const { data: payment } = await supabaseServer
    .from("payments")
    .select("id")
    .eq("paystack_reference", reference)
    .single();

  if (payment) {
    await supabaseServer
      .from("payments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
  } else {
    await supabaseServer.from("payments").insert({
      user_id: userId,
      amount: amount,
      currency: currency,
      status: "completed",
      payment_type: isRenewal ? "renewal" : "subscription",
      paystack_reference: reference,
      completed_at: new Date().toISOString(),
      metadata: {
        type: "signature_subscription",
        product: "Velt Signature",
        billing_cycle: billingCycle,
        is_renewal: isRenewal,
        source: "webhook",
      },
    });
  }

  console.log("Webhook: Subscription activated for user:", userId);
}

async function handleChargeFailed(data: {
  reference: string;
  metadata?: { payment_id?: string };
  message?: string;
}) {
  const { reference, metadata, message } = data;

  if (metadata?.payment_id) {
    await supabaseServer
      .from("payments")
      .update({
        status: "failed",
        error_message: message || "Payment failed",
      })
      .eq("id", metadata.payment_id);
  } else {
    // Try to find by reference
    await supabaseServer
      .from("payments")
      .update({
        status: "failed",
        error_message: message || "Payment failed",
      })
      .eq("paystack_reference", reference);
  }

  console.log("Webhook: Payment failed for reference:", reference);
}

async function handleSubscriptionDisabled(data: {
  customer?: { email?: string };
  metadata?: { user_id?: string };
}) {
  const userId = data.metadata?.user_id;
  const email = data.customer?.email;

  if (userId) {
    await supabaseServer
      .from("profiles")
      .update({
        is_signature: false,
      })
      .eq("id", userId);
  } else if (email) {
    await supabaseServer
      .from("profiles")
      .update({
        is_signature: false,
      })
      .eq("email", email);
  }

  console.log("Webhook: Subscription disabled");
}
