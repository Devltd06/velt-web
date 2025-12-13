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

type PostThoughtBody = {
  body?: string;
  topicId?: string | null;
  attachmentUri?: string | null;
};

const sanitizeAttachment = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return null;
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
  const { supabase, user } = auth;

  try {
    const body = (await req.json().catch(() => ({}))) as PostThoughtBody;
    const message = (body.body ?? "").trim();
    if (!message) {
      return json(400, { error: "body is required" });
    }
    if (message.length > 280) {
      return json(400, { error: "Thoughts are limited to 280 characters" });
    }

    let topicId: string | null = null;
    let storyId: string | null = null;
    if (body.topicId) {
      const { data: topic, error: topicErr } = await supabase
        .from("mindspace_topics")
        .select("id, story_id, active_until, released_at")
        .eq("id", body.topicId)
        .maybeSingle();

      if (topicErr) {
        console.error("mindspace-post-thought topic err", topicErr);
        return json(500, { error: "Unable to load topic" });
      }

      if (!topic) {
        return json(404, { error: "Topic not found" });
      }

      const expiresAt = topic.active_until ? Date.parse(topic.active_until) : 0;
      const expired = Boolean(topic.released_at) || (expiresAt > 0 && expiresAt < Date.now());
      if (expired) {
        return json(410, { error: "Topic is no longer active" });
      }

      topicId = topic.id;
      storyId = topic.story_id;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("mindspace-post-thought profile err", profileErr);
      return json(500, { error: "Unable to load profile" });
    }

    const nowIso = new Date().toISOString();
    const insertPayload = {
      author_id: user.id,
      author_name: profile?.full_name ?? user.user_metadata?.full_name ?? "Mindspace user",
      author_avatar: profile?.avatar_url ?? null,
      body: message,
      topic_id: topicId,
      story_id: storyId,
      attachment_url: sanitizeAttachment(body.attachmentUri ?? null),
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("mindspace_thoughts")
      .insert(insertPayload)
      .select(
        "id, author_id, author_name, author_avatar, body, created_at, topic_id, story_id, attachment_url"
      )
      .single();

    if (insertErr) {
      console.error("mindspace-post-thought insert err", insertErr);
      return json(500, { error: "Unable to post thought" });
    }

    return json(200, { thought: inserted });
  } catch (err) {
    console.error("mindspace-post-thought unhandled", err);
    return json(500, { error: "Unexpected server error" });
  }
});
