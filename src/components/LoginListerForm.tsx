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
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || String(err) });
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
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Unable to send reset link." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 py-16 px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-600 text-white font-bold mb-3 shadow-sm">V</div>
          <h1 className="text-2xl font-extrabold">Lister Login</h1>
          <p className="mt-2 text-slate-600">Sign in to manage your Lister plan and subscriptions.</p>
        </div>

        <form onSubmit={handleSignIn} className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
          {paymentSuccess && (
            <div className="mb-4 rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              Payment successful — please sign in to continue.
            </div>
          )}

          {message && <div className={`mb-4 text-sm ${message.type === "error" ? "text-red-600" : "text-blue-700"}`}>{message.text}</div>}

          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 mb-4 w-full border border-slate-200 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="you@example.com"
            required
          />

          <label className="block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 mb-3 w-full border border-slate-200 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="••••••••"
            required
          />

          <div className="flex items-center justify-between mb-6">
            <button type="button" className="text-sm text-blue-600 hover:underline" onClick={handleForgot} disabled={busy}>
              Forgot password?
            </button>

            <div className="text-sm text-slate-500">
              No account? <Link href="/signup" className="text-blue-600 hover:underline">Create account</Link>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-white font-semibold ${busy ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
            disabled={busy}
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-500 text-center">After signing in you'll be taken to the Lister plan page to start or renew your subscription.</div>
      </div>
    </div>
  );
}
