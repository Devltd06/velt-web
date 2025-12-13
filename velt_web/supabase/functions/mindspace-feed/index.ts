import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type User } from "npm:@supabase/supabase-js@2";

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

type AuthContext = { supabase: ReturnType<typeof createClient>; user: User };

async function getAuthContext(req: Request): Promise<AuthContext | Response> {
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return json(500, { error: "Server misconfiguration" });
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(401, { error: "Missing Authorization token" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return json(401, { error: "Invalid or expired token" });
  }

  return { supabase, user: data.user };
}

type FeedBody = {
  limit?: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const auth = await getAuthContext(req);
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  try {
    const body = (await req.json().catch(() => ({}))) as FeedBody;
    const rawLimit = typeof body.limit === "number" ? body.limit : 40;
    const limit = Math.min(Math.max(Math.floor(rawLimit) || 40, 1), 80);
    const nowIso = new Date().toISOString();

    const { data: activeTopic, error: topicErr } = await supabase
      .from("mindspace_topics")
      .select(
        "id, story_id, title, cover_url, active_until, created_by, created_by_name, story_owner_name"
      )
      .is("released_at", null)
      .gt("active_until", nowIso)
      .order("active_until", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topicErr && topicErr.code !== "PGRST116") {
      console.error("mindspace-feed topic error", topicErr);
      return json(500, { error: "Unable to load active topic" });
    }

    const { data: thoughts, error: thoughtsErr } = await supabase
      .from("mindspace_thoughts")
      .select(
        "id, author_id, author_name, author_avatar, body, created_at, topic_id, story_id, attachment_url"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (thoughtsErr) {
      console.error("mindspace-feed thoughts error", thoughtsErr);
      return json(500, { error: "Unable to load thoughts" });
    }

    return json(200, {
      activeTopic: activeTopic ?? null,
      thoughts: thoughts ?? [],
    });
  } catch (err) {
    console.error("mindspace-feed unhandled", err);
    return json(500, { error: "Unexpected server error" });
  }
});
