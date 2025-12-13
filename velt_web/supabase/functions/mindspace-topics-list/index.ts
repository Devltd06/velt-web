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

const mediaFromStory = (story: { media_url?: string | null; media_urls?: unknown }) => {
  if (story.media_url) return story.media_url;
  if (Array.isArray(story.media_urls) && story.media_urls.length && typeof story.media_urls[0] === "string") {
    return story.media_urls[0];
  }
  if (typeof story.media_urls === "string" && story.media_urls.trim()) {
    try {
      const parsed = JSON.parse(story.media_urls);
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === "string") {
        return parsed[0];
      }
    } catch (_) {
      // ignore parse errors – fall through to undefined cover
    }
  }
  return null;
};

type TopicsBody = {
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
    const body = (await req.json().catch(() => ({}))) as TopicsBody;
    const rawLimit = typeof body.limit === "number" ? body.limit : 40;
    const limit = Math.min(Math.max(Math.floor(rawLimit) || 40, 10), 120);
    const cutoffIso = new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString();

    const { data: activeRows, error: activeErr } = await supabase
      .from("mindspace_topics")
      .select("story_id, active_until, created_by_name")
      .is("released_at", null);
    if (activeErr) {
      console.error("mindspace-topics-list active err", activeErr);
      return json(500, { error: "Unable to load active topics" });
    }
    const activeMap = new Map<string, { active_until: string | null; created_by_name: string | null }>();
    (activeRows ?? []).forEach((row) => {
      if (row.story_id) {
        activeMap.set(row.story_id, {
          active_until: row.active_until ?? null,
          created_by_name: row.created_by_name ?? null,
        });
      }
    });

    const { data: stories, error: storiesErr } = await supabase
      .from("stories")
      .select(
        "id, caption, media_url, media_urls, created_at, user_id, profiles:profiles!stories_user_id_fkey(id, full_name)"
      )
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (storiesErr) {
      console.error("mindspace-topics-list stories err", storiesErr);
      return json(500, { error: "Unable to load stories" });
    }

    const now = Date.now();
    const topics = (stories ?? []).map((story) => {
      const active = activeMap.get(story.id);
      const activeUntilTs = active?.active_until ? Date.parse(active.active_until) : 0;
      return {
        story_id: story.id,
        title: story.caption ?? "Untitled story",
        cover_url: mediaFromStory(story),
        owner_name: story.profiles?.full_name ?? "Someone you follow",
        active: Boolean(active && activeUntilTs > now),
        active_until: active?.active_until ?? null,
        active_by: active?.created_by_name ?? null,
      };
    });

    return json(200, { topics });
  } catch (err) {
    console.error("mindspace-topics-list unhandled", err);
    return json(500, { error: "Unexpected server error" });
  }
});
