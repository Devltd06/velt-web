"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FaHome,
  FaShoppingBag,
  FaPlayCircle,
  FaBullhorn,
  FaComments,
  FaHeart,
  FaComment,
  FaShare,
  FaBookmark,
  FaPlay,
  FaVolumeUp,
  FaVolumeMute,
  FaUser,
  FaMusic,
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
}

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  duration?: number;
  created_at: string;
  caption?: string | null;
  is_hd?: boolean;
  music_title?: string | null;
  music_artist?: string | null;
  profile?: Profile | null;
  likes_count?: number;
  comments_count?: number;
}

// Navigation items matching mobile: Home, Shopr, Contents, Billboards, Chats
const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaShoppingBag, label: "Shopr", href: "/app/shopr" },
  { icon: FaPlayCircle, label: "Contents", href: "/app/contents", active: true },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaComments, label: "Chats", href: "/app/chats" },
];

export default function ContentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});

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

  // Fetch stories (content feed)
  const fetchStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const nowMs = Date.now();
      const { data: storyRows, error } = await supabase
        .from("stories")
        .select("id, user_id, media_url, media_type, duration, created_at, expire_at, is_deleted, is_hd, caption, music_title, music_artist")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !storyRows) {
        console.warn("[contents] fetchStories error", error);
        setStories([]);
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

      // Fetch profiles
      const profilesMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);

        (profRows ?? []).forEach((p) => {
          profilesMap[p.id] = { ...p, avatar_url: p.avatar_url || PLACEHOLDER_AVATAR };
        });
      }

      // Map stories with profiles
      const mapped: Story[] = activeRows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        media_url: row.media_url,
        media_type: row.media_type === "video" ? "video" : "image",
        duration: row.duration,
        created_at: row.created_at,
        caption: row.caption,
        is_hd: row.is_hd,
        music_title: row.music_title,
        music_artist: row.music_artist,
        profile: profilesMap[row.user_id] || null,
        likes_count: 0,
        comments_count: 0,
      }));

      setStories(mapped);
    } catch (err) {
      console.warn("[contents] fetchStories exception", err);
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchStories();
    }
  }, [loading, fetchStories]);

  // Handle video playback
  useEffect(() => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    // Pause all videos
    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.pause();
    });

    // Play current video
    const currentVideo = videoRefs.current[currentStory.id];
    if (currentVideo && isPlaying) {
      currentVideo.play().catch(() => {});
    }
  }, [currentIndex, stories, isPlaying]);

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const togglePlay = () => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    const video = videoRefs.current[currentStory.id];
    if (video) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.muted = !isMuted;
    });
    setIsMuted(!isMuted);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const currentStory = stories[currentIndex];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 h-screen w-64 bg-black border-r border-white/10 p-6 flex flex-col z-40">
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
            <Link
              href="/app/profile"
              className="flex items-center gap-4 px-4 py-3 w-full text-left text-white/60 hover:text-white transition rounded-xl hover:bg-white/5"
            >
              <FaUser size={20} />
              <span>Profile</span>
            </Link>
          </div>
        </aside>

        {/* Main Content - Full Screen Video Feed */}
        <main className="ml-64 flex-1 min-h-screen flex items-center justify-center p-4">
          {storiesLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : stories.length === 0 ? (
            <div className="text-center">
              <FaPlayCircle size={64} className="mx-auto text-white/20 mb-4" />
              <h2 className="text-xl font-bold mb-2">No Content Yet</h2>
              <p className="text-white/60">Check back later for new stories</p>
            </div>
          ) : (
            <div className="relative w-full max-w-md mx-auto">
              {/* Video Container */}
              <div className="relative aspect-[9/16] bg-black rounded-3xl overflow-hidden">
                {/* Story Content */}
                {currentStory && (
                  <>
                    {currentStory.media_type === "video" ? (
                      <video
                        ref={(el) => {
                          if (el) videoRefs.current[currentStory.id] = el;
                        }}
                        src={currentStory.media_url}
                        className="w-full h-full object-cover"
                        loop
                        playsInline
                        muted={isMuted}
                        onClick={togglePlay}
                      />
                    ) : (
                      <img
                        src={currentStory.media_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* HD Badge */}
                    {currentStory.is_hd && (
                      <div className="absolute top-4 left-4 bg-black/70 px-2 py-1 rounded text-xs font-bold">
                        HD
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 right-0 flex gap-1 p-2">
                      {stories.slice(0, 10).map((_, idx) => (
                        <div
                          key={idx}
                          className="flex-1 h-1 rounded-full overflow-hidden bg-white/30"
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              backgroundColor: VELT_ACCENT,
                              width: idx < currentIndex ? "100%" : idx === currentIndex ? "50%" : "0%",
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* User Info */}
                    <div className="absolute top-8 left-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden" style={{ backgroundColor: VELT_ACCENT }}>
                        {currentStory.profile?.avatar_url ? (
                          <img
                            src={currentStory.profile.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-black font-bold">
                            {(currentStory.profile?.full_name || currentStory.profile?.username || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm drop-shadow-lg">
                          {currentStory.profile?.full_name || currentStory.profile?.username || "Unknown"}
                        </p>
                        <p className="text-xs text-white/80 drop-shadow-lg">
                          @{currentStory.profile?.username || "user"}
                        </p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <button
                        onClick={toggleMute}
                        className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center"
                      >
                        {isMuted ? <FaVolumeMute size={14} /> : <FaVolumeUp size={14} />}
                      </button>
                    </div>

                    {/* Bottom Gradient */}
                    <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

                    {/* Caption & Music */}
                    <div className="absolute bottom-20 left-4 right-16 pr-4">
                      {currentStory.caption && (
                        <p className="text-sm mb-3 drop-shadow-lg line-clamp-3">
                          {currentStory.caption}
                        </p>
                      )}
                      {currentStory.music_title && (
                        <div className="flex items-center gap-2 text-xs text-white/80">
                          <FaMusic size={10} />
                          <span className="truncate">
                            {currentStory.music_title} - {currentStory.music_artist}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right Side Actions */}
                    <div className="absolute bottom-20 right-4 flex flex-col items-center gap-6">
                      <button className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition">
                          <FaHeart size={18} />
                        </div>
                        <span className="text-xs">{currentStory.likes_count || 0}</span>
                      </button>
                      <button className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition">
                          <FaComment size={18} />
                        </div>
                        <span className="text-xs">{currentStory.comments_count || 0}</span>
                      </button>
                      <button className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition">
                          <FaBookmark size={18} />
                        </div>
                      </button>
                      <button className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition">
                          <FaShare size={18} />
                        </div>
                      </button>
                    </div>

                    {/* Navigation Areas */}
                    <div className="absolute inset-0 flex">
                      <div className="w-1/3 h-full cursor-pointer" onClick={goToPrev} />
                      <div className="w-1/3 h-full cursor-pointer" onClick={togglePlay} />
                      <div className="w-1/3 h-full cursor-pointer" onClick={goToNext} />
                    </div>

                    {/* Play/Pause Indicator */}
                    {!isPlaying && currentStory.media_type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                          <FaPlay size={24} className="ml-1" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Thumbnails Strip */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                {stories.slice(0, 20).map((story, idx) => (
                  <button
                    key={story.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden transition ${
                      idx === currentIndex ? "ring-2 ring-offset-2 ring-offset-black" : "opacity-60 hover:opacity-100"
                    }`}
                    style={idx === currentIndex ? { boxShadow: `0 0 0 2px ${VELT_ACCENT}` } : {}}
                  >
                    {story.media_type === "video" ? (
                      <video
                        src={story.media_url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={story.media_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Counter */}
              <div className="text-center mt-4 text-white/60">
                {currentIndex + 1} / {stories.length}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
