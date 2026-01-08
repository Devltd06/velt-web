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
  FaBell,
  FaSignOutAlt,
  FaPlus,
  FaStar,
  FaLayerGroup,
  FaMapMarkerAlt,
  FaPaperPlane,
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
  is_signature?: boolean;
  verified?: boolean;
  subscription_ends_at?: string | null;
}

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  created_at: string;
  expire_at?: string | null;
  profile?: Profile | null;
  is_hd?: boolean;
}

interface StoryGroup {
  userId: string;
  profile: Profile;
  stories: Story[];
  latestStory: Story;
}

interface LocationPost {
  id: string;
  place: string;
  caption?: string | null;
  images: string[];
  videos: string[];
  media_type: string;
  avatar_url?: string | null;
  author_name?: string | null;
  author_id?: string | null;
  created_at?: string | null;
  stars: number;
}

interface Message {
  id: string;
  content?: string | null;
  text?: string | null;
  created_at: string;
  sender_id?: string;
}

interface Conversation {
  id: string;
  created_at: string;
  lastMessage?: Message | null;
  otherUser?: Profile | null;
}

// Sidebar Navigation Items - matches mobile: Home, Shopr, Contents, Billboards, Chats
const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home", active: true },
  { icon: FaShoppingBag, label: "Shopr", href: "/app/shopr" },
  { icon: FaPlayCircle, label: "Contents", href: "/app/contents" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaComments, label: "Chats", href: "/app/chats" },
];

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

// Stories Carousel Component with Center Focus Effect
function StoriesCarousel({ storiesGrouped }: { storiesGrouped: StoryGroup[] }) {
  const [focusedIndex, setFocusedIndex] = useState(Math.min(1, storiesGrouped.length - 1));
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const cardWidth = 180; // Card width + gap
  const visibleCards = storiesGrouped.slice(0, 10);

  // Handle scroll to update focused index
  const handleScroll = useCallback(() => {
    if (!carouselRef.current) return;
    const scrollLeft = carouselRef.current.scrollLeft;
    const containerWidth = carouselRef.current.offsetWidth;
    const centerPoint = scrollLeft + containerWidth / 2;
    const newIndex = Math.round((centerPoint - containerWidth / 2) / cardWidth);
    setFocusedIndex(Math.max(0, Math.min(newIndex, visibleCards.length - 1)));
  }, [visibleCards.length]);

  // Scroll to center on mount
  useEffect(() => {
    if (carouselRef.current && visibleCards.length > 1) {
      const centerOffset = cardWidth;
      carouselRef.current.scrollLeft = centerOffset;
    }
  }, [visibleCards.length]);

  return (
    <section className="p-6 border-b border-white/10">
      <h2 className="text-lg font-bold mb-4">All Stories</h2>
      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Left spacer for centering */}
        <div className="flex-shrink-0" style={{ width: "calc(50vw - 330px)" }} />
        
        {visibleCards.map((group, index) => {
          const isFocused = index === focusedIndex;
          
          return (
            <Link
              href={`/app/stories?userId=${group.userId}`}
              key={`card-${group.userId}`}
              className="snap-center"
            >
              <motion.div
                animate={{
                  scale: isFocused ? 1 : 0.85,
                  opacity: isFocused ? 1 : 0.5,
                  y: isFocused ? 0 : 10,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex-shrink-0 rounded-2xl overflow-hidden relative cursor-pointer"
                style={{ 
                  width: 160,
                  height: 240,
                  boxShadow: isFocused 
                    ? `0 20px 50px rgba(212, 175, 55, 0.3), 0 10px 30px rgba(0,0,0,0.5)` 
                    : "0 10px 30px rgba(0,0,0,0.3)",
                  border: isFocused ? `2px solid ${VELT_ACCENT}` : "2px solid transparent",
                }}
              >
                {/* Story Preview - Video autoplay when focused */}
                {group.latestStory?.media_type === "video" ? (
                  <StoryVideoCard 
                    src={group.latestStory.media_url} 
                    isFocused={isFocused}
                  />
                ) : (
                  <img 
                    src={group.latestStory?.media_url || PLACEHOLDER_AVATAR} 
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* HD Badge */}
                {group.latestStory?.is_hd && (
                  <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs font-bold">
                    HD
                  </div>
                )}
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                {/* User Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                  <p className="font-bold text-sm truncate">
                    {group.profile.full_name || group.profile.username}
                  </p>
                  <p className="text-xs text-white/60">
                    {group.latestStory?.created_at ? timeAgo(group.latestStory.created_at) : ""}
                  </p>
                </div>

                {/* Focus ring animation */}
                {isFocused && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      boxShadow: `inset 0 0 0 2px ${VELT_ACCENT}`,
                    }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}

        {/* Right spacer for centering */}
        <div className="flex-shrink-0" style={{ width: "calc(50vw - 330px)" }} />
      </div>
    </section>
  );
}

// Video card component that autoplays when focused
function StoryVideoCard({ src, isFocused }: { src: string; isFocused: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isFocused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isFocused]);

  return (
    <video
      ref={videoRef}
      src={src}
      className="w-full h-full object-cover"
      muted
      loop
      playsInline
    />
  );
}

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [storiesGrouped, setStoriesGrouped] = useState<StoryGroup[]>([]);
  const [locationPosts, setLocationPosts] = useState<LocationPost[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftCollapsed] = useState(false);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  // Check auth and load profile
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }
      
      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, role, is_signature, verified, subscription_ends_at")
        .eq("id", session.user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch stories
  const fetchStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const nowMs = Date.now();
      const { data: storyRows, error } = await supabase
        .from("stories")
        .select("id, user_id, media_url, media_type, duration, created_at, expire_at, visibility, is_deleted, is_hd")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error || !storyRows) {
        setStoriesGrouped([]);
        return;
      }

      // Filter active stories (not expired)
      const activeRows = storyRows.filter((r) => {
        if (!r.expire_at) return true;
        try {
          return new Date(r.expire_at).getTime() > nowMs;
        } catch {
          return true;
        }
      });

      // Get unique user IDs
      const userIds = Array.from(new Set(activeRows.map((it) => it.user_id).filter(Boolean)));
      if (userIds.length === 0) {
        setStoriesGrouped([]);
        return;
      }

      // Fetch profiles
      const { data: profRows } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, role")
        .in("id", userIds);

      const profilesMap: Record<string, Profile> = {};
      (profRows || []).forEach((p) => {
        profilesMap[p.id] = { ...p, avatar_url: p.avatar_url || PLACEHOLDER_AVATAR };
      });

      // Group stories by user
      const groupsMap: Record<string, { profile: Profile; stories: Story[] }> = {};
      for (const row of activeRows) {
        const uid = row.user_id;
        const prof = profilesMap[uid] || { id: uid, avatar_url: PLACEHOLDER_AVATAR };
        
        if (!groupsMap[uid]) {
          groupsMap[uid] = { profile: prof, stories: [] };
        }
        groupsMap[uid].stories.push({
          id: row.id,
          user_id: row.user_id,
          media_url: row.media_url,
          media_type: row.media_type === "video" ? "video" : "image",
          created_at: row.created_at,
          expire_at: row.expire_at,
          profile: prof,
          is_hd: row.is_hd,
        });
      }

      // Convert to array and sort by latest story
      const arr = Object.entries(groupsMap)
        .map(([userId, v]) => {
          v.stories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return { 
            userId, 
            profile: v.profile, 
            stories: v.stories,
            latestStory: v.stories[0],
          };
        })
        .filter((g) => g.stories.length > 0)
        .sort((a, b) => {
          const aLast = a.latestStory?.created_at ?? "";
          const bLast = b.latestStory?.created_at ?? "";
          return new Date(bLast).getTime() - new Date(aLast).getTime();
        });

      setStoriesGrouped(arr);
    } catch (err) {
      console.warn("[home] fetchStories err", err);
      setStoriesGrouped([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  // Fetch location posts (feed)
  const fetchLocationPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const { data, error } = await supabase
        .from("location_posts")
        .select("id, place, caption, country, images, videos, media_type, avatar_url, author_display_name, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.warn("[home] fetchLocationPosts err", error);
        setLocationPosts([]);
        return;
      }

      const rows = (data ?? []);
      const mapped: LocationPost[] = rows.map((r) => ({
        id: String(r.id),
        place: r.place ?? "—",
        caption: r.caption ?? null,
        images: Array.isArray(r.images) ? r.images : r.images ? [r.images] : [],
        videos: Array.isArray(r.videos) ? r.videos : [],
        media_type: r.media_type ?? "image",
        avatar_url: r.avatar_url ?? null,
        author_name: r.author_display_name ?? null,
        author_id: r.user_id ?? null,
        created_at: r.created_at ?? null,
        stars: 0,
      }));

      setLocationPosts(mapped);

      // Fetch star counts
      const ids = mapped.map((p) => p.id);
      if (ids.length) {
        const { data: sc } = await supabase
          .from("location_post_star_counts")
          .select("location_post_id, star_count")
          .in("location_post_id", ids);
        
        const scMap: Record<string, number> = {};
        (sc ?? []).forEach((row) => (scMap[String(row.location_post_id)] = Number(row.star_count ?? 0)));
        setLocationPosts((cur) => cur.map((p) => ({ ...p, stars: scMap[p.id] ?? 0 })));
      }
    } catch (err) {
      console.warn("[home] fetchLocationPosts exception", err);
      setLocationPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // Fetch unread notifications
  const fetchUnreadCount = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient", profile.id)
        .eq("read", false);
      setUnreadCount(count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [profile?.id]);

  // Fetch recent conversations for right sidebar
  const fetchRecentConversations = useCallback(async () => {
    if (!profile?.id) return;
    setConversationsLoading(true);
    try {
      // participant rows
      const { data: participantRows, error: partError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", profile.id);
      if (partError) {
        setRecentConversations([]);
        return;
      }
      const conversationIds = (participantRows || []).map((p: { conversation_id: string }) => p.conversation_id);
      if (conversationIds.length === 0) {
        setRecentConversations([]);
        return;
      }

      const { data: convRows } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("*")
        .in("conversation_id", conversationIds);

      const allUserIds = Array.from(new Set((allParticipants || []).map((p: { user_id: string }) => p.user_id)));
      const profilesMap: Record<string, Profile> = {};
      if (allUserIds.length) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", allUserIds);
        (profRows || []).forEach((p: Profile) => (profilesMap[p.id] = { ...p, avatar_url: p.avatar_url || PLACEHOLDER_AVATAR }));
      }

      const convs = await Promise.all((convRows || []).map(async (conv: { id: string; created_at: string }) => {
        const { data: lastMsgRows } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const lastMessage = lastMsgRows && lastMsgRows.length ? lastMsgRows[0] : null;
        const participants = (allParticipants || []).filter((p: { conversation_id: string }) => p.conversation_id === conv.id);
        const otherParticipant = participants.find((p: { user_id: string }) => p.user_id !== profile.id);
        const otherUser = otherParticipant ? profilesMap[otherParticipant.user_id] : null;
        return { ...conv, lastMessage, otherUser };
      }));

      setRecentConversations(convs);
    } catch (err) {
      console.warn("[home] fetchRecentConversations err", err);
      setRecentConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [profile?.id]);

  // Load data on mount
  useEffect(() => {
    if (!loading && profile) {
      fetchStories();
      fetchLocationPosts();
      fetchUnreadCount();
      fetchRecentConversations();
    }
  }, [loading, profile, fetchStories, fetchLocationPosts, fetchUnreadCount, fetchRecentConversations]);

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
          <Link
            href="/app/create-story"
            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mb-6 transition hover:opacity-90"
            style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
          >
            <FaPlus size={16} />
            Create Story
          </Link>

          {/* User Actions */}
          <div className="border-t border-white/10 pt-4 space-y-2">
            <Link 
              href="/app/profile"
              className="flex items-center gap-4 px-4 py-3 w-full text-left text-white/60 hover:text-white transition rounded-xl hover:bg-white/5"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden" style={{ backgroundColor: VELT_ACCENT }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-black font-bold text-xs">
                    {(profile?.full_name || profile?.username || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span>Profile</span>
            </Link>
            <Link 
              href="/app/notifications"
              className="flex items-center gap-4 px-4 py-3 w-full text-left text-white/60 hover:text-white transition rounded-xl hover:bg-white/5 relative"
            >
              <FaBell size={20} />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="absolute right-4 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
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
        <main className={`${leftCollapsed ? "ml-0" : "ml-64"} flex-1 min-h-screen`}>
          {/* Location Navigation Button - Airplane Icon */}
          <div className="fixed top-4 right-96 z-40 hidden xl:block">
            <Link
              href="/app/location"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 border border-white/10 hover:border-white/30 transition group"
              title="View Your Locations"
            >
              <FaPaperPlane 
                size={18} 
                className="group-hover:rotate-12 transition-transform"
                style={{ color: VELT_ACCENT }} 
              />
              <span className="text-sm font-medium text-white/80 group-hover:text-white">
                Locations
              </span>
            </Link>
          </div>

          {/* Stories Bubbles */}
          <section className="border-b border-white/10 p-6">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {/* removed Add Story bubble - creation moved to Contents/Create flow */}

              {/* Loading state */}
              {storiesLoading && (
                <div className="flex items-center justify-center px-8">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* User Stories */}
              {!storiesLoading && storiesGrouped.map((group) => (
                <Link 
                  href={`/app/stories?userId=${group.userId}`}
                  key={group.userId} 
                  className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group"
                >
                  <div
                    className="w-16 h-16 rounded-full overflow-hidden p-0.5"
                    style={{ background: `linear-gradient(135deg, ${VELT_ACCENT}, #FFD700, ${VELT_ACCENT})` }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-black p-0.5">
                      {group.profile.avatar_url ? (
                        <img 
                          src={group.profile.avatar_url} 
                          alt="" 
                          className="w-full h-full object-cover rounded-full group-hover:scale-110 transition"
                        />
                      ) : (
                        <span 
                          style={{ backgroundColor: VELT_ACCENT, color: "#000" }} 
                          className="w-full h-full flex items-center justify-center rounded-full font-bold"
                        >
                          {(group.profile.full_name || group.profile.username || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-white/60 truncate w-16 text-center">
                    {group.profile.full_name || group.profile.username || "User"}
                  </span>
                </Link>
              ))}

              {/* No stories */}
              {!storiesLoading && storiesGrouped.length === 0 && (
                <p className="text-white/40 text-sm px-4">No stories yet</p>
              )}
            </div>
          </section>

          {/* Stories Cards Carousel - Center Focus Effect */}
          {!storiesLoading && storiesGrouped.length > 0 && (
            <StoriesCarousel storiesGrouped={storiesGrouped} />
          )}

          {/* Location Posts - Zigzag Layout */}
          <section className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FaMapMarkerAlt style={{ color: VELT_ACCENT }} />
                Locations
              </h2>
              <Link href="/app/explore" className="text-sm" style={{ color: VELT_ACCENT }}>
                View All
              </Link>
            </div>

            {postsLoading && (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {!postsLoading && locationPosts.length === 0 && (
              <div className="text-center py-12 text-white/40">
                <p>No location posts yet</p>
              </div>
            )}

            {/* Zigzag Layout */}
            {!postsLoading && locationPosts.length > 0 && (
              <div className="space-y-8 max-w-4xl mx-auto">
                {locationPosts.map((post, index) => {
                  const isEven = index % 2 === 0;
                  const primaryMedia = post.videos.length > 0 ? post.videos[0] : post.images[0];
                  const isVideo = post.videos.length > 0;
                  const hasMultiple = (post.images.length + post.videos.length) > 1;
                  
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex gap-6 items-center ${isEven ? "flex-row" : "flex-row-reverse"}`}
                    >
                      {/* Media Card */}
                      <Link 
                        href={`/app/explore?post=${post.id}`}
                        className="w-[55%] aspect-[4/5] rounded-2xl overflow-hidden relative group cursor-pointer"
                        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
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
                            <FaMapMarkerAlt size={48} className="text-white/20" />
                          </div>
                        )}
                        
                        {/* Stack indicator */}
                        {hasMultiple && (
                          <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded-lg flex items-center gap-1">
                            <FaLayerGroup size={12} />
                            <span className="text-xs font-bold">{post.images.length + post.videos.length}</span>
                          </div>
                        )}
                        
                        {/* Stars badge */}
                        <div className="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-full flex items-center gap-1">
                          <span className="font-bold text-sm">{post.stars}</span>
                          <FaStar size={14} className="text-yellow-400" />
                        </div>
                        
                        {/* Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        
                        {/* Avatar at bottom */}
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                          <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                            {post.avatar_url ? (
                              <img src={post.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: VELT_ACCENT }}>
                                <span className="text-black font-bold text-sm">
                                  {(post.author_name || "?").charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                      
                      {/* Info Box */}
                      <div className="w-[45%] px-2">
                        <h3 className="font-bold text-xl mb-2">{post.place}</h3>
                        {post.caption && (
                          <p className="text-white/60 text-sm mb-3 line-clamp-3">{post.caption}</p>
                        )}
                        <p className="text-sm text-white/80 mb-2">{post.author_name || "Anonymous"}</p>
                        <div className="flex items-center gap-2 text-white/40 text-xs">
                          <FaMapMarkerAlt size={10} />
                          <span>{post.created_at ? timeAgo(post.created_at) : ""}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* View More */}
            {!postsLoading && locationPosts.length > 6 && (
              <div className="text-center mt-8">
                <Link
                  href="/app/explore"
                  className="inline-block px-6 py-3 rounded-xl font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  View All Locations
                </Link>
              </div>
            )}
          </section>
        </main>

        {/* Right Sidebar - Profile & Recent Chats */}
        <aside className={`${rightCollapsed ? "hidden" : "fixed right-0 top-0 h-screen w-80"} bg-black border-l border-white/10 p-6 hidden xl:block`}>
          {/* Current User */}
          {profile && (
            <Link href="/app/profile" className="flex items-center gap-3 mb-8 hover:bg-white/5 p-2 rounded-xl transition -m-2">
              <div className="w-12 h-12 rounded-full overflow-hidden" style={{ backgroundColor: VELT_ACCENT }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black font-bold">
                    {(profile.full_name || profile.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-semibold">{profile.full_name || profile.username}</h4>
                <p className="text-xs text-white/40">@{profile.username || "user"}</p>
              </div>
            </Link>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white/80 mb-4">Recent Chats</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRightCollapsed(true)}
                className="text-white/40 hover:text-white transition"
                aria-label="Collapse chats"
              >
                ×
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {conversationsLoading && (
              <div className="text-white/40 text-sm">Loading...</div>
            )}
            {!conversationsLoading && recentConversations.length === 0 && (
              <div className="text-white/40">No recent chats</div>
            )}
            {!conversationsLoading && recentConversations.map((c) => (
              <Link
                key={c.id}
                href={`/app/chats?conversation=${c.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5">
                  {c.otherUser?.avatar_url ? (
                    <img src={c.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: VELT_ACCENT }}>
                      <span className="text-black font-bold">{(c.otherUser?.full_name || c.otherUser?.username || "?").charAt(0)}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{c.otherUser?.full_name || c.otherUser?.username || "Conversation"}</p>
                    <span className="text-xs text-white/40">{c.lastMessage?.created_at ? timeAgo(c.lastMessage.created_at) : ""}</span>
                  </div>
                  <p className="text-xs text-white/60 truncate">{c.lastMessage?.content || c.lastMessage?.text || ""}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Small open button when collapsed */}
          {/* (a visible toggle will be rendered when collapsed - see below) */}
        </aside>

        {/* Collapsed right toggle (shows when right sidebar collapsed) */}
        {rightCollapsed && (
          <div className="fixed right-2 top-8 z-50 hidden xl:block">
            <button
              onClick={() => setRightCollapsed(false)}
              className="bg-white/5 text-white px-3 py-2 rounded-full hover:bg-white/10"
            >
              Chats
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
