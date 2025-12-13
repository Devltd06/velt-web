/// <reference path="../_editor_shims.d.ts" />
// Editor-only: declare Deno to keep TS happy in the workspace editor (runtime provides the real Deno)
declare const Deno: any;
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Use the plain package name so the editor/tsserver resolves types from node_modules.
// The deployed function runtime accepts the `npm:` import form; this file keeps the plain import
// to keep tooling happy while still working at runtime.
import { createClient } from "@supabase/supabase-js";

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

  // Get user token from Authorization header
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Missing Authorization token" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Verify token and user
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "Invalid or expired token" });

  // Ensure user's profile row exists and role === 'admin'
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .limit(1)
    .maybeSingle();

  if (profileErr) return json(500, { error: 'Failed to load profile' });
  const role = (profileRow?.role ?? '') as string;
  // support a configurable set of acceptable admin role names
  const allowed = (Deno.env.get('SUPABASE_ADMIN_ROLES') || 'admin')
    .split(',')
    .map((s: string) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(String(role).toLowerCase())) return json(403, { error: 'Forbidden - admin only' });

  return { supabase, user: userData.user } as const;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const ctx = await getAuthContext(req);
  if (ctx instanceof Response) return ctx;
  const { supabase } = ctx;

  try {
    const body = await req.json().catch(() => ({}));
    // Validate/whitelist fields
    const payload: any = {
      sku: String(body.sku ?? '').trim(),
      title: String(body.title ?? '').trim(),
      description: String(body.description ?? '').trim() || null,
      price: typeof body.price === 'number' ? body.price : Number(body.price ?? 0),
      images: Array.isArray(body.images) ? body.images.map(String) : [],
      size: body.size ? String(body.size) : null,
      color: body.color ? String(body.color) : null,
      material: body.material ? String(body.material) : null,
      brand: body.brand ? String(body.brand) : null,
      category: body.category ? String(body.category) : null,
      stock: Number(body.stock ?? 0),
      seller_id: 'VELT',
    };

    if (!payload.sku || !payload.title || isNaN(payload.price)) {
      return json(400, { error: 'Missing sku/title/price' });
    }

    const { data, error } = await supabase.from('products').insert([payload]).select('id').single();
    if (error) {
      console.error('admin-create-product insert error', error);
      return json(500, { error: 'Failed to create product' });
    }

    return json(200, { id: data.id });
  } catch (err) {
    console.error('admin-create-product unhandled', err);
    return json(500, { error: 'Unexpected error' });
  }
});
