// src/lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use the service role key when present for server-side operations.
// If you don't have a service role key yet, this will fall back to anon (less secure).
export const supabaseServer = createClient("https://jgcjndmqyzyslcupgjab.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnY2puZG1xeXp5c2xjdXBnamFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMTkwMDYsImV4cCI6MjA2Njc5NTAwNn0.N0k_BqpGUIHnVwcqraY98XNcKK5gvB6egvFeEwp2x9o");
