# process-notification-outbox

This Edge Function processes `notification_outbox` rows and delivers push notifications by calling the existing `send-push-notification` Edge Function.

Required env vars (set when deploying the function):
- `SUPABASE_URL` – your Supabase project URL (e.g. https://xyz.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` – your service role key (keep secret)

Deploy (Supabase CLI):
```powershell
# from repo root
supabase functions deploy process-notification-outbox --project-ref <PROJECT_REF>
```

Invoke locally / test:
```powershell
# invoke once via CLI (reads env configured in supabase)
supabase functions invoke process-notification-outbox --project-ref <PROJECT_REF>
```

Scheduling:
- Supabase offers scheduled functions in the dashboard; alternatively use GitHub Actions or any cron scheduler to hit the function periodically.
- Recommended cadence: every 30s–2m depending on traffic.

Behavior notes:
- The function processes unprocessed rows in `notification_outbox` (max batch size configurable in the function code).
- For each row it calls `send-push-notification` with a JSON body like `{ userId, title, body, data }`.
- The function implements retry attempts and marks rows as `processed` after successful delivery, or increments `attempts` on failure.

Security:
- The function uses the Supabase REST endpoint with the `SERVICE_ROLE` key to read/patch the `notification_outbox` table. Keep this key secret.

Troubleshooting:
- If rows remain unprocessed, check function logs in Supabase; look for errors when calling `send-push-notification` or REST permission errors.
- If `send-push-notification` returns non-200, the outbox attempt is incremented and retried until max attempts.
