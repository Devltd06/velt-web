// src/lib/supabaseServer.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization to prevent build-time errors
let _supabaseServer: SupabaseClient | null = null;

function getSupabaseServer(): SupabaseClient {
  if (_supabaseServer) {
    return _supabaseServer;
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var");
  }

  // Prefer service role for server operations; fall back to anon only if service role is not provided.
  const serverKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!serverKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY env var");
  }

  _supabaseServer = createClient(SUPABASE_URL, serverKey, {
    auth: {
      persistSession: false,
    },
  });

  return _supabaseServer;
}

// Export a proxy that lazily initializes
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseServer();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
