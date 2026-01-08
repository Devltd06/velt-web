"use client";

import Link from "next/link";
import Image from "next/image";
import { FaImage, FaWallet, FaGlobe, FaChartLine, FaStar, FaCrown, FaCheck } from "react-icons/fa";
import { motion } from "framer-motion";

export default function Home() {
  // App features with screenshots and descriptions
  const features = [
    { 
      src: "/screenshots/home.png", 
      alt: "Home Feed",
      title: "Your Personalized Feed",
      description: "A beautifully designed home feed that showcases content from creators you follow. Discover stories, posts, and updates in a clean, intuitive interface that puts content first.",
      gradient: "from-violet-500 to-purple-600"
    },
    { 
      src: "/screenshots/message.png", 
      alt: "Messages",
      title: "Lightning-Fast Messaging",
      description: "Experience messaging like never before. Built for performance with real-time delivery, read receipts, media sharing, and seamless conversations. Connect with creators and brands instantly.",
      gradient: "from-pink-500 to-rose-600"
    },
    { 
      src: "/screenshots/places.png", 
      alt: "Places",
      title: "Discover & Create at Places",
      description: "Visit places, capture moments, and create content that matters. Post about locations you visit and earn rewards. Collaborate with brands, get promoted, and turn your adventures into opportunities.",
      gradient: "from-cyan-500 to-teal-600"
    },
    { 
      src: "/screenshots/maps.png", 
      alt: "Maps",
      title: "Your Journey, Mapped",
      description: "Every place you post about becomes a pin on your personal map. Discover billboards across Ghana, Nigeria, and Ivory Coast. See active advertising spots and explore opportunities near you.",
      gradient: "from-amber-500 to-orange-600"
    },
    { 
      src: "/screenshots/explore.png", 
      alt: "Explore",
      title: "Explore New Destinations",
      description: "Find your next adventure. Search for places, swipe through videos, and discover hidden gems. See how locations look before you visit and get inspired by other creators' experiences.",
      gradient: "from-indigo-500 to-violet-600"
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)] antialiased overflow-hidden relative">
      {/* Background Gradient Blobs - Colorful */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Purple blob top left */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 blur-3xl"
        />
        {/* Blue blob top right */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 0.15, x: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute top-32 -right-16 w-64 h-64 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-gradient-to-bl from-cyan-400 to-blue-500 blur-3xl rotate-12"
        />
        {/* Pink blob middle */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.12, scale: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="absolute top-1/2 left-1/4 w-80 h-80 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 blur-3xl"
        />
        {/* Teal blob bottom right */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.18, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="absolute bottom-20 right-10 w-56 h-56 rounded-full bg-gradient-to-tl from-teal-400 to-emerald-500 blur-3xl"
        />
        {/* Orange blob bottom left */}
        <motion.div
          initial={{ opacity: 0, rotate: 15 }}
          animate={{ opacity: 0.15, rotate: 0 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="absolute bottom-40 -left-10 w-48 h-48 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 blur-3xl"
        />
        {/* Indigo accent center */}
        <motion.div
          initial={{ opacity: 0, rotate: -45 }}
          animate={{ opacity: 0.08, rotate: 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 blur-3xl"
        />
        {/* Small floating dots */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-40 left-1/4 w-3 h-3 rounded-full bg-violet-400 opacity-50"
        />
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute top-60 right-1/4 w-2 h-2 rounded-full bg-cyan-400 opacity-60"
        />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-40 left-1/3 w-4 h-4 rounded-full bg-pink-400 opacity-40"
        />
      </div>

      {/* HERO */}
      <section className="w-full relative z-10">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[var(--foreground)]">
            Connect with your audience
          </h1>
          <p className="text-lg text-[var(--foreground)]/70 mb-8 max-w-xl mx-auto">
            Grow your lifestyle with Velt&apos;s ecosystem.
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link 
              href="/WaitList" 
              className="px-6 py-3 rounded-full font-medium text-center transition-all hover:opacity-80 bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
            >
              Get Started
            </Link>
            <Link 
              href="/website_payment" 
              className="px-6 py-3 rounded-full font-medium text-center transition-all hover:opacity-80 bg-gradient-to-r from-[#E0BC4D] to-[#C9A23A] text-[var(--background)] flex items-center justify-center gap-2"
            >
              <FaStar className="text-sm" />
              Get Signature
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

      {/* APP FEATURES SECTION */}
      <section className="w-full py-16 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500 bg-clip-text text-transparent">
              Experience Velt
            </h2>
            <p className="text-[var(--foreground)]/60 max-w-md mx-auto">
              A beautiful, intuitive interface designed for creators like you
            </p>
          </motion.div>

          {/* Feature Rows - Alternating Layout */}
          <div className="space-y-24">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 md:gap-16`}
              >
                {/* iPhone Mockup */}
                <div className="flex-shrink-0">
                  <div className="relative mx-auto" style={{ width: "260px" }}>
                    {/* iPhone outer frame with gradient border */}
                    <div className={`relative rounded-[3rem] p-[3px] bg-gradient-to-br ${feature.gradient}`}>
                      {/* iPhone body */}
                      <div className="bg-black rounded-[2.8rem] p-2">
                        {/* Dynamic Island */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-20" />
                        
                        {/* Screen */}
                        <div className="relative rounded-[2.4rem] overflow-hidden bg-[var(--card)]" style={{ aspectRatio: "9/19.5" }}>
                          <Image
                            src={feature.src}
                            alt={feature.alt}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feature Description */}
                <div className={`flex-1 text-center ${index % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                  <div className={`inline-block px-4 py-1.5 rounded-full mb-4 bg-gradient-to-r ${feature.gradient}`}>
                    <span className="text-sm font-medium text-white">
                      {feature.alt}
                    </span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-[var(--foreground)]/60 text-lg leading-relaxed max-w-lg mx-auto md:mx-0">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SIGNATURE BANNER */}
      <section className="w-full py-8 relative z-10">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-cyan-500/10 border border-[var(--foreground)]/10 p-6 md:p-8"
          >
            {/* Decorative gradient blobs */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-pink-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-cyan-500/20 to-teal-500/20 rounded-full blur-2xl" />
            
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#E0BC4D] to-[#A68A2E] flex items-center justify-center flex-shrink-0">
                  <FaCrown className="text-2xl text-[var(--background)]" />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-xl md:text-2xl font-bold text-[var(--foreground)] mb-1">Velt Signature</h3>
                  <p className="text-[var(--foreground)]/70 text-sm md:text-base">Unlock premium features & save on app store fees</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center md:items-end gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold bg-gradient-to-r from-[#E0BC4D] to-[#C9A23A] bg-clip-text text-transparent">₵25</span>
                  <span className="text-[var(--foreground)]/50">/month</span>
                </div>
                <Link
                  href="/website_payment"
                  className="px-6 py-3 rounded-full font-semibold bg-gradient-to-r from-[#E0BC4D] to-[#C9A23A] text-[var(--background)] hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <FaStar className="text-sm" />
                  Subscribe Now
                </Link>
              </div>
            </div>
            
            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {["Verification Badge", "Premium Themes", "Priority Support", "Early Access"].map((feature, i) => (
                <span key={feature} className={`px-3 py-1 rounded-full text-[var(--foreground)]/80 text-xs font-medium flex items-center gap-1 ${
                  i % 4 === 0 ? "bg-violet-500/20" :
                  i % 4 === 1 ? "bg-pink-500/20" :
                  i % 4 === 2 ? "bg-cyan-500/20" :
                  "bg-teal-500/20"
                }`}>
                  <FaCheck className="text-[10px] text-[#C9A23A]" />
                  {feature}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="w-full py-12 relative z-10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0 }}
              viewport={{ once: true }}
              className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5"
            >
              <div className="text-2xl mb-2 text-violet-500">
                <FaImage className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Billboard Management</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/5"
            >
              <div className="text-2xl mb-2 text-pink-500">
                <FaChartLine className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Real-time Analytics</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5"
            >
              <div className="text-2xl mb-2 text-cyan-500">
                <FaGlobe className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Nationwide Coverage</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="p-4 rounded-2xl bg-gradient-to-br from-teal-500/10 to-emerald-500/5"
            >
              <div className="text-2xl mb-2 text-teal-500">
                <FaWallet className="mx-auto" />
              </div>
              <p className="text-sm text-[var(--foreground)]/70">Simple Payments</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="w-full py-16 relative z-10">
        <div className="max-w-xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500/20 via-pink-500/10 to-cyan-500/20 p-8 md:p-12"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 via-transparent to-cyan-600/5" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-[var(--foreground)] relative">Ready to get started?</h2>
            <p className="text-[var(--foreground)]/60 mb-6 relative">Join thousands of creators on VELT.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center relative">
              <Link 
                href="/WaitList"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold transition-all hover:opacity-80 bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
              >
                Join Waitlist
              </Link>
              <Link 
                href="/website_payment"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold transition-all hover:opacity-80 bg-gradient-to-r from-[#E0BC4D] to-[#C9A23A] text-[var(--background)]"
              >
                <FaCrown />
                Get Signature
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full py-12 mt-8 relative z-10 border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <span className="font-bold text-xl text-[var(--foreground)] block mb-3">VELT</span>
              <p className="text-sm text-[var(--foreground)]/50">Create, Upload & Monetize your content with Velt.</p>
            </div>
            
            {/* Links */}
            <div>
              <p className="font-semibold text-[var(--foreground)] mb-3">Links</p>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/privacy" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">Privacy Policy</Link>
                <Link href="/support" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">Support</Link>
                <Link href="/WaitList" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">Join Waitlist</Link>
              </div>
            </div>
            
            {/* Contact & Social */}
            <div>
              <p className="font-semibold text-[var(--foreground)] mb-3">Connect</p>
              <div className="flex flex-col gap-2 text-sm">
                <a href="mailto:atmosdevltd@gmail.com" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">atmosdevltd@gmail.com</a>
                <a href="tel:+233503540645" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">+233 050 354 0645</a>
                <div className="flex gap-3 mt-2">
                  <a href="https://instagram.com/VELT" target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition" title="Instagram">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </a>
                  <a href="https://facebook.com/VELT_app" target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition" title="Facebook">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                  <a href="https://x.com/atmosedev.inc" target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition" title="X (Twitter)">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-[var(--border)]">
            <p className="text-center text-sm text-[var(--foreground)]/40">
              © {new Date().getFullYear()} VELT by Atmosdev Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
