"use client";

import Link from "next/link";
import { FaImage, FaWallet, FaGlobe, FaChartLine } from "react-icons/fa";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)] antialiased overflow-hidden relative">
      {/* Background Doodle Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top left circle */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.15, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8B7355]"
        />
        {/* Top right blob */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 0.1, x: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute top-32 -right-16 w-48 h-48 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-gradient-to-bl from-[#C4A77D] to-[#8B7355] rotate-12"
        />
        {/* Middle left squiggle */}
        <motion.svg
          initial={{ opacity: 0, pathLength: 0 }}
          animate={{ opacity: 0.2, pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.6 }}
          className="absolute top-1/3 -left-8 w-32 h-32"
          viewBox="0 0 100 100"
        >
          <motion.path
            d="M10 50 Q 25 20, 50 50 T 90 50"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.8 }}
          />
        </motion.svg>
        {/* Bottom right circle */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.12, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-gradient-to-tl from-[#D4AF37] to-[#C4A77D]"
        />
        {/* Center decorative ring */}
        <motion.div
          initial={{ opacity: 0, rotate: -45 }}
          animate={{ opacity: 0.08, rotate: 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border-[3px] border-dashed border-[#D4AF37]"
        />
        {/* Small floating dots */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-40 left-1/4 w-3 h-3 rounded-full bg-[#D4AF37] opacity-30"
        />
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute top-60 right-1/4 w-2 h-2 rounded-full bg-[#C4A77D] opacity-40"
        />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-40 left-1/3 w-4 h-4 rounded-full bg-[#8B7355] opacity-25"
        />
        {/* Bottom left triangle */}
        <motion.div
          initial={{ opacity: 0, rotate: 15 }}
          animate={{ opacity: 0.1, rotate: 0 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="absolute bottom-32 -left-10 w-0 h-0 border-l-[40px] border-l-transparent border-r-[40px] border-r-transparent border-b-[70px] border-b-[#D4AF37]"
        />
        {/* Right side line accent */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="absolute top-1/4 right-20 w-1 h-32 bg-gradient-to-b from-[#D4AF37] to-transparent rounded-full origin-top opacity-20"
        />
      </div>

      {/* HERO */}
      <section className="w-full relative z-10">

        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
          {/* Animated shimmer bar */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-32 h-1 mx-auto mb-6 rounded-full overflow-hidden bg-gradient-to-r from-transparent via-[#8B7355] to-transparent"
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-full h-full bg-gradient-to-r from-transparent via-[#C4A77D] to-transparent"
            />
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[var(--foreground)]">
            Create, Upload & Monetize
          </h1>
          <p className="text-lg text-[var(--foreground)]/70 mb-8 max-w-xl mx-auto">
            Connect with your audience and grow your brand with VELT's billboard ecosystem.
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link 
              href="/WaitList" 
              className="px-6 py-3 rounded-full font-medium text-center transition-all hover:opacity-80 bg-[#8B7355] text-white"
            >
              Get Started
            </Link>
            <Link 
              href="/renew-subscription" 
              className="px-6 py-3 rounded-full font-medium text-center border border-[var(--foreground)]/20 text-[var(--foreground)] hover:bg-[var(--foreground)]/5 transition-all"
            >
              Renew Subscription
            </Link>
          </div>

          <div className="mb-8">
            <p className="text-sm text-[var(--foreground)]/50 mb-3">Join the waitlist for early access</p>
            <Link 
              href="/WaitList"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all hover:opacity-80 bg-[var(--foreground)] text-[var(--background)]"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </section>




      {/* FEATURES */}
      <section className="w-full py-12">
        <div className="max-w-3xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4">
              <div className="text-2xl mb-2 text-[var(--foreground)]">
                <FaImage className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Billboard Management</p>
            </div>
            <div className="p-4">
              <div className="text-2xl mb-2 text-[var(--foreground)]">
                <FaChartLine className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Real-time Analytics</p>
            </div>
            <div className="p-4">
              <div className="text-2xl mb-2 text-[var(--foreground)]">
                <FaGlobe className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Nationwide Coverage</p>
            </div>
            <div className="p-4">
              <div className="text-2xl mb-2 text-[var(--foreground)]">
                <FaWallet className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Simple Payments</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="w-full py-16">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4 text-[var(--foreground)]">Ready to get started?</h2>
          <p className="text-[var(--foreground)]/60 mb-6">Join thousands of creators on VELT.</p>
          <Link 
            href="/WaitList"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold transition-all hover:opacity-80 bg-[#8B7355] text-white"
          >
            Join Waitlist
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full py-8 mt-8">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <span className="font-bold text-[var(--foreground)]">VELT</span>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">Privacy</Link>
              <Link href="/support" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">Support</Link>
              <Link href="/investors" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">Investors</Link>
            </div>
          </div>
          <p className="text-center text-sm text-[var(--foreground)]/40">
            © {new Date().getFullYear()} VELT. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}