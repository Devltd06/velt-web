"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHome,
  FaShoppingBag,
  FaPlayCircle,
  FaBullhorn,
  FaComments,
  FaUser,
  FaCog,
  FaEdit,
  FaHeart,
  FaSignOutAlt,
  FaCrown,
  FaCheckCircle,
  FaShareAlt,
  FaChartLine,
  FaGlobe,
  FaLink,
  FaBriefcase,
  FaBirthdayCake,
  FaStore,
  FaPlay,
  FaEye,
} from "react-icons/fa";
import { IoRefresh, IoGridOutline, IoBagHandle, IoImage } from "react-icons/io5";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaShoppingBag, label: "Shopr", href: "/app/shopr" },
  { icon: FaPlayCircle, label: "Contents", href: "/app/contents" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaComments, label: "Chats", href: "/app/chats" },
];

// Profile tabs to match mobile: Posts, Metrics, Revives, Products
const tabs = [
  { id: "posts", label: "Posts", icon: IoGridOutline },
  { id: "metrics", label: "Metrics", icon: FaChartLine },
  { id: "revives", label: "Revives", icon: IoRefresh },
  { id: "products", label: "Products", icon: IoBagHandle },
];

// Interfaces
interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_photo_url: string | null;
  bio: string | null;
  role: string | null;
  location: string | null;
  website: string | null;
  profession: string | null;
  date_of_birth: string | null;
  business_name: string | null;
  subscription_end: string | null;
  created_at: string;
}

interface Story {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  is_hd?: boolean;
  created_at: string;
}

interface Product {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  images: string[] | null;
  sold_count: number | null;
  created_at: string;
}

interface Revive {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: string | null;
  revived_at: string;
  created_at: string;
}

// Helper functions
function isVideoUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(uri);
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [showSettings, setShowSettings] = useState(false);

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [commercials, setCommercials] = useState<Story[]>([]);
  const [revives, setRevives] = useState<Revive[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [totalLikesCount, setTotalLikesCount] = useState(0);
  const [storyLikesMap, setStoryLikesMap] = useState<Record<string, number>>({});
  const [storyCommentsMap, setStoryCommentsMap] = useState<Record<string, number>>({});

  // Loading states
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingRevives, setLoadingRevives] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Metrics state
  const [metricsPeriod, setMetricsPeriod] = useState<"day" | "week" | "month" | "year">("day");

  // Fetch profile data
  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (!error && data) {
      setProfile(data);
    }
  }, []);

  // Fetch user's stories
  const fetchStories = useCallback(async (uid: string) => {
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from("stories")
      .select("id, user_id, media_url, media_type, caption, is_hd, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setStories(data);
      // Fetch stats for stories
      if (data.length > 0) {
        fetchStoryStats(data.map((s) => s.id));
      }
    }
    setLoadingPosts(false);
  }, []);

  // Fetch commercials (business_stories)
  const fetchCommercials = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("business_stories")
      .select("id, user_id, media_url, media_type, caption, is_hd, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCommercials(data);
    }
  }, []);

  // Fetch story stats (likes and comments)
  const fetchStoryStats = useCallback(async (storyIds: string[]) => {
    const likesMap: Record<string, number> = {};
    const commentsMap: Record<string, number> = {};
    let totalLikes = 0;

    for (const id of storyIds) {
      const { count: likesCount } = await supabase
        .from("story_likes")
        .select("*", { count: "exact", head: true })
        .eq("story_id", id);
      
      const { count: commentsCount } = await supabase
        .from("story_comments")
        .select("*", { count: "exact", head: true })
        .eq("story_id", id);

      likesMap[id] = likesCount || 0;
      commentsMap[id] = commentsCount || 0;
      totalLikes += likesCount || 0;
    }

    setStoryLikesMap(likesMap);
    setStoryCommentsMap(commentsMap);
    setTotalLikesCount(totalLikes);
  }, []);

  // Fetch user's revives
  const fetchRevives = useCallback(async (uid: string) => {
    setLoadingRevives(true);
    try {
      const { data, error } = await supabase
        .from("stories")
        .select("id, user_id, media_url, media_type, created_at, revived_at")
        .eq("user_id", uid)
        .not("revived_at", "is", null)
        .order("revived_at", { ascending: false });

      if (!error && data) {
        setRevives(data as Revive[]);
      }
    } catch {
      setRevives([]);
    }
    setLoadingRevives(false);
  }, []);

  // Fetch user's products
  const fetchProducts = useCallback(async (uid: string) => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data);
    }
    setLoadingProducts(false);
  }, []);

  // Fetch follow counts
  const fetchFollowCounts = useCallback(async (uid: string) => {
    const { count: followers } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", uid);

    const { count: following } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", uid);

    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/loginlister");
        return;
      }
      const uid = session.user.id;

      await fetchProfile(uid);
      fetchStories(uid);
      fetchCommercials(uid);
      fetchRevives(uid);
      fetchProducts(uid);
      fetchFollowCounts(uid);

      setLoading(false);
    };
    checkAuth();
  }, [router, fetchProfile, fetchStories, fetchCommercials, fetchRevives, fetchProducts, fetchFollowCounts]);

  // Calculate metrics based on period
  const computeMetrics = useCallback(() => {
    const now = new Date();
    let start: Date;
    
    switch (metricsPeriod) {
      case "day":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        const day = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
    }

    let likes = 0;
    let comments = 0;
    const all = [...stories, ...commercials];
    
    all.forEach((s) => {
      if (!s.created_at) return;
      const dt = new Date(s.created_at);
      if (dt >= start && dt <= now) {
        likes += storyLikesMap[s.id] ?? 0;
        comments += storyCommentsMap[s.id] ?? 0;
      }
    });

    return { likes, comments, start, end: now };
  }, [metricsPeriod, stories, commercials, storyLikesMap, storyCommentsMap]);

  const metrics = computeMetrics();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/loginlister");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.full_name || profile?.username} - VELT Profile`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert("Profile link copied!");
    }
  };

  const isSubscribed = profile?.subscription_end
    ? new Date(profile.subscription_end) > new Date()
    : false;

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
                  className="flex items-center gap-4 px-4 py-3 rounded-xl transition text-white/60 hover:bg-white/5 hover:text-white"
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 pt-4 space-y-2">
            <Link
              href="/app/profile"
              className="flex items-center gap-4 px-4 py-3 w-full text-left bg-white/10 text-white rounded-xl"
            >
              <FaUser size={20} />
              <span>Profile</span>
            </Link>
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
          {/* Cover Photo - No camera icon here (only in edit profile) */}
          <div className="h-56 relative overflow-hidden">
            {profile?.cover_photo_url ? (
              <img
                src={profile.cover_photo_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{ background: `linear-gradient(135deg, ${VELT_ACCENT}40, #1a1a1a)` }}
              />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
            {/* Header buttons on cover */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition"
                title="Share Profile"
              >
                <FaShareAlt size={16} />
              </button>
              <Link
                href="/app/edit-profile"
                className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition"
                title="Edit Profile"
              >
                <FaEdit size={16} />
              </Link>
              <button
                onClick={() => setShowSettings(true)}
                className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition"
                title="Settings"
              >
                <FaCog size={16} />
              </button>
            </div>
          </div>

          {/* Profile Card - Glassmorphism style */}
          <div className="px-6 -mt-12 relative z-10">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div 
                  className="w-24 h-24 rounded-full border-4 overflow-hidden flex-shrink-0"
                  style={{ borderColor: VELT_ACCENT }}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || "User"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-3xl font-bold"
                      style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                    >
                      {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || "U"}
                    </div>
                  )}
                </div>

                {/* Profile Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold truncate">
                      {profile?.full_name || profile?.username || "User"}
                    </h1>
                    <FaCheckCircle size={18} style={{ color: VELT_ACCENT }} />
                    {isSubscribed && <FaCrown size={16} style={{ color: VELT_ACCENT }} />}
                  </div>
                  
                  <p className="text-white/60 mb-2">@{profile?.username || "username"}</p>
                  
                  {profile?.bio && (
                    <p className="text-white/80 text-sm mb-3 line-clamp-3">{profile.bio}</p>
                  )}

                  {/* Info pills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {profile?.profession && (
                      <span className="px-3 py-1 bg-white/10 rounded-full text-xs flex items-center gap-1">
                        <FaBriefcase size={10} />
                        {profile.profession}
                      </span>
                    )}
                    {profile?.date_of_birth && (
                      <span className="px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{ backgroundColor: VELT_ACCENT, color: "#000" }}>
                        <FaBirthdayCake size={10} />
                        {formatDate(profile.date_of_birth)}
                      </span>
                    )}
                    {profile?.business_name && (
                      <span className="px-3 py-1 bg-white/10 rounded-full text-xs flex items-center gap-1">
                        <FaStore size={10} />
                        {profile.business_name}
                      </span>
                    )}
                    {profile?.website && (
                      <a 
                        href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-white/10 rounded-full text-xs flex items-center gap-1 hover:bg-white/20 transition"
                      >
                        <FaLink size={10} />
                        Website
                      </a>
                    )}
                  </div>

                  {/* Stats: Followers, Following, Likes */}
                  <div className="flex gap-4">
                    <Link 
                      href="/app/connections?section=followers"
                      className="text-center hover:opacity-80 transition"
                    >
                      <p className="text-xl font-bold" style={{ color: VELT_ACCENT }}>{formatNumber(followersCount)}</p>
                      <p className="text-xs text-white/60">Followers</p>
                    </Link>
                    <Link 
                      href="/app/connections?section=following"
                      className="text-center hover:opacity-80 transition"
                    >
                      <p className="text-xl font-bold">{formatNumber(followingCount)}</p>
                      <p className="text-xs text-white/60">Following</p>
                    </Link>
                    <div className="text-center">
                      <p className="text-xl font-bold text-pink-400">{formatNumber(totalLikesCount)}</p>
                      <p className="text-xs text-white/60">Likes</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* World button */}
              <Link
                href="/app/world"
                className="mt-4 flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-2">
                  <FaGlobe size={16} />
                  <span className="font-medium">World</span>
                </div>
                <span className="text-sm text-white/60">Control center →</span>
              </Link>
            </div>
          </div>

          {/* Subscription Badge */}
          <div className="px-6 mt-4">
            {isSubscribed && profile?.subscription_end ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-yellow-900/50 to-amber-800/50 border border-yellow-500/30 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaCrown size={24} style={{ color: VELT_ACCENT }} />
                    <div>
                      <p className="font-semibold">Premium Plan</p>
                      <p className="text-sm text-white/60">
                        Expires: {new Date(profile.subscription_end).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/website_payment"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition"
                    >
                      Extend
                    </Link>
                    <div className="flex items-center gap-1 text-green-400">
                      <FaCheckCircle size={14} />
                      <span className="text-sm">Active</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaCrown size={24} className="text-white/40" />
                    <div>
                      <p className="font-semibold">Free Plan</p>
                      <p className="text-sm text-white/60">Upgrade to unlock premium features</p>
                    </div>
                  </div>
                  <Link
                    href="/website_payment"
                    className="px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                  >
                    Get Signature
                  </Link>
                </div>
              </motion.div>
            )}
          </div>

          {/* Tabs */}
          <div className="px-6 mt-6">
            <div className="flex border-b border-white/10">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? "text-white"
                        : "border-transparent text-white/60 hover:text-white"
                    }`}
                    style={{ borderColor: activeTab === tab.id ? VELT_ACCENT : "transparent" }}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-6">
            {/* Posts Tab */}
            {activeTab === "posts" && (
              <div className="space-y-8">
                {/* Stories Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <IoImage size={20} style={{ color: VELT_ACCENT }} />
                      Stories
                    </h3>
                    <span className="text-sm text-white/50">{stories.length} stories</span>
                  </div>
                  {loadingPosts ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : stories.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                      <IoGridOutline size={40} className="text-white/20 mx-auto mb-3" />
                      <p className="text-white/60 mb-2">No stories yet</p>
                      <Link
                        href="/app/create-story"
                        className="inline-block px-4 py-2 rounded-xl text-sm font-medium"
                        style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                      >
                        Create Story
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {stories.slice(0, 15).map((story, index) => {
                        const isVideo = isVideoUri(story.media_url);
                        const likes = storyLikesMap[story.id] ?? 0;
                        return (
                          <Link
                            key={story.id}
                            href={`/app/stories?storyId=${story.id}`}
                          >
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.03 }}
                              className="aspect-[9/16] rounded-xl overflow-hidden relative group cursor-pointer"
                              style={{ boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}
                            >
                              {story.media_url ? (
                                isVideo ? (
                                  <video
                                    src={story.media_url}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    muted
                                    playsInline
                                  />
                                ) : (
                                  <img
                                    src={story.media_url}
                                    alt="Story"
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                )
                              ) : (
                                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                  <IoGridOutline size={24} className="text-white/40" />
                                </div>
                              )}
                              
                              {/* Video indicator */}
                              {isVideo && (
                                <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full">
                                  <FaPlay size={8} />
                                </div>
                              )}
                              
                              {/* HD badge */}
                              {story.is_hd && (
                                <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-xs font-bold">
                                  HD
                                </div>
                              )}
                              
                              {/* Gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                              
                              {/* Stats overlay */}
                              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-xs">
                                <span className="flex items-center gap-1">
                                  <FaHeart size={10} style={{ color: VELT_ACCENT }} />
                                  {likes}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FaEye size={10} />
                                  {0}
                                </span>
                              </div>
                            </motion.div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {stories.length > 15 && (
                    <div className="mt-4 text-center">
                      <Link
                        href={`/app/stories?userId=${profile?.id}`}
                        className="text-sm hover:underline"
                        style={{ color: VELT_ACCENT }}
                      >
                        View all {stories.length} stories →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Commercials Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FaBullhorn size={18} style={{ color: VELT_ACCENT }} />
                      Commercials
                    </h3>
                    <span className="text-sm text-white/50">{commercials.length} commercials</span>
                  </div>
                  {commercials.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                      <FaBullhorn size={40} className="text-white/20 mx-auto mb-3" />
                      <p className="text-white/60">No commercials yet</p>
                      <p className="text-white/40 text-sm mt-1">Create business content to promote your brand</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {commercials.slice(0, 12).map((commercial, index) => {
                        const isVideo = isVideoUri(commercial.media_url);
                        return (
                          <Link
                            key={commercial.id}
                            href={`/app/commercial/${commercial.id}`}
                          >
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.03 }}
                              className="aspect-video rounded-xl overflow-hidden relative group cursor-pointer"
                              style={{ boxShadow: "0 4px 15px rgba(0,0,0,0.3)" }}
                            >
                              {commercial.media_url ? (
                                isVideo ? (
                                  <video
                                    src={commercial.media_url}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    muted
                                    playsInline
                                  />
                                ) : (
                                  <img
                                    src={commercial.media_url}
                                    alt="Commercial"
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                )
                              ) : (
                                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                  <FaBullhorn size={24} className="text-white/40" />
                                </div>
                              )}
                              
                              {/* Play button overlay */}
                              {isVideo && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30">
                                  <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: VELT_ACCENT }}
                                  >
                                    <FaPlay size={14} className="text-black ml-0.5" />
                                  </div>
                                </div>
                              )}
                              
                              {/* HD badge */}
                              {commercial.is_hd && (
                                <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-xs font-bold">
                                  HD
                                </div>
                              )}
                              
                              {/* Gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              
                              {/* Caption */}
                              {commercial.caption && (
                                <div className="absolute bottom-2 left-2 right-2">
                                  <p className="text-xs text-white truncate">{commercial.caption}</p>
                                </div>
                              )}
                            </motion.div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metrics Tab */}
            {activeTab === "metrics" && (
              <div>
                <h3 className="text-xl font-bold mb-4">Metrics</h3>
                
                {/* Period selector */}
                <div className="flex gap-2 mb-6">
                  {(["day", "week", "month", "year"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setMetricsPeriod(p)}
                      className={`px-4 py-2 rounded-xl font-semibold transition ${
                        metricsPeriod === p ? "text-black" : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                      style={{ backgroundColor: metricsPeriod === p ? VELT_ACCENT : undefined }}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Metrics card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <p className="text-sm text-white/60 mb-4">
                    Period: {metrics.start.toLocaleDateString()} - {metrics.end.toLocaleDateString()}
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-3xl font-bold text-green-400">{metrics.likes}</p>
                      <p className="text-white/60">Likes</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-blue-400">{metrics.comments}</p>
                      <p className="text-white/60">Comments</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Revives Tab */}
            {activeTab === "revives" && (
              <div>
                {loadingRevives ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                ) : revives.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                    <IoRefresh size={48} className="text-white/20 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Revives Yet</h3>
                    <p className="text-white/60">Posts you revive will appear here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {revives.map((revive, index) => {
                      const isVideo = isVideoUri(revive.media_url);
                      const likes = storyLikesMap[revive.id] ?? 0;
                      const comments = storyCommentsMap[revive.id] ?? 0;
                      
                      return (
                        <motion.div
                          key={revive.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition cursor-pointer"
                        >
                          <div className="aspect-square relative">
                            {revive.media_url ? (
                              <img
                                src={revive.media_url}
                                alt="Revive"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                <IoRefresh size={24} className="text-white/40" />
                              </div>
                            )}
                            {isVideo && (
                              <div className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-full">
                                <FaPlay size={10} />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-white/60 mb-2">
                              Revived {timeAgo(revive.revived_at)}
                            </p>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="flex items-center gap-1">
                                <FaHeart size={12} style={{ color: VELT_ACCENT }} />
                                {likes}
                              </span>
                              <span className="flex items-center gap-1 text-white/60">
                                💬 {comments}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Products Tab */}
            {activeTab === "products" && (
              <div>
                {loadingProducts ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                    <IoBagHandle size={48} className="text-white/20 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Products Yet</h3>
                    <p className="text-white/60 mb-6">Start selling by adding your first product</p>
                    <Link
                      href="/app/marketplace"
                      className="inline-block px-6 py-3 rounded-xl font-semibold transition hover:opacity-90"
                      style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                    >
                      Go to Marketplace
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map((product, index) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition cursor-pointer"
                      >
                        <div className="aspect-square relative">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-white/10 flex items-center justify-center">
                              <IoBagHandle size={32} className="text-white/20" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="font-medium truncate mb-1">{product.title}</h4>
                          <p className="font-bold" style={{ color: VELT_ACCENT }}>
                            GHS {product.price}
                          </p>
                          <p className="text-xs text-white/40">{product.sold_count || 0} sold</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
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
                {/* Get Signature - Prominent CTA */}
                <Link
                  href="/website_payment"
                  className="block p-4 rounded-xl transition"
                  style={{ backgroundColor: `${VELT_ACCENT}20`, border: `1px solid ${VELT_ACCENT}40` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaCrown size={20} style={{ color: VELT_ACCENT }} />
                      <div>
                        <p className="font-semibold">Get Velt Signature</p>
                        <p className="text-sm text-white/60">Unlock premium features</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">Save!</span>
                  </div>
                </Link>
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
                  href="/website_payment"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
