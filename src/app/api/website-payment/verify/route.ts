// src/app/api/website-payment/verify/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || "";

// Subscription durations in days
const SUBSCRIPTION_DAYS = {
  monthly: 30,
  annual: 365,
};

export async function POST(req: Request) {
  try {
    const { reference, payment_id } = await req.json();

    if (!reference || !payment_id) {
      return NextResponse.json(
        { success: false, error: "Missing reference or payment_id" },
        { status: 400 }
      );
    }

    // Verify payment with Paystack
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      // Update payment record as failed
      await supabaseServer
        .from("payments")
        .update({ status: "failed", error_message: verifyData.message })
        .eq("id", payment_id);

      return NextResponse.json(
        { success: false, error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // Payment verified successfully
    const paymentData = verifyData.data;
    const metadata = paymentData.metadata;
    const userId = metadata.user_id;
    const billingCycle = metadata.billing_cycle as "monthly" | "annual";
    const isRenewal = metadata.is_renewal;

    // Calculate subscription end date
    const days = SUBSCRIPTION_DAYS[billingCycle] || 30;
    let subscriptionEndDate: Date;

    if (isRenewal) {
      // For renewals, extend from current end date (if still active) or from now
      const { data: currentProfile } = await supabaseServer
        .from("profiles")
        .select("subscription_ends_at")
        .eq("id", userId)
        .single();

      const currentEnd = currentProfile?.subscription_ends_at
        ? new Date(currentProfile.subscription_ends_at)
        : new Date();

      // If subscription hasn't expired, extend from current end date
      // Otherwise, extend from now
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      subscriptionEndDate = new Date(
        baseDate.getTime() + days * 24 * 60 * 60 * 1000
      );
    } else {
      // New subscription starts from now
      subscriptionEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // Update payment record
    await supabaseServer
      .from("payments")
      .update({
        status: "completed",
        paystack_reference: reference,
        paystack_transaction_id: paymentData.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", payment_id);

    // Update user profile with signature status
    const { error: profileError } = await supabaseServer
      .from("profiles")
      .update({
        is_signature: true,
        verified: true,
        subscription_ends_at: subscriptionEndDate.toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return NextResponse.json(
        { success: false, error: "Failed to activate subscription" },
        { status: 500 }
      );
    }

    // Create subscription history record (if table exists)
    try {
      await supabaseServer.from("subscription_history").insert({
        user_id: userId,
        payment_id: payment_id,
        plan_type: billingCycle,
        amount: paymentData.amount,
        currency: paymentData.currency,
        start_date: new Date().toISOString(),
        end_date: subscriptionEndDate.toISOString(),
        is_renewal: isRenewal,
        paystack_reference: reference,
      });
    } catch (historyError) {
      // Don't fail if subscription_history doesn't exist
      console.warn("Could not create subscription history:", historyError);
    }

    return NextResponse.json({
      success: true,
      subscription_ends_at: subscriptionEndDate.toISOString(),
    });
  } catch (error: unknown) {
    console.error("Payment verification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
