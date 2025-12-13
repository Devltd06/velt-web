"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaSearch,
  FaUsers,
  FaFire,
  FaPlay,
  FaHeart,
  FaCrown,
  FaArrowRight,
} from "react-icons/fa";

const VELT_ACCENT = "#D4AF37";

const categories = [
  { id: "all", label: "All", icon: "🌟" },
  { id: "creators", label: "Creators", icon: "🎨" },
  { id: "music", label: "Music", icon: "🎵" },
  { id: "food", label: "Food", icon: "🍔" },
  { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "tech", label: "Tech", icon: "💻" },
];

const featuredCreators = [
  { id: 1, name: "Creative Studio", handle: "@creativestudio", followers: "125K", verified: true },
  { id: 2, name: "Music Vibes GH", handle: "@musicvibesgh", followers: "89K", verified: true },
  { id: 3, name: "Food Paradise", handle: "@foodparadise", followers: "67K", verified: false },
  { id: 4, name: "Style Ghana", handle: "@styleghana", followers: "234K", verified: true },
];

const trendingContent = [
  { id: 1, title: "New Billboard Campaign Launch", views: "45K", likes: "2.3K" },
  { id: 2, title: "Fashion Week Highlights", views: "78K", likes: "5.1K" },
  { id: 3, title: "Local Food Festival", views: "32K", likes: "1.8K" },
  { id: 4, title: "Tech Startup Showcase", views: "56K", likes: "3.2K" },
];

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState("all");

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
              Explore <span style={{ color: VELT_ACCENT }}>VELT</span>
            </h1>
            <p className="text-xl text-white/70 mb-8">
              Discover creators, trending content, and connect with your community
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search creators, content, hashtags..."
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl whitespace-nowrap transition ${
                  activeCategory === category.id
                    ? "text-black"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={activeCategory === category.id ? { backgroundColor: VELT_ACCENT } : {}}
              >
                <span>{category.icon}</span>
                <span className="font-medium">{category.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Creators */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FaUsers style={{ color: VELT_ACCENT }} />
              Featured Creators
            </h2>
            <Link href="/app/welcome" className="text-sm font-medium flex items-center gap-1 hover:opacity-70 transition" style={{ color: VELT_ACCENT }}>
              View All <FaArrowRight size={12} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCreators.map((creator, index) => (
              <motion.div
                key={creator.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                  >
                    {creator.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{creator.name}</h4>
                      {creator.verified && <FaCrown size={14} style={{ color: VELT_ACCENT }} />}
                    </div>
                    <p className="text-sm text-gray-500">{creator.handle}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">{creator.followers} followers</p>
                <Link
                  href="/app/welcome"
                  className="w-full py-2 rounded-lg text-sm font-medium text-center block transition hover:opacity-80"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Follow
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Content */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FaFire style={{ color: "#FF6B6B" }} />
              Trending Now
            </h2>
            <Link href="/app/welcome" className="text-sm font-medium flex items-center gap-1 hover:opacity-70 transition" style={{ color: VELT_ACCENT }}>
              View All <FaArrowRight size={12} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingContent.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition"
              >
                <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-100 flex items-center justify-center">
                  <FaPlay className="text-gray-400" size={24} />
                </div>
                <div className="p-4">
                  <h4 className="font-medium mb-2 line-clamp-2">{item.title}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{item.views} views</span>
                    <span className="flex items-center gap-1">
                      <FaHeart size={12} /> {item.likes}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
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
              Ready to Join the Community?
            </h2>
            <p className="text-xl text-white/70 mb-8">
              Create your account and start exploring the best creators in Ghana
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/app/signup"
                className="px-8 py-4 rounded-xl font-semibold text-lg transition hover:opacity-90"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                Create Account
              </Link>
              <Link
                href="/app/login"
                className="px-8 py-4 rounded-xl font-semibold text-lg border border-white/20 hover:bg-white/10 transition"
              >
                Log In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
