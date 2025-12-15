"use client";

import Link from "next/link";
import { FaArrowLeft, FaChartLine, FaTrophy, FaUsers, FaGlobe, FaRocket, FaShieldAlt, FaHandshake, FaEnvelope } from "react-icons/fa";
import { motion } from "framer-motion";

const GOLD = "#D4AF37";

// Animated counter component
const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: string; prefix?: string; suffix?: string }) => (
  <motion.span
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    {prefix}{value}{suffix}
  </motion.span>
);

// Floating background element
const FloatingOrb = ({ className, delay }: { className: string; delay: number }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl ${className}`}
    animate={{
      scale: [1, 1.2, 1],
      opacity: [0.1, 0.2, 0.1],
    }}
    transition={{
      duration: 8,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

export default function Investors() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <FloatingOrb className="w-96 h-96 -top-48 -right-48 bg-amber-200/30" delay={0} />
        <FloatingOrb className="w-80 h-80 top-1/2 -left-40 bg-amber-100/20" delay={2} />
        <FloatingOrb className="w-64 h-64 bottom-20 right-1/4 bg-yellow-200/20" delay={4} />
      </div>

      {/* HEADER */}
      <header className="border-b border-gray-200 bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-[var(--foreground)] transition">
            <FaArrowLeft size={14} />
            <span className="text-sm font-medium">Back Home</span>
          </Link>
          <Link href="/" className="font-bold text-xl">VELT</Link>
          <div className="w-20"></div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-6"
            >
              <FaChartLine style={{ color: GOLD }} />
              <span className="text-sm font-medium text-amber-800">Investor Relations</span>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Invest in the Future of{" "}
              <span style={{ color: GOLD }}>Creator Economy</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
              VELT is revolutionizing how creators monetize their content and how brands connect with audiences through innovative billboard technology.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="mailto:investors@velt.app"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-xl font-semibold text-black flex items-center justify-center gap-2"
                style={{ backgroundColor: GOLD }}
              >
                <FaEnvelope />
                Contact Investor Relations
              </motion.a>
              <motion.a
                href="#metrics"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-xl font-semibold border-2 border-gray-300 hover:border-amber-400 transition"
              >
                View Metrics
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* KEY METRICS */}
      <section id="metrics" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div 
            initial={{ opacity: 0 }} 
            whileInView={{ opacity: 1 }} 
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Key Performance Metrics</h2>
            <p className="text-gray-600">Real-time business performance indicators</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FaChartLine, label: "Monthly Revenue", value: "GH₵2.4M", change: "+24%", color: "from-blue-500 to-blue-600" },
              { icon: FaTrophy, label: "Net Profit", value: "GH₵840K", change: "+35%", color: "from-green-500 to-green-600" },
              { icon: FaRocket, label: "Company Valuation", value: "GH₵180M", change: "+78%", color: "from-purple-500 to-purple-600" },
              { icon: FaGlobe, label: "Active Billboards", value: "450+", change: "+25/mo", color: "from-amber-500 to-amber-600" },
            ].map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, boxShadow: "0 20px 40px rgba(0,0,0,0.1)" }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center mb-4`}>
                  <metric.icon className="text-white text-xl" />
                </div>
                <p className="text-gray-500 text-sm font-medium mb-1">{metric.label}</p>
                <p className="text-3xl font-bold mb-2">{metric.value}</p>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {metric.change}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FINANCIAL DETAILS */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Financial Overview */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
                  <FaChartLine style={{ color: GOLD }} />
                </div>
                <h3 className="text-2xl font-bold">Financial Overview</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { label: "Total Revenue (YTD)", value: "GH₵18.2M" },
                  { label: "Operating Expenses", value: "GH₵8.8M" },
                  { label: "EBITDA", value: "GH₵9.4M", highlight: true },
                  { label: "Cash Runway", value: "18+ months" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-600">{item.label}</span>
                    <span className={`font-bold text-lg ${item.highlight ? "" : ""}`} style={item.highlight ? { color: GOLD } : {}}>
                      {item.value}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Growth Metrics */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
                  <FaRocket style={{ color: GOLD }} />
                </div>
                <h3 className="text-2xl font-bold">Growth Metrics</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { label: "User Growth (Monthly)", value: "+18%" },
                  { label: "Billboard Expansion", value: "+25/month" },
                  { label: "Customer Retention", value: "92%" },
                  { label: "Market Penetration", value: "8% of market" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-bold text-lg">{item.value}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROJECTIONS */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-3xl p-8 md:p-12 text-white overflow-hidden relative"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="text-center mb-10">
                <h3 className="text-3xl md:text-4xl font-bold mb-3">12-Month Projections</h3>
                <p className="text-gray-400">Based on current growth trajectory</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: "Projected Revenue", value: "GH₵32.4M", growth: "+78%" },
                  { label: "Projected Profit", value: "GH₵14.7M", growth: "45% margin" },
                  { label: "Projected Valuation", value: "GH₵320M", growth: "+78%" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    className="text-center"
                  >
                    <p className="text-gray-400 text-sm font-medium mb-2">{item.label}</p>
                    <p className="text-4xl md:text-5xl font-bold mb-2" style={{ color: GOLD }}>{item.value}</p>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-amber-300">
                      {item.growth}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* WHY INVEST */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div 
            initial={{ opacity: 0 }} 
            whileInView={{ opacity: 1 }} 
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Invest in VELT?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Strategic advantages that set us apart in the market</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: FaUsers, title: "Growing Market", description: "The creator economy is projected to reach $500B by 2027. VELT is positioned to capture significant market share." },
              { icon: FaShieldAlt, title: "Strong Moat", description: "Proprietary technology, exclusive billboard partnerships, and network effects create sustainable competitive advantages." },
              { icon: FaHandshake, title: "Experienced Team", description: "Leadership team with proven track records in tech, advertising, and scaling startups across Africa." },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 border border-gray-100 shadow-lg text-center"
              >
                <div 
                  className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                  style={{ backgroundColor: `${GOLD}15` }}
                >
                  <item.icon className="text-2xl" style={{ color: GOLD }} />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-xl text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring" }}
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: `${GOLD}20` }}
            >
              <FaHandshake className="text-3xl" style={{ color: GOLD }} />
            </motion.div>
            
            <h3 className="text-3xl font-bold mb-4">Ready to Partner?</h3>
            <p className="text-gray-600 mb-8 max-w-xl mx-auto">
              For detailed financial reports, pitch decks, and partnership opportunities, our investor relations team is ready to assist you.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="mailto:investors@velt.app"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-xl font-semibold text-black flex items-center justify-center gap-2"
                style={{ backgroundColor: GOLD }}
              >
                <FaEnvelope />
                investors@velt.app
              </motion.a>
              <motion.a
                href="tel:+233000000000"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-amber-400 transition"
              >
                Schedule a Call
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
