"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaEye, FaEyeSlash, FaSpinner, FaCheckCircle } from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [error, setError] = useState("");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning 👋");
    else if (hour < 18) setGreeting("Good Afternoon 🌞");
    else setGreeting("Good Evening 🌙");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter your email and password.");
      setIsLoading(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // Check subscription
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("subscription_end")
        .eq("email", email)
        .maybeSingle();

      if (profileError) {
        setError("Could not fetch subscription info.");
        setIsLoading(false);
        return;
      }

      if (!profile || !profile.subscription_end) {
        setError("Subscription required. Please renew to continue.");
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const endDate = new Date(profile.subscription_end);

      if (endDate < now) {
        setError("Subscription expired. Please renew your subscription.");
        setIsLoading(false);
        return;
      }

      // Success!
      setLoginSuccess(true);
      setTimeout(() => {
        router.push("/app/home");
      }, 800);
    } catch {
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email first.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/app/reset-password`,
      });

      if (error) {
        setError(error.message);
        return;
      }

      alert("Check your email for a password reset link.");
    } catch {
      setError("Failed to send reset email.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-10"
          style={{ backgroundColor: VELT_ACCENT, filter: "blur(100px)", top: "10%", left: "10%" }}
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full opacity-10"
          style={{ backgroundColor: "#00E5A0", filter: "blur(80px)", bottom: "10%", right: "10%" }}
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back Link */}
        <Link href="/app/welcome" className="text-white/60 hover:text-white transition text-sm mb-8 block">
          ← Back to Welcome
        </Link>

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold mb-2">{greeting}</h1>
            <p className="text-white/60">Welcome back to VELT</p>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-500/50 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-500/50 transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                >
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm hover:underline transition"
                style={{ color: VELT_ACCENT }}
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || loginSuccess}
              className="w-full py-4 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-3 disabled:opacity-70"
              style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
            >
              {isLoading ? (
                <FaSpinner className="animate-spin" size={20} />
              ) : loginSuccess ? (
                <>
                  <FaCheckCircle size={20} />
                  Success!
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center mt-8 text-white/60">
            Do not have an account?{" "}
            <Link href="/app/signup" className="font-semibold hover:underline" style={{ color: VELT_ACCENT }}>
              Sign Up
            </Link>
          </p>
        </div>

        {/* Legal Links */}
        <div className="text-center mt-6 text-white/40 text-sm">
          <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
          <span className="mx-2">•</span>
          <Link href="/app/legal/terms" className="hover:text-white transition">Terms of Service</Link>
        </div>
      </motion.div>
    </div>
  );
}
