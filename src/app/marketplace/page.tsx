"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaSearch,
  FaShoppingBag,
  FaStar,
  FaMapMarkerAlt,
  FaHeart,
  FaArrowRight,
} from "react-icons/fa";

const VELT_ACCENT = "#D4AF37";

const categories = [
  { id: "all", label: "All Products", icon: "🛍️" },
  { id: "electronics", label: "Electronics", icon: "📱" },
  { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "food", label: "Food", icon: "🍎" },
  { id: "home", label: "Home", icon: "🏠" },
  { id: "beauty", label: "Beauty", icon: "💄" },
];

const featuredProducts = [
  {
    id: 1,
    name: "Wireless Bluetooth Earbuds",
    price: 150,
    originalPrice: 200,
    seller: "Tech Store GH",
    rating: 4.8,
    reviews: 234,
    location: "Accra",
  },
  {
    id: 2,
    name: "African Print Dress",
    price: 280,
    seller: "Style Ghana",
    rating: 4.9,
    reviews: 156,
    location: "Kumasi",
  },
  {
    id: 3,
    name: "Organic Shea Butter",
    price: 45,
    seller: "Natural Beauty",
    rating: 4.7,
    reviews: 89,
    location: "Tamale",
  },
  {
    id: 4,
    name: "Kente Cloth (6 yards)",
    price: 450,
    seller: "Kente Masters",
    rating: 5.0,
    reviews: 78,
    location: "Bonwire",
  },
  {
    id: 5,
    name: "Handwoven Basket Set",
    price: 120,
    seller: "Craft Village",
    rating: 4.6,
    reviews: 67,
    location: "Bolgatanga",
  },
  {
    id: 6,
    name: "Solar Power Bank",
    price: 180,
    originalPrice: 220,
    seller: "Green Energy GH",
    rating: 4.6,
    reviews: 123,
    location: "Tema",
  },
];

const stats = [
  { label: "Products Listed", value: "50K+" },
  { label: "Active Sellers", value: "5K+" },
  { label: "Happy Buyers", value: "100K+" },
  { label: "Cities Covered", value: "50+" },
];

export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = useState("all");

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
              <span style={{ color: VELT_ACCENT }}>VELT</span> Marketplace
            </h1>
            <p className="text-xl text-white/70 mb-8">
              Buy and sell local goods with confidence. Support small businesses in your community.
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search products, sellers..."
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition"
              />
            </div>
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

      {/* Categories */}
      <section className="py-8">
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

      {/* Featured Products */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FaShoppingBag style={{ color: VELT_ACCENT }} />
              Featured Products
            </h2>
            <Link href="/app/welcome" className="text-sm font-medium flex items-center gap-1 hover:opacity-70 transition" style={{ color: VELT_ACCENT }}>
              View All <FaArrowRight size={12} />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition group"
              >
                {/* Image */}
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FaShoppingBag size={32} className="text-gray-300" />
                  </div>
                  {product.originalPrice && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
                    </div>
                  )}
                  <button className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 transition shadow">
                    <FaHeart size={14} />
                  </button>
                </div>

                {/* Details */}
                <div className="p-4">
                  <h3 className="font-medium mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">{product.seller}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      <FaStar size={12} style={{ color: VELT_ACCENT }} />
                      <span className="text-sm">{product.rating}</span>
                    </div>
                    <span className="text-gray-400 text-sm">({product.reviews})</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                      <FaMapMarkerAlt size={10} />
                      {product.location}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold" style={{ color: VELT_ACCENT }}>
                        {formatCurrency(product.price)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-gray-400 text-sm line-through ml-2">
                          {formatCurrency(product.originalPrice)}
                        </span>
                      )}
                    </div>
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
              Start Selling Today
            </h2>
            <p className="text-xl text-white/70 mb-8">
              Join thousands of sellers reaching customers across Ghana
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/app/signup"
                className="px-8 py-4 rounded-xl font-semibold text-lg transition hover:opacity-90"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                Start Selling
              </Link>
              <Link
                href="/app/welcome"
                className="px-8 py-4 rounded-xl font-semibold text-lg border border-white/20 hover:bg-white/10 transition"
              >
                Browse Products
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
