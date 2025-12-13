AI Quickstart — minimal, secure setup

This quickstart shows the minimal steps to get a simple ChatGPT-style assistant running safely in this repo.

Goals
- Keep the OpenAI API key only on the server (Supabase functions or other server-side host).
- Provide a tiny client helper and a minimal chat UI so you can test conversational flows locally.

Files used
- supabase/functions/openai-proxy/index.ts — server-side proxy that forwards requests to OpenAI using the secret OPENAI_API_KEY.
- utils/openai.ts — minimal client helper that calls the server function and returns raw assistant content.
- app/aisearch.tsx — minimal ChatGPT-style UI that calls chatRaw() in utils/openai.ts.
- scripts/get_token.js — dev helper to sign in a test user and print their access token for calling the function.

Prerequisites (required)
1) Add server secrets to your Supabase functions (do not commit these values):

   supabase secrets set OPENAI_API_KEY="sk-..."
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

2) Deploy the function:

   supabase functions deploy openai-proxy

3) Make sure your client app has the public values set (local dev):

   setx EXPO_PUBLIC_SUPABASE_URL "https://<project>.supabase.co"
   setx EXPO_PUBLIC_SUPABASE_ANON_KEY "<anon-key>"

Testing the function
1) Obtain a valid user's access token (use the included script):

   node scripts/get_token.js

2) Call the function using the returned access token (PowerShell example):

   $token = '<USER_ACCESS_TOKEN>'
   $body = '{"prompt":"Hello from the quickstart — keep replies short."}'
   Invoke-RestMethod -Method Post -Uri "https://<project>.functions.supabase.co/openai-proxy" -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } -Body $body

Notes & troubleshooting
- If you get 401: make sure you're passing a valid user *access* token (not a refresh token) and SUPABASE_SERVICE_ROLE_KEY is set in function secrets.
- If you get 502: check function logs in the Supabase CLI / dashboard. Confirm OPENAI_API_KEY is present in secrets and the function can reach api.openai.com.
- Keep OPENAI_API_KEY only in server-side secrets — never put it in client `.env` or code.

Next steps
- Use app/aisearch.tsx and utils/openai.ts as a minimal starting point. We can extend to structured agent actions later.
