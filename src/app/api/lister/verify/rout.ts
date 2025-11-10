// src/app/api/lister/verify/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reference, invoiceId } = body || {};
    if (!reference || !invoiceId) {
      return NextResponse.json({ error: "Missing reference or invoiceId" }, { status: 400 });
    }

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
      console.error("Missing PAYSTACK_SECRET_KEY");
      return NextResponse.json({ error: "Missing Paystack secret" }, { status: 500 });
    }

    // verify transaction with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    const verifyJson = await verifyRes.json().catch(() => null);
    const paid = verifyJson?.data?.status === "success";

    // update invoice
    await supabaseServer
      .from("invoices")
      .update({ status: paid ? "paid" : "failed", provider_ref: reference })
      .eq("id", invoiceId);

    if (!paid) {
      return NextResponse.json({ paid: false, raw: verifyJson });
    }

    // invoice paid -> create/renew publisher_subscriptions row (idempotent)
    const { data: inv } = await supabaseServer.from("invoices").select("user_id,amount").eq("id", invoiceId).maybeSingle();
    const userId = inv?.user_id;
    const durationDays = 30; // use plan duration or listing_plans if available

    if (userId) {
      // check for existing active subscription
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
        // extend existing subscription if present
        const curExp = existing[0].expires_at ? new Date(existing[0].expires_at) : now;
        const extended = new Date(Math.max(curExp.getTime(), now.getTime()) + durationDays * 24 * 60 * 60 * 1000).toISOString();

        await supabaseServer
          .from("publisher_subscriptions")
          .update({ expires_at: extended, status: "active" })
          .eq("id", existing[0].id);
      }
    }

    return NextResponse.json({ paid: true, raw: verifyJson });
  } catch (err) {
    console.error("lister/verify error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
