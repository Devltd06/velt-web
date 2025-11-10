// src/app/api/webhooks/paystack/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const secret = process.env.PAYSTACK_SECRET;
    const rawBody = await req.text(); // get raw string for signature
    const signature = (req.headers.get("x-paystack-signature") || "").toString();

    // If secret exists, verify signature
    if (secret) {
      const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
      if (hash !== signature) {
        console.warn("Paystack signature mismatch");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload?.event;
    const data = payload?.data;

    if (event === "charge.success" && data) {
      const reference = data.reference;
      const customerEmail = data?.customer?.email || data?.metadata?.email || null;
      const metadata = data?.metadata || {};
      const role = metadata.plan || data?.authorization?.plan || "subscriber";

      if (customerEmail) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        const { error } = await supabaseServer
          .from("profiles")
          .update({
            role,
            subscription_start: startDate.toISOString(),
            subscription_end: endDate.toISOString(),
          })
          .eq("email", customerEmail);

        if (error) {
          console.error("Webhook update error", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook processing error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
