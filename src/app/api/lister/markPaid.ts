// src/app/api/lister/markPaid/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // ensure this exports a server client

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

    const { reference, userId, email, full_name, amount } = body as {
      reference?: string;
      userId?: string | null;
      email?: string | null;
      full_name?: string | null;
      amount?: number | string;
    };

    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Create invoice (mark as paid immediately per your request)
    const invoicePayload = {
      user_id: userId,
      listing_id: null,
      listing_type: "publisher_subscription",
      plan_id: null,
      amount: Number(amount ?? 50),
      currency: "GHS",
      provider: "paystack",
      provider_ref: reference,
      status: "paid",
      meta: { note: "Paid via inline Paystack (no server verify)" },
      created_at: new Date().toISOString(),
    };

    const { data: invoice, error: invErr } = await supabaseServer
      .from("invoices")
      .insert([invoicePayload])
      .select()
      .maybeSingle();

    if (invErr) {
      console.error("markPaid: invoices.insert error", invErr);
      return NextResponse.json({ error: "Could not create invoice", detail: invErr.message }, { status: 500 });
    }

    // Create/extend publisher_subscriptions (30 days from now)
    const starts_at = new Date().toISOString();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const subPayload = {
      user_id: userId,
      status: "active",
      starts_at,
      expires_at,
      created_at: new Date().toISOString(),
    };

    const { data: sub, error: subErr } = await supabaseServer
      .from("publisher_subscriptions")
      .insert([subPayload])
      .select()
      .maybeSingle();

    if (subErr) {
      console.warn("markPaid: publisher_subscriptions.insert error", subErr);
      // continue — invoice already recorded
    }

    // Optionally update profile.subscription_end
    try {
      await supabaseServer
        .from("profiles")
        .update({ subscription_end: expires_at, role: "lister" })
        .eq("id", userId);
    } catch (e) {
      console.warn("markPaid: profiles.update non-blocking error", e);
    }

    return NextResponse.json({ ok: true, invoice, subscription: sub ?? null });
  } catch (err: unknown) {
    console.error("markPaid unexpected error", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}