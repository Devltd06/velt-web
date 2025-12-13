import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type User } from "npm:@supabase/supabase-js@2";

// CORS config for this function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getAuthContext(req: Request) {
  // Use service role to validate the user's session token (so only valid, signed-in users can call this)
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return json(500, { error: "Server misconfiguration" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Missing Authorization token" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return json(401, { error: "Invalid or expired token" });

  return { supabase, user: data.user } as const;
}

type ProxyRequestBody = { prompt: string; model?: string; temperature?: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Validate user token and load service client so we can optionally do auditing
  const ctx = await getAuthContext(req);
  if (ctx instanceof Response) return ctx;

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return json(500, { error: "Server misconfiguration (OPENAI_API_KEY missing)" });

  try {
    const body = (await req.json().catch(() => ({}))) as ProxyRequestBody;
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json(400, { error: "Missing prompt" });

    // Use a broadly-available default model for stability (gpt-3.5-turbo is widely supported).
    // Consumers can still pass body.model to override if their key supports other models.
    const model = body.model || 'gpt-3.5-turbo';
    const temperature = typeof body.temperature === "number" ? Number(body.temperature) : 0.2;

    // Build system message for safe behavior
    const messages = [
      {
        role: "system",
        content:
          "You are a safe in-app AI assistant for the Velt app. Provide short replies in JSON when requested by the client (assistant flows) and avoid exposing internal ids or secrets.",
      },
      { role: "user", content: prompt },
    ];

    // Forward to OpenAI's Chat Completion endpoint
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: 800 }),
    });

    // If OpenAI returned a non-200, capture details for debugging and return a sanitized error.
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("openai proxy error", res.status, txt.substring?.(0, 1024));
      // Return a short, helpful error payload so the client can surface the problem for dev debugging.
      return json(502, { error: 'OpenAI proxy error', openaiStatus: res.status, openaiMessage: txt?.slice(0, 1000) ?? '' });
    }

    const data = await res.json();
    // Return the whole response to the client (client should only surface user-friendly content)
    return json(200, { data });
  } catch (err) {
    console.error("openai-proxy unhandled", err);
    return json(500, { error: "Unexpected server error" });
  }
});
