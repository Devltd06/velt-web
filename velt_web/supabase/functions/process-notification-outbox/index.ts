// Outbox processor for Supabase Edge Function (Deno).
// Polls `notification_outbox`, sends push via your `send-push-notification` function,
// and updates outbox rows with retries and error handling.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUSH_FN_PATH = "/functions/v1/send-push-notification"; // adjust if your function path differs

const MAX_ATTEMPTS = 5;
const BATCH_LIMIT = 50;

async function fetchOutboxBatch(limit = BATCH_LIMIT) {
  const url = `${SUPABASE_URL}/rest/v1/notification_outbox?processed=eq.false&select=id,notification_id,payload,attempts,created_at&order=created_at.asc&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });
  if (!res.ok) throw new Error(`outbox fetch failed: ${res.status}`);
  return await res.json();
}

async function patchOutbox(id: string, patch: Record<string, any>) {
  const url = `${SUPABASE_URL}/rest/v1/notification_outbox?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`outbox patch failed ${res.status} ${txt}`);
  }
  return true;
}

async function callPushFunction(payload: any) {
  const url = `${SUPABASE_URL}${PUSH_FN_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: text };
}

serve(async () => {
  try {
    const rows = await fetchOutboxBatch();
    for (const row of rows) {
      const id: string = row.id;
      const attempts: number = row.attempts ?? 0;
      const payload = row.payload ?? {};

      if (attempts >= MAX_ATTEMPTS) {
        // give up and mark processed to avoid infinite retries
        try {
          await patchOutbox(id, { processed: true, processed_at: new Date().toISOString() });
        } catch (e) {
          console.error("failed to mark outbox as processed after max attempts", id, e);
        }
        continue;
      }

      try {
        const pushPayload = {
          userId: payload.recipient,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        };

        const result = await callPushFunction(pushPayload);
        if (result.ok) {
          await patchOutbox(id, { processed: true, processed_at: new Date().toISOString() });
        } else {
          // increment attempts and leave unprocessed for retry
          await patchOutbox(id, { attempts: attempts + 1 });
          console.error(`push function failed for outbox ${id}: ${result.status} ${result.body}`);
        }
      } catch (err) {
        console.error("error processing outbox", id, err);
        try {
          await patchOutbox(id, { attempts: attempts + 1 });
        } catch (e) {
          console.error("failed to increment attempts for outbox", id, e);
        }
      }
    }

    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});