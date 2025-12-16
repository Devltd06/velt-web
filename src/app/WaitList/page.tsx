"use client";

import { useState } from "react";
import Link from "next/link";
import { waitlistService } from "@/lib/waitlistService";
import { FaEnvelope, FaCheckCircle, FaExclamationCircle, FaArrowLeft, FaRocket, FaGift, FaUsers, FaMobile } from "react-icons/fa";
import { motion } from "framer-motion";
import VeltLogo from "@/components/VeltLogo";

const benefits = [
  { icon: FaRocket, title: "Early Access", description: "Be the first to experience new features before anyone else" },
  { icon: FaGift, title: "Exclusive Perks", description: "Get special discounts and bonuses as an early supporter" },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    try {
      const alreadyExists = await waitlistService.isOnWaitlist(email);
      if (alreadyExists) {
        setStatus("error");
        setMessage("This email is already on our waitlist!");
        setLoading(false);
        return;
      }

      const response = await waitlistService.subscribe(
        email,
        name || undefined,
        ["billboard", "sharing", "creating"]
      );

      if (response.error) {
        setStatus("error");
        setMessage(response.error.message || "Failed to join waitlist. Please try again.");
      } else {
        setStatus("success");
        setMessage("🎉 Welcome to the waitlist! We'll notify you when we launch.");
        setEmail("");
        setName("");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
      console.error("Waitlist error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      {/* Header */}
      <header className="border-b border-[var(--foreground)]/10 bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">
            <FaArrowLeft size={14} />
            <span className="text-sm font-medium">Back Home</span>
          </Link>
          <Link href="/" className="font-bold text-xl">VELT</Link>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left side - Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--foreground)]/5 border border-[var(--foreground)]/10 mb-6">
              <FaUsers className="text-[var(--foreground)]" />
              <span className="text-sm font-medium">Join 2,000+ waiting</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Be the First to Experience{" "}
              <span className="text-[var(--foreground)]">VELT</span>
            </h1>

            <p className="text-lg text-[var(--foreground)]/60 mb-8 leading-relaxed">
              Join our exclusive waitlist and get early access to the future of creator monetization and billboard advertising. Don&apos;t miss out on special launch perks!
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-[var(--foreground)]/5 border border-[var(--foreground)]/10"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--foreground)]/10"
                  >
                    <benefit.icon className="text-[var(--foreground)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{benefit.title}</h3>
                    <p className="text-xs text-[var(--foreground)]/50 mt-1">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right side - Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-[var(--background)] rounded-2xl shadow-2xl border border-[var(--foreground)]/10 p-8 md:p-10">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-[var(--foreground)] text-[var(--background)]"
                >
                  <VeltLogo size={32} />
                </motion.div>
                <h2 className="text-2xl font-bold">Join the Waitlist</h2>
                <p className="text-[var(--foreground)]/50 mt-2">Get notified when we launch</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-xl focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email Address *</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-xl focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
                    disabled={loading}
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="w-full py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 bg-[var(--foreground)] text-[var(--background)]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full animate-spin" />
                  ) : (
                    <>
                      <FaEnvelope />
                      Join Waitlist
                    </>
                  )}
                </motion.button>

                {status === "success" && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3"
                  >
                    <FaCheckCircle className="text-green-500 text-lg mt-0.5 flex-shrink-0" />
                    <p className="text-green-500 text-sm">{message}</p>
                  </motion.div>
                )}

                {status === "error" && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3"
                  >
                    <FaExclamationCircle className="text-red-500 text-lg mt-0.5 flex-shrink-0" />
                    <p className="text-red-500 text-sm">{message}</p>
                  </motion.div>
                )}
              </form>

              <p className="text-center text-xs text-[var(--foreground)]/40 mt-6">
                We respect your privacy. Unsubscribe at any time.
              </p>
            </div>

            {/* App Store badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 text-center"
            >
              <p className="text-sm text-[var(--foreground)]/50 mb-3 flex items-center justify-center gap-2">
                <FaMobile className="text-[var(--foreground)]" />
                Coming soon to mobile
              </p>
              <div className="flex justify-center gap-4">
                <div className="px-4 py-2 bg-[var(--foreground)]/10 rounded-lg text-xs text-[var(--foreground)]/50">App Store</div>
                <div className="px-4 py-2 bg-[var(--foreground)]/10 rounded-lg text-xs text-[var(--foreground)]/50">Google Play</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}