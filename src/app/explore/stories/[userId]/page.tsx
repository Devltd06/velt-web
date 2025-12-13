"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHeart,
  FaRegHeart,
  FaComment,
  FaEye,
  FaPaperPlane,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisH,
  FaPlay,
  FaCheckCircle,
  FaShare,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

// Comment type definition
type StoryComment = {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
  profiles?: ProfileShort | null;
};

const VELT_ACCENT = "#D4AF37";
const CLOUDINARY_CLOUD = "dpejjmjxg";
const PLACEHOLDER_AVATAR = "https://api.dicebear.com/7.x/identicon/png?seed=anon&backgroundType=gradientLinear";

type ProfileShort = {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  is_online?: boolean | null;
};

type StoryItem = {
  id: string;
  user_id: string;
  raw_media_url?: string;
  media_url: string;
  media_type: "image" | "video";
  duration?: number;
  created_at: string;
  profiles?: ProfileShort | null;
  expire_at?: string | null;
  caption?: string | null;
  on_screen_text?: string | null;
  isHD?: boolean;
};

type StoryGroup = {
  userId: string;
  profile: ProfileShort;
  stories: StoryItem[];
};

function buildCloudinaryUrl(publicIdOrUrl: string | null | undefined, mediaType: "image" | "video") {
  if (!publicIdOrUrl) return null;
  const s = String(publicIdOrUrl).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const resource = mediaType === "video" ? "video" : "image";
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/${resource}/upload/f_auto,q_auto/${s}`;
}

function timeAgoLabel(iso: string) {
  try {
    const t = Date.now() - new Date(iso).getTime();
    const s = Math.floor(t / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "";
  }
}

function formatCount(n?: number) {
  if (n === 0) return "0";
  if (!n) return "";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return v >= 100 ? `${Math.round(v)}K` : `${parseFloat(v.toFixed(1))}K`;
  }
  const v = n / 1_000_000;
  return v >= 100 ? `${Math.round(v)}M` : `${parseFloat(v.toFixed(1))}M`;
}

export default function UserStoriesPage() {
  const params = useParams();
  const router = useRouter();
  const initialUserId = params?.userId as string;

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [activeUserIndex, setActiveUserIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Social state
  const [isFollowingState, setIsFollowingState] = useState<Record<string, boolean>>({});
  const [isLikedState, setIsLikedState] = useState<Record<string, boolean>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [viewsCountMap, setViewsCountMap] = useState<Record<string, number>>({});

  // Comments
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsList, setCommentsList] = useState<StoryComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Action menu
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  // Video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Get current user
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setCurrentUserId(data?.user?.id ?? null);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Fetch stories
  useEffect(() => {
    fetchAllStories();
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress timer for images
  useEffect(() => {
    if (activeUserIndex === null) return;
    const story = getActiveStory();
    if (!story || isPaused || commentSheetVisible) return;

    if (story.media_type === "image") {
      const duration = (story.duration || 6) * 1000;
      const startTime = Date.now();
      
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(elapsed / duration, 1);
        setProgress(newProgress);
        
        if (newProgress >= 1) {
          goToNextStoryOrUser();
        }
      }, 50);

      return () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserIndex, activeStoryIndex, isPaused, commentSheetVisible]);

  // Load social state when story changes
  useEffect(() => {
    const story = getActiveStory();
    if (story) {
      fetchViewCount(story.id);
      loadSocialStateForActive();
      fetchCommentsForActive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserIndex, activeStoryIndex]);

  async function fetchAllStories() {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      
      // First try with foreign key, fallback to without
      let data: Record<string, unknown>[] | null = null;
      let error: Error | null = null;
      
      // Try query with profile join
      const result = await supabase
        .from("stories")
        .select(`
          id, user_id, media_url, media_type, duration, created_at, is_deleted, expire_at, is_hd, caption,
          profiles(id, username, full_name, avatar_url)
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      
      data = result.data as Record<string, unknown>[] | null;
      error = result.error as Error | null;

      console.log("Stories query result:", { data, error, count: data?.length });

      if (error) {
        console.error("Query error:", error);
        throw error;
      }

      const active = (data || []).filter((r: Record<string, unknown>) => {
        // Don't filter by expire_at if it's null (stories without expiration)
        if (r.expire_at) {
          const expireDate = new Date(r.expire_at as string);
          const nowDate = new Date(now);
          if (expireDate <= nowDate) return false;
        }
        return true;
      });

      console.log("Active stories after filter:", active.length);

      const items: StoryItem[] = active.map((r: Record<string, unknown>) => {
        const mediaType: "image" | "video" = r.media_type === "video" ? "video" : "image";
        const built = buildCloudinaryUrl(r.media_url as string, mediaType) ?? "";
        const profileData = r.profiles as ProfileShort | ProfileShort[] | null;
        return {
          id: r.id as string,
          user_id: r.user_id as string,
          raw_media_url: r.media_url as string,
          media_url: built,
          media_type: mediaType,
          duration: r.duration as number | undefined,
          created_at: r.created_at as string,
          profiles: Array.isArray(profileData) ? profileData[0] ?? null : profileData ?? null,
          expire_at: (r.expire_at as string) ?? null,
          isHD: Boolean(r.is_hd),
          caption: typeof r.caption !== "undefined" ? r.caption as string : null,
        };
      });

      const map: Record<string, { profile: ProfileShort; stories: StoryItem[] }> = {};
      for (const s of items) {
        const uid = s.user_id;
        const prof = (s.profiles as ProfileShort) ?? ({ id: uid } as ProfileShort);
        if (!map[uid]) map[uid] = { profile: prof, stories: [] };
        if (s.media_url) map[uid].stories.push(s);
      }

      const arr = Object.entries(map)
        .map(([userId, v]) => {
          v.stories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return { userId, profile: v.profile, stories: v.stories };
        })
        .sort((a, b) => {
          const aLast = a.stories[a.stories.length - 1]?.created_at ?? "";
          const bLast = b.stories[b.stories.length - 1]?.created_at ?? "";
          return new Date(bLast).getTime() - new Date(aLast).getTime();
        });

      setGroups(arr);

      if (arr.length > 0) {
        const idx = arr.findIndex((g) => g.userId === initialUserId);
        if (idx >= 0) {
          setActiveUserIndex(idx);
          setActiveStoryIndex(0);
        } else {
          setActiveUserIndex(0);
          setActiveStoryIndex(0);
        }
      } else {
        setActiveUserIndex(null);
      }
    } catch (err) {
      console.warn("fetchAllStories error", err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  const getActiveStory = useCallback((): StoryItem | null => {
    if (activeUserIndex === null) return null;
    const g = groups[activeUserIndex];
    if (!g) return null;
    return g.stories[activeStoryIndex] ?? null;
  }, [activeUserIndex, activeStoryIndex, groups]);

  const getActiveGroup = useCallback((): StoryGroup | null => {
    if (activeUserIndex === null) return null;
    return groups[activeUserIndex] ?? null;
  }, [activeUserIndex, groups]);

  async function markStoryViewed(storyId: string) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      await supabase.from("story_views").upsert(
        { story_id: storyId, viewer_id: uid, viewed_at: new Date().toISOString() },
        { onConflict: "story_id,viewer_id" }
      );
      fetchViewCount(storyId);
    } catch {
      // ignore
    }
  }

  async function fetchViewCount(storyId: string) {
    try {
      const { count } = await supabase
        .from("story_views")
        .select("id", { count: "exact" })
        .eq("story_id", storyId);
      setViewsCountMap((m) => ({ ...m, [storyId]: count ?? 0 }));
    } catch {
      // ignore
    }
  }

  async function loadSocialStateForActive() {
    const g = getActiveGroup();
    const s = getActiveStory();
    if (!g || !s) return;
    try {
      if (g.userId && currentUserId) {
        const { count } = await supabase
          .from("follows")
          .select("id", { count: "exact" })
          .eq("follower_id", currentUserId)
          .eq("following_id", g.userId);
        setIsFollowingState((m) => ({ ...m, [g.userId]: (count ?? 0) > 0 }));
      }
      if (s.id && currentUserId) {
        const { data: liked } = await supabase
          .from("story_likes")
          .select("id")
          .eq("story_id", s.id)
          .eq("user_id", currentUserId)
          .maybeSingle();
        setIsLikedState((m) => ({ ...m, [s.id]: !!liked }));
        
        const { count } = await supabase
          .from("story_likes")
          .select("id", { count: "exact" })
          .eq("story_id", s.id);
        setLikesCountMap((m) => ({ ...m, [s.id]: count ?? 0 }));
      }
      markStoryViewed(s.id);
    } catch {
      // ignore
    }
  }

  async function fetchCommentsForActive() {
    const s = getActiveStory();
    if (!s) return;
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("story_comments")
        .select("id, story_id, user_id, content, created_at, parent_id, profiles(id, username, full_name, avatar_url)")
        .eq("story_id", s.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Transform data to match StoryComment type
      const comments: StoryComment[] = (data ?? []).map((c) => ({
        id: c.id,
        story_id: c.story_id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        parent_id: c.parent_id,
        profiles: Array.isArray(c.profiles) ? c.profiles[0] ?? null : c.profiles ?? null,
      }));
      setCommentsList(comments);
    } catch {
      setCommentsList([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleFollowToggle(targetId: string) {
    if (!currentUserId) return;
    try {
      const isCurrentlyFollowing = isFollowingState[targetId];
      setIsFollowingState((m) => ({ ...m, [targetId]: !isCurrentlyFollowing }));
      
      if (isCurrentlyFollowing) {
        await supabase.from("follows").delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", targetId);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: targetId });
      }
    } catch {
      setIsFollowingState((m) => ({ ...m, [targetId]: !m[targetId] }));
    }
  }

  async function handleLikeToggle(storyId: string) {
    if (!currentUserId) return;
    try {
      const isCurrentlyLiked = isLikedState[storyId];
      setIsLikedState((m) => ({ ...m, [storyId]: !isCurrentlyLiked }));
      setLikesCountMap((m) => ({ ...m, [storyId]: (m[storyId] ?? 0) + (isCurrentlyLiked ? -1 : 1) }));
      
      if (isCurrentlyLiked) {
        await supabase.from("story_likes").delete()
          .eq("story_id", storyId)
          .eq("user_id", currentUserId);
      } else {
        await supabase.from("story_likes").insert({ story_id: storyId, user_id: currentUserId });
      }
    } catch {
      setIsLikedState((m) => ({ ...m, [storyId]: !m[storyId] }));
    }
  }

  async function handleAddComment() {
    const s = getActiveStory();
    if (!s || !commentDraft.trim() || !currentUserId) return;
    
    try {
      const { error } = await supabase.from("story_comments").insert({
        story_id: s.id,
        user_id: currentUserId,
        content: commentDraft.trim(),
      });
      if (error) throw error;
      setCommentDraft("");
      fetchCommentsForActive();
    } catch {
      // ignore
    }
  }

  function goToNextStoryOrUser() {
    if (activeUserIndex === null) return;
    const g = groups[activeUserIndex];
    if (!g) return;
    
    if (progressInterval.current) clearInterval(progressInterval.current);
    setProgress(0);

    if (activeStoryIndex + 1 < g.stories.length) {
      setActiveStoryIndex((i) => i + 1);
      return;
    }
    goToNextUser();
  }

  function goToPrevStoryOrUser() {
    if (activeUserIndex === null) return;
    
    if (progressInterval.current) clearInterval(progressInterval.current);
    setProgress(0);

    if (activeStoryIndex > 0) {
      setActiveStoryIndex((i) => i - 1);
      return;
    }
    goToPrevUser();
  }

  function goToNextUser() {
    if (activeUserIndex === null) return;
    const next = activeUserIndex + 1;
    if (next >= groups.length) {
      handleClose();
      return;
    }
    setActiveUserIndex(next);
    setActiveStoryIndex(0);
    setProgress(0);
  }

  function goToPrevUser() {
    if (activeUserIndex === null) return;
    const prev = activeUserIndex - 1;
    if (prev < 0) {
      handleClose();
      return;
    }
    setActiveUserIndex(prev);
    setActiveStoryIndex(0);
    setProgress(0);
  }

  function handleClose() {
    if (progressInterval.current) clearInterval(progressInterval.current);
    router.back();
  }

  function handleVideoProgress() {
    if (!videoRef.current) return;
    const duration = videoRef.current.duration || 1;
    const currentTime = videoRef.current.currentTime;
    setProgress(currentTime / duration);
  }

  function handleVideoEnded() {
    goToNextStoryOrUser();
  }

  function togglePause() {
    setIsPaused((p) => !p);
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (commentSheetVisible) return;
      
      switch (e.key) {
        case "ArrowLeft":
          goToPrevStoryOrUser();
          break;
        case "ArrowRight":
          goToNextStoryOrUser();
          break;
        case "Escape":
          handleClose();
          break;
        case " ":
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserIndex, activeStoryIndex, commentSheetVisible, isPaused]);

  const group = getActiveGroup();
  const story = getActiveStory();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: VELT_ACCENT }} />
      </div>
    );
  }

  if (!group || !story) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 text-white">
        <p className="text-xl mb-4">No stories available</p>
        <button
          onClick={handleClose}
          className="px-6 py-3 rounded-full font-semibold"
          style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Navigation buttons for desktop */}
      <button
        onClick={goToPrevUser}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition"
      >
        <FaChevronLeft className="text-white text-xl" />
      </button>
      
      <button
        onClick={goToNextUser}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition"
      >
        <FaChevronRight className="text-white text-xl" />
      </button>

      {/* Story Container */}
      <div className="relative w-full h-full md:w-[420px] md:h-[90vh] md:rounded-2xl overflow-hidden bg-black">
        {/* Progress bars */}
        <div className="absolute top-2 left-3 right-3 z-40 flex gap-1">
          {group.stories.map((s, idx) => (
            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{
                  width: idx < activeStoryIndex
                    ? "100%"
                    : idx === activeStoryIndex
                    ? `${progress * 100}%`
                    : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-40 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 relative">
              <Image
                src={group.profile?.avatar_url || PLACEHOLDER_AVATAR}
                alt={group.profile?.full_name || "User"}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">
                  {group.profile?.full_name || group.profile?.username || "Unknown"}
                </span>
                {group.profile?.full_name && (
                  <FaCheckCircle className="text-blue-500 text-xs" />
                )}
              </div>
              <span className="text-white/60 text-xs">{timeAgoLabel(story.created_at)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {currentUserId && currentUserId !== group.userId && (
              <button
                onClick={() => handleFollowToggle(group.userId)}
                className="px-4 py-1.5 rounded-full text-xs font-bold transition"
                style={{
                  backgroundColor: isFollowingState[group.userId] ? "transparent" : VELT_ACCENT,
                  color: isFollowingState[group.userId] ? "#fff" : "#000",
                  border: isFollowingState[group.userId] ? "1px solid rgba(255,255,255,0.3)" : "none",
                }}
              >
                {isFollowingState[group.userId] ? "Following" : "Follow"}
              </button>
            )}
            
            <button
              onClick={() => setActionMenuVisible(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition"
            >
              <FaEllipsisH className="text-white text-sm" />
            </button>
            
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition"
            >
              <FaTimes className="text-white" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePause}
        >
          {story.media_type === "video" ? (
            <video
              ref={videoRef}
              src={story.media_url}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              onTimeUpdate={handleVideoProgress}
              onEnded={handleVideoEnded}
              onLoadedData={() => {
                if (videoRef.current && !isPaused) {
                  videoRef.current.play();
                }
              }}
            />
          ) : (
            <Image
              src={story.media_url}
              alt="Story"
              fill
              className="object-cover"
              unoptimized
              priority
            />
          )}

          {/* Pause indicator */}
          <AnimatePresence>
            {isPaused && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center bg-black/30"
              >
                <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
                  <FaPlay className="text-white text-3xl ml-1" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tap zones */}
        <div className="absolute inset-0 flex z-20 pointer-events-auto">
          <div className="w-1/3 h-full" onClick={(e) => { e.stopPropagation(); goToPrevStoryOrUser(); }} />
          <div className="w-1/3 h-full" onClick={(e) => { e.stopPropagation(); togglePause(); }} />
          <div className="w-1/3 h-full" onClick={(e) => { e.stopPropagation(); goToNextStoryOrUser(); }} />
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-24 left-0 right-0 px-4 z-30">
            <div className="bg-black/50 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white font-semibold text-sm">{story.caption}</p>
            </div>
          </div>
        )}

        {/* Bottom action bar */}
        <div className="absolute bottom-4 left-4 right-4 z-40">
          <div className="flex items-center gap-3 bg-black/80 backdrop-blur-sm rounded-full px-4 py-3">
            <button
              onClick={() => setCommentSheetVisible(true)}
              className="flex-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <FaComment className="text-white text-sm" />
              <span className="text-white text-sm opacity-70">
                {commentsList.length > 0 ? `${formatCount(commentsList.length)} comments` : "Add comment..."}
              </span>
            </button>
            
            <button
              onClick={() => handleLikeToggle(story.id)}
              className={`flex items-center gap-1 px-3 py-2 rounded-full transition ${
                isLikedState[story.id] ? "bg-red-500/30" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isLikedState[story.id] ? (
                <FaHeart className="text-red-500" />
              ) : (
                <FaRegHeart className="text-white" />
              )}
              <span className="text-white text-xs font-bold">
                {formatCount(likesCountMap[story.id])}
              </span>
            </button>
            
            <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-white/10">
              <FaEye className="text-white text-sm" />
              <span className="text-white text-xs font-bold">
                {formatCount(viewsCountMap[story.id])}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Sheet */}
      <AnimatePresence>
        {commentSheetVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setCommentSheetVisible(false)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="relative w-full md:w-[420px] max-h-[70vh] bg-gray-900 rounded-t-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-white font-bold">Comments</h3>
                <button onClick={() => setCommentSheetVisible(false)}>
                  <FaTimes className="text-white" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[50vh] p-4">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: VELT_ACCENT }} />
                  </div>
                ) : commentsList.length === 0 ? (
                  <div className="text-center py-8">
                    <FaComment className="text-white/30 text-4xl mx-auto mb-3" />
                    <p className="text-white/50">No comments yet</p>
                    <p className="text-white/30 text-sm">Be the first to comment</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {commentsList.map((comment) => {
                      const prof = comment.profiles;
                      return (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 relative">
                            <Image
                              src={prof?.avatar_url || PLACEHOLDER_AVATAR}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold text-sm">
                                {prof?.full_name || prof?.username || "User"}
                              </span>
                              <span className="text-white/40 text-xs">
                                {timeAgoLabel(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-white/80 text-sm">{comment.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-white/10">
                <div className="flex items-center gap-3 bg-white/10 rounded-full px-4 py-2">
                  <input
                    type="text"
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentDraft.trim()}
                    className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50 transition"
                    style={{ backgroundColor: VELT_ACCENT }}
                  >
                    <FaPaperPlane className="text-black text-sm" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Menu */}
      <AnimatePresence>
        {actionMenuVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setActionMenuVisible(false)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="relative w-full md:w-[420px] bg-gray-900 rounded-t-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                
                <button className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/10 rounded-xl transition">
                  <FaShare className="text-white text-lg" />
                  <span className="text-white font-semibold">Share</span>
                </button>
                
                <button className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/10 rounded-xl transition text-red-500">
                  <span className="text-lg">🚫</span>
                  <span className="font-semibold">Report</span>
                </button>
                
                {currentUserId === group.userId && (
                  <button className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/10 rounded-xl transition text-red-500">
                    <span className="text-lg">🗑️</span>
                    <span className="font-semibold">Delete Story</span>
                  </button>
                )}
                
                <button
                  onClick={() => setActionMenuVisible(false)}
                  className="w-full mt-4 py-4 bg-white/10 hover:bg-white/20 rounded-xl transition"
                >
                  <span className="text-white font-semibold">Cancel</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
