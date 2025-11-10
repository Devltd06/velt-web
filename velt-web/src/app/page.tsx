"use client";
import Image from "next/image";
import Link from "next/link";
import { FaRocket, FaLock, FaWallet, FaTwitter, FaInstagram, FaEnvelope, FaBell, FaChartLine, FaCloud } from "react-icons/fa";
import { motion } from "framer-motion";

export default function Home() {
  const listerPlanPayload = {
    email: "demo@velt.com",
    username: "demoUser",
    fullName: "Demo User",
    priceGHS: 50,
    plan: "publisher_monthly",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#071431] to-white text-white overflow-x-hidden">
      {/* page-level styles for a light/blue/black palette */}

      <style jsx>{`
        .glass {
          background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          backdrop-filter: blur(10px) saturate(120%);
          -webkit-backdrop-filter: blur(10px) saturate(120%);
        }

        @keyframes floaty { 0% { transform: translateY(0) } 50% { transform: translateY(-10px) } 100% { transform: translateY(0) } }
        .floaty { animation: floaty 5s ease-in-out infinite; }

        @media (min-width: 768px) {
          .hero-padding { padding-top: 90px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="fixed w-full z-50 top-0 left-0 border-b border-transparent glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#0ea5e9] to-[#7c3aed] flex items-center justify-center shadow-lg">
              <Image src="/favicon.ico" alt="VELT" width={28} height={28} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">VELT</span>
            <span className="ml-2 text-sm text-blue-200/70">billboards • listings • creators</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/" className="text-blue-100 hover:text-white transition">Home</Link>
            <a href="#features" className="text-blue-100 hover:text-white transition">Features</a>
            <a href="#about" className="text-blue-100 hover:text-white transition">About</a>
            <a href="#contact" className="text-blue-100 hover:text-white transition">Contact</a>
            <Link href={`/login?next=${encodeURIComponent("/lister-plan")}`} className="text-white bg-black/40 px-3 py-2 rounded-md border border-white/6 hover:bg-black/60 transition">
              Lister Login
            </Link>
            <Link href="/signup" className="bg-[#0ea5e9] text-black px-3 py-2 rounded-md font-semibold hover:opacity-95 transition">Sign up</Link>
          </div>

          <div className="md:hidden">
            <Link href={`/login?next=${encodeURIComponent("/lister-plan")}`} className="text-white bg-black/40 px-3 py-2 rounded-md border border-white/6 hover:bg-black/60 transition">Lister</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero-padding pt-28 pb-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col-reverse md:flex-row items-center gap-12">
          <div className="w-full md:w-6/12 text-center md:text-left">
            <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="text-5xl md:text-6xl font-extrabold leading-tight text-white">
              Smart billboards. Instant updates. Real revenue.
            </motion.h1>

            <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.6 }} className="mt-6 text-lg text-blue-100/90 max-w-xl">
              Velt turns ordinary spaces into dynamic revenue channels. Manage connected billboards, list stays, cars, and taxis, and collect subscription revenue — all from one cloud-first dashboard.
            </motion.p>

            <div className="mt-8 flex flex-wrap gap-4 justify-center md:justify-start">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link href="/signup" className="inline-flex items-center gap-3 bg-[#0ea5e9] text-black px-6 py-3 rounded-lg font-semibold shadow-2xl">Get started</Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link href="/ListerPlan" className="inline-flex items-center gap-3 border border-white/10 px-6 py-3 rounded-lg text-white">Lister plan</Link>
              </motion.div>

              <motion.a whileHover={{ scale: 1.02 }} className="inline-flex items-center gap-3 text-sm text-blue-200/80 px-4 py-3 rounded-lg" href="#features">See features</motion.a>
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-blue-100/70">
              <div className="flex items-center gap-3"><FaCloud className="text-blue-300" /> Cloud-managed billboards</div>
              <div className="flex items-center gap-3"><FaChartLine className="text-blue-300" /> Real-time analytics</div>
              <div className="flex items-center gap-3"><FaWallet className="text-blue-300" /> Paystack payments</div>
              <div className="flex items-center gap-3"><FaBell className="text-blue-300" /> Instant content updates</div>
            </div>
          </div>

          <div className="w-full md:w-6/12 flex items-center justify-center">
            <div className="relative w-full max-w-lg">
              <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="rounded-2xl p-6 glass border border-white/6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-blue-100/80">LIVE • Connected</div>
                    <div className="text-xl font-semibold mt-1">Abena's Market Billboard</div>
                  </div>
                  <div className="text-right text-sm text-blue-200/70">Impressions: <span className="font-bold text-white">24.3k</span></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-[#0ea5e9]/10 to-white/4 p-4 rounded-lg">
                    <div className="text-sm text-blue-200/80">Scheduled</div>
                    <div className="mt-2 font-bold text-white">Sale • Weekend</div>
                  </div>

                  <div className="bg-gradient-to-br from-[#7c3aed]/10 to-white/4 p-4 rounded-lg floaty">
                    <div className="text-sm text-blue-200/80">Active Creative</div>
                    <div className="mt-2 font-bold text-white">Autumn Promo</div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-blue-100/80">Sync status: <span className="ml-2 font-semibold text-green-300">All billboards up-to-date</span></div>
              </motion.div>

              <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.12 }} className="absolute -right-8 -bottom-8 w-44 p-3 rounded-xl glass border border-white/6 shadow-xl">
                <div className="text-xs text-blue-200/70">Top Listing</div>
                <div className="font-bold text-white mt-1">Cozy 2BR in Accra</div>
                <div className="text-sm text-blue-100/60 mt-2">GHS 120 / night</div>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section id="features" className="py-20 px-6 bg-white text-black">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#02112a]">Built for creators, advertisers, and local businesses</h2>
          <p className="text-center text-[#0b2a4a] max-w-2xl mx-auto mt-4">Velt gives you the tools to publish, monetize and measure—whether you're listing a car, registering a taxi, or running an ad across a network of smart billboards.</p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div whileHover={{ y: -6 }} className="p-6 rounded-xl border border-[#e6eef8] shadow hover:shadow-lg transition">
              <div className="flex items-center gap-3 text-[#0b2a4a]"><FaCloud /> <h3 className="font-bold text-lg">Cloud-first control</h3></div>
              <p className="mt-3 text-[#123d60]">Schedule content across dozens of billboards, push updates instantly from a single dashboard.</p>
            </motion.div>

            <motion.div whileHover={{ y: -6 }} className="p-6 rounded-xl border border-[#e6eef8] shadow hover:shadow-lg transition">
              <div className="flex items-center gap-3 text-[#0b2a4a]"><FaWallet /> <h3 className="font-bold text-lg">Secure payments</h3></div>
              <p className="mt-3 text-[#123d60]">Seamless Paystack integration for subscriptions and one-off payments in GHS.</p>
            </motion.div>

            <motion.div whileHover={{ y: -6 }} className="p-6 rounded-xl border border-[#e6eef8] shadow hover:shadow-lg transition">
              <div className="flex items-center gap-3 text-[#0b2a4a]"><FaChartLine /> <h3 className="font-bold text-lg">Real-time analytics</h3></div>
              <p className="mt-3 text-[#123d60]">Understand impressions, conversions, and the performance of your creatives with actionable dashboards.</p>
            </motion.div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-xl bg-gradient-to-tr from-[#0ea5e9]/8 to-[#7c3aed]/6 border border-[#eaf6ff]">
              <h4 className="font-bold text-[#02112a]">Listings that convert</h4>
              <p className="mt-2 text-[#043253]">High-converting templates for stays, cars and taxis with built-in booking and secure checkout.</p>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-xl bg-gradient-to-tr from-[#0ea5e9]/8 to-[#7c3aed]/6 border border-[#eaf6ff]">
              <h4 className="font-bold text-[#02112a]">Publisher subscriptions</h4>
              <p className="mt-2 text-[#043253]">Become a Lister and unlock creation tools — billed monthly. Manage, cancel or renew anytime from your account.</p>
            </motion.div>
          </div>

        </div>
      </section>

      {/* ABOUT + CTA */}
      <section id="about" className="py-16 px-6 bg-[#02112a] text-white">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-2xl font-bold">Why Velt?</h3>
          <p className="max-w-2xl mx-auto mt-4 text-blue-100/90">Because local businesses deserve modern ad tech. Because creators deserve recurring revenue. Because every listing and billboard should be easy to manage — from any device.</p>

          <div className="mt-8 flex justify-center gap-4">
            <Link href="/ListerPlan" className="bg-white text-black px-5 py-3 rounded-md font-semibold">Start Lister plan</Link>
            <Link href="/signup" className="border border-white/20 px-5 py-3 rounded-md">Create account</Link>
          </div>
        </div>
      </section>

      {/* CONTACT / FOOTER */}
      <footer id="contact" className="py-10 px-6 bg-[#08122a] text-blue-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2"><div className="w-9 h-9 rounded bg-gradient-to-tr from-[#0ea5e9] to-[#7c3aed] flex items-center justify-center"> <FaRocket /> </div><div>
              <div className="font-bold">VELT</div>
              <div className="text-sm text-blue-200/70">billboards • listings • creators</div>
            </div></div>
            <p className="text-sm text-blue-200/60">Have a question? Email <a className="text-white underline" href="mailto:support@velt.com">support@velt.com</a></p>
          </div>

          <div>
            <h4 className="font-semibold">Explore</h4>
            <ul className="mt-3 text-sm text-blue-200/70">
              <li><Link href="/" className="hover:underline">Home</Link></li>
              <li><Link href="/ListerPlan" className="hover:underline">Lister plan</Link></li>
              <li><Link href="/privacy" className="hover:underline">Privacy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Follow</h4>
            <div className="flex gap-4 mt-3 text-xl">
              <a href="https://twitter.com" target="_blank" rel="noreferrer"><FaTwitter /></a>
              <a href="https://www.instagram.com/velt_app" target="_blank" rel="noreferrer"><FaInstagram /></a>
              <a href="mailto:atmosdevltd@gmail.com"><FaEnvelope /></a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-8 text-center text-sm text-blue-200/60">© {new Date().getFullYear()} VELT • All rights reserved</div>
      </footer>
    </div>
  );
}

