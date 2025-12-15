"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaEnvelope, FaLock, FaCheckCircle, FaExclamationTriangle, FaCrown, FaArrowRight, FaUser, FaMobileAlt } from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const GOLD = "#D4AF37";

// Single Premium Plan
const PREMIUM_PLAN = {
  id: "premium",
  name: "Premium Plan",
  priceGHS: 25,
  features: [
    "Unlimited uploads",
    "Analytics dashboard",
    "Priority support",
    "Verified badge",
    "All premium features"
  ]
};

type Step = "signin" | "welcome" | "active" | "select" | "payment" | "success";

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  role?: string;
  profession?: string;
  subscription_expires_at?: string;
  subscription_plan?: string;
}

export default function RenewSubscriptionPage() {
  const [step, setStep] = useState<Step>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<typeof PREMIUM_PLAN | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [subscriptionExpired, setSubscriptionExpired] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    checkExistingSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkExistingSession() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await loadUserProfile(authUser.id, authUser.email || "", true);
      }
    } catch {
      // No existing session
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function loadUserProfile(userId: string, userEmail: string, isAutoLogin: boolean = false) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profile) {
        const userProfile: UserProfile = {
          id: userId,
          email: userEmail,
          username: profile.username,
          full_name: profile.full_name,
          role: profile.role,
          profession: profile.profession || profile.bio,
          subscription_expires_at: profile.subscription_expires_at,
          subscription_plan: profile.subscription_plan,
        };
        setUser(userProfile);

        // Check subscription status
        if (profile.subscription_expires_at) {
          const expiresAt = new Date(profile.subscription_expires_at);
          const now = new Date();
          
          // Debug logging
          console.log("Subscription check:", {
            expires_at_raw: profile.subscription_expires_at,
            expires_at_parsed: expiresAt.toISOString(),
            now: now.toISOString(),
            isActive: expiresAt > now
          });
          
          // Direct date comparison (more reliable than diff calculation)
          if (expiresAt > now) {
            // Subscription is still active
            const diffTime = expiresAt.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays);
            setSubscriptionExpired(false);
            setStep("active");
          } else {
            // Subscription expired - show welcome then select
            setSubscriptionExpired(true);
            setStep("welcome");
          }
        } else {
          // No subscription - show welcome then select
          setSubscriptionExpired(true);
          setStep("welcome");
        }
      } else {
        setStep("select");
      }
    } catch {
      setStep("select");
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        await loadUserProfile(data.user.id, data.user.email || email);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Sign in failed. Please check your credentials.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function proceedToSelectPlan() {
    setStep("select");
  }

  function handleSelectPlan(plan: typeof PREMIUM_PLAN) {
    setSelectedPlan(plan);
    setStep("payment");
  }

  async function handlePayment() {
    if (!selectedPlan || !user) return;
    setLoading(true);

    try {
      // Load Paystack
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      
      script.onload = () => {
        const handler = (window as unknown as { PaystackPop: { setup: (config: {
          key: string;
          email: string;
          amount: number;
          currency: string;
          ref: string;
          onClose: () => void;
          callback: (response: { reference: string }) => void;
        }) => { openIframe: () => void } } }).PaystackPop.setup({
          key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_xxxxx",
          email: user.email,
          amount: selectedPlan.priceGHS * 100, // Amount in pesewas (GHS)
          currency: "GHS",
          ref: `renew_${user.id}_${Date.now()}`,
          onClose: () => {
            setLoading(false);
          },
          callback: async () => {
            // Payment successful - update subscription
            const newExpiry = new Date();
            newExpiry.setMonth(newExpiry.getMonth() + 1);

            await supabase
              .from("profiles")
              .update({
                subscription_plan: selectedPlan.id,
                subscription_expires_at: newExpiry.toISOString(),
                role: selectedPlan.id,
              })
              .eq("id", user.id);

            setStep("success");
            setLoading(false);
          },
        });
        handler.openIframe();
      };

      document.body.appendChild(script);
    } catch {
      setError("Payment initialization failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Progress Steps - only show for expired subscriptions */}
        {subscriptionExpired && step !== "active" && (
          <div className="flex items-center justify-center mb-8">
            {["Sign In", "Welcome", "Select Plan", "Payment"].map((label, idx) => {
              const steps: Step[] = ["signin", "welcome", "select", "payment"];
              const currentIdx = steps.indexOf(step);
              const isActive = currentIdx >= idx;
              const isCurrent = steps[idx] === step;
              
              return (
                <div key={label} className="flex items-center">
                  <motion.div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isActive ? "text-black" : "bg-gray-200 text-gray-500"
                    }`}
                    style={{ backgroundColor: isActive ? GOLD : undefined }}
                    animate={{ scale: isCurrent ? 1.1 : 1 }}
                >
                  {idx + 1}
                </motion.div>
                {idx < 3 && (
                  <div className={`w-8 h-1 mx-1 rounded ${isActive ? "bg-amber-300" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: Sign In */}
          {step === "signin" && (
            <motion.div
              key="signin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
                  <FaCrown className="text-2xl" style={{ color: GOLD }} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Renew Subscription</h1>
                <p className="text-gray-600 mt-2">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold text-black transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: GOLD }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In & Continue
                      <FaArrowRight />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-gray-600 mt-6 text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold hover:underline" style={{ color: GOLD }}>
                  Sign Up
                </Link>
              </p>
            </motion.div>
          )}

          {/* STEP 2: Welcome - Show user info after sign in */}
          {step === "welcome" && user && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${GOLD}20` }}
                >
                  <FaUser className="text-3xl" style={{ color: GOLD }} />
                </motion.div>
                
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold text-gray-900 mb-1"
                >
                  Welcome back!
                </motion.h2>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <p className="text-xl font-semibold" style={{ color: GOLD }}>
                    @{user.username || "user"}
                  </p>
                  {user.full_name && (
                    <p className="text-gray-600 mt-1">{user.full_name}</p>
                  )}
                </motion.div>

                {user.profession && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-3 inline-block px-4 py-2 bg-gray-100 rounded-full"
                  >
                    <p className="text-gray-700 text-sm font-medium">{user.profession}</p>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div className="flex items-center justify-center gap-2 text-amber-700">
                    <FaExclamationTriangle />
                    <span className="font-medium">Subscription Expired</span>
                  </div>
                  <p className="text-amber-600 text-sm mt-2">
                    Your subscription has ended. Renew now to continue enjoying all features.
                  </p>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  onClick={proceedToSelectPlan}
                  className="w-full mt-6 py-3 rounded-lg font-semibold text-black transition-all hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: GOLD }}
                >
                  Continue to Renew
                  <FaArrowRight />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP: Active Subscription - Tell user to use the app */}
          {step === "active" && user && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100"
                >
                  <FaCheckCircle className="text-4xl text-green-500" />
                </motion.div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Hey, {user.full_name || user.username || "there"}!</h2>
                <p className="text-lg" style={{ color: GOLD }}>@{user.username}</p>
                
                {user.profession && (
                  <p className="text-gray-600 mt-1">{user.profession}</p>
                )}

                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <FaCheckCircle />
                    <span className="font-medium">Your subscription is still active!</span>
                  </div>
                  <p className="text-green-600 mt-2">
                    You have <span className="font-bold text-lg">{daysRemaining} days</span> remaining on your{" "}
                    <span className="font-semibold capitalize">{user.subscription_plan || "Premium"}</span> plan.
                  </p>
                  {user.subscription_expires_at && (
                    <p className="text-green-500 text-sm mt-2">
                      Expires on: <span className="font-semibold">{new Date(user.subscription_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                    </p>
                  )}
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-center gap-2 text-blue-700">
                    <FaMobileAlt className="text-xl" />
                    <span className="font-medium">Continue in the App</span>
                  </div>
                  <p className="text-blue-600 text-sm mt-2">
                    Your subscription is active. Please login and continue using the VELT mobile app to access all features.
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <a
                    href="https://play.google.com/store/apps/details?id=com.velt.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    <FaMobileAlt />
                    Open VELT App
                  </a>
                  
                  <Link
                    href="/"
                    className="w-full py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all text-center"
                  >
                    Go Back Home
                  </Link>
                </div>

                <p className="text-gray-400 text-xs mt-4">
                  Don&apos;t have the app? Download VELT from the App Store or Google Play.
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Select Plan - Premium Only */}
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="text-center mb-6">
                <FaCrown className="text-4xl mx-auto mb-3" style={{ color: GOLD }} />
                <h2 className="text-2xl font-bold text-gray-900">VELT Premium</h2>
                <p className="text-gray-600 mt-2">Unlock all features with our Premium plan</p>
              </div>

              <motion.div
                className="p-6 rounded-xl border-2 transition-all"
                style={{ borderColor: GOLD, backgroundColor: `${GOLD}10` }}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
              >
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold" style={{ color: GOLD }}>GH₵{PREMIUM_PLAN.priceGHS}</div>
                  <div className="text-gray-500 text-sm">per month</div>
                </div>

                <ul className="space-y-3 mb-6">
                  {PREMIUM_PLAN.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-gray-700">
                      <FaCheckCircle className="text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(PREMIUM_PLAN)}
                  className="w-full py-3 rounded-lg font-semibold text-black transition-all hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: GOLD }}
                >
                  Continue to Payment
                  <FaArrowRight />
                </button>
              </motion.div>

              <p className="text-center text-gray-400 text-xs mt-4">
                Your subscription will be renewed for 1 month
              </p>
            </motion.div>
          )}

          {/* STEP 4: Payment Confirmation */}
          {step === "payment" && selectedPlan && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Confirm Payment</h2>
                <p className="text-gray-600 mt-2">Review your subscription details</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-semibold">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600">Email</span>
                  <span className="font-semibold">{user?.email}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600">Duration</span>
                  <span className="font-semibold">1 Month</span>
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-bold">Total</span>
                    <span className="text-2xl font-bold" style={{ color: GOLD }}>
                      GH₵{selectedPlan.priceGHS}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold text-black transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: GOLD }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>Pay with Paystack</>
                  )}
                </button>
                <button
                  onClick={() => setStep("select")}
                  className="w-full py-3 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Change Plan
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Success */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-xl p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${GOLD}20` }}
              >
                <FaCheckCircle className="text-4xl" style={{ color: GOLD }} />
              </motion.div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Renewed!</h2>
              <p className="text-gray-600 mb-6">
                Your <span className="font-semibold">{selectedPlan?.name}</span> has been successfully renewed for 1 month.
              </p>

              <Link
                href="/"
                className="inline-block w-full py-3 rounded-lg font-semibold text-black transition-all hover:opacity-90"
                style={{ backgroundColor: GOLD }}
              >
                Go to Home
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
