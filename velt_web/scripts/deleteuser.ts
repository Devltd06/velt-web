import 'dotenv/config'; // This MUST come before anything that uses env vars
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// the rest of your logic...
