// Minimal OpenAI client helper — clean fresh replacement for previous ai agent helpers.
// This helper intentionally keeps behaviour simple and safe for a quickstart.

import { supabase } from '@/lib/supabase';

const FUNCTION_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL ? `${process.env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/functions/v1` : '';

/**
 * chatRaw(prompt)
 * - Calls a server-side function at `${FUNCTION_BASE}/openai-proxy` if configured.
 * - If no function is configured, returns null and logs a helpful message.
 */
export async function chatRaw(prompt: string): Promise<string | null> {
  if (!FUNCTION_BASE) {
    console.warn('No FUNCTIONS base configured — set EXPO_PUBLIC_SUPABASE_URL to enable server-side OpenAI proxy.');
    return null;
  }

  try {
    const session = await supabase.auth.getSession();
    const token = (session as any)?.data?.session?.access_token;

    const res = await fetch(`${FUNCTION_BASE}/openai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      console.warn('OpenAI proxy call failed', res.status, await res.text().catch(() => ''));
      return null;
    }

    const payload = await res.json().catch(() => null);
    const content = payload?.data?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.message?.content ?? payload?.content ?? null;
    if (!content) return null;

    return (content.match(/```([\s\S]*?)```/)?.[1] || content).trim();
  } catch (err) {
    console.error('chatRaw helper error', err);
    return null;
  }
}

export default { chatRaw };

