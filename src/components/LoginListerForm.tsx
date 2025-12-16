// src/components/LoginListerForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginListerForm() {
  const router = useRouter();
  const params = useSearchParams();
  const paymentSuccess = params?.get("paymentSuccess") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "info" | "error"; text: string } | null>(null);

  async function handleSignIn(e?: React.FormEvent) {
    e?.preventDefault();
    setMessage(null);
    if (!email || !password) {
      setMessage({ type: "error", text: "Email and password are required." });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message || "Sign in failed." });
        setBusy(false);
        return;
      }
      router.push("/ListerPlan");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    setMessage(null);
    if (!email) {
      setMessage({ type: "error", text: "Enter your email to receive a reset link." });
      return;
    }
    setBusy(true);
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) setMessage({ type: "error", text: error.message });
      else setMessage({ type: "info", text: "Check your inbox for a reset link." });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unable to send reset link.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)] py-16 px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold">Lister Login</h1>
          <p className="mt-2 text-[var(--foreground)]/70">Sign in to manage your subscriptions.</p>
        </div>

        <form onSubmit={handleSignIn} className="bg-[var(--background)] border border-[var(--foreground)]/20 rounded-xl p-6 shadow-sm">
          {paymentSuccess && (
            <div className="mb-4 rounded-md border border-[var(--foreground)]/30 bg-[var(--foreground)]/5 p-3 text-sm">
              Payment successful. Please sign in to continue.
            </div>
          )}

          {message && (
            <div className={`mb-4 text-sm rounded-md p-3 ${message.type === "error" ? "text-red-500 bg-red-500/10 border border-red-500/30" : "text-green-500 bg-green-500/10 border border-green-500/30"}`}>
              {message.text}
            </div>
          )}

          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[var(--foreground)]/20 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-[var(--foreground)]/50 bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--foreground)]/40 mb-4"
            placeholder="you@example.com"
            required
          />

          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-[var(--foreground)]/20 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-[var(--foreground)]/50 bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--foreground)]/40 mb-6"
            placeholder="••••••••"
            required
          />

          <div className="flex items-center justify-between mb-6">
            <button type="button" className="text-sm font-medium underline text-[var(--foreground)] hover:opacity-70" onClick={handleForgot} disabled={busy}>
              Forgot password?
            </button>

            <div className="text-sm text-[var(--foreground)]/70">
              No account? <Link href="/signup" className="font-medium underline text-[var(--foreground)]">Create one</Link>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 font-semibold transition bg-[var(--foreground)] text-[var(--background)] ${busy ? "opacity-60" : "hover:opacity-80"}`}
            disabled={busy}
          >
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-sm text-[var(--foreground)]/70 text-center">After signing in, you will be taken to your Lister plan page.</div>
      </div>
    </div>
  );
}
