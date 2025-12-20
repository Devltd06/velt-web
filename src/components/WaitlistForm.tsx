"use client";

import { useState } from "react";
import { waitlistService } from "@/lib/waitlistService";
import { FaEnvelope, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { motion } from "framer-motion";

interface WaitlistFormProps {
  onSuccess?: () => void;
  showName?: boolean;
  text?: string;
}

export default function WaitlistForm({
  onSuccess,
  showName = true,
  text = "Join the waitlist",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    try {
      // Check if already on waitlist
      const alreadyExists = await waitlistService.isOnWaitlist(email);
      if (alreadyExists) {
        setStatus("error");
        setMessage("This email is already on our waitlist!");
        setLoading(false);
        return;
      }

      // Subscribe
      const response = await waitlistService.subscribe(
        email,
        name || undefined,
        phone || undefined,
        ["billboard", "sharing", "creating"]
      );

      if (response.error) {
        setStatus("error");
        setMessage(
          response.error.message || "Failed to join waitlist. Please try again."
        );
      } else {
        setStatus("success");
        setMessage("Welcome to the waitlist! Check your email soon.");
        setEmail("");
        setName("");
        setPhone("");
        onSuccess?.();
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
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="space-y-3">
        {showName && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-lg focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
              disabled={loading}
            />
          </motion.div>
        )}

        {showName && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
          >
            <input
              type="tel"
              placeholder="Phone number (e.g. 0241234567)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-lg focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
              disabled={loading}
            />
          </motion.div>
        )}

        <motion.div
          className="flex gap-2"
          initial={{ y: 10, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-lg focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
            disabled={loading}
          />
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
            className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] font-semibold rounded-lg hover:opacity-80 disabled:opacity-50 transition flex items-center gap-2"
          >
            <FaEnvelope className="text-sm" />
            {loading ? "Joining..." : text}
          </motion.button>
        </motion.div>

        {status === "success" && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-3 bg-green-50 border-l-4 border-green-500 rounded flex items-start gap-3"
          >
            <FaCheckCircle className="text-green-600 text-lg mt-0.5 flex-shrink-0" />
            <p className="text-green-800 text-sm">{message}</p>
          </motion.div>
        )}

        {status === "error" && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-3 bg-red-50 border-l-4 border-red-500 rounded flex items-start gap-3"
          >
            <FaExclamationCircle className="text-red-600 text-lg mt-0.5 flex-shrink-0" />
            <p className="text-red-800 text-sm">{message}</p>
          </motion.div>
        )}
      </div>
    </motion.form>
  );
}
