"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaUsers, FaShoppingCart, FaBullhorn, FaArrowRight } from "react-icons/fa";

// VELT Brand Colors
const VELT_ACCENT = "#D4AF37";

const slides = [
  {
    title: "Creators",
    description: "Discover and follow creators nearby. Explore short feeds and curated highlights.",
    icon: FaUsers,
    gradient: "from-amber-900 to-yellow-600",
  },
  {
    title: "Marketplace",
    description: "Buy and sell local goods with confidence. Support small businesses in your community.",
    icon: FaShoppingCart,
    gradient: "from-emerald-900 to-teal-600",
  },
  {
    title: "Billboards",
    description: "Book outdoor advertising spaces quickly and reach new audiences.",
    icon: FaBullhorn,
    gradient: "from-blue-900 to-cyan-600",
  },
];

export default function WelcomePage() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-20"
          style={{ backgroundColor: VELT_ACCENT, filter: "blur(100px)" }}
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -50, 100, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute right-0 bottom-0 w-80 h-80 rounded-full opacity-15"
          style={{ backgroundColor: "#00E5A0", filter: "blur(80px)" }}
          animate={{
            x: [0, -80, 40, 0],
            y: [0, 40, -80, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <Link href="/" className="text-white/60 hover:text-white transition flex items-center gap-2 text-sm">
          ← Back to Home
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1
            className="text-6xl md:text-8xl font-bold mb-4"
            style={{ color: VELT_ACCENT }}
          >
            VELT
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto">
            Your all-in-one platform for creators, marketplace, and billboard advertising
          </p>
        </motion.div>

        {/* Feature Slides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {slides.map((slide, index) => {
            const Icon = slide.icon;
            return (
              <motion.div
                key={slide.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className={`relative p-8 rounded-2xl border transition-all duration-500 cursor-pointer ${
                  activeSlide === index
                    ? "border-yellow-500/50 bg-gradient-to-br " + slide.gradient
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
                onClick={() => setActiveSlide(index)}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: activeSlide === index ? VELT_ACCENT : "rgba(255,255,255,0.1)" }}
                >
                  <Icon size={24} color={activeSlide === index ? "#000" : "#fff"} />
                </div>
                <h3 className="text-2xl font-bold mb-3">{slide.title}</h3>
                <p className="text-white/70">{slide.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Slide Indicators */}
        <div className="flex justify-center gap-2 mb-16">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                activeSlide === index ? "w-8" : ""
              }`}
              style={{
                backgroundColor: activeSlide === index ? VELT_ACCENT : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link
            href="/app/login"
            className="px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 transition hover:opacity-90"
            style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
          >
            Log In
            <FaArrowRight />
          </Link>
          <Link
            href="/app/signup"
            className="px-8 py-4 rounded-xl font-semibold text-lg border border-white/20 bg-white/5 hover:bg-white/10 transition flex items-center gap-3"
          >
            Create Account
          </Link>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { label: "Active Creators", value: "10K+" },
            { label: "Products Listed", value: "50K+" },
            { label: "Billboards", value: "450+" },
            { label: "Users", value: "100K+" },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl font-bold mb-2" style={{ color: VELT_ACCENT }}>
                {stat.value}
              </div>
              <div className="text-white/60 text-sm">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-white/40 text-sm">
        <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
      </footer>
    </div>
  );
}
