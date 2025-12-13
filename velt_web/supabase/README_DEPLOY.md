Supabase deployment quick guide
================================

This project uses SQL migrations to set up the personalization pipeline — the pipeline is function-free (clients write watch events directly to the DB) so these instructions focus on applying migrations only.

Preflight
--------
- Install Supabase CLI: https://supabase.com/docs/guides/cli
- Log in: supabase login
- Set environment variables locally for convenience (PowerShell example):

```powershell
$Env:SUPABASE_PROJECT_REF='your-project-ref'
$Env:SUPABASE_SERVICE_ROLE_KEY='service_role_...'
$Env:SUPABASE_URL='https://<your-project>.supabase.co'
$Env:PAYSTACK_SECRET_KEY='sk_test_...'
```

Deploy steps
------------
1. Apply SQL migrations (see `supabase/scripts/deploy-db-instructions.md`) — use Dashboard SQL editor or CLI.
2. Edge functions: Not required for the personalization pipeline. If your project uses other Edge Functions (e.g., payment webhooks), deploy them separately with the helpers in `supabase/scripts`.

Voice recordings DB migration
-----------------------------

We've added a migration file at `supabase/sql/2025-12-04-01-create-voice-recordings.sql` to create a `voice_recordings` table for storing voice note metadata (duration, waveform, Cloudinary id, size, and a reference to `messages`).

This project also now includes the Location feature migration that creates tables and helpers for `location_posts`, `location_post_stars`, and `location_post_comments`. See `supabase/sql/2025-12-08-01-create-location-posts-stars-comments.sql`.

Apply migrations via one of the following methods:

- Supabase SQL editor (Dashboard): copy & paste the SQL file and run it from your project's SQL editor.
- Supabase CLI (migrations): add the file to your migrations folder and run:

```powershell
# push migrations using supabase CLI from the repo root (if configured):
supabase db push --project-ref $Env:SUPABASE_PROJECT_REF
```

Or run directly with psql against your Supabase Postgres if you have connection string access:

```powershell
psql "$Env:SUPABASE_URL" -c "\i supabase/sql/2025-12-04-01-create-voice-recordings.sql"
```

Notes:
- Ensure `pgcrypto` or appropriate UUID functions are available (Supabase typically supports gen_random_uuid()).
- Consider RLS policies for this table: allow authenticated inserts where `auth.uid() = sender_id` and restrict reads appropriately.

Cloudinary presets for chat uploads
----------------------------------

The app expects two upload presets in Cloudinary:

- `chatsuploads` — default preset used for images/video/files (already configured in `app.config.js`).
- `chat_rec` — dedicated preset for voice recording uploads (used by chat uploads). Create this preset in the Cloudinary console and ensure any transformations and upload options you need (e.g., audio format, moderation, access control) are set.

If you'd like, I can add server-side code to populate the `voice_recordings` table after a successful upload (eg, via your existing voice API workflow). 

3. Validate functions are deployed and have secrets set (Dashboard -> Edge Functions -> Environment variables). The scripts set secrets via `supabase secrets set`.

Check logs & debug
------------------
- View function logs (CLI):

```powershell
supabase functions logs paystack-init --project-ref $Env:SUPABASE_PROJECT_REF
supabase functions logs paystack-complete --project-ref $Env:SUPABASE_PROJECT_REF
```

- If you see `504` with long execution time, supabase function likely hit platform timeout — ensure the function has a short upstream timeout and Paystack responds. The functions in this repo abort after 10s against Paystack to avoid long hanging executions.

Troubleshooting tips
--------------------
- Ensure `PAYSTACK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set as secrets for the project.
- If using local dev, ensure the client JWT is present (app must be logged in) — functions are protected and require an Authorization header.

If you'd like, I can:
- Add a GitHub Action to automatically deploy functions on push to main.
- Add a sample webhook handler for Paystack so you can rely on webhooks instead of polling.
