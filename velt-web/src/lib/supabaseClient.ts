import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient("https://jgcjndmqyzyslcupgjab.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnY2puZG1xeXp5c2xjdXBnamFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMTkwMDYsImV4cCI6MjA2Njc5NTAwNn0.N0k_BqpGUIHnVwcqraY98XNcKK5gvB6egvFeEwp2x9o");
