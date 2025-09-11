// src/app/api/subscription/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, role, reference } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Missing email or role" }, { status: 400 });
    }

    // Set subscription dates
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
      .eq("email", email);

    if (error) {
      console.error("Supabase update error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("API error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
