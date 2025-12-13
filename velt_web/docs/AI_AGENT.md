This file has been replaced by a minimal quickstart and cleaned UI. See `docs/AI_QUICKSTART.md` for the new, simplified developer guide and instructions.

Key files

- `app/aisearch.tsx` — the simplified ChatGPT-style chat UI (user messages + assistant replies)
- `utils/openai.ts` — client helper that calls your Supabase Edge Function `openai-proxy`. Use `chatRaw()` for free-form assistant replies.
- `supabase/functions/openai-proxy` — edge function that securely forwards prompts to OpenAI using a server-side secret (OPENAI_API_KEY)

Important notes

- Keep your OpenAI API key server-side. DO NOT add it to client code or `.env` in the client. Use Supabase secrets (or secure server secrets).

Quick setup

1. Add secrets to Supabase functions (do not commit keys):

```bash
supabase secrets set OPENAI_API_KEY="sk-..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```

2. Deploy the function (if not already deployed):

```bash
supabase functions deploy openai-proxy
```

3. Ensure your client has the public values set so it can call your function endpoint:

```bash
# in local dev set these environment variables
setx EXPO_PUBLIC_SUPABASE_URL "https://<project>.supabase.co"
setx EXPO_PUBLIC_SUPABASE_ANON_KEY "<anon-key>"
```

How the client talks to OpenAI

- The client calls the `openai-proxy` Supabase function. The function validates the caller token with your `SUPABASE_SERVICE_ROLE_KEY` and forwards prompts to OpenAI using `OPENAI_API_KEY` stored as a secret. This keeps keys secure and makes the function the only place where the OpenAI key exists.

Testing & troubleshooting

- Inspect function logs while testing to see errors or blocked requests:

```bash
supabase functions logs openai-proxy
```

- Test the function from the command line (requires a valid user's access token):

```bash
curl -X POST "https://<project>.functions.supabase.co/openai-proxy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -d '{"prompt":"Hello, give me a short answer."}'
```

- Debug tips when "nothing works":
  - Confirm the function is deployed and shows no errors in the Supabase dashboard.
  - Confirm `OPENAI_API_KEY` is present in Supabase secrets.
  - Verify the client is authenticating (a signed-in user will supply a token used by the function to verify the caller).
  - Use `supabase functions logs openai-proxy` to review runtime errors.

Notes on "web browsing" and citations

- The assistant's replies depend on the model and the prompt. If you want the assistant to verify answers against live web pages, consider implementing a web-retrieval step before sending the prompt (fetch search results / snippets with a web-search API like SerpAPI or Bing, then provide those snippets in the model prompt). I can add a retrieval + citation flow if you want.

This repo used to include a structured "agent" implementation. That work has been archived into `/archive/` and replaced with a minimal, easy-to-follow quickstart. If you need to restore the agent implementation, look in `archive/` for backups of the modified files.

Important setup

1. Create an environment variable OPENAI_API_KEY for the Supabase Edge Function runtime (do NOT commit keys to the repo). For Supabase functions you can add the secret using the Supabase CLI or the dashboard. Example (Supabase CLI):

```bash
supabase secrets set OPENAI_API_KEY="sk-..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```

Also ensure your Supabase function has SUPABASE_URL set (usually configured for the project) and your client app has the public values `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

How the agent works

- When Agent mode is OFF: `aisearch` uses the local knowledge router (`searchKnowledge`) that reads app docs and Supabase tables and returns sanitized results.
- When Agent mode is ON: the UI calls `chatAssistant` which asks the LLM to return a single JSON object like:

```
{ "intent":"send_message", "confidence":0.95, "text":"I can send that message for you.", "actions": { "recipient": "@alice", "text": "Hi Alice!" } }
```

- The app shows the assistant text and offers a primary "Do" button to execute the suggested action (send message, open a product page, or open billboard creator). All actions use sanitized display fields — we never display backend IDs to the end user.

Testing & manual QA

1. Deploy the Supabase Edge Function `openai-proxy` and configure `OPENAI_API_KEY` using the examples above. Then run the app and visit the AI screen at `app/aisearch.tsx`.
2. Try toggling Agent ON, then ask commands like:
   - "Send message to @alice: Hi — can we meet?"
   - "Find phones under 1000 and buy the best one"
   - "Book a billboard for next week"
3. If the assistant returns a structured action you can press `Do` or the specific action button (e.g. Send message) and confirm.

Notes

- The assistant deliberately returns sanitized fields and short replies. It won't reveal raw DB ids.
- For production, ensure you do not hardcode any API keys. Use server-side functions or secure runtime env configuration. Consider routing calls via your backend / serverless API to keep API keys off client bundles.

Security & configuration checklist

- Add secret OPENAI_API_KEY to Supabase functions (or your backend host) — do not push to Git.
- If you want to require signed-in users for calls, configure the function to validate the user's Authorization bearer token. The `openai-proxy` function included in this repo validates tokens using SUPABASE_SERVICE_ROLE_KEY.
- On the client set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY so the app uses the function endpoint.
