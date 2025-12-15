"use client";

import { useState } from "react";
import Link from "next/link";
import { waitlistService } from "@/lib/waitlistService";
import { FaEnvelope, FaCheckCircle, FaExclamationCircle, FaArrowLeft, FaRocket, FaBell, FaGift, FaStar, FaUsers, FaMobile } from "react-icons/fa";
import { motion } from "framer-motion";

const GOLD = "#D4AF37";

// Floating particle component
const FloatingParticle = ({ delay, x, y, size }: { delay: number; x: string; y: string; size: number }) => (
  <motion.div
    className="absolute rounded-full opacity-20"
    style={{
      left: x,
      top: y,
      width: size,
      height: size,
      background: `linear-gradient(135deg, ${GOLD} 0%, #F4D03F 100%)`,
    }}
    animate={{
      y: [0, -30, 0],
      scale: [1, 1.2, 1],
      opacity: [0.1, 0.3, 0.1],
    }}
    transition={{
      duration: 6,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

const benefits = [
  { icon: FaRocket, title: "Early Access", description: "Be the first to experience new features before anyone else" },
  { icon: FaGift, title: "Exclusive Perks", description: "Get special discounts and bonuses as an early supporter" },
  { icon: FaBell, title: "Priority Updates", description: "Receive important announcements and news first" },
  { icon: FaStar, title: "Founder Benefits", description: "Lifetime benefits for early waitlist members" },
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
      {/* Background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <FloatingParticle delay={0} x="10%" y="20%" size={12} />
        <FloatingParticle delay={1} x="80%" y="10%" size={8} />
        <FloatingParticle delay={2} x="70%" y="60%" size={10} />
        <FloatingParticle delay={3} x="20%" y="70%" size={14} />
        <FloatingParticle delay={4} x="90%" y="40%" size={6} />
        <FloatingParticle delay={5} x="30%" y="30%" size={9} />
      </div>

      {/* Header */}
      <header className="border-b border-gray-200 bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-[var(--foreground)] transition">
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-6">
              <FaUsers style={{ color: GOLD }} />
              <span className="text-sm font-medium text-amber-800">Join 2,000+ waiting</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Be the First to Experience{" "}
              <span style={{ color: GOLD }}>VELT</span>
            </h1>

            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
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
                  className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${GOLD}20` }}
                  >
                    <benefit.icon style={{ color: GOLD }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{benefit.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{benefit.description}</p>
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
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 md:p-10">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${GOLD}20` }}
                >
                  <FaRocket className="text-2xl" style={{ color: GOLD }} />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900">Join the Waitlist</h2>
                <p className="text-gray-500 mt-2">Get notified when we launch</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 text-gray-900 placeholder-gray-400 transition"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-400 text-gray-900 placeholder-gray-400 transition"
                    disabled={loading}
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="w-full py-4 rounded-xl font-semibold text-black transition flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: GOLD }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
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
                    className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3"
                  >
                    <FaCheckCircle className="text-green-600 text-lg mt-0.5 flex-shrink-0" />
                    <p className="text-green-800 text-sm">{message}</p>
                  </motion.div>
                )}

                {status === "error" && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
                  >
                    <FaExclamationCircle className="text-red-600 text-lg mt-0.5 flex-shrink-0" />
                    <p className="text-red-800 text-sm">{message}</p>
                  </motion.div>
                )}
              </form>

              <p className="text-center text-xs text-gray-400 mt-6">
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
              <p className="text-sm text-gray-500 mb-3 flex items-center justify-center gap-2">
                <FaMobile style={{ color: GOLD }} />
                Coming soon to mobile
              </p>
              <div className="flex justify-center gap-4">
                <div className="px-4 py-2 bg-gray-100 rounded-lg text-xs text-gray-500">App Store</div>
                <div className="px-4 py-2 bg-gray-100 rounded-lg text-xs text-gray-500">Google Play</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}