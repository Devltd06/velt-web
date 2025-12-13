"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaBullhorn,
  FaMapMarkerAlt,
  FaEye,
  FaStar,
  FaArrowRight,
  FaCheck,
} from "react-icons/fa";

const VELT_ACCENT = "#D4AF37";

const REGIONS = [
  "All Regions",
  "Greater Accra",
  "Ashanti",
  "Northern",
  "Western",
  "Eastern",
  "Volta",
];

const featuredBillboards = [
  {
    id: "1",
    name: "Accra Mall Premium",
    location: "Accra Mall, Spintex Road",
    region: "Greater Accra",
    size: "48x14 ft",
    pricePerDay: 850,
    impressions: 125000,
    rating: 4.8,
  },
  {
    id: "2",
    name: "Kumasi City Center",
    location: "Adum, Kumasi",
    region: "Ashanti",
    size: "32x10 ft",
    pricePerDay: 650,
    impressions: 98000,
    rating: 4.6,
  },
  {
    id: "3",
    name: "Airport Roundabout",
    location: "Kotoka International Airport",
    region: "Greater Accra",
    size: "64x20 ft",
    pricePerDay: 1200,
    impressions: 180000,
    rating: 4.9,
  },
  {
    id: "4",
    name: "Tema Motorway",
    location: "Tema Motorway Junction",
    region: "Greater Accra",
    size: "48x14 ft",
    pricePerDay: 750,
    impressions: 145000,
    rating: 4.7,
  },
  {
    id: "5",
    name: "Takoradi Market Circle",
    location: "Market Circle, Takoradi",
    region: "Western",
    size: "24x8 ft",
    pricePerDay: 450,
    impressions: 65000,
    rating: 4.4,
  },
  {
    id: "6",
    name: "Ho Municipal Center",
    location: "Ho Town Center",
    region: "Volta",
    size: "32x10 ft",
    pricePerDay: 400,
    impressions: 52000,
    rating: 4.3,
  },
];

const benefits = [
  "Premium billboard locations across Ghana",
  "Real-time availability and booking",
  "Detailed analytics and impressions tracking",
  "Flexible booking durations",
  "24/7 customer support",
  "Competitive pricing",
];

const stats = [
  { label: "Active Billboards", value: "450+" },
  { label: "Cities Covered", value: "30+" },
  { label: "Daily Impressions", value: "50M+" },
  { label: "Happy Advertisers", value: "2K+" },
];

export default function BillboardsPage() {
  const [selectedRegion, setSelectedRegion] = useState("All Regions");

  const filteredBillboards = featuredBillboards.filter((b) =>
    selectedRegion === "All Regions" ? true : b.region === selectedRegion
  );

  const formatCurrency = (value: number) => `GHS ${value.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 to-black text-white py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span style={{ color: VELT_ACCENT }}>VELT</span> Billboards
            </h1>
            <p className="text-xl text-white/70 mb-8">
              Book outdoor advertising spaces quickly and reach new audiences across Ghana
            </p>
            <Link
              href="/app/welcome"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition hover:opacity-90"
              style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
            >
              Start Advertising
              <FaArrowRight />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl font-bold" style={{ color: VELT_ACCENT }}>{stat.value}</p>
                <p className="text-gray-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Region Filter */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {REGIONS.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`px-5 py-3 rounded-xl whitespace-nowrap transition ${
                  selectedRegion === region
                    ? "text-black"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={selectedRegion === region ? { backgroundColor: VELT_ACCENT } : {}}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Billboards */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FaBullhorn style={{ color: VELT_ACCENT }} />
              Featured Billboards
            </h2>
            <Link href="/app/welcome" className="text-sm font-medium flex items-center gap-1 hover:opacity-70 transition" style={{ color: VELT_ACCENT }}>
              View All <FaArrowRight size={12} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBillboards.map((billboard, index) => (
              <motion.div
                key={billboard.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition"
              >
                {/* Image Placeholder */}
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                  <FaBullhorn size={32} className="text-gray-300" />
                </div>

                {/* Details */}
                <div className="p-5">
                  <h3 className="font-semibold text-lg mb-1">{billboard.name}</h3>
                  <div className="flex items-center gap-1 text-gray-500 text-sm mb-3">
                    <FaMapMarkerAlt size={12} />
                    <span>{billboard.location}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-500">Size: {billboard.size}</span>
                    <div className="flex items-center gap-1">
                      <FaStar size={12} style={{ color: VELT_ACCENT }} />
                      <span>{billboard.rating}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-bold text-lg" style={{ color: VELT_ACCENT }}>
                        {formatCurrency(billboard.pricePerDay)}
                      </p>
                      <p className="text-xs text-gray-400">per day</p>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 text-sm">
                      <FaEye size={12} />
                      <span>{(billboard.impressions / 1000).toFixed(0)}K/day</span>
                    </div>
                  </div>

                  <Link
                    href="/app/welcome"
                    className="w-full py-3 rounded-lg font-medium text-center block transition hover:opacity-80"
                    style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                  >
                    Book Now
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-6">
                Why Advertise with VELT?
              </h2>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: VELT_ACCENT }}
                    >
                      <FaCheck size={12} color="#000" />
                    </div>
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="aspect-video bg-gradient-to-br from-gray-200 to-gray-100 rounded-2xl flex items-center justify-center"
            >
              <FaBullhorn size={64} className="text-gray-300" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-gray-900 to-black text-white">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-4">
              Ready to Reach Millions?
            </h2>
            <p className="text-xl text-white/70 mb-8">
              Start your billboard campaign today and watch your brand grow
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/app/signup"
                className="px-8 py-4 rounded-xl font-semibold text-lg transition hover:opacity-90"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                Get Started
              </Link>
              <Link
                href="/support"
                className="px-8 py-4 rounded-xl font-semibold text-lg border border-white/20 hover:bg-white/10 transition"
              >
                Contact Sales
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
