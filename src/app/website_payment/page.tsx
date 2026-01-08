"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaEnvelope, 
  FaLock, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaArrowRight, 
  FaArrowLeft,
  FaUser,
  FaStar,
  FaPalette,
  FaBolt,
  FaHeadset,
  FaRocket,
  FaShieldAlt
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

// Signature Plans
const PLANS = {
  monthly: {
    id: "signature_monthly",
    name: "Monthly",
    price: 25,
    priceDisplay: "₵25",
    duration: 1,
    durationLabel: "/month",
    features: [
      "Verification Badge",
      "Premium Themes",
      "Custom Greeting",
      "Tab Customization",
      "Priority Support",
      "Early Access Features"
    ]
  },
  annual: {
    id: "signature_annual",
    name: "Annual",
    price: 300,
    priceDisplay: "₵300",
    duration: 12,
    durationLabel: "/year",
    savings: "Save ₵50",
    features: [
      "Verification Badge",
      "Premium Themes",
      "Custom Greeting",
      "Tab Customization",
      "Priority Support",
      "Early Access Features"
    ]
  }
};

type Step = "signin" | "plans" | "payment" | "success";
type PlanType = "monthly" | "annual";

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  is_signature?: boolean;
  verified?: boolean;
  subscription_ends_at?: string;
}

export default function WebsitePaymentPage() {
  const [step, setStep] = useState<Step>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          await loadProfile(authUser.id, authUser.email || "");
        }
      } catch {
        // No existing session
      }
    }

    async function loadProfile(userId: string, userEmail: string) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, username, full_name, is_signature, verified, subscription_ends_at")
          .eq("id", userId)
          .single();

        if (profile) {
          const userProfile: UserProfile = {
            id: userId,
            email: profile.email || userEmail,
            username: profile.username,
            full_name: profile.full_name,
            is_signature: profile.is_signature,
            verified: profile.verified,
            subscription_ends_at: profile.subscription_ends_at,
          };
          setUser(userProfile);

          // Check subscription status
          if (profile.subscription_ends_at) {
            const expiresAt = new Date(profile.subscription_ends_at);
            const now = new Date();
            
            if (expiresAt > now) {
              const diffTime = expiresAt.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              setDaysRemaining(diffDays);
              setIsActive(true);
            }
          }
          
          setStep("plans");
        } else {
          setStep("plans");
        }
      } catch {
        setStep("plans");
      }
    }

    checkSession();
  }, []);

  async function loadUserProfile(userId: string, userEmail: string) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, username, full_name, is_signature, verified, subscription_ends_at")
        .eq("id", userId)
        .single();

      if (profile) {
        const userProfile: UserProfile = {
          id: userId,
          email: profile.email || userEmail,
          username: profile.username,
          full_name: profile.full_name,
          is_signature: profile.is_signature,
          verified: profile.verified,
          subscription_ends_at: profile.subscription_ends_at,
        };
        setUser(userProfile);

        // Check subscription status
        if (profile.subscription_ends_at) {
          const expiresAt = new Date(profile.subscription_ends_at);
          const now = new Date();
          
          if (expiresAt > now) {
            const diffTime = expiresAt.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays);
            setIsActive(true);
          }
        }
        
        setStep("plans");
      } else {
        setStep("plans");
      }
    } catch {
      setStep("plans");
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

  async function handlePayment() {
    if (!user) return;
    setLoading(true);
    setError("");

    const plan = PLANS[selectedPlan];

    try {
      // Check if Paystack is already loaded
      const existingPaystack = (window as unknown as { PaystackPop?: unknown }).PaystackPop;
      
      if (existingPaystack) {
        // Paystack already loaded, use it directly
        openPaystackPopup(plan);
      } else {
        // Load Paystack script
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.async = true;
        
        script.onload = () => {
          openPaystackPopup(plan);
        };

        script.onerror = () => {
          setError("Failed to load payment system. Please refresh and try again.");
          setLoading(false);
        };

        document.body.appendChild(script);
      }
    } catch {
      setError("Payment initialization failed. Please try again.");
      setLoading(false);
    }
  }

  function openPaystackPopup(selectedPlanData: typeof PLANS.monthly) {
    if (!user) return;

    const PaystackPop = (window as unknown as { 
      PaystackPop: { 
        setup: (config: {
          key: string;
          email: string;
          amount: number;
          currency: string;
          ref: string;
          onClose: () => void;
          callback: (response: { reference: string }) => void;
        }) => { openIframe: () => void } 
      } 
    }).PaystackPop;

    if (!PaystackPop) {
      setError("Payment system not available. Please refresh the page.");
      setLoading(false);
      return;
    }

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
    
    if (!paystackKey) {
      setError("Payment configuration missing. Please contact support.");
      setLoading(false);
      console.error("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set");
      return;
    }

    const reference = `velt_sig_${user.id}_${Date.now()}`;

    try {
      const handler = PaystackPop.setup({
        key: paystackKey,
        email: user.email,
        amount: selectedPlanData.price * 100, // Amount in pesewas
        currency: "GHS",
        ref: reference,
        onClose: function() {
          setLoading(false);
        },
        callback: function(response: { reference: string }) {
          // Payment successful - handle async operations
          handlePaymentSuccess(response.reference, selectedPlanData);
        },
      });

    handler.openIframe();
  } catch (err) {
    console.error("Paystack setup error:", err);
    setError("Failed to initialize payment. Please try again.");
    setLoading(false);
  }
  }

  async function handlePaymentSuccess(paymentReference: string, planData: typeof PLANS.monthly) {
    if (!user) return;
    
    try {
      // Calculate new expiry date
      const now = new Date();
      let newExpiry: Date;
      
      // If user has active subscription, extend from current end date
      if (user.subscription_ends_at) {
        const currentExpiry = new Date(user.subscription_ends_at);
        if (currentExpiry > now) {
          newExpiry = new Date(currentExpiry);
        } else {
          newExpiry = now;
        }
      } else {
        newExpiry = now;
      }
      
      // Add months based on plan
      newExpiry.setMonth(newExpiry.getMonth() + planData.duration);

      // Update profile with signature status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_signature: true,
          verified: true,
          subscription_ends_at: newExpiry.toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        throw updateError;
      }

      // Try to record payment (table may not exist yet)
      try {
        await supabase.from("payments").insert({
          user_id: user.id,
          amount: planData.price * 100,
          currency: "GHS",
          status: "completed",
          payment_type: isActive ? "renewal" : "subscription",
          paystack_reference: paymentReference,
          metadata: {
            plan: selectedPlan,
            plan_name: planData.name,
            duration_months: planData.duration,
          },
          completed_at: new Date().toISOString(),
        });
      } catch {
        // Payment recording failed but subscription was updated
        console.log("Payment record skipped (table may not exist)");
      }

      // Update local state
      setUser({
        ...user,
        is_signature: true,
        verified: true,
        subscription_ends_at: newExpiry.toISOString(),
      });

      setStep("success");
    } catch (err) {
      console.error("Error updating subscription:", err);
      setError("Payment received but failed to update subscription. Please contact support.");
    } finally {
      setLoading(false);
    }
  }

  const plan = PLANS[selectedPlan];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden">
      {/* Background Gradient Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 1 }}
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-gradient-to-bl from-violet-500 to-purple-600 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 blur-3xl"
        />
      </div>

      {/* Header */}
      <header className="border-b border-[var(--foreground)]/10 relative z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            VELT
          </Link>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--foreground)]/60 hidden sm:block">{user.email}</span>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  setStep("signin");
                }}
                className="text-sm text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12 relative z-10">
        {/* Back button */}
        {step !== "signin" && step !== "success" && (
          <button
            onClick={() => {
              if (step === "payment") setStep("plans");
              else if (step === "plans" && !user) setStep("signin");
            }}
            className="flex items-center gap-2 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition mb-6"
          >
            <FaArrowLeft className="text-sm" />
            Back
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* SIGN IN STEP */}
          {step === "signin" && (
            <motion.div
              key="signin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[var(--background)] rounded-2xl border border-[var(--foreground)]/10 p-8"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">Get Velt Signature</h1>
                <p className="text-[var(--foreground)]/60 mt-2">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/40" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-[var(--foreground)]/20 rounded-lg focus:border-[#C9A23A] outline-none bg-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/40" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full pl-10 pr-4 py-3 border border-[var(--foreground)]/20 rounded-lg focus:border-[#C9A23A] outline-none bg-transparent"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 bg-[#C9A23A] text-[var(--background)]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full animate-spin" />
                  ) : (
                    <>
                      Continue
                      <FaArrowRight />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-[var(--foreground)]/60 mt-6 text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold hover:underline text-[#C9A23A]">
                  Sign Up
                </Link>
              </p>
            </motion.div>
          )}

          {/* PLANS STEP */}
          {step === "plans" && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Welcome banner for logged in users */}
              {user && (
                <div className="mb-8 p-4 rounded-xl bg-[var(--foreground)]/5 border border-[var(--foreground)]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--foreground)]/10 flex items-center justify-center">
                      <FaUser className="text-[var(--foreground)]/60" />
                    </div>
                    <div>
                      <p className="font-medium">@{user.username || "user"}</p>
                      <p className="text-sm text-[var(--foreground)]/60">{user.email}</p>
                    </div>
                  </div>
                  
                  {isActive && (
                    <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2 text-green-500">
                        <FaCheckCircle />
                        <span className="font-medium">Signature Active</span>
                      </div>
                      <p className="text-green-500/80 text-sm mt-1">
                        {daysRemaining} days remaining. You can extend your subscription below.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">Velt Signature</h1>
                <p className="text-[var(--foreground)]/60 mt-2">
                  {isActive ? "Extend your subscription" : "Unlock premium features"}
                </p>
                <p className="text-sm text-[var(--foreground)]/40 mt-1">
                  Purchase on web - No app store fees
                </p>
              </div>

              {/* Plan Cards */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {/* Monthly Plan */}
                <button
                  onClick={() => setSelectedPlan("monthly")}
                  className={`text-left p-6 rounded-xl border-2 transition-all ${
                    selectedPlan === "monthly"
                      ? "border-[#C9A23A] bg-[#C9A23A]/5"
                      : "border-[var(--foreground)]/10 hover:border-[var(--foreground)]/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{PLANS.monthly.name}</h3>
                    {selectedPlan === "monthly" && (
                      <div className="w-6 h-6 rounded-full bg-[#C9A23A] flex items-center justify-center">
                        <FaCheckCircle className="text-xs text-[var(--background)]" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold">{PLANS.monthly.priceDisplay}</span>
                    <span className="text-[var(--foreground)]/50">{PLANS.monthly.durationLabel}</span>
                  </div>
                  <ul className="space-y-2">
                    {PLANS.monthly.features.slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-[var(--foreground)]/70">
                        <FaCheckCircle className="text-[#C9A23A] text-xs flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>

                {/* Annual Plan */}
                <button
                  onClick={() => setSelectedPlan("annual")}
                  className={`text-left p-6 rounded-xl border-2 transition-all relative ${
                    selectedPlan === "annual"
                      ? "border-[#C9A23A] bg-[#C9A23A]/5"
                      : "border-[var(--foreground)]/10 hover:border-[var(--foreground)]/30"
                  }`}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 rounded-full text-xs font-bold text-white">
                    BEST VALUE
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{PLANS.annual.name}</h3>
                    {selectedPlan === "annual" && (
                      <div className="w-6 h-6 rounded-full bg-[#C9A23A] flex items-center justify-center">
                        <FaCheckCircle className="text-xs text-[var(--background)]" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold">{PLANS.annual.priceDisplay}</span>
                    <span className="text-[var(--foreground)]/50">{PLANS.annual.durationLabel}</span>
                  </div>
                  <p className="text-green-500 text-sm font-medium mb-4">{PLANS.annual.savings}</p>
                  <ul className="space-y-2">
                    {PLANS.annual.features.slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-[var(--foreground)]/70">
                        <FaCheckCircle className="text-[#C9A23A] text-xs flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              </div>

              {/* All Features */}
              <div className="mb-8 p-6 rounded-xl bg-[var(--foreground)]/5 border border-[var(--foreground)]/10">
                <h3 className="font-semibold mb-4">Everything included:</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A23A]/10 flex items-center justify-center">
                      <FaShieldAlt className="text-[#C9A23A] text-sm" />
                    </div>
                    <span className="text-sm">Verification Badge</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A23A]/10 flex items-center justify-center">
                      <FaPalette className="text-[#C9A23A] text-sm" />
                    </div>
                    <span className="text-sm">Premium Themes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A23A]/10 flex items-center justify-center">
                      <FaBolt className="text-[#C9A23A] text-sm" />
                    </div>
                    <span className="text-sm">Custom Greeting</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A23A]/10 flex items-center justify-center">
                      <FaHeadset className="text-[#C9A23A] text-sm" />
                    </div>
                    <span className="text-sm">Priority Support</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A23A]/10 flex items-center justify-center">
                      <FaRocket className="text-[#C9A23A] text-sm" />
                    </div>
                    <span className="text-sm">Early Access</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A23A]/10 flex items-center justify-center">
                      <FaStar className="text-[#C9A23A] text-sm" />
                    </div>
                    <span className="text-sm">Tab Customization</span>
                  </div>
                </div>
              </div>

              {/* Continue Button */}
              <button
                onClick={() => setStep("payment")}
                className="w-full py-4 rounded-xl font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 bg-[#C9A23A] text-[var(--background)]"
              >
                Continue with {PLANS[selectedPlan].name}
                <FaArrowRight />
              </button>
            </motion.div>
          )}

          {/* PAYMENT STEP */}
          {step === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[var(--background)] rounded-2xl border border-[var(--foreground)]/10 p-8"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Confirm Payment</h2>
                <p className="text-[var(--foreground)]/60 mt-2">Review your subscription</p>
              </div>

              {/* Order Summary */}
              <div className="bg-[var(--foreground)]/5 rounded-xl p-5 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[var(--foreground)]/60">Plan</span>
                  <span className="font-semibold">Velt Signature ({plan.name})</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[var(--foreground)]/60">Email</span>
                  <span className="font-semibold">{user?.email}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[var(--foreground)]/60">Duration</span>
                  <span className="font-semibold">{plan.duration} {plan.duration === 1 ? "Month" : "Months"}</span>
                </div>
                <div className="border-t border-[var(--foreground)]/10 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Total</span>
                    <span className="text-2xl font-bold text-[#C9A23A]">{plan.priceDisplay}</span>
                  </div>
                </div>
              </div>

              {isActive && (
                <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-2 text-blue-500">
                    <FaExclamationTriangle />
                    <span className="font-medium">Extending Subscription</span>
                  </div>
                  <p className="text-blue-500/80 text-sm mt-1">
                    This will add {plan.duration} {plan.duration === 1 ? "month" : "months"} to your existing subscription.
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full py-4 rounded-xl font-semibold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 bg-[#C9A23A] text-[var(--background)]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full animate-spin" />
                  ) : (
                    <>Pay {plan.priceDisplay} with Paystack</>
                  )}
                </button>
                <button
                  onClick={() => setStep("plans")}
                  className="w-full py-3 rounded-xl font-semibold text-[var(--foreground)]/70 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 transition-all"
                >
                  Change Plan
                </button>
              </div>

              <p className="text-center text-[var(--foreground)]/40 text-xs mt-6">
                Secure payment powered by Paystack
              </p>
            </motion.div>
          )}

          {/* SUCCESS STEP */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--background)] rounded-2xl border border-[var(--foreground)]/10 p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-green-500/10"
              >
                <FaCheckCircle className="text-4xl text-green-500" />
              </motion.div>
              
              <h2 className="text-2xl font-bold mb-2">You&apos;re all set!</h2>
              <p className="text-[var(--foreground)]/60 mb-6">
                Your Velt Signature subscription is now active.
              </p>

              <div className="bg-[var(--foreground)]/5 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-[#C9A23A] mb-2">
                  <FaStar />
                  <span className="font-semibold">Signature Member</span>
                </div>
                <p className="text-sm text-[var(--foreground)]/60">
                  Open the Velt app to enjoy your premium features
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="/"
                  className="w-full py-3 rounded-xl font-semibold transition-all hover:opacity-90 bg-[#C9A23A] text-[var(--background)] text-center"
                >
                  Back to Home
                </Link>
                <Link
                  href="/app/home"
                  className="w-full py-3 rounded-xl font-semibold text-[var(--foreground)]/70 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 transition-all text-center"
                >
                  Open Web App
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--foreground)]/10 mt-16 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-[var(--foreground)]/40 text-sm">
          <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition">Privacy</Link>
            <Link href="/support" className="hover:text-[var(--foreground)] transition">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
