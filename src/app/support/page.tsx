"use client";

import Link from "next/link";
import { FaArrowLeft, FaPaperPlane, FaCheckCircle } from "react-icons/fa";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Support() {
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("feedback");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Here you would typically send this to your backend
      // For now, we'll just simulate the submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitted(true);
      setFeedback("");
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden">
      {/* Background Gradient Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={{ duration: 1 }}
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute bottom-0 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-violet-500 to-purple-600 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full bg-gradient-to-bl from-pink-500 to-rose-600 blur-3xl"
        />
      </div>

      {/* HEADER */}
      <header className="border-b border-[var(--foreground)]/10 relative z-10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">
            <FaArrowLeft size={16} />
            <span className="text-sm">Back Home</span>
          </Link>
          <div className="font-bold text-xl">VELT</div>
          <div className="w-20"></div>
        </div>
      </header>

      {/* SUPPORT PAGE */}
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-20 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Support & <span className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 bg-clip-text text-transparent">Feedback</span>
          </h1>
          <p className="text-lg text-[var(--foreground)]/60 mb-12">We would love to hear from you. Share your feedback, report issues, or send us your suggestions.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 bg-gradient-to-br from-violet-500/10 to-purple-500/5 rounded-lg border border-violet-500/20">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-3">
              <span className="text-xl">💬</span>
            </div>
            <h3 className="font-bold text-lg mb-2">Feedback</h3>
            <p className="text-sm text-[var(--foreground)]/60">Tell us what you think about VELT. Your suggestions help us improve.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-lg border border-cyan-500/20">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-3">
              <span className="text-xl">🐛</span>
            </div>
            <h3 className="font-bold text-lg mb-2">Report Issues</h3>
            <p className="text-sm text-[var(--foreground)]/60">Found a bug? Let us know and we will fix it as soon as possible.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 bg-gradient-to-br from-teal-500/10 to-emerald-500/5 rounded-lg border border-teal-500/20">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mb-3">
              <span className="text-xl">⭐</span>
            </div>
            <h3 className="font-bold text-lg mb-2">Complaints</h3>
            <p className="text-sm text-[var(--foreground)]/60">Share your concerns with us and we will address them right away.</p>
          </motion.div>
        </div>

        {/* FORM */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-gradient-to-br from-[var(--foreground)]/5 to-transparent rounded-xl p-8 border border-[var(--foreground)]/10">
          <h2 className="text-2xl font-bold mb-6">Send us your message</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Type of Message</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--foreground)]/20 rounded-lg focus:outline-none focus:border-[var(--foreground)]/50 bg-[var(--background)] text-[var(--foreground)]"
              >
                <option value="feedback">General Feedback</option>
                <option value="bug">Report a Bug</option>
                <option value="complaint">Submit a Complaint</option>
                <option value="suggestion">Feature Suggestion</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Your Message</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={8}
                className="w-full px-4 py-3 border border-[var(--foreground)]/20 rounded-lg focus:outline-none focus:border-[var(--foreground)]/50 bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--foreground)]/40 resize-none"
                required
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition bg-[var(--foreground)] text-[var(--background)]"
            >
              <FaPaperPlane />
              {loading ? "Sending..." : "Send Message"}
            </motion.button>

            {submitted && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                <FaCheckCircle className="text-green-500 mt-1" />
                <div>
                  <div className="font-semibold text-green-500">Message sent successfully!</div>
                  <div className="text-sm text-green-500/80">Thank you for your feedback. We will review it shortly.</div>
                </div>
              </motion.div>
            )}
          </form>
        </motion.div>

        {/* CONTACT INFO */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-16 p-8 bg-gradient-to-br from-[var(--foreground)]/5 to-transparent border border-[var(--foreground)]/10 rounded-xl">
          <h3 className="text-2xl font-bold mb-6">Need Immediate Help?</h3>
          <p className="text-[var(--foreground)]/60 mb-6">Reach out to us directly through any of these channels.</p>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[var(--foreground)]/50 mb-1">Email</p>
              <a href="mailto:atmosdevltd@gmail.com" className="text-lg font-semibold hover:opacity-70 transition">
                atmosdevltd@gmail.com
              </a>
            </div>
            
            <div>
              <p className="text-sm text-[var(--foreground)]/50 mb-1">Phone</p>
              <a href="tel:+233503540645" className="text-lg font-semibold hover:opacity-70 transition">
                +233 050 354 0645
              </a>
            </div>
            
            <div className="pt-4">
              <p className="text-sm text-[var(--foreground)]/50 mb-3">Follow Us</p>
              <div className="flex gap-4">
                <a href="https://instagram.com/VELT" target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium hover:opacity-80 transition">
                  @VELT
                </a>
                <a href="https://facebook.com/VELT_app" target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:opacity-80 transition">
                  VELT_app
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* FOOTER */}
      <footer className="w-full border-t border-[var(--foreground)]/10 mt-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 text-sm text-[var(--foreground)]/60 text-center">
          <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
