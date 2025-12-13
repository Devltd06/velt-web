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

type ActiveTopicBody = {
  topicId?: string;
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
    const body = (await req.json().catch(() => ({}))) as ActiveTopicBody;
    if (!body.topicId) {
      return json(400, { error: "topicId is required" });
    }

    const { data: topic, error: topicErr } = await supabase
      .from("mindspace_topics")
      .select(
        "id, story_id, title, cover_url, active_until, released_at, created_by, created_by_name, story_owner_name"
      )
      .eq("id", body.topicId)
      .limit(1)
      .maybeSingle();

    if (topicErr) {
      console.error("mindspace-active-topic query err", topicErr);
      return json(500, { error: "Unable to load topic" });
    }

    if (!topic) {
      return json(404, { error: "Topic not found" });
    }

    const expiresAt = topic.active_until ? Date.parse(topic.active_until) : 0;
    const expired = Boolean(topic.released_at) || (expiresAt > 0 && expiresAt < Date.now());

    return json(200, {
      topic: {
        id: topic.id,
        story_id: topic.story_id,
        title: topic.title,
        cover_url: topic.cover_url,
        active_until: topic.active_until,
        created_by: topic.created_by,
        created_by_name: topic.created_by_name,
        story_owner_name: topic.story_owner_name,
        expired,
      },
    });
  } catch (err) {
    console.error("mindspace-active-topic unhandled", err);
    return json(500, { error: "Unexpected server error" });
  }
});
