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
    <div className="min-h-screen flex items-center justify-center bg-white text-black py-16 px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-black">Lister Login</h1>
          <p className="mt-2 text-gray-700">Sign in to manage your subscriptions.</p>
        </div>

        <form onSubmit={handleSignIn} className="bg-white border border-gray-300 rounded-xl p-6 shadow-sm">
          {paymentSuccess && (
            <div className="mb-4 rounded-md border p-3 text-sm" style={{ backgroundColor: "#faf5f0", borderColor: "#d4af37", color: "#000000" }}>
              Payment successful. Please sign in to continue.
            </div>
          )}

          {message && (
            <div className={`mb-4 text-sm rounded-md p-3 ${message.type === "error" ? "text-red-700 bg-red-50 border border-red-300" : "text-green-700 bg-green-50 border border-green-300"}`}>
              {message.text}
            </div>
          )}

          <label className="block text-sm font-medium text-black mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent text-black placeholder-gray-400 mb-4"
            placeholder="you@example.com"
            required
          />

          <label className="block text-sm font-medium text-black mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent text-black placeholder-gray-400 mb-6"
            placeholder="••••••••"
            required
          />

          <div className="flex items-center justify-between mb-6">
            <button type="button" className="text-sm font-medium underline" style={{ color: "#d4af37" }} onClick={handleForgot} disabled={busy}>
              Forgot password?
            </button>

            <div className="text-sm text-gray-700">
              No account? <Link href="/signup" className="font-medium underline" style={{ color: "#d4af37" }}>Create one</Link>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-black font-semibold transition ${busy ? "opacity-60" : "hover:opacity-90"}`}
            style={{ backgroundColor: "#d4af37" }}
            disabled={busy}
          >
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-700 text-center">After signing in, you will be taken to your Lister plan page.</div>
      </div>
    </div>
  );
}
