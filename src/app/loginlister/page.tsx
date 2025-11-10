"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient"; // keep your existing supabase client import

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = (params?.get("next") as string) || "/lister-plan";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setBusy(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) {
        setError(authErr.message || "Login failed");
        setBusy(false);
        return;
      }

      // Successful sign-in: redirect to ListerPlan so user can start/renew subscription
      router.push(next);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email and tap \"Forgot password\" to receive a reset link.");
      return;
    }
    setBusy(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password`,
      });
      if (resetErr) {
        setError(resetErr.message);
      } else {
        setInfo("Check your email for a password reset link.");
      }
    } catch (e: any) {
      setError(e?.message || "Unable to send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center py-16 px-6">
      <div className="max-w-2xl w-full">
        <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-600 text-white font-bold mb-3 shadow-sm">V</div>
            <h1 className="text-3xl font-extrabold">VELT — Lister Login</h1>
            <p className="mt-2 text-slate-600">Sign in to manage your Lister plan, create listings and run campaigns.</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-xl p-8 shadow-sm">
            {params?.get("paymentSuccess") === "true" && (
              <div className="mb-4 rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
                Payment successful — confirm your email (check inbox) then sign in.
              </div>
            )}

            {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
            {info && <div className="mb-4 text-sm text-blue-700">{info}</div>}

            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 mb-4 w-full border border-slate-200 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="you@example.com"
              required
            />

            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 mb-3 w-full border border-slate-200 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="••••••••"
              required
            />

            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={handleForgot}
                className="text-sm text-blue-600 hover:underline"
                disabled={busy}
              >
                Forgot password?
              </button>

              <div className="text-sm text-slate-500">
                No account? <Link href="/signup" className="text-blue-600 hover:underline">Create one</Link>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-white font-semibold ${busy ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
              disabled={busy}
            >
              {busy ? "Signing in..." : "Sign in & continue to Lister plan"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            By signing in you will be taken to your <strong>Lister plan</strong> page to start or renew your subscription.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
