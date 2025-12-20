import { createClient } from "@supabase/supabase-js";

// Use environment variables with fallback to hardcoded values for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jgcjndmqyzyslcupgjab.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnY2puZG1xeXp5c2xjdXBnamFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMTkwMDYsImV4cCI6MjA2Njc5NTAwNn0.N0k_BqpGUIHnVwcqraY98XNcKK5gvB6egvFeEwp2x9o";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service role key (bypasses RLS)
// Only use this for admin pages that need to see all data
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "";
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : supabase; // Fallback to regular client if no service key
