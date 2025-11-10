"use client";

import Image from "next/image";
import Link from "next/link";
import { FaRocket, FaLock, FaWallet, FaTwitter, FaInstagram, FaEnvelope, FaChartLine, FaCloud } from "react-icons/fa";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-white text-slate-900 antialiased">
      {/* HERO - full bleed, light theme */}
      <header className="w-full">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <motion.h1
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="text-4xl md:text-6xl font-extrabold leading-tight"
              >
                Turn spaces into revenue with <span className="text-blue-600">Velt</span>
              </motion.h1>

              <motion.p
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.08, duration: 0.6 }}
                className="mt-6 text-lg text-slate-700 max-w-xl"
              >
                Manage cloud-connected billboards, list stays, cars and taxis, and collect recurring revenue — all from one dashboard.
                Fast deployment. Secure payments. Real-time analytics.
              </motion.p>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-3 bg-blue-600 text-white px-5 py-3 rounded-lg font-semibold shadow hover:bg-blue-700 transition"
                >
                  Get started
                </Link>

                <Link
                  href={`/login?next=${encodeURIComponent("/lister-plan")}`}
                  className="inline-flex items-center gap-3 border border-blue-600 text-blue-600 px-5 py-3 rounded-lg hover:bg-blue-50 transition"
                >
                  Lister Login
                </Link>

                <a href="#features" className="inline-flex items-center gap-2 text-sm text-slate-600 px-3 py-3 rounded-lg">
                  Learn features →
                </a>
              </motion.div>

              <motion.div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}>
                <div className="flex items-center gap-3"><FaChartLine className="text-blue-500" /> Real-time metrics</div>
                <div className="flex items-center gap-3"><FaWallet className="text-blue-500" /> Paystack payments</div>
                <div className="flex items-center gap-3"><FaRocket className="text-blue-500" /> Fast setup</div>
                <div className="flex items-center gap-3"><FaLock className="text-blue-500" /> Secure by design</div>
              </motion.div>
            </div>

            {/* Visual / mock */}
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.12, duration: 0.6 }}>
              <div className="w-full max-w-xl mx-auto border rounded-2xl shadow-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-slate-500">LIVE • Connected</div>
                    <div className="text-lg font-semibold">Main Street Billboard</div>
                  </div>
                  <div className="text-sm text-slate-700">Impressions <span className="font-bold">12.4k</span></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="text-xs text-blue-600">Active Creative</div>
                    <div className="mt-1 font-semibold">Weekend Sale</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                    <div className="text-xs text-slate-500">Next Slot</div>
                    <div className="mt-1 font-semibold">Mon 08:00</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-100">
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="mt-1 text-sm font-semibold text-green-600">All synced</div>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-slate-100">
                    <div className="text-xs text-slate-500">Top Listing</div>
                    <div className="mt-1 font-semibold">Cozy 2BR in Accra</div>
                    <div className="text-xs text-slate-500">GHS 120 / night</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section id="features" className="w-full bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-16">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 text-center">Features that power local revenue</h2>
          <p className="text-center text-slate-600 max-w-2xl mx-auto mt-3">Everything you need to run listings and ads — modern dashboard, secure checkout, and analytics that matter.</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div whileHover={{ y: -6 }} className="p-6 bg-white border rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded bg-blue-50 text-blue-600"><FaCloud /></div>
                <div>
                  <h3 className="font-semibold text-slate-900">Cloud control</h3>
                  <p className="text-sm text-slate-600 mt-2">Push content to many billboards instantly, schedule creatives and target by location.</p>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -6 }} className="p-6 bg-white border rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded bg-blue-50 text-blue-600"><FaWallet /></div>
                <div>
                  <h3 className="font-semibold text-slate-900">Secure payments</h3>
                  <p className="text-sm text-slate-600 mt-2">Paystack-powered subscriptions and one-off payments in GHS, verified server-side.</p>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -6 }} className="p-6 bg-white border rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded bg-blue-50 text-blue-600"><FaChartLine /></div>
                <div>
                  <h3 className="font-semibold text-slate-900">Real-time analytics</h3>
                  <p className="text-sm text-slate-600 mt-2">See impressions, booking conversions, and billing metrics in one dashboard.</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6 bg-white border p-6 rounded-lg shadow-sm">
            <div>
              <h4 className="font-bold text-slate-900">Ready to monetize your space?</h4>
              <p className="text-slate-600 mt-2">Become a Lister to create listings and run ad campaigns. Manage everything on the Velt website.</p>
            </div>

            <div className="flex gap-4">
              <Link href={`/login?next=${encodeURIComponent("/lister-plan")}`} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold">Sign in to buy Lister plan</Link>
              <Link href="/auth/signup" className="border border-slate-200 px-4 py-2 rounded-lg">Create account</Link>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF & CTA */}
      <section className="max-w-6xl mx-auto px-6 md:px-12 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white border rounded-lg text-slate-700">
            <div className="font-semibold">Trusted by local businesses</div>
            <div className="mt-3 text-sm">Automated scheduling and simple billing helped local shops sell more effectively.</div>
          </div>

          <div className="p-6 bg-white border rounded-lg text-slate-700">
            <div className="font-semibold">Listings + bookings</div>
            <div className="mt-3 text-sm">Create stays, cars or taxis and accept bookings with secure checkout.</div>
          </div>

          <div className="p-6 bg-white border rounded-lg text-slate-700">
            <div className="font-semibold">Grow with analytics</div>
            <div className="mt-3 text-sm">Measure performance and optimize creatives for better ROI.</div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/auth/signup" className="inline-flex items-center gap-3 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">Create account — it's free</Link>
        </div>
      </section>

      {/* FOOTER (simple, light) */}
      <footer className="w-full border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 text-sm text-slate-600">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <div className="font-bold text-slate-900">VELT</div>
              <div className="text-xs">billboards • listings • creators</div>
            </div>

            <div className="flex gap-6">
              <Link href="/privacy" className="hover:underline">Privacy</Link>
              <Link href="/terms" className="hover:underline">Terms</Link>
              <a href="mailto:support@velt.com" className="hover:underline">support@velt.com</a>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-400">© {new Date().getFullYear()} VELT. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}


