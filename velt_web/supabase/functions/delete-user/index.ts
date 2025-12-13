// supabase/functions/delete-user/index.ts
// Deno Edge Function – deletes the authenticated user and its profile

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // ==== 1️⃣ CORS pre‑flight ====
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ==== 2️⃣ Only POST allowed ====
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // ==== 3️⃣ Environment vars (service‑role) ====
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
      console.error("Missing env vars");
      return json(500, { error: "Server misconfiguration" });
    }

    // ==== 4️⃣ Extract user token (must be a user access token) ====
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return json(401, { error: "Missing Authorization token" });
    }

    // ==== 5️⃣ Initialise a service‑role client (bypasses RLS) ====
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ==== 6️⃣ Verify the token belongs to a real user ====
    const { data: userInfo, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userInfo?.user) {
      console.error("Token verification error:", userErr);
      return json(401, { error: "Invalid or expired token" });
    }
    const userId = userInfo.user.id;

    // ==== 7️⃣ Delete dependent rows (e.g., profiles) ====
    const { error: profileErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileErr) {
      // Log but continue – we still want to delete the auth user.
      console.error("Profile delete error:", profileErr);
    }

    // ==== 8️⃣ Delete the auth user (requires service‑role) ====
    const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("admin.deleteUser error:", delErr);
      // Forward the exact Supabase error message to help debugging.
      return json(500, {
        error: "Failed to delete auth user",
        details: delErr.message,
      });
    }

    // ==== 9️⃣ Success ====
    return json(200, { ok: true });
  } catch (e) {
    console.error("Unhandled exception in delete-user:", e);
    return json(500, { error: "Unexpected server error" });
  }
});