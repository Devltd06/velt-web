// src/lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

// Read from environment only (do NOT commit secrets).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var");
}

// Prefer service role for server operations; fall back to anon only if service role is not provided.
// IMPORTANT: Try to always provide SUPABASE_SERVICE_ROLE_KEY in server environment.
const serverKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
if (!serverKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY env var");
}

export const supabaseServer = createClient(SUPABASE_URL, serverKey, {
  auth: {
    // disable cookies on server client by default
    persistSession: false,
  },
});
