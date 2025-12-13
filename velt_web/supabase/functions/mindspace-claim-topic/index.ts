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

const resolveCover = (record: { media_url?: string | null; media_urls?: unknown }) => {
  if (record.media_url) return record.media_url;
  if (Array.isArray(record.media_urls) && record.media_urls.length && typeof record.media_urls[0] === "string") {
    return record.media_urls[0];
  }
  if (typeof record.media_urls === "string" && record.media_urls.trim()) {
    try {
      const parsed = JSON.parse(record.media_urls);
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === "string") {
        return parsed[0];
      }
    } catch (_) {}
  }
  return null;
};

type ClaimBody = {
  storyId?: string;
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
    const body = (await req.json().catch(() => ({}))) as ClaimBody;
    if (!body.storyId) {
      return json(400, { error: "storyId is required" });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Release any expired topics so the partial unique index does not block inserts.
    await supabase
      .from("mindspace_topics")
      .update({ released_at: nowIso, updated_at: nowIso })
      .is("released_at", null)
      .lte("active_until", nowIso);

    const { data: existing, error: existingErr } = await supabase
      .from("mindspace_topics")
      .select("id, active_until, created_by_name")
      .is("released_at", null)
      .eq("story_id", body.storyId)
      .maybeSingle();

    if (existingErr && existingErr.code !== "PGRST116") {
      console.error("mindspace-claim-topic existing err", existingErr);
      return json(500, { error: "Unable to check current topic" });
    }

    if (existing) {
      const expiresAt = existing.active_until ? Date.parse(existing.active_until) : 0;
      if (expiresAt === 0 || expiresAt > Date.now()) {
        return json(409, {
          error: "Story already has an active topic",
          active_until: existing.active_until,
          host: existing.created_by_name,
        });
      }

      // Expired but not yet released => release it now.
      await supabase
        .from("mindspace_topics")
        .update({ released_at: nowIso, updated_at: nowIso })
        .eq("id", existing.id);
    }

    const { count: hostCount, error: hostErr } = await supabase
      .from("mindspace_topics")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .is("released_at", null)
      .gt("active_until", nowIso);

    if (hostErr) {
      console.error("mindspace-claim-topic host limit err", hostErr);
      return json(500, { error: "Unable to validate host limit" });
    }

    if ((hostCount ?? 0) > 0) {
      return json(409, { error: "You already host an active topic" });
    }

    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select(
        "id, caption, media_url, media_urls, created_at, user_id, profiles:profiles!stories_user_id_fkey(id, full_name)"
      )
      .eq("id", body.storyId)
      .maybeSingle();

    if (storyErr) {
      console.error("mindspace-claim-topic story err", storyErr);
      return json(500, { error: "Unable to load story" });
    }

    if (!story) {
      return json(404, { error: "Story not found" });
    }

    const maxAgeMs = 1000 * 60 * 60 * 24 * 7; // one week
    if (story.created_at && Date.now() - Date.parse(story.created_at) > maxAgeMs) {
      return json(400, { error: "Only stories from the last 7 days can be claimed" });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("mindspace-claim-topic profile err", profileErr);
      return json(500, { error: "Unable to load host profile" });
    }

    const hostName = profile?.full_name ?? user.user_metadata?.full_name ?? "Mindspace host";
    const ownerName = story.profiles?.full_name ?? "Story author";
    const activeUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();

    const insertPayload = {
      story_id: story.id,
      created_by: user.id,
      created_by_name: hostName,
      story_owner_id: story.user_id,
      story_owner_name: ownerName,
      title: story.caption ?? "Untitled story",
      cover_url: resolveCover(story),
      active_until: activeUntil,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("mindspace_topics")
      .insert(insertPayload)
      .select(
        "id, story_id, title, cover_url, active_until, created_by, created_by_name, story_owner_name"
      )
      .single();

    if (insertErr) {
      console.error("mindspace-claim-topic insert err", insertErr);
      return json(500, { error: "Unable to claim topic" });
    }

    return json(200, { topic: inserted });
  } catch (err) {
    console.error("mindspace-claim-topic unhandled", err);
    return json(500, { error: "Unexpected server error" });
  }
});
