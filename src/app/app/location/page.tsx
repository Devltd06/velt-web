"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaMapMarkerAlt,
  FaStar,
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaGlobe,
  FaCompass,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface LocationPost {
  id: string;
  place: string;
  caption?: string | null;
  country?: string | null;
  images: string[];
  videos: string[];
  media_type: string;
  avatar_url?: string | null;
  author_name?: string | null;
  author_id?: string | null;
  created_at?: string | null;
  stars: number;
  latitude?: number | null;
  longitude?: number | null;
}

// Time ago helper
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function LocationPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<LocationPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

  // Stats
  const [totalPlaces, setTotalPlaces] = useState(0);
  const [totalCountries, setTotalCountries] = useState(0);
  const [totalStars, setTotalStars] = useState(0);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch location posts
  const fetchPosts = useCallback(async () => {
    if (!profile?.id) return;
    setPostsLoading(true);
    try {
      let query = supabase
        .from("location_posts")
        .select("id, place, caption, country, images, videos, media_type, avatar_url, author_display_name, user_id, created_at, latitude, longitude")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (searchQuery.trim()) {
        query = supabase
          .from("location_posts")
          .select("id, place, caption, country, images, videos, media_type, avatar_url, author_display_name, user_id, created_at, latitude, longitude")
          .eq("user_id", profile.id)
          .or(`place.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%`)
          .order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.warn("fetch location posts", error);
        setPosts([]);
        return;
      }

      const mapped: LocationPost[] = (data ?? []).map((r) => ({
        id: String(r.id),
        place: r.place ?? "Unknown",
        caption: r.caption ?? null,
        country: r.country ?? null,
        images: Array.isArray(r.images) ? r.images : r.images ? [r.images] : [],
        videos: Array.isArray(r.videos) ? r.videos : [],
        media_type: r.media_type ?? "image",
        avatar_url: r.avatar_url ?? null,
        author_name: r.author_display_name ?? null,
        author_id: r.user_id ?? null,
        created_at: r.created_at ?? null,
        stars: 0,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
      }));

      setPosts(mapped);

      // Calculate stats
      const uniquePlaces = new Set(mapped.map((p) => p.place)).size;
      const uniqueCountries = new Set(mapped.map((p) => p.country).filter(Boolean)).size;
      setTotalPlaces(uniquePlaces);
      setTotalCountries(uniqueCountries);

      // Fetch star counts
      const ids = mapped.map((p) => p.id);
      if (ids.length) {
        const { data: sc } = await supabase
          .from("location_post_star_counts")
          .select("location_post_id, star_count")
          .in("location_post_id", ids);

        const scMap: Record<string, number> = {};
        let total = 0;
        (sc ?? []).forEach((row) => {
          scMap[String(row.location_post_id)] = Number(row.star_count ?? 0);
          total += Number(row.star_count ?? 0);
        });
        setPosts((cur) => cur.map((p) => ({ ...p, stars: scMap[p.id] ?? 0 })));
        setTotalStars(total);
      }
    } catch (err) {
      console.warn("fetch posts exception", err);
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [profile?.id, searchQuery]);

  useEffect(() => {
    if (profile) {
      fetchPosts();
    }
  }, [profile, fetchPosts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              <FaArrowLeft size={20} />
            </button>
            <h1 className="font-bold text-lg">Your Locations</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchVisible(!searchVisible)}
              className="p-2 rounded-full hover:bg-white/10 transition"
            >
              <FaSearch size={18} />
            </button>
            <Link
              href="/app/create-story"
              className="p-2 rounded-full transition"
              style={{ backgroundColor: VELT_ACCENT }}
            >
              <FaPlus size={18} className="text-black" />
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="px-4 py-3 max-w-6xl mx-auto">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search places or countries..."
                  className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none placeholder-white/40"
                  autoFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="pt-20 pb-8 px-4 max-w-6xl mx-auto">
        {/* Profile & Stats Header */}
        <div className="flex flex-col items-center py-8">
          {/* Avatar with animated ring */}
          <div className="relative mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(${VELT_ACCENT}, transparent, ${VELT_ACCENT})`,
                padding: 3,
              }}
            />
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-black relative z-10">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-black font-bold text-2xl"
                  style={{ backgroundColor: VELT_ACCENT }}
                >
                  {(profile?.full_name || profile?.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <h2 className="text-xl font-bold mb-1">{profile?.full_name || profile?.username}</h2>
          <p className="text-white/40 text-sm mb-6">@{profile?.username || "user"}</p>

          {/* Stats Cards */}
          <div className="flex gap-4 flex-wrap justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/5 rounded-2xl px-6 py-4 text-center min-w-[120px]"
            >
              <FaMapMarkerAlt size={24} className="mx-auto mb-2" style={{ color: VELT_ACCENT }} />
              <p className="text-2xl font-bold">{totalPlaces}</p>
              <p className="text-xs text-white/40">Places</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/5 rounded-2xl px-6 py-4 text-center min-w-[120px]"
            >
              <FaGlobe size={24} className="mx-auto mb-2" style={{ color: VELT_ACCENT }} />
              <p className="text-2xl font-bold">{totalCountries}</p>
              <p className="text-xs text-white/40">Countries</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/5 rounded-2xl px-6 py-4 text-center min-w-[120px]"
            >
              <FaStar size={24} className="mx-auto mb-2" style={{ color: VELT_ACCENT }} />
              <p className="text-2xl font-bold">{totalStars}</p>
              <p className="text-xs text-white/40">Stars</p>
            </motion.div>
          </div>
        </div>

        {/* Posts Grid */}
        {postsLoading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {!postsLoading && posts.length === 0 && (
          <div className="text-center py-12">
            <FaCompass size={48} className="mx-auto mb-4 text-white/20" />
            <p className="text-white/40 mb-4">No locations yet</p>
            <Link
              href="/app/create-story"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition hover:opacity-90"
              style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
            >
              <FaPlus size={16} />
              Add Your First Location
            </Link>
          </div>
        )}

        {!postsLoading && posts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post, index) => {
              const primaryMedia = post.videos.length > 0 ? post.videos[0] : post.images[0];
              const isVideo = post.videos.length > 0;
              const hasMultiple = (post.images.length + post.videos.length) > 1;

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={`/app/location/${post.id}`}
                    className="block aspect-[3/4] rounded-2xl overflow-hidden relative group"
                    style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}
                  >
                    {isVideo ? (
                      <video
                        src={primaryMedia}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        muted
                        loop
                        playsInline
                      />
                    ) : primaryMedia ? (
                      <img
                        src={primaryMedia}
                        alt={post.place}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <FaMapMarkerAlt size={32} className="text-white/20" />
                      </div>
                    )}

                    {/* Stack indicator */}
                    {hasMultiple && (
                      <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-lg flex items-center gap-1">
                        <FaLayerGroup size={10} />
                        <span className="text-xs font-bold">{post.images.length + post.videos.length}</span>
                      </div>
                    )}

                    {/* Stars badge */}
                    <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded-full flex items-center gap-1">
                      <span className="font-bold text-xs">{post.stars}</span>
                      <FaStar size={10} className="text-yellow-400" />
                    </div>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Place name */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="font-bold text-sm truncate">{post.place}</p>
                      {post.country && (
                        <p className="text-xs text-white/60 truncate">{post.country}</p>
                      )}
                      <p className="text-xs text-white/40 mt-1">
                        {post.created_at ? timeAgo(post.created_at) : ""}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
