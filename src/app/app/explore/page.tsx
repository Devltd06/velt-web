"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FaHome,
  FaCompass,
  FaShoppingCart,
  FaBullhorn,
  FaUser,
  FaSearch,
  FaHeart,
  FaPlay,
  FaUsers,
  FaFire,
  FaCrown,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaCompass, label: "Explore", href: "/app/explore", active: true },
  { icon: FaShoppingCart, label: "Marketplace", href: "/app/marketplace" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaUser, label: "Profile", href: "/app/profile" },
];

const categories = [
  { id: "all", label: "All", icon: "🌟" },
  { id: "creators", label: "Creators", icon: "🎨" },
  { id: "music", label: "Music", icon: "🎵" },
  { id: "food", label: "Food", icon: "🍔" },
  { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "tech", label: "Tech", icon: "💻" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "travel", label: "Travel", icon: "✈️" },
];

const mockCreators = [
  { id: 1, name: "Creative Studio", handle: "@creativestudio", followers: "125K", verified: true, category: "creators" },
  { id: 2, name: "Music Vibes GH", handle: "@musicvibesgh", followers: "89K", verified: true, category: "music" },
  { id: 3, name: "Food Paradise", handle: "@foodparadise", followers: "67K", verified: false, category: "food" },
  { id: 4, name: "Style Ghana", handle: "@styleghana", followers: "234K", verified: true, category: "fashion" },
  { id: 5, name: "Tech Hub Africa", handle: "@techhub", followers: "156K", verified: true, category: "tech" },
  { id: 6, name: "Sports Daily", handle: "@sportsdaily", followers: "98K", verified: false, category: "sports" },
];

const mockTrending = [
  { id: 1, title: "New Billboard Campaign Launch", views: "45K", likes: "2.3K" },
  { id: 2, title: "Fashion Week Highlights", views: "78K", likes: "5.1K" },
  { id: 3, title: "Local Food Festival", views: "32K", likes: "1.8K" },
  { id: 4, title: "Tech Startup Showcase", views: "56K", likes: "3.2K" },
];

const mockHighlights = [
  { id: 1, user: "Creative Studio", type: "video", duration: "0:45" },
  { id: 2, user: "Music Vibes", type: "video", duration: "1:20" },
  { id: 3, user: "Food Paradise", type: "image" },
  { id: 4, user: "Style Ghana", type: "video", duration: "0:30" },
  { id: 5, user: "Tech Hub", type: "image" },
  { id: 6, user: "Sports Daily", type: "video", duration: "2:15" },
];

export default function ExplorePage() {
  const router = useRouter();
  const [, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }
      setUser(session.user as unknown as Record<string, unknown>);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const filteredCreators = mockCreators.filter((creator) =>
    activeCategory === "all" ? true : creator.category === activeCategory
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 h-screen w-64 bg-black border-r border-white/10 p-6 flex flex-col">
          <Link href="/app/home" className="text-2xl font-bold mb-10" style={{ color: VELT_ACCENT }}>
            VELT
          </Link>
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition ${
                    item.active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 min-h-screen p-8">
          {/* Search Bar */}
          <div className="max-w-2xl mb-8">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search creators, content, hashtags..."
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition ${
                  activeCategory === category.id
                    ? "text-black"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
                style={activeCategory === category.id ? { backgroundColor: VELT_ACCENT } : {}}
              >
                <span>{category.icon}</span>
                <span className="font-medium">{category.label}</span>
              </button>
            ))}
          </div>

          {/* Highlights Grid */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaFire style={{ color: VELT_ACCENT }} />
                Highlights
              </h2>
              <button className="text-sm text-white/60 hover:text-white transition">See All</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {mockHighlights.map((highlight, index) => (
                <motion.div
                  key={highlight.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="aspect-[9/16] bg-gradient-to-br from-white/10 to-white/5 rounded-2xl relative overflow-hidden cursor-pointer group"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    {highlight.type === "video" ? (
                      <FaPlay className="text-white/30 group-hover:text-white/50 transition" size={24} />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10" />
                    )}
                  </div>
                  {highlight.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-xs">
                      {highlight.duration}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80">
                    <p className="text-xs font-medium truncate">{highlight.user}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Trending Section */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaFire style={{ color: "#FF6B6B" }} />
                Trending Now
              </h2>
              <button className="text-sm text-white/60 hover:text-white transition">See All</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockTrending.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition cursor-pointer"
                >
                  <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <FaPlay className="text-white/20" size={24} />
                  </div>
                  <div className="p-4">
                    <h4 className="font-medium mb-2 line-clamp-2">{item.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-white/60">
                      <span>{item.views} views</span>
                      <span className="flex items-center gap-1">
                        <FaHeart size={12} /> {item.likes}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Creators Grid */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaUsers style={{ color: VELT_ACCENT }} />
                Popular Creators
              </h2>
              <button className="text-sm text-white/60 hover:text-white transition">See All</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCreators.map((creator, index) => (
                <motion.div
                  key={creator.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                      style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                    >
                      {creator.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{creator.name}</h4>
                        {creator.verified && (
                          <FaCrown size={14} style={{ color: VELT_ACCENT }} />
                        )}
                      </div>
                      <p className="text-sm text-white/60">{creator.handle}</p>
                      <p className="text-sm text-white/40">{creator.followers} followers</p>
                    </div>
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-80"
                      style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                    >
                      Follow
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
