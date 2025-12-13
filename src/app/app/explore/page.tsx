"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FaHome,
  FaShoppingBag,
  FaPlayCircle,
  FaBullhorn,
  FaComments,
  FaSearch,
  FaPlay,
  FaUsers,
  FaFire,
  FaCrown,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";
const PLACEHOLDER_AVATAR = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

// Types
interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  bio?: string | null;
}

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  created_at: string;
  duration?: number | null;
  profile?: Profile | null;
}

interface BusinessStory {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption?: string | null;
  label?: string | null;
  created_at: string;
  profile?: Profile | null;
}

const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaShoppingBag, label: "Shopr", href: "/app/shopr" },
  { icon: FaPlayCircle, label: "Contents", href: "/app/contents" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaComments, label: "Chats", href: "/app/chats" },
];

const categories = [
  { id: "all", label: "All", icon: "🌟" },
  { id: "creators", label: "Creators", icon: "🎨" },
  { id: "business", label: "Business", icon: "💼" },
  { id: "music", label: "Music", icon: "🎵" },
  { id: "food", label: "Food", icon: "🍔" },
  { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "tech", label: "Tech", icon: "💻" },
];

export default function ExplorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [creators, setCreators] = useState<Profile[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [businessStories, setBusinessStories] = useState<BusinessStory[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const [storiesLoading, setStoriesLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch creators (profiles)
  const fetchCreators = useCallback(async () => {
    setCreatorsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, role, bio")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.warn("[explore] fetchCreators err", error);
        setCreators([]);
        return;
      }

      setCreators(data || []);
    } catch (err) {
      console.warn("[explore] fetchCreators exception", err);
      setCreators([]);
    } finally {
      setCreatorsLoading(false);
    }
  }, []);

  // Fetch stories for highlights
  const fetchStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const nowMs = Date.now();
      
      // Fetch regular stories
      const { data: storyRows } = await supabase
        .from("stories")
        .select("id, user_id, media_url, media_type, duration, created_at, expire_at, is_deleted")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(12);

      // Filter active stories
      const activeRows = (storyRows || []).filter((r) => {
        if (!r.expire_at) return true;
        try {
          return new Date(r.expire_at).getTime() > nowMs;
        } catch {
          return true;
        }
      });

      // Get profiles for stories
      const userIds = Array.from(new Set(activeRows.map((s) => s.user_id).filter(Boolean)));
      const profilesMap: Record<string, Profile> = {};
      
      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);
        
        (profRows || []).forEach((p) => {
          profilesMap[p.id] = { ...p, avatar_url: p.avatar_url || PLACEHOLDER_AVATAR };
        });
      }

      const storiesWithProfiles = activeRows.map((s) => ({
        ...s,
        media_type: s.media_type === "video" ? "video" as const : "image" as const,
        profile: profilesMap[s.user_id] || null,
      }));

      setStories(storiesWithProfiles);

      // Fetch business stories
      const { data: businessRows } = await supabase
        .from("business_stories")
        .select("id, user_id, media_url, media_type, caption, label, created_at, expire_at, is_deleted")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(8);

      const activeBusinessRows = (businessRows || []).filter((r) => {
        if (!r.expire_at) return true;
        try {
          return new Date(r.expire_at).getTime() > nowMs;
        } catch {
          return true;
        }
      });

      // Get profiles for business stories
      const businessUserIds = Array.from(new Set(activeBusinessRows.map((s) => s.user_id).filter(Boolean)));
      if (businessUserIds.length > 0) {
        const { data: bProfRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", businessUserIds);
        
        (bProfRows || []).forEach((p) => {
          profilesMap[p.id] = { ...p, avatar_url: p.avatar_url || PLACEHOLDER_AVATAR };
        });
      }

      const businessWithProfiles = activeBusinessRows.map((s) => ({
        ...s,
        media_type: s.media_type === "video" ? "video" as const : "image" as const,
        profile: profilesMap[s.user_id] || null,
      }));

      setBusinessStories(businessWithProfiles);
    } catch (err) {
      console.warn("[explore] fetchStories exception", err);
      setStories([]);
      setBusinessStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    if (!loading) {
      fetchCreators();
      fetchStories();
    }
  }, [loading, fetchCreators, fetchStories]);

  // Filter creators based on search
  const filteredCreators = creators.filter((creator) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (creator.full_name?.toLowerCase().includes(query)) ||
      (creator.username?.toLowerCase().includes(query)) ||
      (creator.role?.toLowerCase().includes(query))
    );
  });

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
              const isActive = item.href === "/app/explore";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition ${
                    isActive
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

          {/* Story Highlights Grid */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaFire style={{ color: VELT_ACCENT }} />
                Story Highlights
              </h2>
              <button className="text-sm text-white/60 hover:text-white transition">See All</button>
            </div>
            {storiesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : stories.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <p>No story highlights yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {stories.slice(0, 6).map((story, index) => (
                  <motion.div
                    key={story.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="aspect-[9/16] bg-gradient-to-br from-white/10 to-white/5 rounded-2xl relative overflow-hidden cursor-pointer group"
                  >
                    {story.media_url ? (
                      story.media_type === "video" ? (
                        <video src={story.media_url} className="absolute inset-0 w-full h-full object-cover" muted />
                      ) : (
                        <img src={story.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {story.media_type === "video" ? (
                          <FaPlay className="text-white/30 group-hover:text-white/50 transition" size={24} />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/10" />
                        )}
                      </div>
                    )}
                    {story.media_type === "video" && story.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-xs">
                        {Math.floor((story.duration || 0) / 60)}:{String((story.duration || 0) % 60).padStart(2, "0")}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80">
                      <p className="text-xs font-medium truncate">
                        {story.profile?.full_name || story.profile?.username || "Unknown"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Business Stories / Trending Section */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaCrown style={{ color: VELT_ACCENT }} />
                Business Highlights
              </h2>
              <button className="text-sm text-white/60 hover:text-white transition">See All</button>
            </div>
            {storiesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : businessStories.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <p>No business highlights yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {businessStories.slice(0, 4).map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition cursor-pointer"
                  >
                    <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center overflow-hidden">
                      {item.media_url ? (
                        item.media_type === "video" ? (
                          <video src={item.media_url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                        )
                      ) : (
                        <FaPlay className="text-white/20" size={24} />
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-medium mb-1">
                        {item.profile?.full_name || item.profile?.username || "Business"}
                      </h4>
                      {item.caption && (
                        <p className="text-sm text-white/70 line-clamp-2 mb-2">{item.caption}</p>
                      )}
                      <div className="flex items-center gap-2">
                        {item.label && (
                          <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ backgroundColor: `${VELT_ACCENT}22`, color: VELT_ACCENT }}
                          >
                            {item.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* Creators Grid */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FaUsers style={{ color: VELT_ACCENT }} />
                Discover Creators
              </h2>
              <button className="text-sm text-white/60 hover:text-white transition">See All</button>
            </div>
            {creatorsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : filteredCreators.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <p>{searchQuery ? "No creators found" : "No creators to show"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCreators.slice(0, 9).map((creator, index) => (
                  <motion.div
                    key={creator.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => router.push(`/app/profile/${creator.id}`)}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                        <img
                          src={creator.avatar_url || PLACEHOLDER_AVATAR}
                          alt={creator.full_name || creator.username || ""}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_AVATAR;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold truncate">
                            {creator.full_name || creator.username || "Unknown"}
                          </h4>
                          {creator.role === "business" && (
                            <FaCrown size={14} style={{ color: VELT_ACCENT }} />
                          )}
                        </div>
                        {creator.username && (
                          <p className="text-sm text-white/60 truncate">@{creator.username}</p>
                        )}
                        {creator.role && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full inline-block mt-1"
                            style={{ backgroundColor: `${VELT_ACCENT}22`, color: VELT_ACCENT }}
                          >
                            {creator.role}
                          </span>
                        )}
                      </div>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-80 flex-shrink-0"
                        style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                      >
                        View
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
