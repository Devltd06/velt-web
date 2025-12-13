"use client";

import Link from "next/link";
import { FaArrowLeft, FaChartLine, FaTrophy } from "react-icons/fa";
import { motion } from "framer-motion";

export default function Investors() {
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

      {/* HERO */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Investor Dashboard</h1>
          <p className="text-lg text-gray-600 mb-12">Key metrics and performance indicators for VELT.</p>
        </motion.div>

        {/* MAIN METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2" style={{ borderColor: "#d4af37" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-gray-600 text-sm font-semibold">Monthly Revenue</div>
                <div className="text-4xl font-bold mt-2">GHS 2.4M</div>
              </div>
              <FaChartLine className="text-4xl" style={{ color: "#d4af37" }} />
            </div>
            <div className="text-xs text-gray-600">Growing at 24% month-over-month</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-8 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2" style={{ borderColor: "#d4af37" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-gray-600 text-sm font-semibold">Net Profit</div>
                <div className="text-4xl font-bold mt-2">GHS 840K</div>
              </div>
              <FaTrophy className="text-4xl" style={{ color: "#d4af37" }} />
            </div>
            <div className="text-xs text-gray-600">35% profit margin</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-8 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2" style={{ borderColor: "#d4af37" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-gray-600 text-sm font-semibold">Company Valuation</div>
                <div className="text-4xl font-bold mt-2">GHS 180M</div>
              </div>
              <div className="text-4xl" style={{ color: "#d4af37" }}>📈</div>
            </div>
            <div className="text-xs text-gray-600">Based on latest funding round</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-8 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border-2" style={{ borderColor: "#d4af37" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-gray-600 text-sm font-semibold">Active Billboards</div>
                <div className="text-4xl font-bold mt-2">450+</div>
              </div>
              <div className="text-4xl" style={{ color: "#d4af37" }}>📊</div>
            </div>
            <div className="text-xs text-gray-600">Nationwide coverage</div>
          </motion.div>
        </div>

        {/* DETAILED METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* FINANCIAL OVERVIEW */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="p-8 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-2xl font-bold mb-6">Financial Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-300">
                <span className="text-gray-700">Total Revenue (YTD)</span>
                <span className="font-bold text-lg">GHS 18.2M</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-300">
                <span className="text-gray-700">Operating Expenses</span>
                <span className="font-bold text-lg">GHS 8.8M</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-300">
                <span className="text-gray-700">EBITDA</span>
                <span className="font-bold text-lg" style={{ color: "#d4af37" }}>GHS 9.4M</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-700 font-semibold">Cash Runway</span>
                <span className="font-bold text-lg">18+ months</span>
              </div>
            </div>
          </motion.div>

          {/* GROWTH METRICS */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="p-8 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-2xl font-bold mb-6">Growth Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-300">
                <span className="text-gray-700">User Growth (Monthly)</span>
                <span className="font-bold text-lg">+18%</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-300">
                <span className="text-gray-700">Billboard Expansion</span>
                <span className="font-bold text-lg">+25 per month</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-300">
                <span className="text-gray-700">Customer Retention</span>
                <span className="font-bold text-lg">92%</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-700 font-semibold">Market Penetration</span>
                <span className="font-bold text-lg">8% of market</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* FUTURE PROJECTIONS */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="p-8 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl">
          <h3 className="text-2xl font-bold mb-6">12-Month Projections</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="text-gray-300 text-sm font-semibold mb-2">Projected Revenue</div>
              <div className="text-3xl font-bold mb-2">GHS 32.4M</div>
              <div className="text-xs text-gray-400">+78% growth</div>
            </div>
            <div>
              <div className="text-gray-300 text-sm font-semibold mb-2">Projected Profit</div>
              <div className="text-3xl font-bold mb-2">GHS 14.7M</div>
              <div className="text-xs text-gray-400">45% margin</div>
            </div>
            <div>
              <div className="text-gray-300 text-sm font-semibold mb-2">Projected Valuation</div>
              <div className="text-3xl font-bold mb-2">GHS 320M</div>
              <div className="text-xs text-gray-400">+78% increase</div>
            </div>
          </div>
        </motion.div>

        {/* CONTACT SECTION */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-12 p-8 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="text-2xl font-bold mb-4">Investor Relations</h3>
          <p className="text-gray-600 mb-6">For detailed financial reports, pitch decks, and partnership opportunities, please reach out.</p>
          <a href="mailto:investors@velt.app" className="font-semibold hover:opacity-80 transition" style={{ color: "#d4af37" }}>
            investors@velt.app
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
