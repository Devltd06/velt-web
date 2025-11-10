// src/app/api/lister/verify/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { reference } = body || {};
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) return NextResponse.json({ error: "Missing Paystack secret" }, { status: 500 });

    // Verify with Paystack API
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const verifyJson = await verifyRes.json().catch(() => null);
    const success = verifyJson?.data?.status === "success";
    const metadata = verifyJson?.data?.metadata?.velt || {};
    const userId = metadata?.userId || null;
    const amount = (verifyJson?.data?.amount ?? 0) / 100.0;

    // Insert invoice regardless (pending/paid)
    const invoiceRow = {
      user_id: userId,
      listing_id: null,
      listing_type: "publisher_subscription",
      plan_id: null,
      amount: amount || 50,
      currency: "GHS",
      provider: "paystack",
      provider_ref: reference,
      status: success ? "paid" : "failed",
      meta: verifyJson,
      created_at: new Date().toISOString(),
    };
    await supabaseServer.from("invoices").insert([invoiceRow]);

    if (!success) {
      return NextResponse.json({ paid: false, raw: verifyJson }, { status: 200 });
    }

    // Activate or extend subscription (30 days)
    if (userId) {
      const durationDays = 30;
      const { data: existing } = await supabaseServer
        .from("publisher_subscriptions")
        .select("id,expires_at,status")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(1);

      const now = new Date();
      const newExpires = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      if (!existing || existing.length === 0) {
        await supabaseServer.from("publisher_subscriptions").insert([
          {
            user_id: userId,
            plan_slug: "publisher_monthly",
            status: "active",
            starts_at: now.toISOString(),
            expires_at: newExpires,
            created_at: now.toISOString(),
          },
        ]);
      } else {
        const curExp = existing[0].expires_at ? new Date(existing[0].expires_at) : now;
        const extended = new Date(Math.max(curExp.getTime(), now.getTime()) + durationDays * 24 * 60 * 60 * 1000).toISOString();
        await supabaseServer.from("publisher_subscriptions").update({ expires_at: extended, status: "active" }).eq("id", existing[0].id);
      }
    }

    return NextResponse.json({ paid: true, raw: verifyJson }, { status: 200 });
  } catch (err) {
    console.error("verify error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
