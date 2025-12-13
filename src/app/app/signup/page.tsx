"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaEye, FaEyeSlash, FaSpinner, FaCheckCircle } from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setIsLoading(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/app/verify`,
        },
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // Success!
      setSignupSuccess(true);
    } catch {
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: VELT_ACCENT }}
          >
            <FaCheckCircle size={40} color="#000" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Check Your Email</h1>
          <p className="text-white/60 mb-8">
            We have sent a confirmation link to <strong className="text-white">{email}</strong>.
            Please check your email and click the link to verify your account.
          </p>
          <Link
            href="/app/login"
            className="inline-block px-8 py-4 rounded-xl font-semibold transition hover:opacity-90"
            style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
          >
            Go to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-10"
          style={{ backgroundColor: VELT_ACCENT, filter: "blur(100px)", top: "20%", right: "10%" }}
          animate={{ x: [0, -50, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full opacity-10"
          style={{ backgroundColor: "#00B8E6", filter: "blur(80px)", bottom: "20%", left: "10%" }}
          animate={{ x: [0, 40, 0], y: [0, -40, 0] }}
          transition={{ duration: 14, repeat: Infinity }}
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

        {/* Signup Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold mb-2">Create Account</h1>
            <p className="text-white/60">Join VELT today</p>
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

          {/* Signup Form */}
          <form onSubmit={handleSignup} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-500/50 transition"
              />
            </div>

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
              <p className="text-xs text-white/40 mt-2">Must be at least 6 characters</p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-3 disabled:opacity-70"
              style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
            >
              {isLoading ? (
                <FaSpinner className="animate-spin" size={20} />
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center mt-8 text-white/60">
            Already have an account?{" "}
            <Link href="/app/login" className="font-semibold hover:underline" style={{ color: VELT_ACCENT }}>
              Log In
            </Link>
          </p>
        </div>

        {/* Legal Links */}
        <p className="text-center mt-6 text-white/40 text-sm">
          By signing up, you agree to our{" "}
          <Link href="/app/legal/terms" className="hover:text-white transition underline">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="hover:text-white transition underline">Privacy Policy</Link>
        </p>
      </motion.div>
    </div>
  );
}
