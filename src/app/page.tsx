"use client";

import Link from "next/link";
import { FaImage, FaWallet, FaGlobe, FaChartLine } from "react-icons/fa";
import { motion } from "framer-motion";
import WaitlistForm from "@/components/WaitlistForm";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-white text-black antialiased">
      {/* HERO */}
      <header className="w-full border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                 CREATE, UPLOAD AND MONETIZE.
              </h1>
              <p className="text-lg text-gray-600 mb-8">
               Velt helps creators monetize their work and manage subscriptions with ease. Connect with your audience and grow your brand with our billboard ecosystem.
              </p>
              
              {/* Login/Signup Buttons */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.2 }}
                className="flex flex-col sm:flex-row gap-4 mb-6"
              >
                <Link 
                  href="/app/login" 
                  className="px-8 py-4 rounded-lg font-semibold text-center transition-all duration-300 hover:scale-105"
                  style={{ backgroundColor: "#D4AF37", color: "#000" }}
                >
                  Log In
                </Link>
                <Link 
                  href="/app/signup" 
                  className="px-8 py-4 rounded-lg font-semibold text-center border-2 transition-all duration-300 hover:scale-105"
                  style={{ borderColor: "#D4AF37", color: "#D4AF37" }}
                >
                  Sign Up
                </Link>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
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
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border-2" style={{ borderColor: "#d4af37" }}>
                <div className="space-y-4">
                  <motion.div className="p-4 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#d4af37" }} whileHover={{ translateY: -4 }}>
                    <div className="text-sm font-semibold">Billboard Display Ready</div>
                    <div className="text-xs text-gray-600 mt-1">Upload once, display everywhere</div>
                  </motion.div>
                  <motion.div className="p-4 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#d4af37" }} whileHover={{ translateY: -4 }}>
                    <div className="text-sm font-semibold">Easy Management</div>
                    <div className="text-xs text-gray-600 mt-1">Control your content from one dashboard</div>
                  </motion.div>
                  <motion.div className="p-4 bg-white rounded-lg shadow-sm border-l-4" style={{ borderColor: "#d4af37" }} whileHover={{ translateY: -4 }}>
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




