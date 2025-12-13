/**
 * scripts/get_token.js
 * Dev helper: sign in a test user and print the access token for quick testing of functions.
 * Usage:
 * 1) Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your local .env
 * 2) Optionally add TEST_USER_EMAIL and TEST_USER_PASSWORD to the .env (or edit below)
 * 3) node scripts/get_token.js
 *
 * NOTE: This signs in a user via the anon key and returns their access_token — keep tokens private.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.TEST_USER_EMAIL || 'test@example.com';
const password = process.env.TEST_USER_PASSWORD || 'Password123!';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env first.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function main() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Sign-in failed:', error.message ?? error);
      // Try sign-up if user doesn't exist
      const { data: signup, error: signupErr } = await supabase.auth.signUp({ email, password });
      if (signupErr) {
        console.error('Sign-up also failed:', signupErr.message ?? signupErr);
        process.exit(1);
      }
      console.log('Sign-up successful — please verify the user in the dashboard if required. Re-run the script.');
      process.exit(0);
    }

    // avoid TypeScript-style cast in plain JS files — use plain optional chaining
    const token = data?.session?.access_token;
    if (!token) {
      console.error('No access token returned. Check sign-in result:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('\n--- USER ACCESS TOKEN (use this for test calls) ---\n');
    console.log(token);
    console.log('\n--- END TOKEN ---\n');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

main();
