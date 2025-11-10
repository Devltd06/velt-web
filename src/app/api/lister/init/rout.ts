// src/app/api/lister/init/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, plan = "publisher_monthly", listingId = null } = body || {};

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // read canonical plan price (fallback to 50)
    let price = 50.0;
    try {
      const { data: planRow } = await supabaseServer
        .from("listing_plans")
        .select("price,currency,duration_days")
        .eq("slug", plan)
        .limit(1)
        .maybeSingle();
      if (planRow && planRow.price) price = Number(planRow.price);
    } catch (e) {
      console.warn("listing_plans read failed, using fallback price", e);
    }

    const { data: invoice, error: insertErr } = await supabaseServer
      .from("invoices")
      .insert([
        {
          user_id: userId,
          listing_id: listingId,
          listing_type: listingId ? "listing" : "publisher_subscription",
          plan_id: null,
          amount: price,
          currency: "GHS",
          provider: "paystack",
          provider_ref: null,
          status: "pending",
          meta: null,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertErr || !invoice) {
      console.error("invoice insert error", insertErr);
      return NextResponse.json({ error: "Could not create invoice" }, { status: 500 });
    }

    return NextResponse.json({ invoiceId: invoice.id, price });
  } catch (err) {
    console.error("api/lister/init error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

