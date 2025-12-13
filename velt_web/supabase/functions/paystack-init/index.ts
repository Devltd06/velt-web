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

async function getAuthContext(req: Request) {
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

  return { supabase, user: data.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // require auth
  const auth = await getAuthContext(req);
  if (auth instanceof Response) return auth;
  const { user, supabase: sb } = auth as any;

  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const amount = Number(body?.amount ?? 0);
    // allow clients to pass an optional currency (e.g., 'GHS' or 'NGN')
    const currency = String(body?.currency ?? 'GHS').toUpperCase();
    const email = String(body?.email ?? user?.email ?? "");
    if (!amount || amount <= 0) return json(400, { error: "Invalid amount" });

    const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET) {
      console.error('paystack-init: missing PAYSTACK_SECRET_KEY');
      return json(500, { error: "Paystack not configured" });
    }

    // Paystack expects amount in kobo (for NGN) — client should pass smallest currency unit or we assume GHS and pass cedi minor units accordingly.
    // We'll accept `amount` as a decimal major units (e.g., 50.20) and multiply by 100.
    const amountInKobo = Math.round(amount * 100);

    const payload = {
      email,
      amount: amountInKobo,
      currency,
      // you can set a callback_url if you have a deep link registered; omitted here so client will poll verify
    } as any;

    // create a payments row to track this transaction before contacting Paystack
    let paymentRecord: any = null;
    try {
      const { data: p, error: pErr } = await sb.from('payments').insert({ reference: null, user_id: user?.id ?? null, amount, currency, status: 'pending', metadata: body }).select('*').single();
      if (pErr) {
        console.warn('could not insert payment row', pErr);
      } else {
        paymentRecord = p;
      }
    } catch (insErr) {
      console.warn('insert payment row exception', insErr);
    }

    // call Paystack with a short timeout — fail fast to avoid function timeout
    const controller = new AbortController();
    const timeoutMs = 10000; // 10s
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let initRes: Response;
    try {
      initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      console.error('paystack-init fetch error', String(fetchErr));
      // If aborted, return a 504 so client knows the upstream timed out
      if (String(fetchErr).toLowerCase().includes('aborted')) {
        // update payment row to failed/timed_out
        try { if (paymentRecord?.id) await sb.from('payments').update({ status: 'failed', gateway_response: { error: 'timeout' }, updated_at: new Date().toISOString() }).eq('id', paymentRecord.id); } catch {}
        return json(504, { error: 'Paystack request timed out' });
      }
      try { if (paymentRecord?.id) await sb.from('payments').update({ status: 'failed', gateway_response: { error: String(fetchErr) }, updated_at: new Date().toISOString() }).eq('id', paymentRecord.id); } catch {}
      return json(502, { error: 'Paystack request failed', details: String(fetchErr) });
    }
    clearTimeout(timeout);

    const j = await initRes.json().catch(() => ({}));
    if (!initRes.ok) {
      console.error('paystack init failed', { status: initRes.status, body: j });
      try { if (paymentRecord?.id) await sb.from('payments').update({ status: 'failed', gateway_response: j, reference: j?.data?.reference ?? null, updated_at: new Date().toISOString() }).eq('id', paymentRecord.id); } catch {}
      // if Paystack error looks like a currency mismatch surface a helpful message for the app
      const detailMsg = JSON.stringify(j || {});
      if (detailMsg.toLowerCase().includes('currency') || (j && (j.message || '').toLowerCase().includes('currency') )) {
        return json(400, { error: 'Currency not supported by Paystack merchant. Ensure merchant account supports this currency (GHS).', details: j });
      }
      // otherwise surface Paystack's error payload
      return json(initRes.status >= 400 && initRes.status < 600 ? initRes.status : 502, { error: 'Paystack initialization failed', details: j });
    }

    // success -> update payment record with reference and returned payload
    try {
      const ref = j?.data?.reference ?? null;
      const payloadResponse = j?.data ?? j;
      if (paymentRecord?.id) {
        await sb.from('payments').update({ reference: ref, gateway_response: payloadResponse, updated_at: new Date().toISOString() }).eq('id', paymentRecord.id);
      }
    } catch (uErr) { console.warn('failed to update payment record after init', uErr); }

    // success -> return authorization_url and reference
    return json(200, { ok: true, data: j.data ?? null });
  } catch (err: any) {
    console.error('paystack-init error', err);
    return json(500, { error: err?.message ?? String(err) });
  }
});
