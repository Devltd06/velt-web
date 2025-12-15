"use client";

import Link from "next/link";
import { FaImage, FaWallet, FaGlobe, FaChartLine, FaCrown, FaRedo } from "react-icons/fa";
import { motion } from "framer-motion";
import WaitlistForm from "@/components/WaitlistForm";

// Floating particles for background animation
const FloatingParticle = ({ delay, duration, x, y, size }: { delay: number; duration: number; x: string; y: string; size: number }) => (
  <motion.div
    className="absolute rounded-full"
    style={{
      left: x,
      top: y,
      width: size,
      height: size,
      background: "linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%)",
    }}
    animate={{
      y: [0, -40, 0],
      x: [0, 20, 0],
      scale: [1, 1.3, 1],
      opacity: [0.15, 0.4, 0.15],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

// Animated gradient orbs
const GradientOrb = ({ className, delay }: { className: string; delay: number }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl ${className}`}
    animate={{
      scale: [1, 1.3, 1],
      opacity: [0.2, 0.5, 0.2],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 12,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

// Sparkle effect
const Sparkle = ({ x, y, delay }: { x: string; y: string; delay: number }) => (
  <motion.div
    className="absolute w-1 h-1 bg-amber-400 rounded-full"
    style={{ left: x, top: y }}
    animate={{
      scale: [0, 1.5, 0],
      opacity: [0, 1, 0],
    }}
    transition={{
      duration: 2,
      delay,
      repeat: Infinity,
      ease: "easeOut",
    }}
  />
);

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-white text-black antialiased overflow-hidden">
      {/* HERO with animated background */}
      <header className="w-full border-b border-gray-200 relative">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Gradient Orbs */}
          <GradientOrb className="w-96 h-96 -top-48 -left-48 bg-gradient-to-br from-amber-200/50 to-yellow-300/40" delay={0} />
          <GradientOrb className="w-80 h-80 top-1/4 right-0 bg-gradient-to-br from-amber-100/40 to-orange-200/30" delay={2} />
          <GradientOrb className="w-64 h-64 bottom-0 left-1/3 bg-gradient-to-br from-yellow-100/40 to-amber-200/30" delay={4} />
          <GradientOrb className="w-72 h-72 top-1/2 left-1/4 bg-gradient-to-br from-amber-50/30 to-yellow-100/20" delay={6} />
          
          {/* Floating Particles - More particles for richer effect */}
          <FloatingParticle delay={0} duration={6} x="10%" y="20%" size={10} />
          <FloatingParticle delay={0.5} duration={7} x="85%" y="15%" size={8} />
          <FloatingParticle delay={1} duration={8} x="80%" y="30%" size={6} />
          <FloatingParticle delay={1.5} duration={6} x="15%" y="45%" size={12} />
          <FloatingParticle delay={2} duration={7} x="30%" y="70%" size={10} />
          <FloatingParticle delay={2.5} duration={8} x="60%" y="25%" size={7} />
          <FloatingParticle delay={3} duration={9} x="70%" y="60%" size={9} />
          <FloatingParticle delay={3.5} duration={6} x="25%" y="85%" size={6} />
          <FloatingParticle delay={4} duration={6} x="50%" y="40%" size={8} />
          <FloatingParticle delay={4.5} duration={7} x="95%" y="55%" size={5} />
          <FloatingParticle delay={5} duration={8} x="20%" y="80%" size={11} />
          <FloatingParticle delay={5.5} duration={9} x="75%" y="75%" size={7} />
          <FloatingParticle delay={6} duration={7} x="90%" y="70%" size={6} />
          <FloatingParticle delay={6.5} duration={8} x="5%" y="60%" size={9} />
          <FloatingParticle delay={7} duration={9} x="40%" y="10%" size={8} />
          <FloatingParticle delay={7.5} duration={6} x="55%" y="90%" size={10} />
          
          {/* Sparkles */}
          <Sparkle x="20%" y="30%" delay={0} />
          <Sparkle x="80%" y="20%" delay={0.5} />
          <Sparkle x="60%" y="70%" delay={1} />
          <Sparkle x="30%" y="60%" delay={1.5} />
          <Sparkle x="90%" y="50%" delay={2} />
          <Sparkle x="10%" y="80%" delay={2.5} />
          <Sparkle x="70%" y="40%" delay={3} />
          <Sparkle x="40%" y="90%" delay={3.5} />
          
          {/* Animated Lines */}
          <motion.div
            className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
            animate={{ opacity: [0.2, 0.6, 0.2], scaleX: [0.8, 1, 0.8] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent"
            animate={{ opacity: [0.1, 0.4, 0.1], scaleX: [0.9, 1, 0.9] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <motion.div
            className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-300/25 to-transparent"
            animate={{ opacity: [0.15, 0.35, 0.15], scaleX: [0.85, 1, 0.85] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          
          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-100/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-yellow-100/15 via-transparent to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <motion.h1 
                className="text-5xl md:text-6xl font-bold leading-tight mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <motion.span
                  className="inline-block"
                  animate={{ 
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  style={{
                    backgroundImage: "linear-gradient(90deg, #000, #D4AF37, #000)",
                    backgroundSize: "200% auto",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  CREATE, UPLOAD AND MONETIZE.
                </motion.span>
              </motion.h1>
              <motion.p 
                className="text-lg text-gray-600 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
               Velt helps creators monetize their work and manage subscriptions with ease. Connect with your audience and grow your brand with our billboard ecosystem.
              </motion.p>
              
              {/* Login/Signup Buttons */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.5 }}
                className="flex flex-col sm:flex-row gap-4 mb-6"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link 
                    href="/signup" 
                    className="px-8 py-4 rounded-lg font-semibold text-center border-2 transition-all duration-300 block flex items-center justify-center gap-2"
                    style={{ borderColor: "#D4AF37", color: "#D4AF37" }}
                  >
                    <FaCrown className="text-lg" />
                    Sign Up
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link 
                    href="/renew-subscription" 
                    className="px-8 py-4 rounded-lg font-semibold text-center transition-all duration-300 block text-black flex items-center justify-center gap-2"
                    style={{ backgroundColor: "#D4AF37" }}
                  >
                    <FaRedo className="text-lg" />
                    Renew Subscription
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                <p className="text-sm text-gray-500 mb-2">Or join our waitlist for early access:</p>
                <WaitlistForm showName={false} text="Join Waitlist" />
              </motion.div>

              <div className="mt-10 flex gap-6">
                <Link href="/investors" className="text-sm font-semibold text-gray-700 hover:text-black transition">
                  Investors
                </Link>
                <Link href="/support" className="text-sm font-semibold text-gray-700 hover:text-black transition">
                  Support
                </Link>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }}>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border-2 relative overflow-hidden" style={{ borderColor: "#d4af37" }}>
                {/* Card background animation */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-amber-100/0 via-amber-100/30 to-amber-100/0"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                />
                <div className="space-y-4 relative z-10">
                  <motion.div 
                    className="p-4 bg-white rounded-lg shadow-sm border-l-4" 
                    style={{ borderColor: "#d4af37" }} 
                    whileHover={{ translateY: -4, boxShadow: "0 10px 30px rgba(212, 175, 55, 0.2)" }}
                  >
                    <div className="text-sm font-semibold">Billboard Display Ready</div>
                    <div className="text-xs text-gray-600 mt-1">Upload once, display everywhere</div>
                  </motion.div>
                  <motion.div 
                    className="p-4 bg-white rounded-lg shadow-sm border-l-4" 
                    style={{ borderColor: "#d4af37" }} 
                    whileHover={{ translateY: -4, boxShadow: "0 10px 30px rgba(212, 175, 55, 0.2)" }}
                  >
                    <div className="text-sm font-semibold">Easy Management</div>
                    <div className="text-xs text-gray-600 mt-1">Control your content from one dashboard</div>
                  </motion.div>
                  <motion.div 
                    className="p-4 bg-white rounded-lg shadow-sm border-l-4" 
                    style={{ borderColor: "#d4af37" }} 
                    whileHover={{ translateY: -4, boxShadow: "0 10px 30px rgba(212, 175, 55, 0.2)" }}
                  >
                    <div className="text-sm font-semibold">Nationwide Reach</div>
                    <div className="text-xs text-gray-600 mt-1">Billboards across the country</div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </header>


      {/* FEATURES */}
      <section className="w-full bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-3xl md:text-4xl font-bold text-black text-center mb-4">
            How It Works
          </motion.h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto mb-12">Upload your content to billboards across the country in minutes.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0 }} className="p-8 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4" style={{ color: "#d4af37" }}>1</div>
              <h3 className="text-xl font-bold text-black mb-3">Upload Content</h3>
              <p className="text-gray-600 text-sm">Add your content and select billboard locations.</p>
            </motion.div>

            <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="p-8 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4" style={{ color: "#d4af37" }}>2</div>
              <h3 className="text-xl font-bold text-black mb-3">Display & Manage</h3>
              <p className="text-gray-600 text-sm">View live status and analytics from your dashboard.</p>
            </motion.div>

            <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="p-8 bg-white rounded-xl border border-gray-200 hover:shadow-lg transition">
              <div className="text-4xl mb-4" style={{ color: "#d4af37" }}>3</div>
              <h3 className="text-xl font-bold text-black mb-3">Reach Audiences</h3>
              <p className="text-gray-600 text-sm">Get your message in front of people everywhere.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURES HIGHLIGHT */}
      <section className="w-full bg-white">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
              <h2 className="text-3xl font-bold text-black mb-6">Powerful Features</h2>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#faf5f0", color: "#d4af37" }}>
                    <FaImage />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Billboard Management</h4>
                    <p className="text-sm text-gray-600">Manage all your billboards from one dashboard.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#faf5f0", color: "#d4af37" }}>
                    <FaChartLine />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Real-time Analytics</h4>
                    <p className="text-sm text-gray-600">Track impressions and engagement instantly.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#faf5f0", color: "#d4af37" }}>
                    <FaGlobe />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Nationwide Coverage</h4>
                    <p className="text-sm text-gray-600">Access billboards across all regions.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#faf5f0", color: "#d4af37" }}>
                    <FaWallet />
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Simple Payments</h4>
                    <p className="text-sm text-gray-600">Secure and easy payment processing.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-12 border-2" style={{ borderColor: "#d4af37" }}>
                <div className="space-y-6">
                  <motion.div className="p-6 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#d4af37" }} whileHover={{ scale: 1.05 }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-black">Active Billboards</div>
                        <div className="text-xs text-gray-600">Across the country</div>
                      </div>
                      <div className="text-3xl font-bold" style={{ color: "#d4af37" }}>24</div>
                    </div>
                  </motion.div>
                  <motion.div className="p-6 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#d4af37" }} whileHover={{ scale: 1.05 }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-black">Total Impressions</div>
                        <div className="text-xs text-gray-600">This month</div>
                      </div>
                      <div className="text-3xl font-bold" style={{ color: "#d4af37" }}>2.4M</div>
                    </div>
                  </motion.div>
                  <motion.div className="p-6 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#d4af37" }} whileHover={{ scale: 1.05 }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-black">Uptime</div>
                        <div className="text-xs text-gray-600">Reliability guaranteed</div>
                      </div>
                      <div className="text-3xl font-bold" style={{ color: "#d4af37" }}>99%</div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="w-full bg-gradient-to-r from-gray-900 to-black text-white">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-20">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-gray-300 mb-10 max-w-2xl mx-auto">Join the waitlist to get early access to VELT.</p>
            
            <div className="max-w-md mx-auto">
              <WaitlistForm showName={true} text="Sign Up on Waitlist" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-8">
            <div>
              <div className="font-bold text-black text-lg mb-2">VELT</div>
              <p className="text-sm text-gray-600">Billboard content management system.</p>
            </div>
            <div>
              <h4 className="font-semibold text-black mb-4">Links</h4>
              <div className="space-y-2 text-sm">
                <Link href="/privacy" className="text-gray-600 hover:text-black transition">Privacy Policy</Link>
                <br />
                <Link href="/support" className="text-gray-600 hover:text-black transition">Support</Link>
                <br />
                <Link href="/investors" className="text-gray-600 hover:text-black transition">Investors</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-black mb-4">Contact</h4>
              <p className="text-sm text-gray-600">support@velt.app</p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-sm text-gray-500 text-center">
            <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}




