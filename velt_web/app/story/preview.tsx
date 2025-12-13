import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  GestureResponderEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewToken,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { safePush, withSafeRouter } from '@/lib/navigation';
import { Video, Audio, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { supabase } from "@/lib/supabase";
import { useTheme } from "app/themes";
// UnifiedBottomSheet removed — revert to RN Modal usage
import { useProfileStore } from "@/lib/store/profile";

const STORY_SELECT =
  "id, user_id, caption, media_url, media_urls, media_type, duration, created_at, music_title, music_audio_url, music_artist, music_duration_ms, profiles:profiles!stories_user_id_fkey(id, username, full_name, avatar_url), is_hd";
const BUSINESS_STORY_SELECT =
  "id, user_id, caption, media_url, media_type, created_at, duration, music_title, music_audio_url, music_artist, music_duration_ms, profiles:profiles!business_stories_user_id_fkey(id, username, full_name, avatar_url), is_hd";
const CLOUDINARY_CLOUD = "dpejjmjxg";

// Default duration for images with music (15 seconds)
const IMAGE_WITH_MUSIC_DURATION_MS = 15000;

type ProfileLite = {
  id?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
} | null;

type LoadedStory = {
  id: string;
  source: "story" | "business";
  mediaType: "video" | "image";
  mediaUri: string | null;
  caption?: string | null;
  created_at?: string | null;
  profile: ProfileLite;
  aspectRatio?: number; // width / height
  music_title?: string | null;
  music_audio_url?: string | null;
  music_artist?: string | null;
  music_duration_ms?: number | null;
  duration?: number | null;
  isHD?: boolean;
};

// Prefetch cache for media URLs
const prefetchedMedia = new Map<string, { loaded: boolean; aspectRatio?: number }>();

const prefetchImage = async (uri: string): Promise<number | undefined> => {
  if (!uri) return undefined;
  if (prefetchedMedia.has(uri)) {
    return prefetchedMedia.get(uri)?.aspectRatio;
  }
  
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => {
        const aspectRatio = width / height;
        prefetchedMedia.set(uri, { loaded: true, aspectRatio });
        // Also prefetch the image into cache
        Image.prefetch(uri).catch(() => {});
        resolve(aspectRatio);
      },
      () => {
        prefetchedMedia.set(uri, { loaded: false });
        resolve(undefined);
      }
    );
  });
};

type StoryComment = {
  id: string;
  content: string;
  created_at?: string | null;
  parent_id?: string | null;
  story_id?: string | null;
  business_story_id?: string | null;
  _optimistic?: boolean;
  _failed?: boolean;
  user_id?: string | null;
  profiles?: {
    id?: string | null;
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type TableConfig = {
  key: "story_id" | "business_story_id";
  likesTable: "story_likes" | "business_story_likes";
  commentsTable: "story_comments" | "business_story_comments";
};

const COMMENT_LIKES_TABLE = "story_comment_likes";

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get("window");

const deriveMediaUrl = (record: { media_url?: string | null; media_urls?: string[] | string | null }) => {
  if (record?.media_url && isAbsolute(record.media_url)) return record.media_url;
  if (Array.isArray(record?.media_urls) && record.media_urls.length) {
    const first = record.media_urls[0];
    if (first) return first;
  }
  if (typeof record?.media_urls === "string" && record.media_urls.trim()) {
    try {
      const parsed = JSON.parse(record.media_urls);
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === "string") {
        return parsed[0];
      }
    } catch {}
  }
  return record.media_url ?? null;
};

const isAbsolute = (value?: string | null) => {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://");
};

const buildCloudinaryUrl = (publicId?: string | null, mediaType?: string | null) => {
  if (!publicId) return null;
  if (isAbsolute(publicId)) return publicId;
  const folder = mediaType === "video" ? "video" : "image";
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/${folder}/upload/${publicId}`;
};

const formatHandle = (username?: string | null) => {
  if (!username) return "@unknown";
  const clean = username.startsWith("@") ? username.slice(1) : username;
  return `@${clean}`;
};

const getInitials = (name?: string | null, fallback?: string | null) => {
  const source = name?.trim() || fallback?.trim() || "";
  if (!source) return "??";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join("")
    .padEnd(2, "");
};

const formatAgo = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return "Just now";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
};

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

type VideoHandle = {
  playAsync?: () => Promise<void>;
  pauseAsync?: () => Promise<void>;
  unloadAsync?: () => Promise<void>;
};

const StoryPreviewScreen = () => {
  const router = withSafeRouter(useRouter());
  const params = useLocalSearchParams<{ storyId?: string | string[]; businessStoryId?: string | string[] }>();
  const storyId = Array.isArray(params.storyId) ? params.storyId[0] : params.storyId;
  const businessStoryId = Array.isArray(params.businessStoryId) ? params.businessStoryId[0] : params.businessStoryId;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfileStore();
  const videoRef = useRef<VideoHandle | null>(null);

  const palette = useMemo(
    () => ({
      background: colors?.bg ?? "#050505",
      text: colors?.text ?? "#f8fafc",
      subtext: colors?.subtext ?? "rgba(148,163,184,0.85)",
      border: colors?.border ?? "rgba(148,163,184,0.25)",
      card: colors?.card ?? "#0a0a0a",
      accent: colors?.accent ?? "#e60050",
      faint: colors?.faint ?? "rgba(255,255,255,0.04)",
    }),
    [colors]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<LoadedStory | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  // Callout modal to share story with followers / suggestions
  const [calloutModalVisible, setCalloutModalVisible] = useState(false);
  const [calloutCandidates, setCalloutCandidates] = useState<ProfileLite[]>([]);
  const [selectedCalloutRecipients, setSelectedCalloutRecipients] = useState<Set<string>>(new Set());
  const [calloutLoading, setCalloutLoading] = useState(false);
  const [calloutExpanded, setCalloutExpanded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ commentId: string; displayName?: string } | null>(null);
  const [commentLikesMap, setCommentLikesMap] = useState<Record<string, number>>({});
  const [commentLikedByMe, setCommentLikedByMe] = useState<Record<string, boolean>>({});
  // track collapsed/hidden replies per parent comment id
  const [hiddenReplyParents, setHiddenReplyParents] = useState<Set<string>>(new Set());
  
  // Random stories queue for FlatList-based vertical paging
  const [storyQueue, setStoryQueue] = useState<LoadedStory[]>([]);
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const [engagementMap, setEngagementMap] = useState<Record<string, { likes: number; comments: number; isLiked: boolean }>>({});
  const viewedStoryIds = useRef<Set<string>>(new Set());
  const flatListRef = useRef<FlatList<LoadedStory> | null>(null);
  const storyQueueRef = useRef<LoadedStory[]>([]);
  const prefetchedIdsRef = useRef<Set<string>>(new Set());
  const hasFetchedQueueRef = useRef(false);
  const isFetchingRef = useRef(false);
  
  // Screen focus state
  const isScreenFocused = useIsFocused();
  
  // Media loading states
  const [mediaLoadingMap, setMediaLoadingMap] = useState<Record<string, boolean>>({});
  const [mediaLoadedMap, setMediaLoadedMap] = useState<Record<string, boolean>>({});
  const mediaFadeAnims = useRef<Map<string, Animated.Value>>(new Map());
  
  // Music playback state
  const musicSoundRef = useRef<InstanceType<typeof Audio.Sound> | null>(null);
  const currentMusicStoryIdRef = useRef<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  
  // Auto-advance timer for images with music
  const imageAutoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Progress tracking for images with music
  const [imageProgressMap, setImageProgressMap] = useState<Record<string, { position: number; duration: number }>>({});
  
  const sheetClosed = WINDOW_H;
  const sheetOpenTop = Math.round(WINDOW_H * 0.18);
  const sheetY = useRef(new Animated.Value(sheetClosed)).current;
  const sheetDragStart = useRef(sheetClosed);
  const sheetValueRef = useRef(sheetClosed);
  const commentsListRef = useRef<FlatList<StoryComment> | null>(null);
  const commentInputRef = useRef<TextInput | null>(null);
  const firstCommentPulse = useRef(new Animated.Value(1)).current;
  
  // Keep refs in sync with state
  useEffect(() => {
    storyQueueRef.current = storyQueue;
  }, [storyQueue]);

  // Music playback functions
  const stopMusicPlayback = useCallback(async () => {
    try {
      if (musicSoundRef.current) {
        await musicSoundRef.current.stopAsync().catch(() => {});
        await musicSoundRef.current.unloadAsync().catch(() => {});
        musicSoundRef.current = null;
      }
      currentMusicStoryIdRef.current = null;
      setMusicPlaying(false);
    } catch (err) {
      console.warn("stopMusicPlayback error", err);
    }
  }, []);

  const startMusicPlayback = useCallback(async (storyId: string, audioUrl: string) => {
    try {
      if (currentMusicStoryIdRef.current === storyId && musicSoundRef.current) {
        return;
      }
      await stopMusicPlayback();
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, isLooping: true, volume: 0.7 }
      );
      musicSoundRef.current = sound;
      currentMusicStoryIdRef.current = storyId;
      setMusicPlaying(true);
    } catch (err) {
      console.warn("startMusicPlayback error", err);
      setMusicPlaying(false);
    }
  }, [stopMusicPlayback]);

  // Handle music playback when visible story changes
  // Only play separate audio for IMAGES with music_audio_url
  // Videos with music have audio embedded - they don't have music_audio_url
  useEffect(() => {
    // Don't play music if screen isn't focused
    if (!isScreenFocused) {
      stopMusicPlayback();
      return;
    }
    
    const currentStory = storyQueue[currentVisibleIndex];
    if (!currentStory) {
      stopMusicPlayback();
      return;
    }
    
    // Only play separate audio for IMAGES with music
    // Videos have audio embedded via Cloudinary transformation
    if (currentStory.mediaType === 'image' && currentStory.music_audio_url) {
      startMusicPlayback(currentStory.id, currentStory.music_audio_url);
    } else {
      stopMusicPlayback();
    }
  }, [currentVisibleIndex, storyQueue, startMusicPlayback, stopMusicPlayback, isScreenFocused]);

  // Auto-advance and progress tracking for images with music
  useEffect(() => {
    // Clear any existing timer
    if (imageAutoAdvanceTimerRef.current) {
      clearTimeout(imageAutoAdvanceTimerRef.current);
      imageAutoAdvanceTimerRef.current = null;
    }
    
    // Don't run auto-advance if screen isn't focused
    if (!isScreenFocused) return;
    
    const currentStory = storyQueue[currentVisibleIndex];
    if (!currentStory) return;
    
    // Only apply to images with music
    if (currentStory.mediaType !== 'image' || !currentStory.music_audio_url) return;
    
    const duration = IMAGE_WITH_MUSIC_DURATION_MS;
    const startTime = Date.now();
    
    // Update progress every 100ms for smooth progress bar
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setImageProgressMap((prev) => ({
        ...prev,
        [currentStory.id]: { position: Math.min(elapsed, duration), duration }
      }));
    }, 100);
    
    // Auto-advance after duration
    imageAutoAdvanceTimerRef.current = setTimeout(() => {
      // Find index of current story and advance to next
      if (currentVisibleIndex < storyQueue.length - 1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: currentVisibleIndex + 1, animated: true });
      }
    }, duration);
    
    return () => {
      clearInterval(progressInterval);
      if (imageAutoAdvanceTimerRef.current) {
        clearTimeout(imageAutoAdvanceTimerRef.current);
        imageAutoAdvanceTimerRef.current = null;
      }
    };
  }, [currentVisibleIndex, storyQueue, isScreenFocused]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => {
      stopMusicPlayback();
    };
  }, [stopMusicPlayback]);

  // Stop all audio when screen loses focus
  useEffect(() => {
    if (!isScreenFocused) {
      // Stop music playback immediately when screen loses focus
      stopMusicPlayback();
      // Clear auto-advance timer for images
      if (imageAutoAdvanceTimerRef.current) {
        clearTimeout(imageAutoAdvanceTimerRef.current);
        imageAutoAdvanceTimerRef.current = null;
      }
    }
  }, [isScreenFocused, stopMusicPlayback]);
  const fetchCommentLikes = useCallback(async (commentIds: string[]) => {
    if (!commentIds || commentIds.length === 0) {
      setCommentLikesMap({});
      setCommentLikedByMe({});
      return;
    }
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id ?? null;
      const { data: rows } = await supabase
        .from(COMMENT_LIKES_TABLE)
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
      const counts: Record<string, number> = {};
      const likedByMe: Record<string, boolean> = {};
      (rows ?? []).forEach((row: any) => {
        const id = row?.comment_id;
        if (!id) return;
        counts[id] = (counts[id] ?? 0) + 1;
        if (uid && row?.user_id === uid) {
          likedByMe[id] = true;
        }
      });
      setCommentLikesMap(counts);
      setCommentLikedByMe(likedByMe);
    } catch (err) {
      console.warn("story preview comment likes load error", err);
    }
  }, []);

  const loadCalloutCandidates = useCallback(async () => {
    // Prefetch followers and following as candidates for callouts
    if (!profile?.id) return setCalloutCandidates([]);
    try {
      const myId = profile.id;
      const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", myId).limit(500);
      const { data: followerRows } = await supabase.from("follows").select("follower_id").eq("following_id", myId).limit(500);
      const ids = new Set<string>();
      (followingRows || []).forEach((r: any) => r?.following_id && ids.add(r.following_id));
      (followerRows || []).forEach((r: any) => r?.follower_id && ids.add(r.follower_id));
      ids.delete(myId);
      const idArray = Array.from(ids).slice(0, 60);
      let candidates: ProfileLite[] = [];
      if (idArray.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", idArray).order("full_name", { ascending: true }).limit(60);
        candidates = profs || [];
      }
      // Fallback to other profiles
      if (!candidates.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username, avatar_url").neq("id", myId).order("full_name", { ascending: true }).limit(40);
        candidates = profs || [];
      }
      setCalloutCandidates(candidates as ProfileLite[]);
    } catch (err) {
      console.warn("loadCalloutCandidates err", err);
      setCalloutCandidates([]);
    }
  }, [profile?.id]);

  const toggleCalloutRecipient = useCallback((id?: string | null) => {
    if (!id) return;
    setSelectedCalloutRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sendCalloutToRecipients = useCallback(async (recipientIds: string[]) => {
    if (!profile?.id || !story) return;
    setCalloutLoading(true);
    let successCount = 0;
    let failCount = 0;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    try {
      const myId = profile.id;
      // Prepare story snapshot
      const storySnapshot = { id: story.id, title: story.caption ?? "Untitled", cover_url: story.mediaUri ?? null, author_name: story.profile?.full_name ?? profile.full_name ?? profile.username };

      // (work happens below)
      for (const targetId of recipientIds) {
        try {
          // find existing DM conversation between me and target
          const { data: myConvos } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", myId).limit(500);
          const cidIds = (myConvos || []).map((r:any) => r.conversation_id);
          let existingId: string | null = null;
          if (cidIds.length) {
            const { data: combos } = await supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", cidIds);
            const byConvo: Record<string, Set<string>> = {};
            (combos || []).forEach((row: any) => {
              const set = byConvo[row.conversation_id] || new Set<string>();
              set.add(row.user_id);
              byConvo[row.conversation_id] = set;
            });
            for (const [cid, members] of Object.entries(byConvo)) {
              if (members.size === 2 && members.has(myId) && members.has(targetId)) {
                existingId = cid;
                break;
              }
            }
          }
          let cid = existingId;
          if (!cid) {
            const ins = await supabase.from("conversations").insert({ is_group: false, created_by: myId }).select("id").single();
            if (ins.error || !ins.data) {
              console.warn("create convo failed", ins.error);
              continue;
            }
            cid = ins.data.id;
            let partErr: any = null;
            try {
              const { error } = await supabase.from("conversation_participants").insert([
                { conversation_id: cid, user_id: myId, accepted: true },
                { conversation_id: cid, user_id: targetId, accepted: false },
              ]);
              partErr = error;
            } catch (e) { partErr = e; }
            if (partErr) {
              console.warn('conversation_participants insert failed with accepted flag', partErr);
              try {
                const { error: fbErr } = await supabase.from("conversation_participants").insert([
                  { conversation_id: cid, user_id: myId },
                  { conversation_id: cid, user_id: targetId },
                ]);
                if (fbErr) throw fbErr;
              } catch (e) {
                console.warn('conversation_participants fallback insert failed', e);
                results.push({ id: targetId, success: false, error: String(partErr?.message ?? partErr) });
                continue;
              }
            }
          }
          // create an explicit invite system message so recipient receives accept/abort prompt
          // don't store invite system messages; acceptance is tracked via conversation_participants.accepted

          // create message in conversation referencing the story; use a supported media_type
          const mediaUrl = story.mediaUri ?? storySnapshot.cover_url ?? null;
          const mediaType = story.mediaType === 'video' ? 'video' : 'image';
          const message = {
            conversation_id: cid,
            sender_id: myId,
            content: "",
            media_url: mediaUrl,
            media_type: mediaType,
            story_id: story.id,
          } as any;
          // insert and check result
          const { data: insertedMsg, error: insertErr } = await supabase.from("messages").insert(message).select('id').single();
          if (insertErr || !insertedMsg?.id) {
            console.warn("sendCallout message insert err", insertErr);
            results.push({ id: targetId, success: false, error: String(insertErr?.message ?? insertErr) });
            failCount++;
          } else {
            results.push({ id: targetId, success: true });
            successCount++;
          }
        } catch (err) {
          console.warn("sendCallout recipient err", err);
        }
      }
      // no-op: counters are tallied per recipient
    } catch (err) {
      console.warn("sendCallout err", err);
      results.push({ id: 'unknown', success: false, error: String(err) });
    } finally {
      setCalloutLoading(false);
      setCalloutModalVisible(false);
      setSelectedCalloutRecipients(new Set());
      // Build a concise status message showing successes and failures and one example error
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      let title = 'Callout status';
      let message = '';
      if (succeeded > 0) title = `Callout sent to ${succeeded}`;
      if (failed > 0) {
        const ex = results.find((r) => !r.success && r.error)?.error ?? 'Some recipients failed';
        message = failed === 1 ? `1 recipient failed: ${ex}` : `${failed} recipients failed. First error: ${ex}`;
      } else {
        if (succeeded > 0) message = 'Delivered to recipients.';
        else message = 'No callouts were delivered. Please try again.';
      }
      Alert.alert(title, message);
    }
  }, [profile?.id, story]);

  const tableConfig = useMemo<TableConfig | null>(() => {
    if (!story) return null;
    if (story.source === "business") {
      return {
        key: "business_story_id",
        likesTable: "business_story_likes",
        commentsTable: "business_story_comments",
      };
    }
    return {
      key: "story_id",
      likesTable: "story_likes",
      commentsTable: "story_comments",
    };
  }, [story]);

  useEffect(() => {
    setVideoPaused(false);
  }, [story?.id]);

  useEffect(() => {
    if (!commentSheetVisible || comments.length > 0) {
      firstCommentPulse.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(firstCommentPulse, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(firstCommentPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => {
      anim.stop();
      firstCommentPulse.setValue(1);
    };
  }, [commentSheetVisible, comments.length, firstCommentPulse]);

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      const prevLiked = !!commentLikedByMe[commentId];
      const prevCount = commentLikesMap[commentId] ?? 0;
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (!uid) throw new Error("Sign in required");
        const { data: existing } = await supabase
          .from(COMMENT_LIKES_TABLE)
          .select("id")
          .eq("comment_id", commentId)
          .eq("user_id", uid)
          .maybeSingle();
        setCommentLikedByMe((prev) => ({ ...prev, [commentId]: !prevLiked }));
        setCommentLikesMap((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] ?? 0) + (prevLiked ? -1 : 1)) }));
        if (prevLiked) {
          if (existing?.id) {
            await supabase.from(COMMENT_LIKES_TABLE).delete().eq("id", existing.id);
          } else {
            await supabase.from(COMMENT_LIKES_TABLE).delete().eq("comment_id", commentId).eq("user_id", uid);
          }
        } else {
          await supabase.from(COMMENT_LIKES_TABLE).insert({ comment_id: commentId, user_id: uid });
        }
        fetchCommentLikes([commentId]).catch(() => {});
      } catch (err) {
        console.warn("story preview toggle comment like error", err);
        Alert.alert("Error", "Could not update like");
        setCommentLikedByMe((prev) => ({ ...prev, [commentId]: prevLiked }));
        setCommentLikesMap((prev) => ({ ...prev, [commentId]: prevCount }));
      }
    },
    [commentLikedByMe, commentLikesMap, fetchCommentLikes]
  );

  const animateSheetTo = useCallback(
    (toValue: number, options?: { dismiss?: boolean }) => {
      Animated.timing(sheetY, {
        toValue,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        sheetValueRef.current = toValue;
        if (options?.dismiss || toValue === sheetClosed) {
          setCommentSheetVisible(false);
          setReplyTarget(null);
        }
      });
    },
    [sheetClosed, sheetY]
  );

  const handleOpenCommentsSheet = useCallback(() => {
    if (commentSheetVisible) {
      animateSheetTo(sheetOpenTop);
      return;
    }
    setCommentSheetVisible(true);
    sheetY.setValue(sheetClosed);
    requestAnimationFrame(() => {
      animateSheetTo(sheetOpenTop);
    });
    Haptics.selectionAsync().catch(() => {});
  }, [animateSheetTo, commentSheetVisible, sheetClosed, sheetOpenTop, sheetY]);

  const handleCloseCommentsSheet = useCallback(() => {
    animateSheetTo(sheetClosed, { dismiss: true });
  }, [animateSheetTo, sheetClosed]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          sheetDragStart.current = sheetValueRef.current;
          sheetY.stopAnimation();
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          const next = Math.max(sheetOpenTop, Math.min(sheetClosed, sheetDragStart.current + gestureState.dy));
          sheetY.setValue(next);
          sheetValueRef.current = next;
        },
        onPanResponderRelease: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
          const { dy, vy } = gestureState;
          const midpoint = (sheetOpenTop + sheetClosed) / 2;
          if (dy > 70 || vy > 0.8 || sheetValueRef.current > midpoint) {
            animateSheetTo(sheetClosed, { dismiss: true });
          } else {
            animateSheetTo(sheetOpenTop);
          }
        },
      }),
    [animateSheetTo, sheetClosed, sheetOpenTop, sheetY]
  );

  const handleToggleVideoPause = useCallback(() => {
    if (story?.mediaType !== "video") return;
    const next = !videoPaused;
    setVideoPaused(next);
    const ref = videoRef.current;
    if (ref) {
      if (next) {
        ref.pauseAsync?.().catch(() => {});
      } else {
        ref.playAsync?.().catch(() => {});
      }
    }
    Haptics.selectionAsync().catch(() => {});
  }, [story?.mediaType, videoPaused]);

  const handleShare = useCallback(() => {
    if (!story) return;
    const pieces = [] as string[];
    if (story.caption) pieces.push(story.caption);
    if (story.mediaUri) pieces.push(story.mediaUri);
    const message = pieces.length ? pieces.join("\n\n") : "Check this story on Velt";
    Share.share({ message }).catch(() => {
      Alert.alert("Share", "Unable to open share sheet right now.");
    });
  }, [story]);

  const runFetch = useCallback(async () => {
    if (!storyId && !businessStoryId) {
      setError("Missing story reference.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (storyId) {
        const { data, error: supaErr } = await supabase.from("stories").select(STORY_SELECT).eq("id", storyId).maybeSingle();
        if (supaErr) throw supaErr;
        if (!data) throw new Error("Story not found");
        const mediaUri = deriveMediaUrl(data) ?? null;
        
        // Get aspect ratio for images
        let aspectRatio: number | undefined;
        if (mediaUri && !data.media_type?.startsWith("video")) {
          aspectRatio = await prefetchImage(mediaUri);
        }
        
        setStory({
          id: data.id,
          source: "story",
          mediaType: data.media_type?.startsWith("video") ? "video" : "image",
          mediaUri,
          caption: data.caption ?? null,
          created_at: data.created_at,
          profile: Array.isArray(data.profiles) ? data.profiles[0] ?? null : data.profiles ?? null,
          aspectRatio,
          music_title: data.music_title ?? null,
          music_audio_url: data.music_audio_url ?? null,
          music_artist: data.music_artist ?? null,
          isHD: Boolean(data.is_hd),
        });
        setLoading(false);
        return;
      }

      if (businessStoryId) {
        const { data, error: supaErr } = await supabase.from("business_stories").select(BUSINESS_STORY_SELECT).eq("id", businessStoryId).maybeSingle();
        if (supaErr) throw supaErr;
        if (!data) throw new Error("Story not found");
        const mediaUri = buildCloudinaryUrl(data.media_url, data.media_type) ?? null;
        
        // Get aspect ratio for images
        let aspectRatio: number | undefined;
        if (mediaUri && data.media_type !== "video") {
          aspectRatio = await prefetchImage(mediaUri);
        }
        
        setStory({
          id: data.id,
          source: "business",
          mediaType: data.media_type === "video" ? "video" : "image",
          mediaUri,
          caption: data.caption ?? null,
          created_at: data.created_at,
          profile: Array.isArray(data.profiles) ? data.profiles[0] ?? null : data.profiles ?? null,
          aspectRatio,
          music_title: data.music_title ?? null,
          music_audio_url: data.music_audio_url ?? null,
          music_artist: data.music_artist ?? null,
          isHD: Boolean(data.is_hd),
        });
        setLoading(false);
      }
    } catch (err: any) {
      console.warn("story preview fetch failed", err);
      setError(err?.message ?? "Failed to load story.");
      setLoading(false);
    }
  }, [storyId, businessStoryId]);

  useEffect(() => {
    runFetch().catch(() => {});
  }, [runFetch]);

  // Fetch random stories for FlatList with full data
  const fetchRandomStories = useCallback(async (forceRefresh = false) => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) return;
    
    // Only fetch once unless forced
    if (hasFetchedQueueRef.current && !forceRefresh) return;
    
    isFetchingRef.current = true;
    
    try {
      const currentId = story?.id || storyId || businessStoryId;
      if (currentId) {
        viewedStoryIds.current.add(currentId);
      }
      
      // Fetch random stories from both tables with full data
      const [storiesRes, businessRes] = await Promise.all([
        supabase
          .from("stories")
          .select(STORY_SELECT)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("business_stories")
          .select(BUSINESS_STORY_SELECT)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      const loadedStories: LoadedStory[] = [];
      
      // Process regular stories
      for (const s of (storiesRes.data || [])) {
        if (s?.id && !viewedStoryIds.current.has(s.id)) {
          const mediaUri = deriveMediaUrl(s) ?? null;
          let aspectRatio: number | undefined;
          if (mediaUri && !s.media_type?.startsWith("video")) {
            aspectRatio = await prefetchImage(mediaUri);
          }
          loadedStories.push({
            id: s.id,
            source: "story",
            mediaType: s.media_type?.startsWith("video") ? "video" : "image",
            mediaUri,
            caption: s.caption ?? null,
            created_at: s.created_at,
            profile: Array.isArray(s.profiles) ? s.profiles[0] ?? null : s.profiles ?? null,
            aspectRatio,
            music_title: s.music_title ?? null,
            music_audio_url: s.music_audio_url ?? null,
            music_artist: s.music_artist ?? null,
            music_duration_ms: s.music_duration_ms ?? null,
            duration: s.duration ?? null,
            isHD: Boolean(s.is_hd),
          });
        }
      }
      
      // Process business stories
      for (const s of (businessRes.data || [])) {
        if (s?.id && !viewedStoryIds.current.has(s.id)) {
          const mediaUri = buildCloudinaryUrl(s.media_url, s.media_type) ?? null;
          let aspectRatio: number | undefined;
          if (mediaUri && s.media_type !== "video") {
            aspectRatio = await prefetchImage(mediaUri);
          }
          loadedStories.push({
            id: s.id,
            source: "business",
            mediaType: s.media_type === "video" ? "video" : "image",
            mediaUri,
            caption: s.caption ?? null,
            created_at: s.created_at,
            profile: Array.isArray(s.profiles) ? s.profiles[0] ?? null : s.profiles ?? null,
            aspectRatio,
            music_title: s.music_title ?? null,
            music_audio_url: s.music_audio_url ?? null,
            music_artist: s.music_artist ?? null,
            music_duration_ms: s.music_duration_ms ?? null,
            duration: s.duration ?? null,
          });
        }
      }

      // Shuffle the array for random order
      for (let i = loadedStories.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [loadedStories[i], loadedStories[j]] = [loadedStories[j], loadedStories[i]];
      }

      const queue = loadedStories.slice(0, 20);
      
      // Add current story at beginning if not already in queue
      if (story && !queue.find(s => s.id === story.id)) {
        queue.unshift(story);
      }
      
      setStoryQueue(queue);
      hasFetchedQueueRef.current = true;
    } catch (err) {
      console.warn("fetchRandomStories error", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [story?.id, storyId, businessStoryId, story]);

  // Load random stories queue on mount
  useEffect(() => {
    if (!loading && story) {
      fetchRandomStories();
    }
  }, [loading, story?.id]);

  // Prefetch engagement data for visible stories
  const prefetchEngagement = useCallback(async (storyIds: string[]) => {
    const freshIds = storyIds.filter(id => !prefetchedIdsRef.current.has(id));
    if (!freshIds.length) return;
    
    freshIds.forEach(id => prefetchedIdsRef.current.add(id));
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      
      for (const id of freshIds) {
        const storyItem = storyQueueRef.current.find(s => s.id === id);
        if (!storyItem) continue;
        
        const tableConfig = storyItem.source === "business"
          ? { key: "business_story_id" as const, likesTable: "business_story_likes" as const, commentsTable: "business_story_comments" as const }
          : { key: "story_id" as const, likesTable: "story_likes" as const, commentsTable: "story_comments" as const };
        
        const [likesRes, commentsRes] = await Promise.all([
          supabase.from(tableConfig.likesTable).select("id", { count: "exact" }).eq(tableConfig.key, id),
          supabase.from(tableConfig.commentsTable).select("id", { count: "exact" }).eq(tableConfig.key, id),
        ]);
        
        let isLiked = false;
        if (uid) {
          const { data: likedRow } = await supabase
            .from(tableConfig.likesTable)
            .select("id")
            .eq(tableConfig.key, id)
            .eq("user_id", uid)
            .maybeSingle();
          isLiked = !!likedRow;
        }
        
        setEngagementMap(prev => ({
          ...prev,
          [id]: {
            likes: likesRes.count ?? 0,
            comments: commentsRes.count ?? 0,
            isLiked,
          }
        }));
      }
    } catch (err) {
      console.warn("prefetchEngagement error", err);
    }
  }, []);

  // Handle viewable items change for FlatList
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0]?.item as LoadedStory;
      const visibleIndex = viewableItems[0]?.index ?? 0;
      
      if (visibleItem && visibleItem.id !== story?.id) {
        setStory(visibleItem);
        setCurrentVisibleIndex(visibleIndex);
        viewedStoryIds.current.add(visibleItem.id);
        
        // Reset engagement for the new story from cache
        const engagement = engagementMap[visibleItem.id];
        if (engagement) {
          setLikesCount(engagement.likes);
          setCommentsCount(engagement.comments);
          setIsLiked(engagement.isLiked);
        } else {
          setLikesCount(0);
          setCommentsCount(0);
          setIsLiked(false);
        }
        setComments([]);
        setVideoPaused(false);
      }
      
      // Prefetch engagement for nearby stories
      const queue = storyQueueRef.current;
      const nearbyIds = queue.slice(Math.max(0, visibleIndex - 2), visibleIndex + 5).map(s => s.id);
      prefetchEngagement(nearbyIds);
    }
  }, [story?.id, engagementMap, prefetchEngagement]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }).current;

  // Get item layout for FlatList optimization
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: WINDOW_H,
    offset: WINDOW_H * index,
    index,
  }), []);

  const loadEngagement = useCallback(async () => {
    if (!story || !tableConfig) return;
    setCommentsLoading(true);
    try {
      const column = tableConfig.key;
      const [{ count: likeCountValue }, userRes, commentsRes] = await Promise.all([
        supabase.from(tableConfig.likesTable).select("id", { count: "exact" }).eq(column, story.id),
        supabase.auth.getUser(),
        supabase
          .from(tableConfig.commentsTable)
          .select("id, user_id, content, created_at, parent_id, profiles(id, username, full_name, avatar_url)")
          .eq(column, story.id)
          .order("created_at", { ascending: true }),
      ]);

      setLikesCount(likeCountValue ?? 0);

      const uid = userRes.data?.user?.id ?? null;

      if (uid) {
        const { data: likedRow } = await supabase
          .from(tableConfig.likesTable)
          .select("id")
          .eq(column, story.id)
          .eq("user_id", uid)
          .maybeSingle();
        setIsLiked(!!likedRow);
      } else {
        setIsLiked(false);
      }

      if (commentsRes.error) throw commentsRes.error;
      const rows = (commentsRes.data ?? []) as StoryComment[];
      setComments(rows);
      setCommentsCount(rows.length);
      fetchCommentLikes(rows.map((row) => row.id).filter(Boolean)).catch(() => {});
    } catch (err) {
      console.warn("story preview engagement error", err);
      setComments([]);
      setCommentsCount(0);
    } finally {
      setCommentsLoading(false);
    }
  }, [story, tableConfig]);

  useEffect(() => {
    loadEngagement().catch(() => {});
  }, [loadEngagement]);

  useEffect(() => {
    const ref = videoRef.current;
    return () => {
      if (ref && typeof ref.unloadAsync === "function") {
        ref.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const handleToggleLike = useCallback(async () => {
    if (!story || !tableConfig) return;
    const column = tableConfig.key;
    Haptics.selectionAsync().catch(() => {});
    const prevLiked = isLiked;
    const prevCount = likesCount;
    const optimisticLiked = !prevLiked;
    setIsLiked(optimisticLiked);
    setLikesCount((count) => Math.max(0, (count ?? 0) + (optimisticLiked ? 1 : -1)));
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) throw new Error("Sign in required");
      if (optimisticLiked) {
        await supabase.from(tableConfig.likesTable).insert({ [column]: story.id, user_id: uid });
      } else {
        await supabase.from(tableConfig.likesTable).delete().eq(column, story.id).eq("user_id", uid);
      }
      const { count } = await supabase.from(tableConfig.likesTable).select("id", { count: "exact" }).eq(column, story.id);
      setLikesCount(count ?? 0);
    } catch (err) {
      console.warn("story preview like error", err);
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
      Alert.alert("Error", "Could not update like. Please try again.");
    }
  }, [isLiked, likesCount, story, tableConfig]);

  // Render a single story item for FlatList (Contents-screen style)
  const renderStoryItem = useCallback(({ item, index }: { item: LoadedStory; index: number }) => {
    const isActive = item.id === story?.id;
    const itemEngagement = engagementMap[item.id] || { likes: 0, comments: 0, isLiked: false };
    const displayName = item.profile?.full_name?.trim() || item.profile?.username || "Someone on Velt";
    const handleLabel = formatHandle(item.profile?.username);
    const timeLabel = item.created_at ? formatAgo(item.created_at) : "";
    const badgeLabel = item.source === "business" ? "Business" : "Story";

    // Video uses COVER, images use CONTAIN (like Contents screen)
    const videoResizeMode = ResizeMode.COVER;
    
    // Get or create fade animation for this item
    if (!mediaFadeAnims.current.has(item.id)) {
      mediaFadeAnims.current.set(item.id, new Animated.Value(0));
    }
    const fadeAnim = mediaFadeAnims.current.get(item.id)!;
    
    const isLoading = mediaLoadingMap[item.id];
    const isLoaded = mediaLoadedMap[item.id];
    
    const handleMediaLoadStart = () => {
      setMediaLoadingMap(m => ({ ...m, [item.id]: true }));
      setMediaLoadedMap(m => ({ ...m, [item.id]: false }));
    };
    
    const handleMediaLoadEnd = () => {
      setMediaLoadingMap(m => ({ ...m, [item.id]: false }));
      setMediaLoadedMap(m => ({ ...m, [item.id]: true }));
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    };

    return (
      <View style={{ width: WINDOW_W, height: WINDOW_H, backgroundColor: "#000" }}>
        {/* Skeleton loader */}
        {isLoading && (
          <View style={styles.skeletonOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        
        {/* Media layer with fade */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          {item.mediaType === "video" && item.mediaUri ? (
            <TouchableWithoutFeedback onPress={handleToggleVideoPause}>
              <View style={{ flex: 1 }}>
                <Video
                  source={{ uri: item.mediaUri }}
                  style={{ width: WINDOW_W, height: WINDOW_H }}
                  resizeMode={videoResizeMode}
                  shouldPlay={isActive && !videoPaused}
                  isLooping
                  isMuted={false}
                  useNativeControls={false}
                  onLoadStart={handleMediaLoadStart}
                  onLoad={handleMediaLoadEnd}
                />
                {/* Pause overlay */}
                {isActive && videoPaused && (
                  <View style={styles.playPauseOverlay}>
                    <Ionicons name="play" size={64} color="#fff" style={{ opacity: 0.8, textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 }} />
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          ) : item.mediaUri ? (
            <View style={{ width: WINDOW_W, height: WINDOW_H, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
              <Image
                source={{ uri: item.mediaUri }}
                style={{ width: WINDOW_W, height: WINDOW_H }}
                resizeMode="contain"
                onLoadStart={handleMediaLoadStart}
                onLoad={handleMediaLoadEnd}
                onError={handleMediaLoadEnd}
              />
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 8 }}>No media</Text>
            </View>
          )}
        </Animated.View>

        {/* Bottom-left user info overlay (Contents-style) */}
        <View style={[styles.bottomUserOverlay, { bottom: insets.bottom + 100 }]}>
          <View style={styles.userInfoRow}>
            {/* Badge pill */}
            <View style={styles.labelRow}>
              <View style={styles.labelPill}>
                <Ionicons name={item.source === "business" ? "briefcase" : "sparkles"} size={12} color="#E6EEF3" style={{ marginRight: 4 }} />
                <Text style={styles.labelPillText}>{badgeLabel}</Text>
              </View>
            </View>

            {/* Username */}
            <Text style={styles.userNameText} numberOfLines={1}>{displayName}</Text>
            
            {/* Handle & time */}
            <Text style={styles.userSubText}>{handleLabel} • {timeLabel}</Text>
            
            {/* Caption */}
            {item.caption ? (
              <Text style={styles.captionTextOverlay} numberOfLines={2}>{item.caption}</Text>
            ) : null}
            
            {/* Music indicator */}
            {item.music_title ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, alignSelf: 'flex-start' }}>
                <Ionicons name="musical-notes" size={14} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                  {item.music_title}{item.music_artist ? ` • ${item.music_artist}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Right action column (Contents-style) */}
        <View style={[styles.rightActionCol, { bottom: insets.bottom + 100 }]}>
          {/* Avatar */}
          <TouchableOpacity 
            style={styles.sideAvatarWrap}
            onPress={() => {
              if (item.profile?.id) {
                router.push({ pathname: "/profile/view/[id]", params: { id: item.profile.id } });
              }
            }}
            activeOpacity={0.85}
          >
            <View style={styles.avatarShadow}>
              <Image 
                source={{ uri: item.profile?.avatar_url || `https://api.dicebear.com/7.x/identicon/png?seed=${item.profile?.id || 'anon'}` }} 
                style={styles.sideAvatar} 
              />
            </View>
          </TouchableOpacity>

          {/* Action cluster */}
          <View style={styles.actionCluster}>
            {/* Like */}
            <TouchableOpacity
              onPress={handleToggleLike}
              activeOpacity={0.85}
              style={styles.actionItem}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={styles.iconBackdrop}>
                <Ionicons 
                  name="heart" 
                  size={36} 
                  color={isActive ? (isLiked ? "#FF4D6D" : "#fff") : (itemEngagement.isLiked ? "#FF4D6D" : "#fff")} 
                  style={{ textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}
                />
              </View>
              <Text style={styles.actionLabelSide}>{formatCount(isActive ? likesCount : itemEngagement.likes)}</Text>
            </TouchableOpacity>

            {/* Comments */}
            <TouchableOpacity 
              style={styles.actionItem} 
              onPress={handleOpenCommentsSheet} 
              activeOpacity={0.85} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.iconBackdrop}>
                <Ionicons name="chatbubble" size={36} color="#fff" style={{ textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }} />
              </View>
              <Text style={styles.actionLabelSide}>{formatCount(isActive ? commentsCount : itemEngagement.comments)}</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleShare}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.iconBackdrop}>
                <Ionicons name="share-social" size={34} color="#fff" style={{ textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }} />
              </View>
            </TouchableOpacity>

            {/* Callout */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={async () => { await loadCalloutCandidates(); setCalloutModalVisible(true); }}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.iconBackdrop}>
                <Ionicons name="megaphone" size={32} color="#fff" style={{ textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [story?.id, videoPaused, isLiked, likesCount, commentsCount, engagementMap, insets.bottom, handleToggleVideoPause, handleToggleLike, handleOpenCommentsSheet, handleShare, loadCalloutCandidates, router, mediaLoadingMap, mediaLoadedMap]);

  const handleSendComment = useCallback(async () => {
    if (!story || !tableConfig) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    const optimisticId = `optimistic-${Date.now()}`;
    const parentId = replyTarget?.commentId ?? null;
    try {
      Haptics.selectionAsync().catch(() => {});
      setCommentSending(true);
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) throw new Error("Sign in required");
      const optimisticProfile = profile
        ? {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }
        : {
            id: uid,
            username: null,
            full_name: "You",
            avatar_url: null,
          };
      const optimisticComment: StoryComment = {
        id: optimisticId,
        content: trimmed,
        created_at: new Date().toISOString(),
        parent_id: parentId ?? null,
        profiles: optimisticProfile,
        _optimistic: true,
      };
      setComments((prev) => [...prev, optimisticComment]);
      setCommentsCount((prev) => prev + 1);
      setCommentDraft("");
      setReplyTarget(null);
      Keyboard.dismiss();
      requestAnimationFrame(() => {
        commentsListRef.current?.scrollToEnd({ animated: true });
      });
      const payload: Record<string, any> = { user_id: uid, content: trimmed };
      payload[tableConfig.key] = story.id;
      if (parentId) payload.parent_id = parentId;
      const { data: inserted, error: insertErr } = await supabase
        .from(tableConfig.commentsTable)
        .insert(payload)
        .select("id, user_id, content, created_at, parent_id, profiles(id, username, full_name, avatar_url)")
        .single();
      if (insertErr) throw insertErr;
      const saved = inserted as StoryComment;
      setComments((prev) => prev.map((comment) => (comment.id === optimisticId ? saved : comment)));
      fetchCommentLikes([saved.id]).catch(() => {});
    } catch (err) {
      console.warn("story preview comment error", err);
      setComments((prev) => prev.map((comment) => (comment.id === optimisticId ? { ...comment, _failed: true, _optimistic: false } : comment)));
      setCommentsCount((prev) => Math.max(0, prev - 1));
      Alert.alert("Error", err instanceof Error ? err.message : "Could not post comment. Please try again.");
    } finally {
      setCommentSending(false);
    }
  }, [commentDraft, story, tableConfig, replyTarget, profile, fetchCommentLikes]);

  const handleRetryComment = useCallback(async (localId: string) => {
    if (!story || !tableConfig) return;
    const target = comments.find((c) => c.id === localId);
    if (!target) return;
    try {
      setComments((prev) => prev.map((comment) => (comment.id === localId ? { ...comment, _failed: false, _optimistic: true } : comment)));
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) throw new Error("Sign in required");
      const payload: Record<string, any> = { user_id: uid, content: target.content };
      payload[tableConfig.key] = story.id;
      if (target.parent_id) payload.parent_id = target.parent_id;
      const { data: inserted, error } = await supabase
        .from(tableConfig.commentsTable)
        .insert(payload)
        .select("id, user_id, content, created_at, parent_id, profiles(id, username, full_name, avatar_url)")
        .single();
      if (error) throw error;
      const saved = inserted as StoryComment;
      setComments((prev) => prev.map((comment) => (comment.id === localId ? saved : comment)));
      fetchCommentLikes([saved.id]).catch(() => {});
    } catch (err) {
      console.warn("story preview retry comment error", err);
      setComments((prev) => prev.map((comment) => (comment.id === localId ? { ...comment, _failed: true, _optimistic: false } : comment)));
      Alert.alert("Error", err instanceof Error ? err.message : "Retry failed. Please try again.");
    }
  }, [comments, story, tableConfig, fetchCommentLikes]);

  const groupedComments = useMemo(() => {
    const repliesMap: Record<string, StoryComment[]> = {};
    const roots: StoryComment[] = [];
    comments.forEach((comment) => {
      if (comment.parent_id) {
        if (!repliesMap[comment.parent_id]) repliesMap[comment.parent_id] = [];
        repliesMap[comment.parent_id].push(comment);
      } else {
        roots.push(comment);
      }
    });
    return { roots, repliesMap };
  }, [comments]);

  const handleSelectReplyTarget = useCallback((comment: StoryComment) => {
    setReplyTarget({
      commentId: comment.id,
      displayName: comment.profiles?.full_name ?? comment.profiles?.username ?? "member",
    });
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  }, []);

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  };

  const handleRetry = () => {
    Haptics.selectionAsync().catch(() => {});
    runFetch().catch(() => {});
  };

  const renderCommentsSheet = () => {
    if (!commentSheetVisible) return null;
    const { roots, repliesMap } = groupedComments;

    const renderThread = (comment: StoryComment, depth = 0): React.ReactElement => {
      const initials = getInitials(comment.profiles?.full_name, comment.profiles?.username);
      const likeCount = commentLikesMap[comment.id] ?? 0;
      const likedByMe = !!commentLikedByMe[comment.id];
      const childReplies = repliesMap[comment.id] ?? [];
      const repliesHidden = childReplies.length > 0 && hiddenReplyParents.has(comment.id);
      return (
        <View key={comment.id} style={{ marginLeft: depth ? depth * 16 : 0 }}>
          <View style={styles.sheetCommentRow}>
            {comment.profiles?.avatar_url ? (
              <Image source={{ uri: comment.profiles.avatar_url }} style={styles.sheetCommentAvatar} />
            ) : (
              <View style={[styles.sheetCommentAvatar, styles.commentAvatarFallback]}>
                <Text style={styles.sheetCommentInitials}>{initials}</Text>
              </View>
            )}
            <View style={[styles.sheetCommentBubble, { borderColor: "rgba(255,255,255,0.07)" }]}> 
              <View style={styles.sheetCommentHeader}>
                <Text style={styles.sheetCommentName} numberOfLines={1}>
                  {comment.profiles?.full_name ?? comment.profiles?.username ?? "Member"}
                </Text>
                <Text style={styles.sheetCommentTimestamp}>{formatAgo(comment.created_at)}</Text>
              </View>
              <Text style={styles.sheetCommentBody}>{comment.content}</Text>
              <View style={styles.sheetCommentFooter}>
                {/* show/hide replies control */}
                {childReplies.length > 0 ? (
                  <TouchableOpacity onPress={() => {
                    setHiddenReplyParents((prev) => {
                      const next = new Set(prev);
                      if (next.has(comment.id)) next.delete(comment.id);
                      else next.add(comment.id);
                      return next;
                    });
                  }} style={{ marginRight: 12 }}>
                    <Text style={{ color: '#93C5FD', fontWeight: '700' }}>{repliesHidden ? `Show ${childReplies.length} replies` : `Hide replies (${childReplies.length})`}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => handleSelectReplyTarget(comment)}>
                  <Text style={styles.replyLink}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentLikeButton} onPress={() => handleToggleCommentLike(comment.id)}>
                  <Ionicons name={likedByMe ? "heart" : "heart-outline"} size={16} color={likedByMe ? palette.accent : "#9AA4B2"} />
                  <Text style={styles.commentLikeCount}>{likeCount}</Text>
                </TouchableOpacity>
                {comment._optimistic ? (
                  <Text style={styles.commentSending}>Sending…</Text>
                ) : null}
                {comment._failed ? (
                  <TouchableOpacity onPress={() => handleRetryComment(comment.id)}>
                    <Text style={styles.commentRetry}>Retry</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          {!repliesHidden && childReplies.length
            ? childReplies.map((reply) => renderThread(reply, Math.min(depth + 1, 3)))
            : null}
        </View>
      );
    };

    return (
      <Modal visible={true} transparent animationType="none" onRequestClose={handleCloseCommentsSheet}>
        <TouchableWithoutFeedback onPress={handleCloseCommentsSheet}>
          <View style={styles.sheetOverlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.commentSheetContainer, { top: sheetY }]}> 
          <View style={styles.sheetHandleRow} {...sheetPanResponder.panHandlers}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetHeader}> 
            <Text style={styles.sheetTitle}>Comments</Text>
            <TouchableOpacity onPress={handleCloseCommentsSheet}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            style={styles.sheetKeyboardArea}
          >
            <View style={styles.sheetInputWrap}>
              {replyTarget ? (
                <View style={styles.replyContext}>
                  <Text style={styles.replyContextText}>Replying to {replyTarget.displayName ?? "member"}</Text>
                  <TouchableOpacity onPress={() => setReplyTarget(null)}>
                    <Text style={styles.replyCancel}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.sheetInputRow}>
                <TextInput
                  ref={commentInputRef}
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder={replyTarget ? `Reply to ${replyTarget.displayName ?? "member"}` : "Add a comment…"}
                  placeholderTextColor="#9AA4B2"
                  style={styles.sheetInput}
                  multiline
                />
                <TouchableOpacity
                  style={styles.sheetSendButton}
                  disabled={commentSending || !commentDraft.trim()}
                  onPress={handleSendComment}
                >
                  {commentSending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color={commentDraft.trim() ? palette.accent : "#9AA4B2"} />}
                </TouchableOpacity>
              </View>
            </View>
            {commentsLoading ? (
              <View style={styles.sheetLoader}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : roots.length ? (
              <FlatList
                ref={commentsListRef}
                data={roots}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderThread(item, 0)}
                contentContainerStyle={styles.sheetListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <Animated.View style={[styles.firstCommentCard, { transform: [{ scale: firstCommentPulse }] }]}>
                <View style={styles.firstCommentRow}>
                  <Ionicons name="chatbubble-ellipses" size={24} color="#fff" style={{ marginRight: 12 }} />
                  <View>
                    <Text style={styles.firstCommentTitle}>Be the first to comment</Text>
                    <Text style={styles.firstCommentSubtitle}>Share a reaction and spark the thread.</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.firstCommentButton} onPress={() => commentInputRef.current?.focus()}>
                  <Text style={styles.firstCommentButtonText}>Start a comment</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>
    );
  };

  // Callout modal render
  const renderCalloutModal = () => {
    if (!calloutModalVisible) return null;
      return (
        <Modal visible={calloutModalVisible} transparent animationType="none" onRequestClose={() => setCalloutModalVisible(false)}>
          <Animated.View style={[styles.bottomSheet, styles.calloutsSheet, { backgroundColor: colors.card, height: calloutExpanded ? Math.max(WINDOW_H - insets.top - 8, WINDOW_H * 0.6) : undefined }]}> 
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={[styles.sheetHandle, { marginVertical: 6 }]} />
              </View>
              <TouchableOpacity onPress={() => setCalloutExpanded((v) => !v)} style={{ padding: 8, marginRight: 6 }} accessibilityLabel={calloutExpanded ? 'Collapse' : 'Expand'}>
                <Ionicons name={calloutExpanded ? 'chevron-down' : 'chevron-up'} size={18} color={colors.subtext} />
              </TouchableOpacity>
            </View>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Send Callout</Text>
          <Text style={[styles.sheetDesc, { color: colors.subtext }]}>Pick followers or suggested recipients to share this story with.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 }}>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => { if (profile?.id) { const ids = (calloutCandidates || []).map((c) => c?.id).filter(Boolean) as string[]; setSelectedCalloutRecipients(new Set(ids)); } }}>
              <Text style={[styles.sheetText, { color: colors.text }]}>Select All Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => { setSelectedCalloutRecipients(new Set()); }}>
              <Text style={[styles.sheetText, { color: colors.text }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, paddingVertical: 6 }}>
            {calloutCandidates.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={{ color: colors.subtext, marginTop: 8 }}>No followers found.</Text>
              </View>
            ) : (
              <FlatList
                data={calloutCandidates}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}
                keyExtractor={(it) => String(it?.id ?? Math.random())}
                renderItem={({ item }) => {
                  const id = String(item?.id || "");
                  const display = item?.full_name || item?.username || "Unknown";
                  const selected = selectedCalloutRecipients.has(id);
                  return (
                    <Pressable onPress={() => toggleCalloutRecipient(id)} style={{ marginRight: 8, width: 80 }}>
                      {item?.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={{ width: 64, height: 64, borderRadius: 12 }} />
                      ) : (
                        <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: colors.text }}>{getInitials(item?.full_name, item?.username)}</Text>
                        </View>
                      )}
                      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, marginTop: 6 }}>{display}</Text>
                      <Text style={{ color: selected ? colors.accent : colors.subtext, fontWeight: '700' }}>{selected ? 'Selected' : ''}</Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingBottom: insets.bottom + 12 }}>
            <TouchableOpacity style={[styles.sheetBtn, { justifyContent: 'center', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]} onPress={() => setCalloutModalVisible(false)}>
              <Text style={[styles.sheetText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetBtn, { justifyContent: 'center', backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 }]} onPress={() => { const recips = Array.from(selectedCalloutRecipients); if (recips.length === 0) { // quick single recipient fallback: send to followers count = 0
                  Alert.alert('No recipients', 'Please select at least one recipient');
                  return; } sendCalloutToRecipients(recips); }}>
              <Text style={[styles.sheetText, { color: '#fff', fontWeight: '800' }]}>{calloutLoading ? 'Sending...' : 'Send Callout'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.statusSafeArea, { backgroundColor: palette.background }]}> 
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.statusHeader}> 
          <TouchableOpacity style={styles.overlayButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Story Preview</Text>
        </View>
        <View style={styles.centerBlock}>
          <ActivityIndicator color={palette.accent} size="small" />
          <Text style={[styles.statusText, { color: palette.subtext }]}>Loading story…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.statusSafeArea, { backgroundColor: palette.background }]}> 
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.statusHeader}> 
          <TouchableOpacity style={styles.overlayButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Story Preview</Text>
        </View>
        <View style={styles.centerBlock}>
          <Ionicons name="alert-circle" size={24} color={palette.accent} style={{ marginBottom: 8 }} />
          <Text style={[styles.statusText, { color: palette.text, textAlign: "center" }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { borderColor: palette.border }]} onPress={handleRetry}>
            <Ionicons name="refresh" size={16} color={palette.text} style={{ marginRight: 6 }} />
            <Text style={{ color: palette.text, fontWeight: "700" }}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!story) {
    return (
      <SafeAreaView style={[styles.statusSafeArea, { backgroundColor: palette.background }]}> 
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.statusHeader}> 
          <TouchableOpacity style={styles.overlayButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Story Preview</Text>
        </View>
        <View style={styles.centerBlock}>
          <Text style={[styles.statusText, { color: palette.text }]}>Story not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const primaryLabel = story?.profile?.full_name?.trim() || "Someone on Velt";
  const handleLabel = formatHandle(story?.profile?.username);
  const subtitle = story?.created_at ? `${handleLabel} • ${formatAgo(story.created_at)}` : handleLabel;
  const badgeLabel = story?.source === "business" ? "Business story" : "Creator story";
  const badgeIcon = story?.source === "business" ? "briefcase" : "sparkles";

  return (
    <View style={styles.fullScreen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* FlatList for vertical paging like Contents screen */}
      <FlatList
        ref={flatListRef}
        data={storyQueue}
        keyExtractor={(item) => item.id}
        renderItem={renderStoryItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={3}
        windowSize={5}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={() => {
          Haptics.selectionAsync().catch(() => {});
        }}
        ListEmptyComponent={
          <View style={[styles.mediaFallbackContained, { height: WINDOW_H }]}>
            <ActivityIndicator size="large" color={palette.accent} />
            <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 12 }}>Loading stories...</Text>
          </View>
        }
      />

      {/* Back button - minimal top overlay */}
      <View style={[styles.backButtonOverlay, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.overlayButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderCommentsSheet()}
      {renderCalloutModal()}
    </View>
  );
};

export default StoryPreviewScreen;

const styles = StyleSheet.create({
  statusSafeArea: {
    flex: 1,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  overlayButton: {
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 8,
    borderRadius: 999,
  },
  overlayTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
  centerBlock: {
    flex: 1,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 18,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  storyItemContainer: {
    width: WINDOW_W,
    height: WINDOW_H,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  swipeContainer: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  storyCardContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: WINDOW_W,
    backgroundColor: "#000",
  },
  adjacentStoryContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: WINDOW_W,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomOverlayTransparent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingHorizontal: 14,
    backgroundColor: "transparent",
  },
  bottomInfoSection: {
    marginBottom: 8,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 100,
  },
  headerBackButton: {
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
    color: "rgba(255,255,255,0.8)",
  },
  headerShareButton: {
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
  },
  mediaContainer: {
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 0,
  },
  mediaContained: {
    width: "100%",
    height: "100%",
  },
  playOverlayContained: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaFallbackContained: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaContainerFull: {
    backgroundColor: "#000",
    overflow: "hidden",
  },
  mediaCenteredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  mediaImage: {
    maxWidth: "100%",
    maxHeight: "100%",
  },
  swipeIndicators: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "none",
    paddingHorizontal: 4,
  },
  swipeIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  swipeIndicatorLeft: {
    marginLeft: 4,
  },
  swipeIndicatorRight: {
    marginRight: 4,
  },
  swipeIndicatorsVertical: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "none",
    paddingVertical: 80,
  },
  swipeIndicatorVertical: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  swipeIndicatorTop: {
    marginTop: 4,
  },
  swipeIndicatorBottom: {
    marginBottom: 4,
  },
  captionOverlay: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  captionOverlayText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
  backButtonOverlay: {
    position: "absolute",
    left: 12,
    zIndex: 100,
  },
  bottomSectionSolid: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000",
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  bottomUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  bottomUserInfo: {
    flex: 1,
    marginRight: 12,
  },
  bottomUserName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  bottomUserHandle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 1,
  },
  bottomBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bottomBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  bottomCaption: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  bottomActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  bottomActionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bottomActionLabel: {
    color: "#fff",
    fontSize: 11,
    marginTop: 2,
  },
  bottomActionsOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 100,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  actionButtonOverlay: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  actionLabelOverlay: {
    color: "#fff",
    fontSize: 12,
    marginTop: 2,
  },
  bottomActionsCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  actionButtonCompact: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  actionLabelCompact: {
    fontSize: 12,
    marginTop: 2,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  captionTextNew: {
    fontSize: 15,
    lineHeight: 22,
  },
  bottomActions: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  actionBarNew: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  actionButtonNew: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  actionLabelNew: {
    fontSize: 14,
    fontWeight: "600",
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  mediaElement: {
    width: WINDOW_W,
    height: WINDOW_H,
  },
  mediaTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  mediaFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overlayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  profileLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarLarge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  profileName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  profileMeta: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    marginTop: 2,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  captionText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 12,
  },
  actionLabel: {
    color: "#fff",
    fontWeight: "700",
    marginLeft: 6,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  commentSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WINDOW_H,
    backgroundColor: "#050505",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 16,
  },
  sheetHandleRow: {
    alignItems: "center",
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  sheetKeyboardArea: {
    flex: 1,
  },
  sheetInputWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  replyContext: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  replyContextText: {
    color: "#9AA4B2",
    fontSize: 13,
  },
  replyCancel: {
    color: "#F87171",
    fontWeight: "700",
  },
  sheetInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sheetInput: {
    flex: 1,
    minHeight: 32,
    maxHeight: 120,
    color: "#fff",
  },
  sheetSendButton: {
    marginLeft: 12,
  },
  sheetLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetListContent: {
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  sheetCommentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  sheetCommentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  sheetCommentInitials: {
    color: "#fff",
    fontWeight: "700",
  },
  sheetCommentBubble: {
    flex: 1,
    borderWidth: 0, // removed border for a cleaner look
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  sheetCommentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetCommentName: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    marginRight: 8,
  },
  sheetCommentTimestamp: {
    color: "#94A3B8",
    fontSize: 12,
  },
  sheetCommentBody: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
  sheetCommentFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
  },
  replyLink: {
    color: "#93C5FD",
    fontWeight: "700",
    marginRight: 18,
  },
  commentLikeButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 18,
  },
  commentLikeCount: {
    color: "#9AA4B2",
    marginLeft: 6,
    fontWeight: "600",
  },
  commentSending: {
    color: "#9AA4B2",
    marginRight: 12,
  },
  commentRetry: {
    color: "#F87171",
    fontWeight: "700",
  },
  firstCommentCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  firstCommentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  firstCommentTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  firstCommentSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  firstCommentButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2563EB",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  firstCommentButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  // bottom sheet/callout helper styles
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 16,
    backgroundColor: "#0b1220",
    minHeight: 180,
    maxHeight: Math.min(Math.round(WINDOW_H * 0.9), Math.round(WINDOW_W * 0.96), 900),
  },
  calloutsSheet: { minHeight: Math.max(420, Math.round(WINDOW_H * 0.48)), maxHeight: Math.min(Math.round(WINDOW_H * 0.92), Math.round(WINDOW_W * 0.96), 900), paddingBottom: 12 },
  /* re-using existing sheetHandle/sheetTitle defined above in the file */
  sheetDesc: { color: "rgba(255,255,255,0.8)", marginBottom: 12 },
  sheetBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, gap: 10 },
  sheetText: { fontSize: 18 },
  storyFlyerCardSmall: { width: Math.min(260, WINDOW_W * 0.38), aspectRatio: 9 / 16, borderRadius: 10, overflow: 'hidden', backgroundColor: 'transparent' },
  storyFlyerImageSmall: { width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end' },
  storyFlyerMetaSmall: { padding: 3, backgroundColor: 'transparent' },
  calloutTitleSmall: { fontSize: 10, fontWeight: '700' },
  calloutAuthorSmall: { fontSize: 8, marginTop: 1 },

  // Contents-screen style overlays
  playPauseOverlay: {
    position: "absolute",
    top: "40%",
    left: "40%",
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  bottomUserOverlay: {
    position: "absolute",
    left: 12,
    right: 110,
    zIndex: 900,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  userInfoRow: {
    backgroundColor: "transparent",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  labelPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  labelPillText: {
    color: "#E6EEF3",
    fontSize: 12,
    fontWeight: "700",
  },
  userNameText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 22,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  userSubText: {
    color: "#fff",
    fontSize: 15,
    marginTop: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  captionTextOverlay: {
    color: "#E6EEF3",
    marginTop: 8,
    fontSize: 17,
    maxWidth: "100%",
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  rightActionCol: {
    position: "absolute",
    right: 12,
    alignItems: "center",
    zIndex: 750,
    paddingVertical: 0,
  },
  sideAvatarWrap: {
    marginBottom: 8,
  },
  avatarShadow: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  sideAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  actionCluster: {
    marginTop: 4,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  actionItem: {
    marginVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBackdrop: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    backgroundColor: "transparent",
  },
  actionLabelSide: {
    fontSize: 13,
    marginTop: 2,
    padding: 0,
    margin: 0,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  skeletonOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
