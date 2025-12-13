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
    <div className="min-h-screen bg-white text-black">
      {/* HEADER */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-black transition">
            <FaArrowLeft size={16} />
            <span className="text-sm">Back Home</span>
          </Link>
          <div className="font-bold text-xl">VELT</div>
          <div className="w-20"></div>
        </div>
      </header>

      {/* SUPPORT PAGE */}
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Support & Feedback</h1>
          <p className="text-lg text-gray-600 mb-12">We would love to hear from you. Share your feedback, report issues, or send us your suggestions.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-3xl mb-3" style={{ color: "#d4af37" }}>💬</div>
            <h3 className="font-bold text-lg mb-2">Feedback</h3>
            <p className="text-sm text-gray-600">Tell us what you think about VELT. Your suggestions help us improve.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-3xl mb-3" style={{ color: "#d4af37" }}>🐛</div>
            <h3 className="font-bold text-lg mb-2">Report Issues</h3>
            <p className="text-sm text-gray-600">Found a bug? Let us know and we will fix it as soon as possible.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-3xl mb-3" style={{ color: "#d4af37" }}>⭐</div>
            <h3 className="font-bold text-lg mb-2">Complaints</h3>
            <p className="text-sm text-gray-600">Share your concerns with us and we will address them right away.</p>
          </motion.div>
        </div>

        {/* FORM */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-gray-50 rounded-xl p-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6">Send us your message</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Type of Message</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                required
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition"
              style={{ backgroundColor: "#d4af37", color: "#000000" }}
            >
              <FaPaperPlane />
              {loading ? "Sending..." : "Send Message"}
            </motion.button>

            {submitted && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 border border-green-300 rounded-lg flex items-start gap-3">
                <FaCheckCircle className="text-green-600 mt-1" />
                <div>
                  <div className="font-semibold text-green-800">Message sent successfully!</div>
                  <div className="text-sm text-green-700">Thank you for your feedback. We will review it shortly.</div>
                </div>
              </motion.div>
            )}
          </form>
        </motion.div>

        {/* CONTACT INFO */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-16 p-8 bg-white border border-gray-200 rounded-lg">
          <h3 className="text-2xl font-bold mb-4">Need Immediate Help?</h3>
          <p className="text-gray-600 mb-4">Email us directly or reach out through our social channels.</p>
          <a href="mailto:support@velt.app" className="text-lg font-semibold hover:opacity-80 transition" style={{ color: "#d4af37" }}>
            support@velt.app
          </a>
        </motion.div>
      </div>

      {/* FOOTER */}
      <footer className="w-full border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 text-sm text-gray-600 text-center">
          <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
