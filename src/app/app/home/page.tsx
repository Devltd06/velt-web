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
  FaBell,
  FaSignOutAlt,
  FaPlus,
  FaHeart,
  FaComment,
  FaShare,
  FaPlay,
  FaBookmark,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

// Sidebar Navigation Items
const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home", active: true },
  { icon: FaCompass, label: "Explore", href: "/app/explore" },
  { icon: FaShoppingCart, label: "Marketplace", href: "/app/marketplace" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaUser, label: "Profile", href: "/app/profile" },
];

// Mock data for demonstration
const mockStories = [
  { id: 1, user: "John D.", avatar: "JD", hasUnread: true },
  { id: 2, user: "Sarah M.", avatar: "SM", hasUnread: true },
  { id: 3, user: "Tech Hub", avatar: "TH", hasUnread: false },
  { id: 4, user: "Food Co.", avatar: "FC", hasUnread: true },
  { id: 5, user: "Style", avatar: "ST", hasUnread: false },
];

const mockPosts = [
  {
    id: 1,
    user: "Creative Studio",
    avatar: "CS",
    time: "2h ago",
    content: "Just launched our new billboard campaign in Accra! Check it out 🎉",
    likes: 234,
    comments: 45,
    image: true,
  },
  {
    id: 2,
    user: "Local Market",
    avatar: "LM",
    time: "4h ago",
    content: "Fresh products available now. Order before they run out!",
    likes: 156,
    comments: 23,
    image: true,
  },
  {
    id: 3,
    user: "Tech News GH",
    avatar: "TN",
    time: "6h ago",
    content: "The future of digital advertising is here. VELT is changing the game!",
    likes: 892,
    comments: 127,
    image: false,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/app/welcome");
  };

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
          {/* Logo */}
          <Link href="/app/home" className="text-2xl font-bold mb-10" style={{ color: VELT_ACCENT }}>
            VELT
          </Link>

          {/* Navigation */}
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

          {/* Create Button */}
          <button
            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mb-6 transition hover:opacity-90"
            style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
          >
            <FaPlus size={16} />
            Create
          </button>

          {/* User Actions */}
          <div className="border-t border-white/10 pt-4 space-y-2">
            <button className="flex items-center gap-4 px-4 py-3 w-full text-left text-white/60 hover:text-white transition rounded-xl hover:bg-white/5">
              <FaBell size={20} />
              <span>Notifications</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-3 w-full text-left text-red-400 hover:text-red-300 transition rounded-xl hover:bg-red-500/10"
            >
              <FaSignOutAlt size={20} />
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 min-h-screen">
          {/* Stories Section */}
          <section className="border-b border-white/10 p-6">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {/* Add Story */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed border-white/30 cursor-pointer hover:border-white/50 transition"
                >
                  <FaPlus size={20} className="text-white/60" />
                </div>
                <span className="text-xs text-white/60">Add Story</span>
              </div>

              {/* User Stories */}
              {mockStories.map((story) => (
                <div key={story.id} className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold ${
                      story.hasUnread ? "ring-2 ring-offset-2 ring-offset-black" : ""
                    }`}
                    style={{
                      background: story.hasUnread
                        ? `linear-gradient(135deg, ${VELT_ACCENT}, #00E5A0)`
                        : "rgba(255,255,255,0.1)",
                      
                    }}
                  >
                    {story.avatar}
                  </div>
                  <span className="text-xs text-white/60 truncate w-16 text-center">{story.user}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Feed */}
          <section className="max-w-2xl mx-auto p-6 space-y-6">
            {mockPosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
              >
                {/* Post Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                    >
                      {post.avatar}
                    </div>
                    <div>
                      <h4 className="font-semibold">{post.user}</h4>
                      <p className="text-xs text-white/40">{post.time}</p>
                    </div>
                  </div>
                  <button className="text-white/40 hover:text-white transition">•••</button>
                </div>

                {/* Post Image */}
                {post.image && (
                  <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <FaPlay size={48} className="text-white/20" />
                  </div>
                )}

                {/* Post Content */}
                <div className="p-4">
                  <p className="text-white/80 mb-4">{post.content}</p>

                  {/* Actions */}
                  <div className="flex items-center justify-between text-white/60">
                    <div className="flex items-center gap-6">
                      <button className="flex items-center gap-2 hover:text-red-400 transition">
                        <FaHeart size={18} />
                        <span className="text-sm">{post.likes}</span>
                      </button>
                      <button className="flex items-center gap-2 hover:text-blue-400 transition">
                        <FaComment size={18} />
                        <span className="text-sm">{post.comments}</span>
                      </button>
                      <button className="hover:text-green-400 transition">
                        <FaShare size={18} />
                      </button>
                    </div>
                    <button className="hover:text-yellow-400 transition">
                      <FaBookmark size={18} />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </section>
        </main>

        {/* Right Sidebar - Suggestions */}
        <aside className="fixed right-0 top-0 h-screen w-80 bg-black border-l border-white/10 p-6 hidden xl:block">
          <h3 className="font-semibold text-white/80 mb-4">Suggested for You</h3>
          <div className="space-y-4">
            {[
              { name: "Fashion Hub", type: "Business", followers: "12.5K" },
              { name: "Tech Ghana", type: "Creator", followers: "8.2K" },
              { name: "Food Paradise", type: "Business", followers: "5.7K" },
            ].map((suggestion, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    {suggestion.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{suggestion.name}</h4>
                    <p className="text-xs text-white/40">{suggestion.type} • {suggestion.followers} followers</p>
                  </div>
                </div>
                <button
                  className="text-xs font-semibold px-3 py-1 rounded-lg transition hover:opacity-80"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Follow
                </button>
              </div>
            ))}
          </div>

          {/* Trending */}
          <h3 className="font-semibold text-white/80 mb-4 mt-8">Trending</h3>
          <div className="space-y-3">
            {["#VELTcreators", "#GhanaBusiness", "#Billboards2024", "#LocalMarket"].map((tag) => (
              <button key={tag} className="block text-white/60 hover:text-white transition text-sm">
                {tag}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
