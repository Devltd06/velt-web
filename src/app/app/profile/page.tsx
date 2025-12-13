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
  FaCog,
  FaEdit,
  FaCamera,
  FaHeart,
  FaBookmark,
  FaShoppingBag,
  FaSignOutAlt,
  FaCrown,
  FaCheckCircle,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaCompass, label: "Explore", href: "/app/explore" },
  { icon: FaShoppingCart, label: "Marketplace", href: "/app/marketplace" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaUser, label: "Profile", href: "/app/profile", active: true },
];

const tabs = [
  { id: "posts", label: "Posts", icon: "📝" },
  { id: "products", label: "Products", icon: "🛍️" },
  { id: "billboards", label: "Billboards", icon: "📺" },
  { id: "saved", label: "Saved", icon: "🔖" },
];

// Mock user data
const mockUser = {
  name: "John Doe",
  username: "@johndoe",
  bio: "Creator | Entrepreneur | VELT Ambassador 🚀",
  location: "Accra, Ghana",
  website: "johndoe.com",
  followers: 12500,
  following: 890,
  posts: 156,
  verified: true,
  joinedDate: "January 2024",
  subscription: {
    plan: "Premium",
    status: "Active",
    expiresAt: "2025-12-31",
  },
};

const mockPosts = [
  { id: 1, likes: 234, comments: 45 },
  { id: 2, likes: 567, comments: 89 },
  { id: 3, likes: 123, comments: 23 },
  { id: 4, likes: 890, comments: 156 },
  { id: 5, likes: 345, comments: 67 },
  { id: 6, likes: 678, comments: 98 },
];

const mockProducts = [
  { id: 1, name: "Tech Gadget", price: 150, sold: 45 },
  { id: 2, name: "Fashion Item", price: 280, sold: 23 },
  { id: 3, name: "Home Decor", price: 120, sold: 67 },
];

export default function ProfilePage() {
  const router = useRouter();
  const [, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [showSettings, setShowSettings] = useState(false);

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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
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
          <div className="border-t border-white/10 pt-4">
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
          {/* Cover Photo */}
          <div className="h-48 bg-gradient-to-r from-yellow-900 to-amber-600 relative">
            <button className="absolute bottom-4 right-4 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition">
              <FaCamera size={16} />
            </button>
          </div>

          {/* Profile Header */}
          <div className="px-8 pb-8">
            <div className="relative -mt-16 mb-6 flex items-end justify-between">
              <div className="flex items-end gap-6">
                {/* Avatar */}
                <div className="relative">
                  <div
                    className="w-32 h-32 rounded-full border-4 border-black flex items-center justify-center text-4xl font-bold"
                    style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                  >
                    {mockUser.name.charAt(0)}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition">
                    <FaCamera size={12} />
                  </button>
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{mockUser.name}</h1>
                    {mockUser.verified && (
                      <FaCrown size={18} style={{ color: VELT_ACCENT }} />
                    )}
                  </div>
                  <p className="text-white/60">{mockUser.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition flex items-center gap-2"
                >
                  <FaCog size={16} />
                  Settings
                </button>
                <button
                  className="px-4 py-2 rounded-xl font-medium transition hover:opacity-90 flex items-center gap-2"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  <FaEdit size={16} />
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Bio */}
            <div className="max-w-2xl mb-6">
              <p className="text-white/80 mb-2">{mockUser.bio}</p>
              <div className="flex items-center gap-4 text-sm text-white/60">
                <span>📍 {mockUser.location}</span>
                <span>🔗 {mockUser.website}</span>
                <span>📅 Joined {mockUser.joinedDate}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 mb-8">
              <div className="text-center">
                <p className="text-2xl font-bold">{formatNumber(mockUser.posts)}</p>
                <p className="text-sm text-white/60">Posts</p>
              </div>
              <div className="text-center cursor-pointer hover:opacity-80 transition">
                <p className="text-2xl font-bold">{formatNumber(mockUser.followers)}</p>
                <p className="text-sm text-white/60">Followers</p>
              </div>
              <div className="text-center cursor-pointer hover:opacity-80 transition">
                <p className="text-2xl font-bold">{formatNumber(mockUser.following)}</p>
                <p className="text-sm text-white/60">Following</p>
              </div>
            </div>

            {/* Subscription Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-yellow-900/50 to-amber-800/50 border border-yellow-500/30 rounded-2xl p-4 mb-8 max-w-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaCrown size={24} style={{ color: VELT_ACCENT }} />
                  <div>
                    <p className="font-semibold">{mockUser.subscription.plan} Plan</p>
                    <p className="text-sm text-white/60">
                      Expires: {new Date(mockUser.subscription.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-green-400">
                  <FaCheckCircle size={14} />
                  <span className="text-sm">{mockUser.subscription.status}</span>
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 font-medium transition border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? "border-yellow-500 text-white"
                      : "border-transparent text-white/60 hover:text-white"
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "posts" && (
              <div className="grid grid-cols-3 gap-4">
                {mockPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="aspect-square bg-gradient-to-br from-white/10 to-white/5 rounded-xl relative group cursor-pointer overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                      <span className="flex items-center gap-1">
                        <FaHeart /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        💬 {post.comments}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === "products" && (
              <div className="grid grid-cols-3 gap-4">
                {mockProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition"
                  >
                    <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5 rounded-lg mb-3 flex items-center justify-center">
                      <FaShoppingBag size={32} className="text-white/20" />
                    </div>
                    <h4 className="font-medium mb-1">{product.name}</h4>
                    <p className="text-sm" style={{ color: VELT_ACCENT }}>
                      GHS {product.price}
                    </p>
                    <p className="text-xs text-white/40">{product.sold} sold</p>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === "billboards" && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <FaBullhorn size={48} className="text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Billboards Yet</h3>
                <p className="text-white/60 mb-6">
                  Start advertising by booking a billboard
                </p>
                <Link
                  href="/app/billboards"
                  className="inline-block px-6 py-3 rounded-xl font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Browse Billboards
                </Link>
              </div>
            )}

            {activeTab === "saved" && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <FaBookmark size={48} className="text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Saved Items</h3>
                <p className="text-white/60">
                  Items you save will appear here
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-white/60 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Link
                href="/app/settings/account"
                className="block p-4 bg-white/5 rounded-xl hover:bg-white/10 transition"
              >
                Account Settings
              </Link>
              <Link
                href="/app/settings/privacy"
                className="block p-4 bg-white/5 rounded-xl hover:bg-white/10 transition"
              >
                Privacy & Security
              </Link>
              <Link
                href="/app/settings/notifications"
                className="block p-4 bg-white/5 rounded-xl hover:bg-white/10 transition"
              >
                Notifications
              </Link>
              <Link
                href="/renewal-subscription"
                className="block p-4 bg-white/5 rounded-xl hover:bg-white/10 transition"
              >
                Subscription & Billing
              </Link>
              <button
                onClick={handleLogout}
                className="w-full p-4 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition text-left"
              >
                Log Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
