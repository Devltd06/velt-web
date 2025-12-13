// Simple HD badge component
const HDBadge = () => (
  <View style={{
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 10,
    alignSelf: 'flex-end',
  }}>
    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>HD</Text>
  </View>
);
// app/(tabs)/Content.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TouchableWithoutFeedback,
  Platform,
  Animated,
  Easing,
  Modal,
  ImageBackground,
  PanResponder,
  ViewToken,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Share,
  Alert,
} from "react-native";
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import { withSafeRouter } from '@/lib/navigation';
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/lib/store/profile";
import { useLoadingStore } from "@/lib/store/loadingStore";
import { prefetchUserStories, prefetchCommercials, prefetchProfile } from '@/lib/store/prefetchStore';
import NotificationBanner from 'components/NotificationsBanner';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video, Audio, AVPlaybackStatus, ResizeMode } from "expo-av";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { downloadAsync as downloadAsyncHelper } from '@/utils/filesystem';
import { TapGestureHandler, State, PanGestureHandler, NativeViewGestureHandler } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomAlert } from '@/components/CustomAlert';
import { VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from "app/themes";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get("window"); // use window to match viewport used by FlatList
const CLOUDINARY_CLOUD = "dpejjmjxg";
const PLACEHOLDER_AVATAR =
  "https://api.dicebear.com/7.x/identicon/png?seed=anon&backgroundType=gradientLinear";

const FS_ANY = FileSystem as any;
const STORIES_CACHE_DIR = `${FS_ANY.cacheDirectory ?? FS_ANY.documentDirectory ?? ""}stories/`;
const STORY_SELECT_FIELDS = `id, user_id, media_url, media_urls, media_type, duration, created_at, expire_at, is_hd,
  profiles:profiles!stories_user_id_fkey(id, username, full_name, avatar_url),
  caption, media_urls, label, location, music_title, music_audio_url, music_artist, music_duration_ms`;
const BUSINESS_STORY_SELECT_FIELDS = `id, user_id, media_url, media_urls, media_type, duration, created_at, expire_at, is_hd,
  caption, label, location, visibility, music_title, music_audio_url, music_artist, music_duration_ms`;

// Default duration for images with music (15 seconds)
const IMAGE_WITH_MUSIC_DURATION_MS = 15000;

const ACTION_BAR_HEIGHT = 133;
const BOTTOM_OVERLAY_OFFSET = 40;
const TOP_OVERLAY_TOP = 0; // no top padding so media touches status bar
const MEDIA_TAB_CLEARANCE = 49; // keep media clear of bottom tab card
const CONTROLS_DROP = 48; // move controls further down (px)
const LEFT_INFO_DROP = -91; // extra drop specifically for left info block
const RIGHT_CONTROLS_DROP = -52; // extra drop for right controls
const PROGRESS_DROP = -84; // extra drop for progress bar independent from controls
const ENGAGEMENT_PREFETCH_LIMIT = 6;
// Hold-to-speed tuning
const SPEED_HOLD_DELAY_MS = 700; // ms required to hold before speed-up engages

// Loading UX tuning:
const LOAD_SHOW_DELAY_MS = 250; // don't show spinner for super short loads
const MIN_SPINNER_MS = 500; // keep spinner visible at least this long when shown
const LOAD_TIMEOUT_MS = 30000; // consider load failed after ~20s

const mediaCache = new Map<string, { localUri?: string }>();

async function ensureCacheDir() {
  try {
    const info = await FS_ANY.getInfoAsync(STORIES_CACHE_DIR);
    if (!info.exists) await FS_ANY.makeDirectoryAsync(STORIES_CACHE_DIR, { intermediates: true });
  } catch {}
}
function cacheFilenameForUrl(url: string) {
  return `${STORIES_CACHE_DIR}${encodeURIComponent(url)}`;
}
async function downloadToCache(url?: string | null) {
  if (!url) return null;
  try {
    if (mediaCache.has(url) && mediaCache.get(url)?.localUri) return mediaCache.get(url)!.localUri!;
    await ensureCacheDir();
    const dest = cacheFilenameForUrl(url);
    try {
      const info = await FS_ANY.getInfoAsync(dest);
      if (info.exists) {
        mediaCache.set(url, { localUri: info.uri });
        return info.uri;
      }
    } catch {}
    const res = await downloadAsyncHelper(url, dest);
    if (res && res.uri) {
      mediaCache.set(url, { localUri: res.uri });
      return res.uri;
    }
  } catch {
    // ignore
  }
  return null;
}
async function preloadMediaToCache(url?: string | null) {
  if (!url) return null;
  try {
    return await downloadToCache(url);
    } catch {
      return null;
    }
  }


/**
 * buildCloudinaryUrl:
 * - Return the raw stored rendition (no `f_auto,q_auto`), so we show the posted media as-is.
 * - Accepts Cloudinary public id or full URL.
 */
function buildCloudinaryUrl(publicIdOrUrl: unknown, mediaType: "image" | "video"): string | null {
  if (publicIdOrUrl == null) return null;
  try {
    if (typeof publicIdOrUrl === "string" && publicIdOrUrl.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(publicIdOrUrl as string);
        if (Array.isArray(parsed) && parsed.length > 0) return buildCloudinaryUrl(parsed[0], mediaType);
      } catch {}
    }
    const s = String(publicIdOrUrl).trim();
    if (!s) return null;
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    const resource = mediaType === "video" ? "video" : "image";
    // NOTE: no transformations — show original upload path
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/${resource}/upload/${s}`;
  } catch {
    return null;
  }
}

function timeAgoLabel(iso?: string | null) {
  if (!iso) return "";
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
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
function timeLeftLabel(expireIso?: string | null) {
  if (!expireIso) return "";
  try {
    const now = Date.now();
    const expire = new Date(expireIso).getTime();
    const diff = expire - now;
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 60) return `Expires in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Expires in ${hours}h`;
    const days = Math.ceil(hours / 24);
    return `Expires in ${days}d`;
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

/* ------------------------------------------------------------------
 * Reliable network hook - Debounces 'offline' state to prevent UI flashes.
 * Also manages showOfflineHeader state for 5-second display.
 * ------------------------------------------------------------------ */
function useReliableNetworkStatus(delayMs = 2000) {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [showOfflineHeader, setShowOfflineHeader] = useState<boolean>(false);
  const timeoutRef = useRef<any>(null);
  const offlineHeaderTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (state.isConnected) {
        setIsConnected(true);
        if (offlineHeaderTimeoutRef.current) {
          clearTimeout(offlineHeaderTimeoutRef.current);
          offlineHeaderTimeoutRef.current = null;
        }
        setShowOfflineHeader(false);
      } else {
        timeoutRef.current = setTimeout(() => {
          setIsConnected(false);
          setShowOfflineHeader(true);
          // Hide offline header after 5 seconds
          offlineHeaderTimeoutRef.current = setTimeout(() => {
            setShowOfflineHeader(false);
          }, 5000);
          timeoutRef.current = null;
        }, delayMs);
      }
    });

    NetInfo.fetch().then((s) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsConnected(!!s.isConnected);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (offlineHeaderTimeoutRef.current) {
        clearTimeout(offlineHeaderTimeoutRef.current);
        offlineHeaderTimeoutRef.current = null;
      }
      sub && sub();
    };
  }, [delayMs]);

  return { isConnected, showOfflineHeader };
}

/* types */
type ProfileShort = { id: string; username?: string | null; full_name?: string | null; avatar_url?: string | null };
type StoryItem = {
  id: string;
  user_id: string;
  raw_media_url?: string | null;
  media_url?: string; // primary fallback
  media_type: "image" | "video";
  media_urls?: string[]; // multiple images
  duration?: number | null;
  created_at?: string | null;
  profiles?: ProfileShort | null;
  caption?: string | null;
  expire_at?: string | null;
  label?: string | null;
  location?: string | null;
  partnership_avatars?: string[]; // built urls for partner avatars
  is_business?: boolean; // true if this is a business story
  music_title?: string | null;
  music_audio_url?: string | null;
  music_artist?: string | null;
  music_duration_ms?: number | null;
  isHD?: boolean;
};

type StoryShot = {
  id: string;
  story_id: string | null;
  sender_id: string;
  recipient_id: string;
  media_index?: number | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  caption?: string | null;
  created_at: string;
  viewed_at?: string | null;
  expires_at?: string | null;
  sender_profile?: ProfileShort | null;
  story?: StoryItem | null;
};

function mapStoryRowToItem(row: any): StoryItem | null {
  if (!row || !row.id) return null;
  const mediaType: "image" | "video" = row.media_type === "video" ? "video" : "image";

  let mediaUrls: string[] | undefined = undefined;
  if (row.media_urls) {
    try {
      let arr: any[] | null = null;
      if (Array.isArray(row.media_urls)) arr = row.media_urls;
      else if (typeof row.media_urls === "string") {
        const parsed = JSON.parse(row.media_urls);
        if (Array.isArray(parsed)) arr = parsed;
      }
      if (arr && arr.length) {
        const mapped = arr
          .map((m: any) => {
            if (!m) return null;
            try {
              const str = String(m).trim();
              if (!str) return null;
              if (str.startsWith("http://") || str.startsWith("https://")) return str;
              return buildCloudinaryUrl(str, "image");
            } catch {
              return null;
            }
          })
          .filter((u): u is string => !!u);
        if (mapped.length) mediaUrls = mapped;
      }
    } catch {
      mediaUrls = undefined;
    }
  }

  let built = "";
  if (row.raw_media_url && typeof row.raw_media_url === "string" && (row.raw_media_url.startsWith("http://") || row.raw_media_url.startsWith("https://"))) {
    built = row.raw_media_url;
  } else if (row.media_url && typeof row.media_url === "string") {
    built = buildCloudinaryUrl(row.media_url, mediaType) ?? String(row.media_url ?? "");
  }

  return {
    id: row.id,
    user_id: row.user_id,
    raw_media_url: row.media_url,
    media_url: built,
    media_type: mediaType,
    media_urls: mediaUrls,
    duration: row.duration,
    created_at: row.created_at,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null,
    caption: typeof row.caption !== "undefined" ? row.caption : null,
    expire_at: row.expire_at ?? null,
    label: typeof row.label !== "undefined" ? row.label : null,
    location: typeof row.location !== "undefined" ? row.location : null,
    partnership_avatars: [],
    music_title: row.music_title ?? null,
    music_audio_url: row.music_audio_url ?? null,
    music_artist: row.music_artist ?? null,
    music_duration_ms: row.music_duration_ms ?? null,
    // is_hd column from DB (snake_case) -> client uses isHD
    isHD: Boolean(row.is_hd),
  };
}

export default function ExplorePage() {
  const { profile, loadProfile } = useProfileStore?.() ?? ({ profile: null, loadProfile: async () => {} } as any);
  const router = withSafeRouter(useRouter());
  const { showAlert } = useCustomAlert();
  const routeParams = useLocalSearchParams<{ storyId?: string }>();
  const storyIdParamRaw = routeParams?.storyId;
  const normalizedStoryId = Array.isArray(storyIdParamRaw) ? storyIdParamRaw[0] ?? null : storyIdParamRaw ?? null;

  const [banner, setBanner] = useState<{ visible: boolean; title?: string; body?: string; onPress?: () => void }>({ visible: false });
  const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 12);

  useEffect(() => {
    if (!profile?.id) return;
    let mounted = true;
    const ch = supabase
      .channel(`contents-notifs:${profile.id}`)
      .on('postgres_changes', { schema: 'public', table: 'notifications', event: 'INSERT', filter: `recipient=eq.${profile.id}` }, (payload: any) => {
        if (!mounted) return;
        const n = payload?.new;
        if (!n) return;
        setBanner({
          visible: true,
          title: n.title ?? (n.type === 'message_received' ? 'New message' : 'Notification'),
          body: n.body ?? '',
          onPress: () => {
            setBanner((s) => ({ ...s, visible: false }));
            const p = n.data ?? {};
            if (p?.conversation_id) router.push(`/message/chat/${p.conversation_id}`);
            else if (p?.screen && p?.params) router.push({ pathname: p.screen, params: p.params });
          },
        });
      })
      .subscribe();

    return () => { mounted = false; try { ch.unsubscribe(); } catch {} };
  }, [profile?.id]);

  const isScreenFocused = useIsFocused();
  const { isConnected, showOfflineHeader } = useReliableNetworkStatus(2000);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingStories, setLoadingStories] = useState(false);

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [allStories, setAllStories] = useState<StoryItem[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [loadTimedOut, setLoadTimedOut] = useState<Record<string, boolean>>({});
  const [mediaLoadedMap, setMediaLoadedMap] = useState<Record<string, boolean>>({});
  const mediaFadeAnims = useRef<Map<string, Animated.Value>>(new Map());
  const videoRefs = useRef<Map<string, any>>(new Map());
  const lastReplayKeyRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList<StoryItem> | null>(null);
  const tabTransition = useRef(new Animated.Value(1)).current;
  const pendingRouteStoryIdRef = useRef<string | null>(null);
  const storyScrollAppliedRef = useRef<string | null>(null);
  const allStoriesRef = useRef<StoryItem[]>([]);
  const storiesRef = useRef<StoryItem[]>([]);

  // per-item media index map (used instead of hook in render)
  const [mediaIndexMap, setMediaIndexMap] = useState<Record<string, number>>({});

  // gesture refs per item
  const gestureRefs = useRef<Map<string, { doubleRef: any; singleRef: any }>>(new Map());

  // mediaAspectMap stores width/height
  const [mediaAspectMap, setMediaAspectMap] = useState<Record<string, number>>({});
  // Use a full-screen media canvas (fill the device window height)
  // This makes the media area occupy the full screen from the very top.
  const TARGET_MEDIA_H = WINDOW_H;
  const DEFAULT_MEDIA_H = TARGET_MEDIA_H;
  // keep media height stable — user requested no resizing
  const animatedMediaHeight = useRef(new Animated.Value(DEFAULT_MEDIA_H)).current;

  const [currentVisibleId, setCurrentVisibleId] = useState<string | null>(null);
  // debug instrumentation
  const [debugMediaHeight, setDebugMediaHeight] = useState<number>(DEFAULT_MEDIA_H);
  const [debugScrollOffset, setDebugScrollOffset] = useState<number>(0);
  const mediaHeightListenerRef = useRef<number | null>(null);

  // measured item height (used for FlatList paging) — default to target media height + reserved bottom
  const insets = useSafeAreaInsets();
  const reservedBottom = (insets?.bottom ?? 0) + MEDIA_TAB_CLEARANCE;
  const [measuredItemH, setMeasuredItemH] = useState<number>(TARGET_MEDIA_H + reservedBottom);
  const measuredItemHRef = useRef<number>(TARGET_MEDIA_H + reservedBottom);
  // small downward nudge to visually lower media inside the item — set to 0 so media anchors to the very top
  const MEDIA_NUDGE = 0; // px

  const [isFollowingState, setIsFollowingState] = useState<Record<string, boolean>>({});
  const [isLikedState, setIsLikedState] = useState<Record<string, boolean>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [viewsCountMap, setViewsCountMap] = useState<Record<string, number>>({});
  const [commentsCountMap, setCommentsCountMap] = useState<Record<string, number>>({});
  const [videoProgressMap, setVideoProgressMap] = useState<Record<string, { position: number; duration: number }>>({});
  const progressTrackWidthRef = useRef<Record<string, number>>({});
  const scrubWasPlayingRef = useRef<Record<string, boolean>>({});
  const scrubTargetRef = useRef<Record<string, number>>({});
  const isScrubbingRef = useRef<Record<string, boolean>>({});
  const prefetchedStoryIdsRef = useRef<Set<string>>(new Set());
  const speedHoldTimersRef = useRef<Record<string, number | null>>({});
  const speedHoldActiveRef = useRef<Record<string, boolean>>({});

  // Music playback state
  const musicSoundRef = useRef<InstanceType<typeof Audio.Sound> | null>(null);
  const currentMusicStoryIdRef = useRef<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  
  // Auto-advance timer for images with music
  const imageAutoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Progress tracking for images with music
  const [imageProgressMap, setImageProgressMap] = useState<Record<string, { position: number; duration: number }>>({});

  useEffect(() => {
    allStoriesRef.current = allStories;
  }, [allStories]);

  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  const updateVideoProgress = useCallback((storyId: string, positionMillis: number, durationMillis: number) => {
    setVideoProgressMap((prev) => {
      if (isScrubbingRef.current[storyId]) return prev;
      const prevEntry = prev[storyId];
      const safeDuration = typeof durationMillis === "number" && durationMillis > 0 ? durationMillis : prevEntry?.duration ?? 0;
      const clampedDuration = safeDuration > 0 ? safeDuration : 0;
      const incomingPosition = typeof positionMillis === "number" ? Math.max(0, positionMillis) : 0;
      const clampedPosition = clampedDuration > 0 ? Math.min(incomingPosition, clampedDuration) : incomingPosition;
      if (prevEntry) {
        const deltaPos = Math.abs(prevEntry.position - clampedPosition);
        const deltaDur = Math.abs(prevEntry.duration - clampedDuration);
        if (deltaPos < 25 && deltaDur < 25) return prev;
      }
      if (clampedDuration === 0 && incomingPosition === 0 && !prevEntry) return prev;
      return { ...prev, [storyId]: { position: clampedPosition, duration: clampedDuration } };
    });
  }, []);

  const prefetchEngagementForStories = useCallback(async (storyBatch: StoryItem[]) => {
    if (!storyBatch || !storyBatch.length) return;
    const freshStories = storyBatch.filter((s) => s?.id && !prefetchedStoryIdsRef.current.has(s.id));
    if (!freshStories.length) return;
    freshStories.forEach((s) => prefetchedStoryIdsRef.current.add(s.id));

    // Separate regular and business stories
    const regularStories = freshStories.filter((s) => !s.is_business);
    const businessStories = freshStories.filter((s) => s.is_business);
    const regularIds = regularStories.map((s) => s.id);
    const businessIds = businessStories.map((s) => s.id);

    try {
      let myId = profile?.id ?? null;
      if (!myId) {
        const { data: authData } = await supabase.auth.getUser();
        myId = authData?.user?.id ?? null;
      }

      if (myId) {
        // Fetch likes for regular stories
        if (regularIds.length) {
          const { data: likedRows } = await supabase
            .from("story_likes")
            .select("story_id")
            .eq("user_id", myId)
            .in("story_id", regularIds);
          const likedSet = new Set((likedRows || []).map((row: any) => row?.story_id).filter(Boolean));
          setIsLikedState((prev) => {
            const next = { ...prev };
            regularIds.forEach((id) => {
              next[id] = likedSet.has(id);
            });
            return next;
          });
        }

        // Fetch likes for business stories
        if (businessIds.length) {
          const { data: bizLikedRows } = await supabase
            .from("business_story_likes")
            .select("business_story_id")
            .eq("user_id", myId)
            .in("business_story_id", businessIds);
          const bizLikedSet = new Set((bizLikedRows || []).map((row: any) => row?.business_story_id).filter(Boolean));
          setIsLikedState((prev) => {
            const next = { ...prev };
            businessIds.forEach((id) => {
              next[id] = bizLikedSet.has(id);
            });
            return next;
          });
        }
      }

      const engagementTasks = freshStories.map(async (story) => {
        const id = story.id;
        const isBusiness = !!story.is_business;
        try {
          const [likes, comments] = await Promise.all([
            fetchLikesCount(id, isBusiness),
            fetchCommentsCount(id, isBusiness),
          ]);
          setLikesCountMap((prev) => {
            if (typeof prev[id] === "number") return prev;
            return { ...prev, [id]: likes };
          });
          setCommentsCountMap((prev) => {
            if (typeof prev[id] === "number") return prev;
            return { ...prev, [id]: comments };
          });
        } catch (err) {
          console.warn("prefetch engagement item err", err);
          prefetchedStoryIdsRef.current.delete(id);
        }
      });

      await Promise.allSettled(engagementTasks);
    } catch (err) {
      console.warn("prefetchEngagementForStories err", err);
      freshStories.forEach((s) => prefetchedStoryIdsRef.current.delete(s.id));
    }
  }, [fetchLikesCount, fetchCommentsCount, profile?.id]);

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

  const startMusicPlayback = useCallback(async (storyId: string, audioUrl: string, videoDurationMs?: number | null, musicDurationMs?: number | null) => {
    try {
      // If already playing for this story, skip
      if (currentMusicStoryIdRef.current === storyId && musicSoundRef.current) {
        return;
      }
      // Stop any existing playback
      await stopMusicPlayback();
      
      // Create and play the new sound
      // For videos, loop music to match video duration
      // Music will loop naturally if video is longer than music
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, isLooping: true, volume: 0.7 }
      );
      musicSoundRef.current = sound;
      currentMusicStoryIdRef.current = storyId;
      setMusicPlaying(true);
      
      // If we have video duration and it's shorter than music, we could trim
      // But for now, music loops with video which is the standard behavior
    } catch (err) {
      console.warn("startMusicPlayback error", err);
      setMusicPlaying(false);
    }
  }, [stopMusicPlayback]);

  // fetch error message (fix TS)
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);

  // comment-specific states
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ commentId: string; displayName?: string } | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [fullExpandedComments, setFullExpandedComments] = useState<Record<string, boolean>>({});
  const [commentLikesMap, setCommentLikesMap] = useState<Record<string, number>>({});
  const [commentLikedByMe, setCommentLikedByMe] = useState<Record<string, boolean>>({});

  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Loading store for global loading indicator in tabs
  const setContentLoading = useLoadingStore((s) => s.setContentLoading);
  
  // Sync loading state to global store for tab bar glow effect
  const isAnyContentLoading = loadingInitial || loadingStories || Object.values(loadingMap).some(Boolean) || loadingViewers;
  useEffect(() => {
    setContentLoading(isAnyContentLoading);
    return () => setContentLoading(false);
  }, [isAnyContentLoading, setContentLoading]);

  const [selectedTab, setSelectedTab] = useState<"ForYou" | "Following">("ForYou");
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  // loadTimers: per-item timers
  const loadTimers = useRef<Map<string, { showTimer?: number; timeoutTimer?: number; minTimer?: number }>>(new Map());
  // auto retry tracker for timed-out media items
  const autoRetryRef = useRef<Set<string>>(new Set());

  // Video status map: isLoaded, isBuffering, isPlaying
  const [videoStatusMap, setVideoStatusMap] = useState<Record<string, { isLoaded?: boolean; isBuffering?: boolean; isPlaying?: boolean }>>({});

  // paused map: user-intent paused state
  const [videoPausedMap, setVideoPausedMap] = useState<Record<string, boolean>>({});

  const SHEET_CLOSED = WINDOW_H;
  const SHEET_OPEN_TOP = Math.round(WINDOW_H * 0.22); // taller comment sheet
  const sheetY = useRef(new Animated.Value(SHEET_CLOSED)).current;
  const sheetYRef = useRef<number>(SHEET_CLOSED);
  const startSheetDragY = useRef<number>(sheetYRef.current);
  const commentOverlayFade = useRef(new Animated.Value(0)).current; // overlay fade for comment sheet

  const VIEWERS_SHEET_CLOSED = WINDOW_H;
  const VIEWERS_SHEET_OPEN_TOP = Math.round(WINDOW_H * 0.56);
  const viewersY = useRef(new Animated.Value(VIEWERS_SHEET_CLOSED)).current;
  const viewersYRef = useRef<number>(VIEWERS_SHEET_CLOSED);
  const startViewersDragY = useRef<number>(viewersYRef.current);

  // callout modal (replacement for old shoot flow)
  const [calloutModalVisible, setCalloutModalVisible] = useState(false);
  const [shootTarget, setShootTarget] = useState<StoryItem | null>(null); // reuse target name for the selected story
  const [calloutCandidates, setCalloutCandidates] = useState<ProfileShort[]>([]);
  const [selectedCalloutRecipients, setSelectedCalloutRecipients] = useState<Set<string>>(new Set());
  const [calloutLoading, setCalloutLoading] = useState(false);
  const [calloutExpanded, setCalloutExpanded] = useState(false);
  const [calloutSearchQuery, setCalloutSearchQuery] = useState('');

  // legacy shoot sheet state (compat)
  const [shootSheetVisible, setShootSheetVisible] = useState(false);
  const [shootActiveTab, setShootActiveTab] = useState<"following" | "suggestions">("following");
  const [shootFollowing, setShootFollowing] = useState<ProfileShort[]>([]);
  const [shootSuggestions, setShootSuggestions] = useState<ProfileShort[]>([]);
  const [shootSelected, setShootSelected] = useState<Set<string>>(new Set());
  const [shootSending, setShootSending] = useState(false);

  const SHOOT_SHEET_CLOSED = WINDOW_H;
  const SHOOT_SHEET_OPEN_TOP = Math.round(WINDOW_H * 0.36);
  const shootY = useRef(new Animated.Value(SHOOT_SHEET_CLOSED)).current;
  const shootYRef = useRef<number>(SHOOT_SHEET_CLOSED);
  const startShootDragY = useRef<number>(shootYRef.current);

  // location sheet state (new bottom sheet)
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);
  const [locationSheetText, setLocationSheetText] = useState<string | null>(null);
  const locationY = useRef(new Animated.Value(WINDOW_H)).current;

  // first viewer toast
  const [firstViewerToast, setFirstViewerToast] = useState<string | null>(null);
  const firstViewerAnim = useRef(new Animated.Value(0)).current;

  // first comment pulse
  const firstCommentPulse = useRef(new Animated.Value(1)).current;

  // Enhanced sheet animation with spring physics and overlay fade
  function animateSheetTo(toValue: number, cb?: () => void) {
    const isOpening = toValue === SHEET_OPEN_TOP;
    Animated.parallel([
      Animated.spring(sheetY, {
        toValue,
        useNativeDriver: false,
        friction: 10,
        tension: 65,
      }),
      Animated.timing(commentOverlayFade, {
        toValue: isOpening ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      sheetYRef.current = toValue;
      if (cb) cb();
    });
  }
  function animateViewersTo(toValue: number, cb?: () => void) {
    Animated.timing(viewersY, { toValue, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      viewersYRef.current = toValue;
      if (cb) cb();
    });
  }
  function animateShootTo(toValue: number, cb?: () => void) {
    Animated.timing(shootY, { toValue, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      shootYRef.current = toValue;
      if (cb) cb();
    });
  }

  // location sheet animation helper
  function openLocationSheet(text: string) {
    setLocationSheetText(text);
    setLocationSheetVisible(true);
    locationY.setValue(WINDOW_H);
    Animated.timing(locationY, { toValue: WINDOW_H - Math.round(WINDOW_H * 0.36), duration: 220, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }
  function closeLocationSheet() {
    Animated.timing(locationY, { toValue: WINDOW_H, duration: 200, useNativeDriver: false, easing: Easing.in(Easing.cubic) }).start(() => {
      setLocationSheetVisible(false);
      setLocationSheetText(null);
    });
  }

  // first viewer toast show
  function showFirstViewerToast(msg: string) {
    setFirstViewerToast(msg);
    firstViewerAnim.setValue(0);
    Animated.sequence([
      Animated.timing(firstViewerAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.delay(1600),
      Animated.timing(firstViewerAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start(() => setFirstViewerToast(null));
  }

  // first comment pulse start/stop
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (commentSheetVisible && commentsList.length === 0) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(firstCommentPulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(firstCommentPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      firstCommentPulse.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [commentSheetVisible, commentsList.length]);

  // ====== IMPORTANT FIX ======
  // Only claim pan responder when it's a vertical drag (not on taps).
  // track whether comment list is scrolling, and its scroll offset
  const listDraggingRef = useRef(false);
  const commentScrollOffsetRef = useRef(0);
  const sheetPanRef = useRef<any>(null);
  const commentsNativeRef = useRef<any>(null);

  // Enhanced panResponder for comment sheet with spring physics
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Allow drag to dismiss when at top of list or dragging down significantly
        const atTop = commentScrollOffsetRef.current <= 0;
        const isDraggingDown = gestureState.dy > 0;
        // Capture gesture if at top of list and dragging down, or if dragging down significantly
        if (atTop && isDraggingDown && Math.abs(gestureState.dy) > 8) return true;
        if (!atTop && Math.abs(gestureState.dy) > 20 && isDraggingDown) return true;
        return false;
      },
      onPanResponderGrant: () => {
        startSheetDragY.current = sheetYRef.current;
        sheetY.stopAnimation();
        commentOverlayFade.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = Math.max(SHEET_OPEN_TOP, Math.min(SHEET_CLOSED, startSheetDragY.current + gestureState.dy));
        sheetY.setValue(newY);
        // Update overlay opacity based on sheet position
        const progress = 1 - (newY - SHEET_OPEN_TOP) / (SHEET_CLOSED - SHEET_OPEN_TOP);
        commentOverlayFade.setValue(Math.max(0, Math.min(1, progress)));
      },
      onPanResponderRelease: (_, gestureState) => {
        const vy = gestureState.vy;
        const dy = gestureState.dy;
        const currentY = startSheetDragY.current + gestureState.dy;
        const dismissThreshold = (SHEET_CLOSED - SHEET_OPEN_TOP) * 0.25; // 25% threshold
        // Dismiss if dragging down with velocity > 0.8 or past 25% threshold
        if (dy > dismissThreshold || vy > 0.8) {
          Animated.parallel([
            Animated.spring(sheetY, {
              toValue: SHEET_CLOSED,
              useNativeDriver: false,
              friction: 8,
              tension: 65,
            }),
            Animated.timing(commentOverlayFade, {
              toValue: 0,
              duration: 200,
              useNativeDriver: false,
            }),
          ]).start(() => {
            setCommentSheetVisible(false);
            setReplyTarget(null);
          });
        } else {
          Animated.parallel([
            Animated.spring(sheetY, {
              toValue: SHEET_OPEN_TOP,
              useNativeDriver: false,
              friction: 8,
              tension: 65,
            }),
            Animated.timing(commentOverlayFade, {
              toValue: 1,
              duration: 150,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // viewers sheet: same behavior — only on vertical drags
  const panResponderViewers = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        startViewersDragY.current = viewersYRef.current;
        viewersY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = Math.max(VIEWERS_SHEET_OPEN_TOP, Math.min(VIEWERS_SHEET_CLOSED, startViewersDragY.current + gestureState.dy));
        viewersY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const vy = gestureState.vy;
        const dy = gestureState.dy;
        const finalY = viewersYRef.current;
        const midPoint = (VIEWERS_SHEET_OPEN_TOP + VIEWERS_SHEET_CLOSED) / 2;
        if (dy < -50 || vy < -0.5 || (vy < 0 && finalY < midPoint)) {
          Animated.spring(viewersY, {
            toValue: VIEWERS_SHEET_OPEN_TOP,
            useNativeDriver: false,
            friction: 10,
            tension: 80,
          }).start();
        } else {
          Animated.spring(viewersY, {
            toValue: VIEWERS_SHEET_CLOSED,
            useNativeDriver: false,
            friction: 10,
            tension: 80,
          }).start(() => setViewersModalVisible(false));
        }
      },
    })
  ).current;

  // shoot sheet: same
  const panResponderShoot = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        startShootDragY.current = shootYRef.current;
        shootY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = Math.max(SHOOT_SHEET_OPEN_TOP, Math.min(SHOOT_SHEET_CLOSED, startShootDragY.current + gestureState.dy));
        shootY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const vy = gestureState.vy;
        const dy = gestureState.dy;
        const finalY = shootYRef.current;
        const midPoint = (SHOOT_SHEET_OPEN_TOP + SHOOT_SHEET_CLOSED) / 2;
        if (dy < -50 || vy < -0.5 || (vy < 0 && finalY < midPoint)) {
          Animated.spring(shootY, {
            toValue: SHOOT_SHEET_OPEN_TOP,
            useNativeDriver: false,
            friction: 10,
            tension: 80,
          }).start();
        } else {
          Animated.spring(shootY, {
            toValue: SHOOT_SHEET_CLOSED,
            useNativeDriver: false,
            friction: 10,
            tension: 80,
          }).start(() => setShootSheetVisible(false));
        }
      },
    })
  ).current;

  // Cache for prefetched comments per story
  const prefetchedCommentsRef = useRef<Map<string, any[]>>(new Map());
  const backgroundRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prefetch comments for visible and nearby stories
  const prefetchComments = useCallback(async (storyIds: string[]) => {
    try {
      for (const storyId of storyIds) {
        if (prefetchedCommentsRef.current.has(storyId)) continue;
        const activeStory = allStoriesRef.current.find((s) => s.id === storyId);
        const isBusiness = activeStory?.is_business ?? false;
        const tableName = isBusiness ? "business_story_comments" : "story_comments";
        const idColumn = isBusiness ? "business_story_id" : "story_id";
        
        const res = await supabase
          .from(tableName)
          .select(`id, ${idColumn}, user_id, content, created_at, parent_id`)
          .eq(idColumn, storyId)
          .order("created_at", { ascending: true });
        const rows = (res as any).data || [];
        
        const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
        let profilesMap: Record<string, any> = {};
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", userIds as string[]);
          (profiles || []).forEach((p: any) => {
            profilesMap[p.id] = p;
          });
        }
        
        const rowsWithProfiles = rows.map((r: any) => ({
          ...r,
          profiles: profilesMap[r.user_id] || null,
        }));
        
        prefetchedCommentsRef.current.set(storyId, rowsWithProfiles);
        setCommentsCountMap((m) => ({ ...m, [storyId]: rowsWithProfiles.length }));
      }
    } catch (err) {
      console.warn("prefetchComments err", err);
    }
  }, []);

  // Background refresh: fetch new posts and append at bottom
  const backgroundRefresh = useCallback(async () => {
    if (!isScreenFocused || !isConnected) return;
    try {
      const existingIds = new Set(allStoriesRef.current.map((s) => s.id));
      const nowMs = Date.now();
      
      const bizRes = await supabase
        .from("business_stories")
        .select(BUSINESS_STORY_SELECT_FIELDS)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if ((bizRes as any).error) return;
      const bizData = (bizRes as any).data || [];
      const activeBiz = bizData.filter((r: any) => {
        if (!r.expire_at) return true;
        try {
          return new Date(r.expire_at).getTime() > nowMs;
        } catch { return true; }
      });

      // Find new stories not in current list
      const newStories = activeBiz.filter((r: any) => !existingIds.has(r.id));
      if (!newStories.length) return;

      // Fetch profiles for new stories
      const bizUserIds = [...new Set(newStories.map((r: any) => r.user_id).filter(Boolean))] as string[];
      let bizProfiles: Record<string, ProfileShort> = {};
      if (bizUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", bizUserIds);
        (profilesData || []).forEach((p: any) => {
          if (p.id) bizProfiles[p.id] = p;
        });
      }

      const newItems: StoryItem[] = newStories.map((r: any) => {
        const mediaType: "image" | "video" = r.media_type === "video" ? "video" : "image";
        const built = buildCloudinaryUrl(r.media_url, mediaType) ?? (typeof r.media_url === "string" ? r.media_url : "");

        let mediaUrls: string[] | undefined = undefined;
        if (r.media_urls) {
          try {
            let arr: any[] | null = null;
            if (Array.isArray(r.media_urls)) arr = r.media_urls;
            else if (typeof r.media_urls === "string") {
              const parsed = JSON.parse(r.media_urls);
              if (Array.isArray(parsed)) arr = parsed;
            }
            if (arr && arr.length) {
              const mappedUrls = arr
                .map((m: any) => {
                  if (!m) return null;
                  try {
                    const str = String(m).trim();
                    if (!str) return null;
                    if (str.startsWith("http://") || str.startsWith("https://")) return str;
                    return buildCloudinaryUrl(str, "image");
                  } catch { return null; }
                })
                .filter((u): u is string => !!u);
              if (mappedUrls.length) mediaUrls = mappedUrls;
            }
          } catch { mediaUrls = undefined; }
        }

        return {
          id: r.id,
          user_id: r.user_id,
          raw_media_url: r.media_url,
          media_url: built,
          media_type: mediaType,
          media_urls: mediaUrls,
          duration: r.duration ?? null,
          created_at: r.created_at,
          profiles: bizProfiles[r.user_id] ?? null,
          caption: r.caption ?? null,
          expire_at: r.expire_at ?? null,
          label: r.label ?? null,
          location: r.location ?? null,
          partnership_avatars: [],
          is_business: true,
          isHD: Boolean(r.is_hd),
        } as StoryItem;
      });

      // Append new stories at the END so user scrolls up to find them
      setAllStories((prev) => [...prev, ...newItems]);
      setStories((prev) => [...prev, ...newItems]);

      // Prefetch engagement for new stories
      prefetchEngagementForStories(newItems);
    } catch (err) {
      console.warn("backgroundRefresh err", err);
    }
  }, [isScreenFocused, isConnected, prefetchEngagementForStories]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id ?? null;
        if (uid && loadProfile) await loadProfile(uid);
      } catch {}
      await loadStories();
    })();

    // Start background refresh every 5 seconds
    backgroundRefreshRef.current = setInterval(() => {
      backgroundRefresh();
    }, 5000);

    return () => {
      loadTimers.current.forEach((t) => {
        if (t.showTimer) clearTimeout(t.showTimer as any);
        if (t.timeoutTimer) clearTimeout(t.timeoutTimer as any);
        if (t.minTimer) clearTimeout(t.minTimer as any);
      });
      loadTimers.current.clear();
      if (backgroundRefreshRef.current) {
        clearInterval(backgroundRefreshRef.current);
        backgroundRefreshRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const nextId = normalizedStoryId ? String(normalizedStoryId) : null;
    pendingRouteStoryIdRef.current = nextId;
    if (nextId) {
      storyScrollAppliedRef.current = null;
    }
  }, [normalizedStoryId]);

  const prioritizeStory = useCallback((list: StoryItem[], anchorId: string | null) => {
    if (!anchorId) return list;
    const idx = list.findIndex((s) => s.id === anchorId);
    if (idx <= 0) return list;
    const copy = [...list];
    const [anchor] = copy.splice(idx, 1);
    copy.unshift(anchor);
    return copy;
  }, []);

  const selectTab = useCallback(
    (nextTab: "ForYou" | "Following", options?: { force?: boolean }) => {
      if (!options?.force && selectedTab === nextTab) return;
      try {
        tabTransition.stopAnimation();
      } catch {}
      Animated.timing(tabTransition, {
        toValue: 0.35,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        Animated.timing(tabTransition, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
      setSelectedTab(nextTab);
    },
    [selectedTab, tabTransition]
  );

  const ensureStoryById = useCallback(async (storyId: string): Promise<StoryItem | null> => {
    if (!storyId) return null;
    const existing = allStoriesRef.current.find((s) => s.id === storyId);
    if (existing) return existing;
    try {
      const { data, error } = await supabase
        .from("stories")
        .select(STORY_SELECT_FIELDS)
        .eq("is_deleted", false)
        .eq("id", storyId)
        .maybeSingle();
      if (error || !data) return null;
      const nowIso = new Date().toISOString();
      if (data.expire_at && new Date(data.expire_at).toISOString() <= nowIso) return null;
      const mapped = mapStoryRowToItem(data);
      if (!mapped) return null;
      setAllStories((prev) => {
        if (prev.some((s) => s.id === mapped.id)) return prev;
        return [mapped, ...prev];
      });
      return mapped;
    } catch (err) {
      console.warn("ensureStoryById err", err);
      return null;
    }
  }, []);

  useEffect(() => {
    try {
      const anchorId = pendingRouteStoryIdRef.current;
      if (selectedTab === "Following") {
        const filtered = allStories.filter((s) => followingIds.includes(String(s.user_id)));
        // Don't fall back to allStories - show empty state if user follows nobody
        const base = filtered;
        const arranged = anchorId ? prioritizeStory(base, anchorId) : base;
        setStories(arranged);
        if (arranged.length) setTimeout(() => setCurrentVisibleId(arranged[0].id), 120);
      } else {
        const base = [...allStories];
        let anchorStory: StoryItem | null = null;
        if (anchorId) {
          const idx = base.findIndex((s) => s.id === anchorId);
          if (idx >= 0) {
            anchorStory = base.splice(idx, 1)[0];
          }
        }
        for (let i = base.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [base[i], base[j]] = [base[j], base[i]];
        }
        const finalList = anchorStory ? [anchorStory, ...base] : base;
        setStories(finalList);
        if (finalList.length) setTimeout(() => setCurrentVisibleId(finalList[0].id), 120);
      }
    } catch {}
  }, [selectedTab, allStories, followingIds, prioritizeStory]);

  useEffect(() => {
    if (!stories.length) return;
    const initial = stories.slice(0, ENGAGEMENT_PREFETCH_LIMIT);
    prefetchEngagementForStories(initial);
  }, [stories, prefetchEngagementForStories]);

  useEffect(() => {
    const targetId = pendingRouteStoryIdRef.current;
    if (!targetId || loadingInitial) return;
    let cancelled = false;

    (async () => {
      let story = allStoriesRef.current.find((s) => s.id === targetId) ?? null;
      if (!story) {
        story = await ensureStoryById(targetId);
        if (!story || cancelled) return;
      }

      const followed = followingIds.includes(String(story.user_id));
      if (!followed && selectedTab !== "ForYou") {
        selectTab("ForYou", { force: true });
      }

      const targetStory = story;
      setAllStories((prev) => {
        const idx = prev.findIndex((s) => s.id === targetId);
        if (idx === -1 && targetStory) return [targetStory, ...prev];
        if (idx <= 0) return prev;
        const next = [...prev];
        const [anchor] = next.splice(idx, 1);
        next.unshift(anchor);
        return next;
      });

      prefetchedStoryIdsRef.current.delete(targetId);
      if (targetStory) {
        prefetchEngagementForStories([targetStory]).catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadingInitial, followingIds, selectedTab, ensureStoryById, prefetchEngagementForStories, selectTab]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
    if (!viewableItems?.length) return;
    const topStory = (viewableItems[0]?.item ?? null) as StoryItem | null;
    if (topStory?.id && topStory.id !== currentVisibleId) {
      setCurrentVisibleId(topStory.id);
    }

    const indexes = viewableItems
      .map((v) => (typeof v.index === "number" ? v.index : null))
      .filter((idx): idx is number => idx !== null);
    if (!indexes.length) return;
    const minIndex = Math.max(0, Math.min(...indexes));
    const maxIndex = Math.min(stories.length - 1, Math.max(...indexes) + ENGAGEMENT_PREFETCH_LIMIT);
    const storySlice = stories.slice(minIndex, maxIndex + 1);
    if (storySlice.length) prefetchEngagementForStories(storySlice);
  }, [currentVisibleId, stories, prefetchEngagementForStories]);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  // Handle music playback when visible story changes
  // Only play separate audio for IMAGES with music_audio_url
  // Videos with music have audio embedded - they don't have music_audio_url
  useEffect(() => {
    if (!isScreenFocused) {
      stopMusicPlayback();
      return;
    }
    
    const currentStory = stories.find((s) => s.id === currentVisibleId);
    if (!currentStory) {
      stopMusicPlayback();
      return;
    }
    
    // Only play separate audio for IMAGES with music
    // Videos have audio embedded via Cloudinary transformation, no separate playback needed
    if (currentStory.media_type === 'image' && currentStory.music_audio_url) {
      startMusicPlayback(
        currentStory.id, 
        currentStory.music_audio_url,
        IMAGE_WITH_MUSIC_DURATION_MS,
        currentStory.music_duration_ms
      );
    } else {
      // Video or no music - stop any playing music
      stopMusicPlayback();
    }
  }, [currentVisibleId, isScreenFocused, stories, startMusicPlayback, stopMusicPlayback]);

  // Auto-advance and progress tracking for images with music
  useEffect(() => {
    // Clear any existing timer
    if (imageAutoAdvanceTimerRef.current) {
      clearTimeout(imageAutoAdvanceTimerRef.current);
      imageAutoAdvanceTimerRef.current = null;
    }
    
    if (!isScreenFocused) return;
    
    const currentStory = stories.find((s) => s.id === currentVisibleId);
    if (!currentStory) return;
    
    // Only apply to images with music
    if (currentStory.media_type !== 'image' || !currentStory.music_audio_url) return;
    
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
      const currentIndex = stories.findIndex((s) => s.id === currentVisibleId);
      if (currentIndex >= 0 && currentIndex < stories.length - 1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: currentIndex + 1, animated: true });
      }
    }, duration);
    
    return () => {
      clearInterval(progressInterval);
      if (imageAutoAdvanceTimerRef.current) {
        clearTimeout(imageAutoAdvanceTimerRef.current);
        imageAutoAdvanceTimerRef.current = null;
      }
    };
  }, [currentVisibleId, isScreenFocused, stories]);

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
      // Pause all videos
      videoRefs.current.forEach((r) => {
        safePauseVideo(r).catch(() => {});
      });
    }
  }, [isScreenFocused, stopMusicPlayback]);

  // Provide getItemLayout so FlatList has consistent measurements (prevents misalignment)
  const getItemLayout = useCallback((_: any, index: number) => ({ length: measuredItemHRef.current, offset: measuredItemHRef.current * index, index }), []);

  useEffect(() => {
    try {
      mediaHeightListenerRef.current = animatedMediaHeight.addListener(({ value }) => {
        setDebugMediaHeight(Math.round(value));
      }) as unknown as number;
    } catch {}
    return () => {
      try {
        if (mediaHeightListenerRef.current != null) animatedMediaHeight.removeListener(mediaHeightListenerRef.current as any);
      } catch {}
    };
  }, [animatedMediaHeight]);

  // When measured item height changes, update refs and animate the media height to match
  useEffect(() => {
    measuredItemHRef.current = measuredItemH;
    try {
      // For full-screen media we animate the media height to the window height
      const target = Math.max(0, WINDOW_H - MEDIA_NUDGE);
      Animated.timing(animatedMediaHeight, { toValue: target, duration: 180, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
    } catch {}
  }, [measuredItemH, animatedMediaHeight]);

  function startLoadTimersFor(id: string) {
    // clear existing timers
    const prev = loadTimers.current.get(id);
    if (prev) {
      if (prev.showTimer) clearTimeout(prev.showTimer as any);
      if (prev.timeoutTimer) clearTimeout(prev.timeoutTimer as any);
      if (prev.minTimer) clearTimeout(prev.minTimer as any);
    }

    const showTimer = Number(
      setTimeout(() => {
        setLoadingMap((m) => ({ ...m, [id]: true }));
      }, LOAD_SHOW_DELAY_MS)
    );
    const timeoutTimer = Number(
      setTimeout(() => {
        setLoadTimedOut((m) => ({ ...m, [id]: true }));
        setLoadingMap((m) => ({ ...m, [id]: false }));
      }, LOAD_TIMEOUT_MS)
    );
    loadTimers.current.set(id, { showTimer, timeoutTimer });
  }

  function stopLoadTimersFor(id: string) {
    const entry = loadTimers.current.get(id);
    if (!entry) {
      setLoadingMap((m) => ({ ...m, [id]: false }));
      return;
    }
    if (entry.showTimer) {
      clearTimeout(entry.showTimer as any);
      entry.showTimer = undefined;
    }
    if (entry.timeoutTimer) {
      clearTimeout(entry.timeoutTimer as any);
      entry.timeoutTimer = undefined;
    }
    // if spinner was visible, keep visible for MIN_SPINNER_MS
    const stillShowing = loadingMap[id];
    if (stillShowing) {
      const minTimer = Number(
        setTimeout(() => {
          setLoadingMap((m) => ({ ...m, [id]: false }));
        }, MIN_SPINNER_MS)
      );
      entry.minTimer = minTimer;
    } else {
      setLoadingMap((m) => ({ ...m, [id]: false }));
    }
    loadTimers.current.set(id, entry);
  }

  // Auto-retry timed-out media items: attempt to download the media automatically
  useEffect(() => {
    try {
      Object.keys(loadTimedOut).forEach((id) => {
        if (loadTimedOut[id] && !autoRetryRef.current.has(id)) {
          autoRetryRef.current.add(id);
          setLoadingMap((m) => ({ ...m, [id]: true }));
          (async () => {
            try {
              const item = storiesRef.current.find((s) => s.id === id) ?? allStoriesRef.current.find((s) => s.id === id) ?? null;
              const url = item?.media_url ?? item?.raw_media_url ?? null;
              if (url) {
                await downloadToCache(url).catch(() => null);
              }
            } catch {}
            try {
              setLoadingMap((m) => ({ ...m, [id]: false }));
              setLoadTimedOut((m) => ({ ...(m || {}), [id]: false }));
            } catch {}
            autoRetryRef.current.delete(id);
          })();
        }
      });
    } catch {}
  }, [loadTimedOut]);

  /**
   * loadStories
   * - If fetch fails: do not clear existing stories.
   * - Show an inline friendly message (fetchErrorMessage).
   * - Supports media_urls JSON array or single media_url.
   * - Also fetches partnership avatars separately and attaches to story items.
   * - Now also fetches business_stories and merges them with regular stories.
   */
  async function loadStories() {
    setLoadingStories(true);
    setFetchErrorMessage(null);
    try {
      const nowMs = Date.now();

      // Fetch only business stories (regular stories moved to All Stories on Home)
      let businessItems: StoryItem[] = [];
      try {
        const bizRes = await supabase
          .from("business_stories")
          .select(BUSINESS_STORY_SELECT_FIELDS)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false });

        if (!(bizRes as any).error) {
          const bizData = (bizRes as any).data || [];
          const activeBiz = bizData.filter((r: any) => {
            if (!r.expire_at) return true;
            try {
              return new Date(r.expire_at).getTime() > nowMs;
            } catch { return true; }
          });

          // Fetch profiles for business stories separately
          const bizUserIds = [...new Set(activeBiz.map((r: any) => r.user_id).filter(Boolean))] as string[];
          let bizProfiles: Record<string, ProfileShort> = {};
          if (bizUserIds.length > 0) {
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, username, full_name, avatar_url")
              .in("id", bizUserIds);
            (profilesData || []).forEach((p: any) => {
              if (p.id) bizProfiles[p.id] = p;
            });
          }

          businessItems = activeBiz.map((r: any) => {
            const mediaType: "image" | "video" = r.media_type === "video" ? "video" : "image";
            const built = buildCloudinaryUrl(r.media_url, mediaType) ?? (typeof r.media_url === "string" ? r.media_url : "");

            let mediaUrls: string[] | undefined = undefined;
            if (r.media_urls) {
              try {
                let arr: any[] | null = null;
                if (Array.isArray(r.media_urls)) arr = r.media_urls;
                else if (typeof r.media_urls === "string") {
                  const parsed = JSON.parse(r.media_urls);
                  if (Array.isArray(parsed)) arr = parsed;
                }
                if (arr && arr.length) {
                  const mappedUrls = arr
                    .map((m: any) => {
                      if (!m) return null;
                      try {
                        const str = String(m).trim();
                        if (!str) return null;
                        if (str.startsWith("http://") || str.startsWith("https://")) return str;
                        return buildCloudinaryUrl(str, "image");
                      } catch { return null; }
                    })
                    .filter((u): u is string => !!u);
                  if (mappedUrls.length) mediaUrls = mappedUrls;
                }
              } catch { mediaUrls = undefined; }
            }

            return {
              id: r.id,
              user_id: r.user_id,
              raw_media_url: r.media_url,
              media_url: built,
              media_type: mediaType,
              media_urls: mediaUrls,
              duration: r.duration ?? null,
              created_at: r.created_at,
              profiles: bizProfiles[r.user_id] ?? null,
              caption: r.caption ?? null,
              expire_at: r.expire_at ?? null,
              label: r.label ?? null,
              location: r.location ?? null,
              partnership_avatars: [],
              is_business: true,
            } as StoryItem;
          }).filter((item: StoryItem | null): item is StoryItem => !!item);
        }
      } catch (bizErr) {
        console.warn("[Contents] business stories fetch err", bizErr);
      }

      // Only business stories now (sorted by created_at descending)
      const allItems = businessItems.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      // Replace cached stories only on success
      prefetchedStoryIdsRef.current = new Set();
      setIsLikedState({});
      setLikesCountMap({});
      setCommentsCountMap({});
      setAllStories(allItems);

      // Preload first media (don't block)
      for (let i = 0; i < Math.min(3, allItems.length); i++) {
        const it = allItems[i];
        const first = (it.media_urls && it.media_urls.length) ? it.media_urls[0] : it.media_url;
        if (first) preloadMediaToCache(first).catch(() => {});
      }

      // fetch partnerships for these stories (non-blocking)
      (async () => {
        try {
          const storyIds = allItems.map((s) => s.id).filter(Boolean);
          if (storyIds.length) {
            // fetch joined partner profile avatars
            const { data: parts } = await supabase
              .from("story_partnerships")
              .select("story_id, partner_profile(id, avatar_url)")
              .in("story_id", storyIds);

            const byStory: Record<string, string[]> = {};
            (parts || []).forEach((p: any) => {
              const sid = p.story_id;
              const avatar = p.partner_profile?.avatar_url ?? null;
              if (!avatar) return;
              // build cloudinary url (handles both public id and full urls)
              const built = buildCloudinaryUrl(avatar, "image") ?? String(avatar);
              if (!byStory[sid]) byStory[sid] = [];
              byStory[sid].push(built);
            });

            if (Object.keys(byStory).length) {
              const merged = allItems.map((it) => {
                const avatars = byStory[it.id] ?? [];
                // limit to 3 for UI colliding avatars
                return { ...it, partnership_avatars: avatars.slice(0, 3) };
              });
              setAllStories(merged);
              // Also update visible stories if necessary
              if (selectedTab === "ForYou") setStories(merged);
              else {
                const next = merged.filter((s) => followingIds.includes(String(s.user_id)));
                setStories(next.length ? next : merged);
              }
            }
          }
        } catch (err) {
          // swallow partnership fetch errors
          console.warn("partnership fetch err", err);
        }
      })();

      // set following ids (filter nulls)
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        if (uid) {
          const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
          // use type guard so TS knows this is string[]
          const ids = ((f || []) as any[]).map((x) => x.following_id).filter((x): x is string => !!x);
          setFollowingIds(ids);
          const map: Record<string, boolean> = {};
          allItems.forEach((it) => {
            map[String(it.user_id)] = ids.includes(String(it.user_id));
          });
          setIsFollowingState(map);
        }
      } catch {}

      if (selectedTab === "ForYou") {
        setStories(allItems);
      } else {
        const next = allItems.filter((s) => followingIds.includes(String(s.user_id)));
        setStories(next.length ? next : allItems);
      }

      if (allItems.length) setTimeout(() => setCurrentVisibleId(allItems[0].id), 200);
      else setCurrentVisibleId(null);
    } catch (err) {
      console.warn("[Explore] loadStories err", err);
      // don't wipe existing content — instead inform the user inline
      if (!isConnected) {
        setFetchErrorMessage("You're offline. Check your connection.");
      } else {
        setFetchErrorMessage("Couldn't refresh content. Tap retry.");
      }
    } finally {
      setLoadingStories(false);
      setLoadingInitial(false);
    }
  }

  // Keep media height constant (force full-screen height)
  // Keep media height constant (account for reserved bottom area)
  function mediaHeightForStory(_s: StoryItem | null) {
    // Return the full window height so media fills the screen from the top
    return Math.max(0, WINDOW_H - MEDIA_NUDGE);
  }
  function animateMediaHeightTo(_s: StoryItem | null) {
    try {
      const target = Math.max(0, WINDOW_H - MEDIA_NUDGE);
      Animated.timing(animatedMediaHeight, { toValue: target, duration: 220, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
    } catch {}
  }

  useEffect(() => {
    (async () => {
      try {
        const active = stories.find((x) => x.id === currentVisibleId) ?? null;
        animateMediaHeightTo(active);

        // pause/play based on visible id and per-video paused map
        videoRefs.current.forEach((r, id) => {
          const isActive = id === currentVisibleId;
          const paused = videoPausedMap[id];
          const statusObj = videoStatusMap[id] ?? {};
          // Only attempt to play if loaded and screen focused
          if (isActive && !paused && statusObj.isLoaded && isScreenFocused) safePlayVideo(r).catch(() => {});
          else safePauseVideo(r).catch(() => {});
        });

        if (currentVisibleId) {
          const activeStory = allStories.find((s) => s.id === currentVisibleId);
          const isBusiness = activeStory?.is_business ?? false;
          markStoryViewed(currentVisibleId, isBusiness).catch(() => {});
          fetchViewCount(currentVisibleId, isBusiness).catch(() => {});
          fetchCommentsForActive().catch(() => {});
          const cnt = await fetchLikesCount(currentVisibleId, isBusiness);
          setLikesCountMap((m) => ({ ...m, [currentVisibleId]: cnt }));
          
          // Prefetch comments for current and nearby stories (before sheet opens)
          const currentIdx = stories.findIndex((s) => s.id === currentVisibleId);
          const nearbyIds: string[] = [];
          if (currentIdx >= 0) {
            // Current + next 2 + previous 1
            for (let i = Math.max(0, currentIdx - 1); i <= Math.min(stories.length - 1, currentIdx + 2); i++) {
              if (stories[i]?.id) nearbyIds.push(stories[i].id);
            }
          }
          if (nearbyIds.length > 0) {
            prefetchComments(nearbyIds).catch(() => {});
          }
        }

        if (currentVisibleId) {
          // reset timeouts for visible item
          const prev = loadTimers.current.get(currentVisibleId);
          if (prev) {
            if (prev.showTimer) clearTimeout(prev.showTimer as any);
            if (prev.timeoutTimer) clearTimeout(prev.timeoutTimer as any);
            loadTimers.current.delete(currentVisibleId);
          }
          // start global timeout to mark as timed out if loading too long
          const t = Number(
            setTimeout(() => {
              setLoadTimedOut((m) => ({ ...m, [currentVisibleId]: true }));
              setLoadingMap((m) => ({ ...m, [currentVisibleId]: false }));
            }, LOAD_TIMEOUT_MS)
          );
          loadTimers.current.set(currentVisibleId, { timeoutTimer: t });
        }
      } catch {}
    })();
  }, [currentVisibleId, isScreenFocused, prefetchComments]);

  useEffect(() => {
    if (!currentVisibleId || !isScreenFocused) {
      if (!isScreenFocused) lastReplayKeyRef.current = null;
      return;
    }

    const activeStory = stories.find((s) => s.id === currentVisibleId) ?? null;
    if (!activeStory || activeStory.media_type !== "video") {
      lastReplayKeyRef.current = `${currentVisibleId}-nonvideo`;
      return;
    }

    const pausedByUser = !!videoPausedMap[currentVisibleId];
    if (pausedByUser) {
      lastReplayKeyRef.current = `${currentVisibleId}-paused`;
      return;
    }

    const replayKey = `${currentVisibleId}-focus`;
    if (lastReplayKeyRef.current === replayKey) return;

    const ref = videoRefs.current.get(currentVisibleId);
    const player = ref?.current ?? ref;
    if (!player) {
      lastReplayKeyRef.current = null;
      return;
    }

    lastReplayKeyRef.current = replayKey;

    (async () => {
      try {
        const status: any = typeof player.getStatusAsync === "function" ? await player.getStatusAsync().catch(() => null) : null;
        if (status?.isLoaded) {
          if (typeof player.setPositionAsync === "function") await player.setPositionAsync(0).catch(() => {});
          if (typeof player.playAsync === "function") await player.playAsync().catch(() => {});
          const duration = typeof status.durationMillis === "number" ? status.durationMillis : videoProgressMap[currentVisibleId]?.duration ?? 0;
          updateVideoProgress(currentVisibleId, 0, duration);
        } else if (typeof player.setStatusAsync === "function") {
          await player.setStatusAsync({ shouldPlay: true, positionMillis: 0 }).catch(() => {});
          const duration = typeof status?.durationMillis === "number" ? status.durationMillis : videoProgressMap[currentVisibleId]?.duration ?? 0;
          updateVideoProgress(currentVisibleId, 0, duration);
        }
      } catch {}
    })();
  }, [currentVisibleId, isScreenFocused, stories, videoPausedMap, videoProgressMap, updateVideoProgress]);

  const safePauseVideo = useCallback(async (vref: any) => {
    if (!vref) return;
    try {
      const ref = vref?.current ?? vref;
      if (!ref) return;
      if (typeof ref.pauseAsync === "function") {
        const status = typeof ref.getStatusAsync === "function" ? await ref.getStatusAsync().catch(() => null) : null;
        if (!status || status?.isPlaying) await ref.pauseAsync().catch(() => {});
      }
    } catch {}
  }, []);
  const safePlayVideo = useCallback(async (vref: any) => {
    if (!vref) return;
    try {
      const ref = vref?.current ?? vref;
      if (!ref) return;
      if (typeof ref.playAsync === "function") {
        const status = typeof ref.getStatusAsync === "function" ? await ref.getStatusAsync().catch(() => null) : null;
        if (!status || !status?.isPlaying) await ref.playAsync().catch(() => {});
      }
    } catch {}
  }, []);

  // When the screen (tab) gains focus, play active video (if not user-paused).
  // When it loses focus, pause all videos.
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          if (currentVisibleId) {
            const ref = videoRefs.current.get(currentVisibleId);
            if (ref) {
              const r = ref?.current ?? ref;
              const st: any = typeof r.getStatusAsync === "function" ? await r.getStatusAsync().catch(() => null) : null;
              if (st?.isLoaded && !videoPausedMap[currentVisibleId]) {
                if (typeof r.playAsync === "function") await r.playAsync().catch(() => {});
              }
            }
          }
        } catch {}
      })();

      return () => {
        videoRefs.current.forEach((ref) => {
          try {
            const r = ref?.current ?? ref;
            if (r && typeof r.pauseAsync === "function") r.pauseAsync().catch(() => {});
          } catch {}
        });
      };
    }, [currentVisibleId, videoPausedMap])
  );

  async function fetchViewCount(storyId: string, isBusiness = false) {
    try {
      if (isBusiness) {
        // Use business_story_views table for business stories
        const { data, count } = await supabase.from("business_story_views").select("id", { count: "exact" }).eq("business_story_id", storyId);
        const cnt = typeof count === "number" ? count : Array.isArray(data) ? data.length : 0;
        setViewsCountMap((m) => ({ ...m, [storyId]: cnt }));
        return;
      }
      const { data, count } = await supabase.from("story_views").select("id", { count: "exact" }).eq("story_id", storyId);
      const cnt = typeof count === "number" ? count : Array.isArray(data) ? data.length : 0;
      setViewsCountMap((m) => ({ ...m, [storyId]: cnt }));
    } catch {}
  }
  async function markStoryViewed(storyId: string, isBusiness = false) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      if (isBusiness) {
        // Use business_story_views table for business stories
        await supabase.from("business_story_views").upsert(
          { business_story_id: storyId, viewer_id: uid, viewed_at: new Date().toISOString() },
          { onConflict: "business_story_id,viewer_id" }
        );
        fetchViewCount(storyId, isBusiness).catch(() => {});
        return;
      }
      await supabase.from("story_views").upsert({ story_id: storyId, viewer_id: uid, viewed_at: new Date().toISOString() }, { onConflict: "story_id,viewer_id" });
      fetchViewCount(storyId, isBusiness).catch(() => {});
    } catch {}
  }
  async function fetchLikesCount(storyId: string, isBusiness = false) {
    try {
      if (isBusiness) {
        const { count } = await supabase.from("business_story_likes").select("id", { count: "exact" }).eq("business_story_id", storyId);
        return count ?? 0;
      }
      const { count } = await supabase.from("story_likes").select("id", { count: "exact" }).eq("story_id", storyId);
      return count ?? 0;
    } catch {
      return 0;
    }
  }
  async function fetchCommentsCount(storyId: string, isBusiness = false) {
    try {
      if (isBusiness) {
        const { count } = await supabase.from("business_story_comments").select("id", { count: "exact", head: true }).eq("business_story_id", storyId);
        return count ?? 0;
      }
      const { count } = await supabase.from("story_comments").select("id", { count: "exact", head: true }).eq("story_id", storyId);
      return count ?? 0;
    } catch {
      return 0;
    }
  }
  async function toggleLikeServer(storyId: string, isBusiness = false) {
    const { data } = await supabase.auth.getUser();
    const myId = data?.user?.id;
    if (!myId) throw new Error("Not signed in");
    
    if (isBusiness) {
      const { data: existing } = await supabase.from("business_story_likes").select("id").eq("business_story_id", storyId).eq("user_id", myId).maybeSingle();
      if (existing) {
        await supabase.from("business_story_likes").delete().eq("id", existing.id);
        return { liked: false };
      } else {
        await supabase.from("business_story_likes").insert({ business_story_id: storyId, user_id: myId });
        return { liked: true };
      }
    }
    
    const { data: existing } = await supabase.from("story_likes").select("id").eq("story_id", storyId).eq("user_id", myId).maybeSingle();
    if (existing) {
      await supabase.from("story_likes").delete().eq("id", existing.id);
      return { liked: false };
    } else {
      await supabase.from("story_likes").insert({ story_id: storyId, user_id: myId });
      return { liked: true };
    }
  }
  async function toggleFollowServer(targetUserId: string) {
    const { data } = await supabase.auth.getUser();
    const myId = data?.user?.id;
    if (!myId) throw new Error("Not signed in");
    const { data: existing } = await supabase.from("follows").select("id").eq("follower_id", myId).eq("following_id", targetUserId).maybeSingle();
    if (existing) {
      await supabase.from("follows").delete().eq("id", existing.id);
      setFollowingIds((s) => s.filter((x) => x !== String(targetUserId)));
      setIsFollowingState((s) => ({ ...s, [String(targetUserId)]: false }));
      return { followed: false };
    } else {
      await supabase.from("follows").insert({ follower_id: myId, following_id: targetUserId });
      setFollowingIds((s) => Array.from(new Set([...s, String(targetUserId)])));
      setIsFollowingState((s) => ({ ...s, [String(targetUserId)]: true }));
      return { followed: true };
    }
  }

  // Heart animation state
  const [likeAnimStoryId, setLikeAnimStoryId] = useState<string | null>(null);
  const likeAnimScale = useRef(new Animated.Value(0)).current;

  // Double tap handler (already anim + server toggle)
  const handleDoubleTap = async (storyId: string, isBusiness: boolean = false) => {
    if (!isLikedState[storyId]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setLikeAnimStoryId(storyId);
      Animated.sequence([
        Animated.timing(likeAnimScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(likeAnimScale, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setLikeAnimStoryId(null));
      await handleLikeToggle(storyId, isBusiness);
    }
  };

  const handleLikeToggle = async (storyId: string, isBusiness: boolean = false) => {
    const prevLiked = !!isLikedState[storyId];
    const prevCount = likesCountMap[storyId] ?? 0;
    try {
      Haptics.selectionAsync().catch(() => {});
      const optimisticLiked = !prevLiked;

      setIsLikedState((m) => ({ ...m, [storyId]: optimisticLiked }));
      setLikesCountMap((m) => {
        const baseline = m[storyId] ?? prevCount;
        const nextCount = Math.max(0, baseline + (optimisticLiked ? 1 : -1));
        return { ...m, [storyId]: nextCount };
      });

      const serverResult = await toggleLikeServer(storyId, isBusiness);
      const finalLiked = typeof serverResult?.liked === "boolean" ? serverResult.liked : optimisticLiked;
      if (finalLiked !== optimisticLiked) {
        setIsLikedState((m) => ({ ...m, [storyId]: finalLiked }));
      }

      const newCount = await fetchLikesCount(storyId, isBusiness);
      setLikesCountMap((m) => ({ ...m, [storyId]: newCount }));
      setIsLikedState((m) => ({ ...m, [storyId]: finalLiked }));
    } catch (err) {
      setIsLikedState((m) => ({ ...m, [storyId]: prevLiked }));
      setLikesCountMap((m) => ({ ...m, [storyId]: prevCount }));
      Alert.alert("Error", "Could not like story");
    }
  };

  const handleFollowToggle = async (targetId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await toggleFollowServer(targetId);
    } catch (err) {
      setIsFollowingState((m) => ({ ...m, [targetId]: !m[targetId] }));
      Alert.alert("Error", "Could not toggle follow");
    }
  };

  async function fetchCommentsForActive(silent = false) {
    const sId = currentVisibleId;
    if (!sId) {
      setCommentsList([]);
      return;
    }
    
    // Check if we have prefetched comments
    const prefetched = prefetchedCommentsRef.current.get(sId);
    if (prefetched) {
      setCommentsList(prefetched);
      setCommentsCountMap((m) => ({ ...m, [sId]: prefetched.length }));
      const commentIds = prefetched.map((r: any) => r.id).filter(Boolean);
      const activeStory = allStories.find((s) => s.id === sId);
      const isBusiness = activeStory?.is_business ?? false;
      fetchCommentLikesFor(commentIds, isBusiness).catch(() => {});
      if (!silent) setCommentsLoading(false);
      return;
    }
    
    if (!silent) setCommentsLoading(true);
    try {
      // Determine if current story is a business story
      const activeStory = allStories.find((s) => s.id === sId);
      const isBusiness = activeStory?.is_business ?? false;
      const tableName = isBusiness ? "business_story_comments" : "story_comments";
      const idColumn = isBusiness ? "business_story_id" : "story_id";
      
      // For business_story_comments, fetch comments first then profiles separately
      // because the FK is on auth.users, not profiles
      const res = await supabase
        .from(tableName)
        .select(`id, ${idColumn}, user_id, content, created_at, parent_id`)
        .eq(idColumn, sId)
        .order("created_at", { ascending: true });
      const rows = (res as any).data || [];
      
      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);
        (profiles || []).forEach((p: any) => {
          profilesMap[p.id] = p;
        });
      }
      
      // Attach profiles to each comment
      const rowsWithProfiles = rows.map((r: any) => ({
        ...r,
        profiles: profilesMap[r.user_id] || null,
      }));
      
      // Store in prefetch cache
      prefetchedCommentsRef.current.set(sId, rowsWithProfiles);
      
      setCommentsList(rowsWithProfiles);
      setCommentsCountMap((m) => ({ ...m, [sId]: rowsWithProfiles.length }));
      const commentIds = rowsWithProfiles.map((r: any) => r.id).filter(Boolean);
      await fetchCommentLikesFor(commentIds, isBusiness);
    } catch (err) {
      console.warn("fetchCommentsForActive err", err);
      setCommentsList([]);
      setCommentLikesMap({});
      setCommentLikedByMe({});
    } finally {
      if (!silent) setCommentsLoading(false);
    }
  }

  // Add comment/reply: parentId optional for reply
  async function addComment(storyId: string, content: string, parentId?: string | null, isBusiness: boolean = false) {
    const { data } = await supabase.auth.getUser();
    const myId = data?.user?.id;
    if (!myId) throw new Error("Not signed in");
    
    const tableName = isBusiness ? "business_story_comments" : "story_comments";
    const idColumn = isBusiness ? "business_story_id" : "story_id";
    
    const payload: any = { [idColumn]: storyId, user_id: myId, content };
    if (parentId) payload.parent_id = parentId;

    // insert and return full row with profiles join
    const insertRes = await supabase.from(tableName).insert(payload).select("id").single();
    if ((insertRes as any).error) throw (insertRes as any).error;
    const newId = (insertRes as any).data?.id;
    if (!newId) throw new Error("No id returned");

    // For business_story_comments, we need to manually fetch the profile since the FK is on auth.users
    // The profiles table uses id that matches auth.users.id, so we can join manually
    const { data: commentRow, error: commentErr } = await supabase
      .from(tableName)
      .select(`id, ${idColumn}, user_id, content, created_at, parent_id`)
      .eq("id", newId)
      .single();
    if (commentErr) throw commentErr;
    
    // Now fetch the profile separately
    let profileData = null;
    if (commentRow?.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", commentRow.user_id)
        .single();
      profileData = prof;
    }
    
    return { ...commentRow, profiles: profileData };
  }

  async function handleAddComment(storyId: string, content: string) {
    try {
      Haptics.selectionAsync().catch(() => {});
      const parentId = replyTarget?.commentId ?? undefined;
      
      // Determine if current story is a business story
      const activeStory = allStories.find((s) => s.id === storyId);
      const isBusiness = activeStory?.is_business ?? false;

      // optimistic UI: append a local pending comment
      const localId = `local-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const iso = new Date().toISOString();
      const optimistic: any = {
        id: localId,
        story_id: storyId,
        business_story_id: isBusiness ? storyId : undefined,
        user_id: profile?.id ?? null,
        content,
        created_at: iso,
        parent_id: parentId ?? null,
        profiles: profile ? { id: profile.id, username: profile.username, full_name: profile.full_name, avatar_url: profile.avatar_url } : null,
        _optimistic: true,
        _isBusiness: isBusiness,
      };

      setCommentsList((prev) => [...(prev || []), optimistic]);
      setCommentDraft("");
      setReplyTarget(null);
      setCommentsCountMap((prev) => {
        const current = prev[storyId] ?? 0;
        return { ...prev, [storyId]: current + 1 };
      });

      // background send
      try {
        const saved = await addComment(storyId, content, parentId, isBusiness);
        if (saved) {
          // replace optimistic with server row
          setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? { ...saved, _optimistic: false } : c)));
          // fetch likes for this specific comment id silently
          if (saved?.id) fetchCommentLikesFor([saved.id]).catch(() => {});
          // Update prefetch cache with new comment
          const cachedComments = prefetchedCommentsRef.current.get(storyId) || [];
          prefetchedCommentsRef.current.set(storyId, [...cachedComments.filter((c: any) => c.id !== localId), saved]);
        }
      } catch (err) {
        console.warn("optimistic add failed", err);
        // mark the optimistic comment as failed so user can retry
        setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? { ...c, _failed: true, _optimistic: false } : c)));
        setCommentsCountMap((prev) => {
          const current = prev[storyId] ?? 0;
          return { ...prev, [storyId]: Math.max(0, current - 1) };
        });
        Alert.alert("Error", "Could not send comment. Tap retry on the failed comment.");
      }
    } catch (err) {
      console.warn("handleAddComment err", err);
      setCommentsCountMap((prev) => {
        const current = prev[storyId] ?? 0;
        return { ...prev, [storyId]: Math.max(0, current - 1) };
      });
      Alert.alert("Error", "Could not add comment");
    }
  }

  async function retryComment(localId: string) {
    const retryTarget = (commentsList || []).find((c: any) => c.id === localId);
    if (!retryTarget) return;

    try {
      // show pending again
      setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? { ...c, _failed: false, _optimistic: true } : c)));
      const storyIdToUse = retryTarget.business_story_id || retryTarget.story_id;
      const isBusiness = retryTarget._isBusiness ?? !!retryTarget.business_story_id;
      setCommentsCountMap((prev) => {
        const current = prev[storyIdToUse] ?? 0;
        return { ...prev, [storyIdToUse]: current + 1 };
      });
      const saved = await addComment(storyIdToUse, retryTarget.content, retryTarget.parent_id ?? undefined, isBusiness);
      setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? saved : c)));
      if (saved?.id) fetchCommentLikesFor([saved.id]).catch(() => {});
      fetchCommentsForActive(true).catch(() => {});
    } catch (err) {
      console.warn("retryComment err", err);
      const storyIdToUse = retryTarget.business_story_id || retryTarget.story_id;
      setCommentsCountMap((prev) => {
        const current = prev[storyIdToUse] ?? 0;
        return { ...prev, [storyIdToUse]: Math.max(0, current - 1) };
      });
      setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? { ...c, _failed: true, _optimistic: false } : c)));
      Alert.alert("Error", "Retry failed");
    }
  }

  // COMMENT LIKES
  // Helper to determine if current story is business
  const isCurrentStoryBusiness = useCallback(() => {
    const activeStory = allStories.find((s) => s.id === currentVisibleId);
    return activeStory?.is_business ?? false;
  }, [allStories, currentVisibleId]);

  async function fetchCommentLikesFor(commentIds: string[], isBusiness?: boolean) {
    if (!commentIds || !commentIds.length) {
      setCommentLikesMap({});
      setCommentLikedByMe({});
      return;
    }
    try {
      const { data: u } = await supabase.auth.getUser();
      const myId = u?.user?.id;
      
      // Determine which table to use
      const useBusiness = isBusiness ?? isCurrentStoryBusiness();
      const likesTable = useBusiness ? "business_story_comment_likes" : "story_comment_likes";
      
      const { data: likesRows } = await supabase
        .from(likesTable)
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
      const counts: Record<string, number> = {};
      const likedByMe: Record<string, boolean> = {};
      (likesRows || []).forEach((row: any) => {
        counts[row.comment_id] = (counts[row.comment_id] || 0) + 1;
        if (myId && row.user_id === myId) likedByMe[row.comment_id] = true;
      });
      setCommentLikesMap(counts);
      setCommentLikedByMe(likedByMe);
    } catch (err) {
      console.warn("fetchCommentLikesFor err", err);
      setCommentLikesMap({});
      setCommentLikedByMe({});
    }
  }

  async function toggleCommentLike(commentId: string) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const myId = u?.user?.id;
      if (!myId) throw new Error("Not signed in");
      
      // Determine which table to use based on current story type
      const isBusiness = isCurrentStoryBusiness();
      const likesTable = isBusiness ? "business_story_comment_likes" : "story_comment_likes";
      
      const { data: existing } = await supabase
        .from(likesTable)
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", myId)
        .maybeSingle();

      // optimistic update
      setCommentLikedByMe((m) => ({ ...m, [commentId]: !m[commentId] }));
      setCommentLikesMap((m) => ({ ...m, [commentId]: (m[commentId] || 0) + (commentLikedByMe[commentId] ? -1 : 1) }));

      if (existing) {
        await supabase.from(likesTable).delete().eq("id", existing.id);
      } else {
        await supabase.from(likesTable).insert({ comment_id: commentId, user_id: myId });
      }

      await fetchCommentLikesFor([commentId], isBusiness);
    } catch (err) {
      console.warn("toggleCommentLike err", err);
      Alert.alert("Error", "Could not toggle like");
      setCommentLikedByMe((m) => ({ ...m, [commentId]: !m[commentId] }));
    }
  }

  async function fetchStoryViewers(storyId: string) {
    // keep this function as a loader (do not await caller)
    setLoadingViewers(true);
    try {
      const { data, error } = await supabase.from("story_views").select("viewer_id, viewed_at, device_info").eq("story_id", storyId).order("viewed_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const viewerIds = Array.from(new Set(rows.map((r) => r.viewer_id).filter(Boolean)));
      let profilesById: Record<string, ProfileShort> = {};
      if (viewerIds.length) {
        const { data: profRows } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", viewerIds);
        (profRows || []).forEach((p: any) => (profilesById[p.id] = { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url }));
      }
      const merged = rows.map((r) => ({ viewer_id: r.viewer_id, viewed_at: r.viewed_at, device_info: r.device_info ?? null, profile: profilesById[r.viewer_id] ?? null }));
      setViewersList(merged);

      // first viewer toast: check if it's just one view and that view is the current user
      if (merged.length === 1) {
        try {
          const { data: u } = await supabase.auth.getUser();
          const myId = u?.user?.id;
          if (myId && merged[0].viewer_id === myId) {
            showFirstViewerToast("You're the first viewer 🎉");
          }
        } catch {}
      }
    } catch {
      setViewersList([]);
    } finally {
      setLoadingViewers(false);
    }
  }

  // improved handleVideoPress: deterministic toggle and immediate play/pause calls
  const handleVideoPress = useCallback((storyId: string) => {
    setVideoPausedMap((prev) => {
      const nextPaused = !prev[storyId];
      const next = { ...prev, [storyId]: nextPaused };
      const ref = videoRefs.current.get(storyId);
      if (ref) {
        (async () => {
          try {
            const r = ref?.current ?? ref;
            if (!r) return;
            if (nextPaused) {
              if (typeof r.pauseAsync === "function") await r.pauseAsync().catch(() => {});
            } else {
              const st: any = typeof r.getStatusAsync === "function" ? await r.getStatusAsync().catch(() => null) : null;
              if (st?.isLoaded && typeof r.playAsync === "function") await r.playAsync().catch(() => {});
            }
          } catch {}
        })();
      }
      Haptics.selectionAsync().catch(() => {});
      return next;
    });
  }, []);

  // Hold-left overlay handlers: while pressing left half, speed up playback for active video
  const handleSpeedPressIn = useCallback(async (storyId: string) => {
    try {
      const ref = videoRefs.current.get(storyId);
      const player = ref?.current ?? ref;
      if (!player) return;
      if (typeof player.setRateAsync === "function") {
        await player.setRateAsync(2.0, true).catch(() => {});
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}
  }, []);

  const handleSpeedPressOut = useCallback(async (storyId: string) => {
    try {
      const ref = videoRefs.current.get(storyId);
      const player = ref?.current ?? ref;
      if (!player) return;
      if (typeof player.setRateAsync === "function") {
        await player.setRateAsync(1.0, true).catch(() => {});
      }
    } catch {}
  }, []);

  const startSpeedHold = useCallback(
    (storyId: string) => {
      try {
        const prevTimer = speedHoldTimersRef.current[storyId];
        if (prevTimer) {
          clearTimeout(prevTimer as any);
          speedHoldTimersRef.current[storyId] = null;
        }
        speedHoldActiveRef.current[storyId] = false;
        const timerId = Number(
          setTimeout(() => {
            try {
              speedHoldActiveRef.current[storyId] = true;
              handleSpeedPressIn(storyId).catch(() => {});
            } catch {}
          }, SPEED_HOLD_DELAY_MS)
        );
        speedHoldTimersRef.current[storyId] = timerId;
      } catch {}
    },
    [handleSpeedPressIn]
  );

  const endSpeedHold = useCallback(
    (storyId: string) => {
      try {
        const timerId = speedHoldTimersRef.current[storyId];
        if (timerId) {
          clearTimeout(timerId as any);
          speedHoldTimersRef.current[storyId] = null;
        }
        if (speedHoldActiveRef.current[storyId]) {
          speedHoldActiveRef.current[storyId] = false;
        }
        handleSpeedPressOut(storyId).catch(() => {});
      } catch {}
    },
    [handleSpeedPressOut]
  );

  useEffect(() => {
    return () => {
      try {
        Object.values(speedHoldTimersRef.current).forEach((timer) => {
          if (timer) clearTimeout(timer as any);
        });
      } catch {}
    };
  }, []);

  // (overlay pause/resume and AppState pause removed per request)

  /* small verification badge component (blue) */
  const VerificationBadge = ({ size = 16 }: { size?: number }) => {
    return <Ionicons name="checkmark-circle" size={size} color={VELT_ACCENT} style={{ marginLeft: 6 }} />;
  };

  /* share handler */
  const handleShare = async (item: StoryItem) => {
    try {
      const url = item.media_url ?? item.raw_media_url ?? undefined;
      const message = item.caption ?? "";
      if (url) {
        await Share.share({ message: `${message}\n\n${url}` });
      } else {
        await Share.share({ message: message || "Check this out!" });
      }
    } catch (err) {
      console.warn("share err", err);
      Alert.alert("Share", "Could not open share dialog.");
    }
  };

  /* render single story */
  const renderStoryItem = useCallback(
    ({ item, index }: { item: StoryItem; index: number }) => {
      if (!gestureRefs.current.has(item.id)) {
        gestureRefs.current.set(item.id, { doubleRef: React.createRef(), singleRef: React.createRef() });
      }
      const refsForItem = gestureRefs.current.get(item.id)!;

      const isActive = item.id === currentVisibleId;
      const remoteUri = item.media_url ?? item.raw_media_url ?? "";
      const cached = mediaCache.get(remoteUri)?.localUri ?? null;
      const mediaUri = cached || remoteUri || "https://via.placeholder.com/720x1280";

      // Get or create fade animation for this item
      if (!mediaFadeAnims.current.has(item.id)) {
        mediaFadeAnims.current.set(item.id, new Animated.Value(mediaLoadedMap[item.id] ? 1 : 0));
      }
      const fadeAnim = mediaFadeAnims.current.get(item.id)!;
      
      const handleMediaLoaded = () => {
        setMediaLoadedMap(m => ({ ...m, [item.id]: true }));
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      };

      const tryReload = async () => {
        setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
        setLoadingMap((m) => ({ ...m, [item.id]: true }));
        setMediaLoadedMap((m) => ({ ...m, [item.id]: false }));
        fadeAnim.setValue(0);
        await downloadToCache(remoteUri).catch(() => null);
        setTimeout(() => setLoadingMap((m) => ({ ...m, [item.id]: false })), 700);
        const prev = loadTimers.current.get(item.id);
        if (prev) {
          if (prev.showTimer) clearTimeout(prev.showTimer as any);
          if (prev.timeoutTimer) clearTimeout(prev.timeoutTimer as any);
          loadTimers.current.delete(item.id);
        }
      };

      // Auto-retry on media error
      const handleMediaError = () => {
        setLoadingMap((m) => ({ ...m, [item.id]: true }));
        setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
        setTimeout(() => {
          downloadToCache(item.media_url ?? item.raw_media_url ?? "").finally(() => {
            setLoadingMap((m) => ({ ...m, [item.id]: false }));
          });
        }, 800);
      };

      const status = videoStatusMap[item.id] ?? {};
      const loadingVisible = !!loadingMap[item.id] || !!status.isBuffering;

      // show posted rendition — videos full-bleed (cover), images preserve aspect (contain)
      const videoResizeMode = ResizeMode.COVER;
      const imageResizeMode: "cover" | "contain" = "contain";

      // HD badge overlay for all uploaded media
      const renderHDBadge = () => <HDBadge />;

      const onDoubleTapHandler = (e: any) => {
        if (e.nativeEvent.state === State.ACTIVE) handleDoubleTap(item.id, item.is_business ?? false);
      };
      const onSingleTapHandler = (e: any) => {
        if (e.nativeEvent.state === State.ACTIVE) handleVideoPress(item.id);
      };

      const hasMultiple = Array.isArray(item.media_urls) && item.media_urls.length > 1;
      const multiIndex = mediaIndexMap[item.id] ?? 0;
      
      // Check if this is an image with music (needs progress bar too)
      const isImageWithMusic = item.media_type === 'image' && !!item.music_audio_url;
      const imageProgress = imageProgressMap[item.id];
      
      // Use video progress for videos, image progress for images with music
      const progressEntry = isImageWithMusic ? imageProgress : videoProgressMap[item.id];
      const durationMsFromEntry = progressEntry?.duration ?? (isImageWithMusic ? IMAGE_WITH_MUSIC_DURATION_MS : 0);
      const positionMsFromEntry = progressEntry?.position ?? 0;
      const progressRatio = durationMsFromEntry > 0 ? Math.min(Math.max(positionMsFromEntry / durationMsFromEntry, 0), 1) : 0;
      const trackWidth = progressTrackWidthRef.current[item.id] ?? WINDOW_W;
      const fillWidth = trackWidth > 0 ? trackWidth * progressRatio : 0;
      // Show progress bar for videos (non-multi) OR images with music
      const shouldShowProgress = (item.media_type === "video" && !hasMultiple) || isImageWithMusic;
      const thumbOffset = trackWidth > 0 ? Math.min(fillWidth, trackWidth) : fillWidth;
      const thumbTranslate = Math.max(0, thumbOffset - 7);
      const commentCount = commentsCountMap[item.id] ?? (isActive ? commentsList.length : 0);

      const applyScrubPosition = (targetMillis: number) => {
        if (!shouldShowProgress || durationMsFromEntry <= 0 || Number.isNaN(targetMillis)) return;
        const limited = Math.max(0, Math.min(targetMillis, durationMsFromEntry));
        scrubTargetRef.current[item.id] = limited;
        setVideoProgressMap((prev) => {
          const prevEntry = prev[item.id];
          if (prevEntry && Math.abs(prevEntry.position - limited) < 5 && Math.abs(prevEntry.duration - durationMsFromEntry) < 5) return prev;
          return { ...prev, [item.id]: { position: limited, duration: durationMsFromEntry } };
        });
      };

      const handleScrubStart = (locationX: number) => {
        if (!shouldShowProgress || durationMsFromEntry <= 0) return;
        const width = progressTrackWidthRef.current[item.id] ?? 0;
        if (!width) return;
        isScrubbingRef.current[item.id] = true;
        const ref = videoRefs.current.get(item.id);
        const player = ref?.current ?? ref;
        const wasPlaying = isScreenFocused && isActive && !videoPausedMap[item.id] && !!(videoStatusMap[item.id]?.isPlaying);
        scrubWasPlayingRef.current[item.id] = wasPlaying;
        if (player && wasPlaying && typeof player.pauseAsync === "function") player.pauseAsync().catch(() => {});
        const ratio = Math.max(0, Math.min(locationX / width, 1));
        applyScrubPosition(ratio * durationMsFromEntry);
      };

      const handleScrubMove = (locationX: number, isFinal: boolean) => {
        if (!shouldShowProgress || !isScrubbingRef.current[item.id] || durationMsFromEntry <= 0) return;
        const width = progressTrackWidthRef.current[item.id] ?? 0;
        if (!width) return;
        const ratio = Math.max(0, Math.min(locationX / width, 1));
        const target = ratio * durationMsFromEntry;
        applyScrubPosition(target);
        if (isFinal) scrubTargetRef.current[item.id] = target;
      };

      const handleScrubEnd = () => {
        if (!shouldShowProgress || !isScrubbingRef.current[item.id]) {
          scrubWasPlayingRef.current[item.id] = false;
          return;
        }
        const target = scrubTargetRef.current[item.id];
        const ref = videoRefs.current.get(item.id);
        const player = ref?.current ?? ref;
        if (player != null && typeof target === "number" && !Number.isNaN(target)) {
          (async () => {
            try {
              if (typeof player.setPositionAsync === "function") await player.setPositionAsync(target).catch(() => {});
              if (scrubWasPlayingRef.current[item.id] && typeof player.playAsync === "function") await player.playAsync().catch(() => {});
            } catch {}
          })();
        }
        scrubWasPlayingRef.current[item.id] = false;
        isScrubbingRef.current[item.id] = false;
      };

      const progressPan = shouldShowProgress
        ? PanResponder.create({
            onStartShouldSetPanResponder: () => isActive && durationMsFromEntry > 0,
            onMoveShouldSetPanResponder: () => isActive && durationMsFromEntry > 0,
            onPanResponderGrant: (evt) => handleScrubStart(evt.nativeEvent.locationX),
            onPanResponderMove: (evt) => handleScrubMove(evt.nativeEvent.locationX, false),
            onPanResponderRelease: (evt) => {
              handleScrubMove(evt.nativeEvent.locationX, true);
              handleScrubEnd();
            },
            onPanResponderTerminate: () => {
              handleScrubEnd();
            },
          })
        : null;

      // helper to render media cells for multi-image pager
      const renderMediaCell = ({ uri, type }: { uri: string; type: "image" | "video" }) => {
        const cachedUri = mediaCache.get(uri)?.localUri ?? uri;
        const isCurrentMedia = !hasMultiple || uri === (item.media_urls || [])[multiIndex];
        // Mute video if story has background music
        const shouldMuteVideo = !!item.music_audio_url;
        if (type === "video" || type === "image") {
          return (
            <Animated.View key={uri} style={{ width: WINDOW_W, height: "100%", justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', opacity: fadeAnim }}>
              {type === "video" ? (
                <Video
                  ref={(r: InstanceType<typeof Video> | null) => {
                    if (r) videoRefs.current.set(item.id, r);
                    else videoRefs.current.delete(item.id);
                  }}
                  source={{ uri: cachedUri }}
                  style={{ width: WINDOW_W, height: "100%" }}
                  resizeMode={videoResizeMode}
                  isMuted={shouldMuteVideo}
                  shouldPlay={isScreenFocused && isActive && isCurrentMedia && !videoPausedMap[item.id]}
                  isLooping={isScreenFocused && isActive && isCurrentMedia && !videoPausedMap[item.id]}
                  onLoad={async (status: any) => {
                    try {
                      stopLoadTimersFor(item.id);
                      setVideoStatusMap((m) => ({ ...m, [item.id]: { ...(m[item.id] || {}), isLoaded: true, isBuffering: false } }));
                      handleMediaLoaded();
                      // measure natural size if available (expo-av provides naturalSize on load)
                      try {
                        const ns = (status && (status as any).naturalSize) || null;
                        const w = ns?.width ?? null;
                        const h = ns?.height ?? null;
                        if (w && h) {
                          const ratio = h / w;
                          setMediaAspectMap((prev) => {
                            if (prev[item.id] === ratio) return prev;
                            return { ...prev, [item.id]: ratio };
                          });
                          if (item.id === currentVisibleId) animateMediaHeightTo(item);
                        }
                      } catch {}
                      preloadMediaToCache(uri).catch(() => {});

                      const durationMs = typeof status?.durationMillis === "number" ? status.durationMillis : typeof status?.playableDurationMillis === "number" ? status.playableDurationMillis : durationMsFromEntry;
                      const positionMs = typeof status?.positionMillis === "number" ? status.positionMillis : 0;
                      updateVideoProgress(item.id, positionMs, durationMs);

                      if (isActive && isCurrentMedia && isScreenFocused && !videoPausedMap[item.id]) {
                        const ref = videoRefs.current.get(item.id);
                        const player = ref?.current ?? ref;
                        if (player) {
                          try {
                            if (typeof player.setPositionAsync === "function") await player.setPositionAsync(0).catch(() => {});
                            if (typeof player.playAsync === "function") await player.playAsync().catch(() => {});
                          } catch {}
                        }
                      }
                    } catch {}
                  }}
                  onLoadStart={() => {
                    startLoadTimersFor(item.id);
                    setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
                    setVideoStatusMap((m) => ({ ...m, [item.id]: { ...(m[item.id] || {}), isLoaded: false, isBuffering: true } }));
                  }}
                  onPlaybackStatusUpdate={async (status: AVPlaybackStatus | null) => {
                    if (!status) return;
                    const st: any = status;
                    setVideoStatusMap((m) => ({ ...m, [item.id]: { ...(m[item.id] || {}), isBuffering: !!st.isBuffering, isPlaying: !!st.isPlaying, isLoaded: !!st.isLoaded } }));
                    const duration = typeof st.durationMillis === "number" ? st.durationMillis : typeof st.playableDurationMillis === "number" ? st.playableDurationMillis : durationMsFromEntry;
                    const position = typeof st.positionMillis === "number" ? st.positionMillis : positionMsFromEntry;
                    updateVideoProgress(item.id, position, duration);
                    if ("didJustFinish" in st && st.didJustFinish) {
                      if (isActive && isCurrentMedia && isScreenFocused && !videoPausedMap[item.id]) {
                        const ref = videoRefs.current.get(item.id);
                        const player = ref?.current ?? ref;
                        if (player) {
                          try {
                            if (typeof player.replayAsync === "function") await player.replayAsync().catch(async () => {
                              if (typeof player.playFromPositionAsync === "function") await player.playFromPositionAsync(0).catch(() => {});
                              else if (typeof player.setPositionAsync === "function") await player.setPositionAsync(0).catch(() => {});
                            });
                            updateVideoProgress(item.id, 0, duration);
                          } catch {}
                        }
                      }
                    }
                  }}
                  onError={handleMediaError}
                />
              ) : (
                <Image
                  source={{ uri: cachedUri }}
                  style={{ width: WINDOW_W, height: '100%' }}
                  resizeMode={imageResizeMode}
                  onLoadStart={() => {
                    startLoadTimersFor(item.id);
                    setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
                  }}
                  onLoad={() => {
                    stopLoadTimersFor(item.id);
                    setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
                    handleMediaLoaded();
                    preloadMediaToCache(cachedUri).catch(() => {});
                  }}
                  onError={handleMediaError}
                />
              )}
              {/* HD badge - only show when media is HD */}
              {item.isHD && (
                <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }} pointerEvents="none">
                  {renderHDBadge()}
                </View>
              )}
            </Animated.View>
          );
        }
      };

      return (
        <View style={{ width: WINDOW_W, height: measuredItemH, backgroundColor: "#000" }}>
          {/* Gesture stack */}
          <TapGestureHandler
            ref={refsForItem.singleRef}
            onHandlerStateChange={onSingleTapHandler}
            waitFor={refsForItem.doubleRef}
            maxDelayMs={350}
          >
            <TapGestureHandler
              ref={refsForItem.doubleRef}
              onHandlerStateChange={onDoubleTapHandler}
              numberOfTaps={2}
            >
              <Animated.View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: MEDIA_NUDGE,
                  width: WINDOW_W,
                  height: animatedMediaHeight,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  backgroundColor: "#000",
                }}
              >
                {/* Full-height left/right pressables for speed-up while holding */}
                {item.media_type === 'video' ? (
                  <>
                          <Pressable
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: WINDOW_W * 0.5, zIndex: 980 }}
                            onPressIn={() => startSpeedHold(item.id)}
                            onPressOut={() => endSpeedHold(item.id)}
                          />
                    <Pressable
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: WINDOW_W * 0.5, zIndex: 980 }}
                      onPressIn={() => startSpeedHold(item.id)}
                      onPressOut={() => endSpeedHold(item.id)}
                    />
                  </>
                ) : null}
                {/* Heart animation overlay */}
                {likeAnimStoryId === item.id && (
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: "40%",
                      left: "40%",
                      zIndex: 999,
                      transform: [
                        { scale: likeAnimScale.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.2] }) },
                      ],
                      opacity: likeAnimScale.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.7, 0] }),
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.8,
                      shadowRadius: 10,
                      elevation: 12,
                    }}
                  >
                    <Ionicons name="heart" size={120} color="#FF4D6D" style={{ textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 16 }} />
                  </Animated.View>
                )}

                {/* Multi-image pager or single media */}
                {hasMultiple ? (
                  <FlatList
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    data={(item.media_urls || [])}
                    keyExtractor={(u) => u}
                    renderItem={({ item: uri }) => renderMediaCell({ uri, type: "image" }) || null}
                    style={{ width: WINDOW_W, height: "100%" }}
                    onMomentumScrollEnd={({ nativeEvent }) => {
                      const idx = Math.round(nativeEvent.contentOffset.x / WINDOW_W);
                      setMediaIndexMap((prev) => ({ ...prev, [item.id]: idx }));
                      Haptics.selectionAsync().catch(() => {});
                    }}
                  />
                ) : (
                  item.media_type === "video" ? (
                    <Animated.View style={{ width: WINDOW_W, height: "100%", justifyContent: "center", alignItems: "center", opacity: fadeAnim }}>
                      <Video
                        ref={(r: InstanceType<typeof Video> | null) => {
                          if (r) videoRefs.current.set(item.id, r);
                          else videoRefs.current.delete(item.id);
                        }}
                        source={{ uri: mediaUri }}
                        style={{ width: WINDOW_W, height: "100%" }}
                        resizeMode={videoResizeMode}
                        isMuted={false}
                        shouldPlay={isScreenFocused && isActive && !videoPausedMap[item.id]}
                        isLooping={isScreenFocused && isActive && !videoPausedMap[item.id]}
                        onLoad={async (status: any) => {
                          try {
                            stopLoadTimersFor(item.id);
                            setVideoStatusMap((m) => ({ ...m, [item.id]: { ...(m[item.id] || {}), isLoaded: true, isBuffering: false } }));
                            handleMediaLoaded();
                            try {
                              const ns = (status && (status as any).naturalSize) || null;
                              const w = ns?.width ?? null;
                              const h = ns?.height ?? null;
                              if (w && h) {
                                const ratio = h / w;
                                setMediaAspectMap((prev) => {
                                  if (prev[item.id] === ratio) return prev;
                                  return { ...prev, [item.id]: ratio };
                                });
                                if (item.id === currentVisibleId) animateMediaHeightTo(item);
                              }
                            } catch {}
                            preloadMediaToCache(remoteUri).catch(() => {});

                            const durationMs = typeof status?.durationMillis === "number" ? status.durationMillis : typeof status?.playableDurationMillis === "number" ? status.playableDurationMillis : durationMsFromEntry;
                            const positionMs = typeof status?.positionMillis === "number" ? status.positionMillis : 0;
                            updateVideoProgress(item.id, positionMs, durationMs);

                            if (isActive && isScreenFocused && !videoPausedMap[item.id]) {
                              const ref = videoRefs.current.get(item.id);
                              const player = ref?.current ?? ref;
                              if (player) {
                                try {
                                  if (typeof player.setPositionAsync === "function") await player.setPositionAsync(0).catch(() => {});
                                  if (typeof player.playAsync === "function") await player.playAsync().catch(() => {});
                                } catch {}
                              }
                            }
                          } catch {}
                        }}
                        onLoadStart={() => {
                          startLoadTimersFor(item.id);
                          setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
                          setVideoStatusMap((m) => ({ ...m, [item.id]: { ...(m[item.id] || {}), isLoaded: false, isBuffering: true } }));
                        }}
                        onPlaybackStatusUpdate={async (status: AVPlaybackStatus | null) => {
                          if (!status) return;
                          const st: any = status;
                          setVideoStatusMap((m) => ({ ...m, [item.id]: { ...(m[item.id] || {}), isBuffering: !!st.isBuffering, isPlaying: !!st.isPlaying, isLoaded: !!st.isLoaded } }));
                          const duration = typeof st.durationMillis === "number" ? st.durationMillis : typeof st.playableDurationMillis === "number" ? st.playableDurationMillis : durationMsFromEntry;
                          const position = typeof st.positionMillis === "number" ? st.positionMillis : positionMsFromEntry;
                          updateVideoProgress(item.id, position, duration);
                          if ("didJustFinish" in st && st.didJustFinish) {
                            if (isActive && isScreenFocused && !videoPausedMap[item.id]) {
                              const ref = videoRefs.current.get(item.id);
                              const player = ref?.current ?? ref;
                              if (player) {
                                try {
                                  if (typeof player.replayAsync === "function") await player.replayAsync().catch(async () => {
                                    if (typeof player.playFromPositionAsync === "function") await player.playFromPositionAsync(0).catch(() => {});
                                    else if (typeof player.setPositionAsync === "function") await player.setPositionAsync(0).catch(() => {});
                                  });
                                  updateVideoProgress(item.id, 0, duration);
                                } catch {}
                              }
                            }
                          }
                        }}
                        onError={handleMediaError}
                      />
                      {videoPausedMap[item.id] && (
                        <View style={styles.playPauseOverlay}>
                          <Ionicons name="play" size={64} color="#fff" style={{ opacity: 0.8, textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 }} />
                        </View>
                      )}
                    </Animated.View>
                  ) : (
                    <Animated.View style={{ width: WINDOW_W, height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', opacity: fadeAnim }}>
                      <Image
                        source={{ uri: mediaUri }}
                        style={{ width: WINDOW_W, height: '100%' }}
                        resizeMode={imageResizeMode}
                        onLoadStart={() => {
                          startLoadTimersFor(item.id);
                          setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
                        }}
                        onLoad={() => {
                          try {
                            stopLoadTimersFor(item.id);
                            setLoadTimedOut((m) => ({ ...m, [item.id]: false }));
                            handleMediaLoaded();
                            // measure remote image size (only if we don't already have it)
                            try {
                              if (!mediaAspectMap[item.id]) {
                                Image.getSize(mediaUri, (w, h) => {
                                  const ratio = h / w;
                                  setMediaAspectMap((prev) => ({ ...prev, [item.id]: ratio }));
                                  if (item.id === currentVisibleId) animateMediaHeightTo(item);
                                }, () => {});
                              }
                            } catch {}
                            preloadMediaToCache(remoteUri).catch(() => {});
                          } catch {}
                        }}
                        onError={handleMediaError}
                      />
                    </Animated.View>
                  )
                )}

                {/* progress overlay — positioned at the bottom of the media */}
                {shouldShowProgress ? (
                  (() => {
                    const progressBottom = item.media_type === 'video' ? ((reservedBottom || 0) + BOTTOM_OVERLAY_OFFSET + CONTROLS_DROP + PROGRESS_DROP) : 12;
                    return (
                      <View style={{ position: 'absolute', left: 0, right: 0, bottom: progressBottom, alignItems: 'stretch', zIndex: 950 }} pointerEvents={isActive ? 'auto' : 'none'}>
                        
                        {/* left half pressable to speed video */}
                        {item.media_type === 'video' ? (
                          <Pressable
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: WINDOW_W * 0.5, zIndex: 960 }}
                            onPressIn={() => handleSpeedPressIn(item.id)}
                            onPressOut={() => handleSpeedPressOut(item.id)}
                          />
                        ) : null}

                        <View
                          style={[styles.videoProgressTrack, { width: '100%' }]}
                          onLayout={({ nativeEvent }) => {
                            progressTrackWidthRef.current[item.id] = nativeEvent.layout.width;
                          }}
                          {...(progressPan ? progressPan.panHandlers : {})}
                        >
                          <View style={styles.videoProgressBackground} />
                          <View style={[styles.videoProgressFill, { width: fillWidth }]} />
                          <Animated.View
                            style={[styles.videoProgressThumb, { transform: [{ translateX: thumbTranslate }] }]}
                          />
                        </View>
                      </View>
                    );
                  })()
                ) : null}
              </Animated.View>
            </TapGestureHandler>
          </TapGestureHandler>

          {/* progress moved into media overlay */}

          {/* skeleton/loading overlay - shows until media is loaded */}
          {!mediaLoadedMap[item.id] && (
            <View style={styles.skeletonOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}


          {/* bottom-left info (raised a bit) */}
          <View style={[styles.bottomUserOverlay, { bottom: (reservedBottom || 0) + BOTTOM_OVERLAY_OFFSET - 24 + CONTROLS_DROP + LEFT_INFO_DROP }]}> 
            <View style={styles.userInfoRow}>
              {/* Label pill (increased font, bold, slimmer) */}
              {item.label || (item.partnership_avatars && item.partnership_avatars.length) ? (
                <View style={styles.labelRow}>
                  {/* partnership avatars (colliding up to 3) */}
                  {item.partnership_avatars && item.partnership_avatars.length > 0 ? (
                    <View style={[styles.collideWrap, { width: 24 + (item.partnership_avatars.length - 1) * 12 + 6 }]}>
                      {item.partnership_avatars.slice(0, 3).map((uri, idx) => {
                        const left = idx * 12;
                        const size = 24;
                        return (
                          <Image
                            key={idx}
                            source={{ uri }}
                            style={[styles.collideImgBase, { width: size, height: size, borderRadius: size / 2, left, zIndex: 10 - idx, borderWidth: 1, borderColor: "#000" }]}
                          />
                        );
                      })}
                    </View>
                  ) : null}

                  <View style={styles.labelPillSlim}>
                    <Text numberOfLines={1} style={styles.labelPillTextLarge}>
                      {item.label ?? ""}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[styles.headerTitleSmall, {
                  textShadowColor: '#000',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 8,
                }]} numberOfLines={1}>
                  {item.profiles?.full_name ?? item.profiles?.username ?? "Unknown"}
                </Text>
                {/* verification badge after full_name */}
                {item.profiles?.full_name ? <VerificationBadge /> : null}
                {/* Callout button after user's full name */}
                <TouchableOpacity
                  style={styles.shootBtnPill}
                  onPress={() => {
                    setShootTarget(item);
                    setSelectedCalloutRecipients(new Set());
                    // load callout candidates then open modal
                    loadCalloutCandidates().catch(() => {});
                    setCalloutModalVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.shootBtnText, {
                    textShadowColor: '#000',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 6,
                  }]}>Callout</Text>
                </TouchableOpacity>
              </View>
              {hasMultiple ? (
                <View style={styles.multiMetaRow}>
                  <View style={styles.multiBadge}>
                    <Text style={styles.multiBadgeText}>{`${multiIndex + 1}/${(item.media_urls || []).length}`}</Text>
                  </View>
                  <View style={styles.multiDotsRow}>
                    {(item.media_urls || []).map((_, i) => (
                      <View key={i} style={[styles.dot, i === multiIndex ? styles.dotActive : null]} />
                    ))}
                  </View>
                </View>
              ) : null}
              <Text style={[styles.headerSubSmall, {
                textShadowColor: '#000',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 6,
              }]}>{timeAgoLabel(item.created_at ?? undefined)}</Text>

              {/* expiry label (new) */}
              {item.expire_at ? (
                <Text style={{ color: "#cbd5e1", marginTop: 4, fontWeight: "700" }}>{timeLeftLabel(item.expire_at)}</Text>
              ) : null}
            </View>
            {item.location ? (
              <TouchableOpacity
                style={styles.locationRow}
                onPress={() => { openLocationSheet(item.location ?? ""); }}
                activeOpacity={0.9}
              >
                <Ionicons name="location" size={16} color="#E6EEF3" style={{ marginRight: 6 }} />
                <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{item.location}</Text>
              </TouchableOpacity>
            ) : null}
            {item.caption ? (
              <Text style={[styles.captionTextRow, {
                textShadowColor: '#000',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
              }]} numberOfLines={2}>{item.caption}</Text>
            ) : (
              /* Comment pill when no caption - opens comment sheet */
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCommentSheetVisible(true);
                  animateSheetTo(SHEET_OPEN_TOP);
                  fetchCommentsForActive();
                }}
                activeOpacity={0.8}
                style={{
                  marginTop: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                  backgroundColor: 'transparent',
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '500' }}>Type something...</Text>
              </TouchableOpacity>
            )}
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

          {/* right action column */}
          <View style={[styles.rightActionCol, { bottom: (reservedBottom || 0) + 20 + CONTROLS_DROP + RIGHT_CONTROLS_DROP, right: 8 }]}>
            <View style={{ marginBottom: 2, position: "relative", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => {
                  try {
                    // Prefetch user data before navigation for instant load
                    prefetchProfile(String(item.user_id)).catch(() => {});
                    prefetchUserStories(String(item.user_id)).catch(() => {});
                    router.push({ pathname: "/profile/view/[id]", params: { id: String(item.user_id) } });
                  } catch {}
                }}
                activeOpacity={0.85}
                style={styles.sideAvatarWrap}
              >
                <View style={{
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.4,
                  shadowRadius: 4,
                }}>
                  <Image source={item.profiles?.avatar_url ? { uri: buildCloudinaryUrl(item.profiles.avatar_url, "image") ?? item.profiles.avatar_url } : { uri: PLACEHOLDER_AVATAR }} style={[styles.sideAvatar]} />
                </View>
              </TouchableOpacity>

              {!isFollowingState[String(item.user_id)] ? (
                <TouchableOpacity
                  onPress={() => handleFollowToggle(String(item.user_id))}
                  activeOpacity={0.85}
                  style={styles.plusOverlay}
                >
                  <Ionicons name="add" size={14} color="#fff" style={{
                    textShadowColor: '#000',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.actionCluster}>
              {/* Like */}
              <TouchableOpacity
                onPress={() => handleLikeToggle(item.id, item.is_business ?? false)}
                activeOpacity={0.85}
                style={styles.actionItem}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} // easier to tap
              >
                <View style={styles.iconBackdrop}>
                  <Ionicons name="heart" size={32} color={isLikedState[item.id] ? "#FF4D6D" : "#fff"} style={{
                    textShadowColor: '#000',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }} />
                </View>
                { (likesCountMap[item.id] ?? 0) > 0 ? <Text style={[styles.actionLabel, {
                  textShadowColor: '#000',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }]}>{formatCount(likesCountMap[item.id])}</Text> : null}
              </TouchableOpacity>

              {/* Comments */}
              <TouchableOpacity style={styles.actionItem} onPress={() => {
                setCommentSheetVisible(true);
                animateSheetTo(SHEET_OPEN_TOP);
                fetchCommentsForActive();
              }} activeOpacity={0.85} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <View style={styles.iconBackdrop}>
                  <Ionicons name="chatbubble-ellipses" size={32} color="#fff" style={{
                    textShadowColor: '#000',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }} />
                </View>
                { commentCount ? <Text style={[styles.actionLabel, {
                  textShadowColor: '#000',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }]}>{formatCount(commentCount)}</Text> : null }
              </TouchableOpacity>

              {/* Views (open viewers sheet quickly: do not await fetch) */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  if (!item.id) return;
                  // fire-and-forget fetch; open sheet immediately
                  fetchStoryViewers(item.id).catch(() => {});
                  setViewersModalVisible(true);
                  animateViewersTo(VIEWERS_SHEET_OPEN_TOP);
                }}
                activeOpacity={0.85}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.iconBackdrop}>
                  <Ionicons name="eye" size={30} color="#fff" style={{
                    textShadowColor: '#000',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }} />
                </View>
                { (viewsCountMap[item.id] ?? 0) > 0 ? <Text style={[styles.actionLabel, {
                  textShadowColor: '#000',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }]}>{formatCount(viewsCountMap[item.id] ?? 0)}</Text> : null }
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  handleShare(item);
                }}
                activeOpacity={0.85}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.iconBackdrop}>
                  <Ionicons name="share-social" size={30} color="#fff" style={{
                    textShadowColor: '#000',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* first viewer toast */}
          {firstViewerToast ? (
            <Animated.View style={[styles.firstViewerToast, { opacity: firstViewerAnim }]}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>{firstViewerToast}</Text>
            </Animated.View>
          ) : null}
        </View>
      );
    },
    [
      currentVisibleId,
      loadingMap,
      loadTimedOut,
      isFollowingState,
      isLikedState,
      likesCountMap,
      commentsList,
      commentsCountMap,
      viewsCountMap,
      stories,
      handleFollowToggle,
      handleLikeToggle,
      likeAnimStoryId,
      likeAnimScale,
      handleDoubleTap,
      viewsCountMap,
      likesCountMap,
      isLikedState,
      isFollowingState,
      loadingMap,
      loadTimedOut,
      stories,
      allStories,
      animateSheetTo,
      fetchCommentsForActive,
      fetchStoryViewers,
      setCommentSheetVisible,
      setViewersModalVisible,
      animateViewersTo,
      setShootSheetVisible,
      animateShootTo,
      videoPausedMap,
      setVideoPausedMap,
      handleVideoPress,
      videoStatusMap,
      mediaAspectMap,
      videoProgressMap,
      updateVideoProgress,
      isScreenFocused,
      isConnected,
      commentLikedByMe,
      commentLikesMap,
      firstViewerToast,
      mediaIndexMap,
    ]
  );

  /* ---------------------- Shoot sheet logic ---------------------- */

  // New: load callout candidates (followers + followers fallback)
  const loadCalloutCandidates = async () => {
    try {
      setCalloutCandidates([]);
      const { data } = await supabase.auth.getUser();
      const myId = data?.user?.id;
      if (!myId) return setCalloutCandidates([]);

      const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", myId).limit(500);
      const { data: followerRows } = await supabase.from("follows").select("follower_id").eq("following_id", myId).limit(500);

      const ids = new Set<string>();
      (followingRows || []).forEach((r: any) => r?.following_id && ids.add(r.following_id));
      (followerRows || []).forEach((r: any) => r?.follower_id && ids.add(r.follower_id));
      ids.delete(myId);
      const idArray = Array.from(ids).slice(0, 60);

      let candidates: ProfileShort[] = [];
      if (idArray.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", idArray).order("full_name", { ascending: true }).limit(60);
        candidates = (profs || []) as ProfileShort[];
      }

      if (!candidates.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username, avatar_url").limit(40);
        candidates = (profs || []) as ProfileShort[];
      }

      setCalloutCandidates(candidates);
    } catch (err) {
      console.warn("loadCalloutCandidates err", err);
      setCalloutCandidates([]);
    }
  };

  const toggleCalloutRecipient = (id?: string | null) => {
    if (!id) return;
    setSelectedCalloutRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const findOrCreateDM = async (targetId: string) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const myId = u?.user?.id;
      if (!myId) throw new Error("Not signed in");

      const { data: myParts } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", myId);
      const myConvoIds = (myParts || []).map((r: any) => r.conversation_id);

      if (myConvoIds.length) {
        const { data: combos } = await supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", myConvoIds);
        const byConvo: Record<string, Set<string>> = {};
        (combos || []).forEach((row: any) => {
          if (!byConvo[row.conversation_id]) byConvo[row.conversation_id] = new Set<string>();
          byConvo[row.conversation_id].add(row.user_id);
        });

        for (const [cid, members] of Object.entries(byConvo)) {
          if (members.size === 2 && members.has(myId) && members.has(targetId)) {
            return cid;
          }
        }
      }

      const ins = await supabase.from("conversations").insert({ is_group: false, created_by: myId }).select("id").single();
      if (ins.error || !ins.data) throw ins.error || new Error("Could not create conversation");
      const cid = ins.data.id;
      let partErr: any = null;
      try {
        const { error } = await supabase.from("conversation_participants").insert([
          { conversation_id: cid, user_id: myId, accepted: true },
          { conversation_id: cid, user_id: targetId, accepted: false },
        ]);
        partErr = error;
      } catch (e) {
        partErr = e;
      }

      if (partErr) {
        console.warn("participant insert failed with accepted flag, falling back", partErr);
        try {
          const { error: fbErr } = await supabase.from("conversation_participants").insert([
            { conversation_id: cid, user_id: myId },
            { conversation_id: cid, user_id: targetId },
          ]);
          if (fbErr) throw fbErr;
        } catch (e) {
          console.error("participant insert fallback failed", e);
          try { await supabase.from('conversations').delete().eq('id', cid); } catch {};
          throw e;
        }
      }
      // invites are prompt-driven via conversation_participants.accepted; do not create message rows

      return cid;
    } catch (err) {
      console.warn("findOrCreateDM err", err);
      throw err;
    }
  };

  const sendCalloutToRecipients = async (recipientIds?: string[]) => {
    const ids = Array.isArray(recipientIds) && recipientIds.length ? recipientIds : Array.from(selectedCalloutRecipients);
    if (!shootTarget) {
      Alert.alert("No target", "No story selected to callout.");
      return;
    }
    if (!ids.length) {
      Alert.alert("Select recipients", "Pick at least one person to send to.");
      return;
    }
    setCalloutLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const myId = u?.user?.id;
      if (!myId) throw new Error("Not signed in");

      // Build media url and type for messages
      const mediaUrl = shootTarget.media_url || shootTarget.raw_media_url || "";
      const mediaType = shootTarget.media_type === "video" ? "video" : "image";

      const results: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const targetId of ids) {
        try {
          const cid = await findOrCreateDM(targetId);
          if (!cid) {
            results.push({ id: targetId, success: false, error: 'no-convo' });
            continue;
          }
          const message = {
            conversation_id: cid,
            sender_id: myId,
            content: shootTarget.caption ?? "",
            media_url: mediaUrl,
            media_type: mediaType,
            story_id: shootTarget.id,
          } as any;
          const { data: inserted, error: insertErr } = await supabase.from('messages').insert(message).select('id').single();
          if (insertErr || !inserted?.id) {
            results.push({ id: targetId, success: false, error: String(insertErr?.message ?? insertErr) });
          } else {
            results.push({ id: targetId, success: true });
          }
        } catch (err) {
          console.warn('sendCallout err', err);
          results.push({ id: targetId, success: false, error: String(err) });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      if (failed > 0) {
        const ex = results.find((r) => !r.success && r.error)?.error ?? 'Some recipients failed';
        Alert.alert(`${succeeded} delivered`, `${failed} failed. First error: ${ex}`);
      } else {
        Alert.alert('Delivered', `Callout sent to ${succeeded} recipient${succeeded > 1 ? 's' : ''}.`);
      }

      setCalloutModalVisible(false);
      setSelectedCalloutRecipients(new Set());
      setShootTarget(null);
    } catch (err) {
      console.warn('sendCalloutToRecipients err', err);
      Alert.alert('Send failed', 'Could not send to some recipients.');
    } finally {
      setCalloutLoading(false);
    }
  };

  /* ---------------------- render shoot sheet ---------------------- */
  function renderCalloutModal() {
    if (!calloutModalVisible) return null;
    
    // Filter candidates based on search
    const filteredCandidates = calloutSearchQuery.trim() 
      ? calloutCandidates.filter((c) => {
          const query = calloutSearchQuery.toLowerCase();
          return (c?.full_name?.toLowerCase().includes(query) || c?.username?.toLowerCase().includes(query));
        })
      : calloutCandidates;
    
    return (
      <Modal visible={calloutModalVisible} animationType="slide" onRequestClose={() => { setCalloutModalVisible(false); setCalloutSearchQuery(''); }}>
        <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
          {/* Safe Area Header */}
          <View style={{ paddingTop: insets.top, backgroundColor: '#0a0a0f' }}>
            {/* Premium Header with Gradient Accent */}
            <LinearGradient
              colors={['rgba(212,175,55,0.08)', 'transparent']}
              style={{ paddingBottom: 2 }}
            >
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                paddingHorizontal: 16, 
                paddingVertical: 14,
              }}>
                {/* Close Button with Glassmorphism */}
                <Pressable 
                  onPress={() => { setCalloutModalVisible(false); setCalloutSearchQuery(''); }}
                  style={({ pressed }) => ({ 
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  })}
                >
                  <Ionicons name="chevron-down" size={24} color="#fff" />
                </Pressable>
                
                {/* Center Title Block */}
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 8,
                      backgroundColor: 'rgba(212,175,55,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="megaphone" size={15} color={VELT_ACCENT} />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 }}>Send Callout</Text>
                  </View>
                  {selectedCalloutRecipients.size > 0 && (
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      marginTop: 6,
                      backgroundColor: 'rgba(212,175,55,0.12)',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: VELT_ACCENT, marginRight: 6 }} />
                      <Text style={{ color: VELT_ACCENT, fontSize: 12, fontWeight: '600' }}>
                        {selectedCalloutRecipients.size} {selectedCalloutRecipients.size === 1 ? 'person' : 'people'} selected
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Send Button - Premium Style */}
                <Pressable 
                  onPress={() => { 
                    const recips = Array.from(selectedCalloutRecipients); 
                    if (recips.length === 0) { 
                      Alert.alert('No recipients', 'Please select at least one recipient'); 
                      return; 
                    } 
                    sendCalloutToRecipients(recips); 
                  }}
                  style={({ pressed }) => ({ 
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 16,
                    paddingVertical: 10, 
                    borderRadius: 20,
                    backgroundColor: selectedCalloutRecipients.size > 0 ? VELT_ACCENT : 'rgba(255,255,255,0.08)',
                    borderWidth: selectedCalloutRecipients.size > 0 ? 0 : 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                    shadowColor: selectedCalloutRecipients.size > 0 ? VELT_ACCENT : 'transparent',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: selectedCalloutRecipients.size > 0 ? 4 : 0,
                  })}
                >
                  <Ionicons 
                    name={calloutLoading ? "hourglass-outline" : "send"} 
                    size={16} 
                    color={selectedCalloutRecipients.size > 0 ? '#000' : 'rgba(255,255,255,0.6)'} 
                  />
                  <Text style={{ 
                    color: selectedCalloutRecipients.size > 0 ? '#000' : 'rgba(255,255,255,0.6)', 
                    fontWeight: '700', 
                    fontSize: 14 
                  }}>
                    {calloutLoading ? 'Sending...' : 'Send'}
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
            
            {/* Divider with subtle gradient */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            
            {/* Search Bar - Enhanced */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: 'rgba(255,255,255,0.06)', 
                borderRadius: 14,
                paddingHorizontal: 14,
                height: 48,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
                <TextInput
                  value={calloutSearchQuery}
                  onChangeText={setCalloutSearchQuery}
                  placeholder="Search followers..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={{ 
                    flex: 1, 
                    marginLeft: 12, 
                    color: '#fff', 
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {calloutSearchQuery.length > 0 && (
                  <Pressable 
                    onPress={() => setCalloutSearchQuery('')} 
                    style={({ pressed }) => ({ 
                      padding: 6,
                      borderRadius: 12,
                      backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                    })}
                  >
                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                )}
              </View>
            </View>
            
            {/* Quick Actions - Pill Style */}
            <View style={{ 
              flexDirection: 'row', 
              paddingHorizontal: 16, 
              paddingBottom: 14,
              gap: 10,
            }}>
              <Pressable 
                onPress={() => { 
                  if (profile?.id) { 
                    const ids = (calloutCandidates || []).map((c) => c?.id).filter(Boolean) as string[]; 
                    setSelectedCalloutRecipients(new Set(ids)); 
                  } 
                }}
                style={({ pressed }) => ({ 
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: pressed ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: pressed ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Ionicons name="checkmark-done" size={16} color="rgba(255,255,255,0.7)" />
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 13 }}>Select All</Text>
              </Pressable>
              <Pressable 
                onPress={() => { setSelectedCalloutRecipients(new Set()); }}
                style={({ pressed }) => ({ 
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: pressed ? 'rgba(255,100,100,0.12)' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: pressed ? 'rgba(255,100,100,0.25)' : 'rgba(255,255,255,0.08)',
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Ionicons name="close-outline" size={16} color="rgba(255,255,255,0.7)" />
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 13 }}>Clear</Text>
              </Pressable>
              
              {/* Followers Count Pill */}
              <View style={{ 
                marginLeft: 'auto',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}>
                <Ionicons name="people" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 12 }}>
                  {calloutCandidates.length}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Users List */}
          {filteredCandidates.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              {calloutCandidates.length === 0 ? (
                <>
                  <ActivityIndicator size="large" color={VELT_ACCENT} />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 16, fontSize: 15 }}>Loading followers...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="search" size={48} color="rgba(255,255,255,0.2)" />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 16, fontSize: 16, fontWeight: '600' }}>No results found</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 6, fontSize: 14, textAlign: 'center' }}>
                    Try a different search term
                  </Text>
                </>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredCandidates}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, paddingBottom: insets.bottom + 20 }}
              keyExtractor={(it) => String(it?.id ?? Math.random())}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />}
              renderItem={({ item }) => {
                const id = String(item?.id || "");
                const displayName = item?.full_name || item?.username || "Unknown";
                const username = item?.username ? `@${item.username}` : '';
                const selected = selectedCalloutRecipients.has(id);
                return (
                  <Pressable 
                    onPress={() => toggleCalloutRecipient(id)} 
                    style={({ pressed }) => ({ 
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      backgroundColor: selected ? 'rgba(212,175,55,0.12)' : (pressed ? 'rgba(255,255,255,0.04)' : 'transparent'),
                    })}
                  >
                    {/* Avatar */}
                    <View style={{ position: 'relative' }}>
                      {item?.avatar_url ? (
                        <Image 
                          source={{ uri: item.avatar_url }} 
                          style={{ 
                            width: 52, 
                            height: 52, 
                            borderRadius: 26,
                            borderWidth: selected ? 2 : 0,
                            borderColor: VELT_ACCENT,
                          }} 
                        />
                      ) : (
                        <View style={{ 
                          width: 52, 
                          height: 52, 
                          borderRadius: 26, 
                          backgroundColor: 'rgba(255,255,255,0.1)', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          borderWidth: selected ? 2 : 0,
                          borderColor: VELT_ACCENT,
                        }}>
                          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                            {(item?.full_name || item?.username || 'U').slice(0,1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {selected && (
                        <View style={{ 
                          position: 'absolute', 
                          bottom: -2, 
                          right: -2, 
                          backgroundColor: VELT_ACCENT, 
                          width: 22, 
                          height: 22, 
                          borderRadius: 11, 
                          justifyContent: 'center', 
                          alignItems: 'center',
                          borderWidth: 2,
                          borderColor: '#0a0a0f',
                        }}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                      )}
                    </View>
                    
                    {/* User Info */}
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{displayName}</Text>
                      {username ? (
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 2 }}>{username}</Text>
                      ) : null}
                    </View>
                    
                    {/* Selection Indicator */}
                    <View style={{ 
                      width: 26, 
                      height: 26, 
                      borderRadius: 13, 
                      borderWidth: 2,
                      borderColor: selected ? VELT_ACCENT : 'rgba(255,255,255,0.2)',
                      backgroundColor: selected ? VELT_ACCENT : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    );
  }

  // For Following tab, don't fall back to allStories - show empty state instead
  const visibleStories = selectedTab === 'Following' 
    ? stories 
    : ((stories && stories.length) ? stories : (allStories && allStories.length ? allStories : []));

  useEffect(() => {
    const targetId = pendingRouteStoryIdRef.current;
    if (!targetId) return;
    const idx = visibleStories.findIndex((s) => s.id === targetId);
    if (idx === -1) return;
    if (storyScrollAppliedRef.current === targetId) return;
    storyScrollAppliedRef.current = targetId;
    setTimeout(() => {
      const list = flatListRef.current;
      if (!list) return;
      try {
        list.scrollToIndex({ index: idx, animated: true });
      } catch {
        try {
          // Fallback: use measured item height (most accurate)
          list.scrollToOffset({ offset: idx * (measuredItemHRef.current || WINDOW_H), animated: true });
        } catch {}
      }
      setCurrentVisibleId(targetId);
    }, 180);
  }, [visibleStories]);

  useEffect(() => {
    const anchor = pendingRouteStoryIdRef.current;
    if (anchor && currentVisibleId === anchor) {
      pendingRouteStoryIdRef.current = null;
    }
  }, [currentVisibleId]);

  function renderCommentsSheet(): React.ReactNode {
    if (!commentSheetVisible) return null;

    return (
      <Modal
        visible={commentSheetVisible}
        animationType="none"
        transparent
        onRequestClose={() => {
          animateSheetTo(SHEET_CLOSED, () => {
            setCommentSheetVisible(false);
            setReplyTarget(null);
          });
        }}
      >
        {/* Animated blur overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: commentOverlayFade }]}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill}>
            <TouchableWithoutFeedback
              onPress={() => {
                animateSheetTo(SHEET_CLOSED, () => {
                  setCommentSheetVisible(false);
                  setReplyTarget(null);
                });
              }}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
            </TouchableWithoutFeedback>
          </BlurView>
        </Animated.View>

        <Animated.View 
          style={[
            styles.commentSheetContainer, 
            { 
              top: sheetY,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }
          ]} 
          {...panResponder.panHandlers}
        >
          {/* Glassmorphism background */}
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,25,0.88)' }]} />
          </BlurView>
          
          {/* Enhanced drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Comments</Text>
            <Pressable
              onPress={() => {
                animateSheetTo(SHEET_CLOSED, () => {
                  setCommentSheetVisible(false);
                  setReplyTarget(null);
                });
              }}
              style={({ pressed }) => ({
                padding: 10,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.08)',
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {replyTarget ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                  <Text style={{ color: "rgba(255,255,255,0.6)" }}>Replying to </Text>
                  <Text style={{ fontWeight: "800", marginLeft: 4, color: VELT_ACCENT }}>{replyTarget.displayName ?? "user"}</Text>
                  <TouchableOpacity onPress={() => setReplyTarget(null)} style={{ marginLeft: 'auto' }}>
                    <Text style={{ color: "#ef4444", fontWeight: "700" }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* If no comments: show pulsing 'be the first to comment' */}
              {commentsList.length === 0 ? (
                <Animated.View style={{ transform: [{ scale: firstCommentPulse }], marginBottom: 12 }}>
                  <View style={[styles.firstCommentCard, { paddingVertical: 16 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Be the first to comment</Text>
                        <Text style={{ color: "#9AA4B2", marginTop: 2 }}>Share your thoughts — spark the conversation.</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder={replyTarget ? `Reply to ${replyTarget.displayName}` : "Add a comment..."}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                    paddingHorizontal: 18,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontSize: 15,
                  }}
                  returnKeyType="send"
                  onSubmitEditing={async () => {
                    if (!currentVisibleId) return;
                    const txt = commentDraft?.trim();
                    if (!txt) return;
                    await handleAddComment(currentVisibleId, txt);
                    Keyboard.dismiss();
                  }}
                />

                <Pressable
                  onPress={async () => {
                    if (!currentVisibleId) return;
                    const txt = commentDraft?.trim();
                    if (!txt) return;
                    await handleAddComment(currentVisibleId, txt);
                    Keyboard.dismiss();
                  }}
                  style={({ pressed }) => ({
                    marginLeft: 12,
                    backgroundColor: commentDraft?.trim() ? VELT_ACCENT : 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 20,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <Text style={{ color: commentDraft?.trim() ? '#000' : 'rgba(255,255,255,0.4)', fontWeight: "700", fontSize: 14 }}>Send</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>

          {commentsLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={VELT_ACCENT} />
              <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 14 }}>Loading comments...</Text>
            </View>
          ) : (
            (() => {
              // build replies map and top-level comments
              const repliesMap: Record<string, any[]> = {};
              const topLevel: any[] = [];
              for (const c of commentsList) {
                const pid = c.parent_id ?? null;
                if (!pid) topLevel.push(c);
                else {
                  if (!repliesMap[pid]) repliesMap[pid] = [];
                  repliesMap[pid].push(c);
                }
              }

              // helper to render a comment and its nested replies (up to a sane depth)
              const maxShow = 5;
              const renderCommentWithReplies = (comment: any, level = 0) => {
                const prof = comment?.profiles ?? comment?.profile ?? null;
                const likeCnt = commentLikesMap[comment.id] ?? 0;
                const liked = !!commentLikedByMe[comment.id];

                const replies = repliesMap[comment.id] ? [...repliesMap[comment.id]].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];
                const isExpanded = !!expandedComments[comment.id];
                const isFull = !!fullExpandedComments[comment.id];
                const shownReplies = isExpanded ? (isFull ? replies : replies.slice(0, maxShow)) : [];

                return (
                  <View key={comment.id}>
                    <View style={{ flexDirection: "row", paddingVertical: 10, alignItems: "flex-start", paddingHorizontal: 16, marginLeft: level ? 12 * level : 0 }}>
                      <Image
                        source={prof?.avatar_url ? { uri: buildCloudinaryUrl(prof.avatar_url, "image") ?? prof.avatar_url } : { uri: PLACEHOLDER_AVATAR }}
                        style={{ width: level > 0 ? 32 : 40, height: level > 0 ? 32 : 40, borderRadius: level > 0 ? 16 : 20, marginRight: 12 }}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", maxWidth: WINDOW_W * 0.6 }}>
                              <Text style={{ fontWeight: "800", fontSize: 14, color: "#fff" }} numberOfLines={1}>{prof?.full_name ?? prof?.username ?? "Unknown"}</Text>
                              {prof?.full_name ? <VerificationBadge /> : null}
                              {level > 0 ? <Text style={{ marginLeft: 8, color: "#9AA4B2" }}>Reply</Text> : null}
                            </View>
                          <Text style={{ color: "#9AA4B2", fontSize: 12 }}>{timeAgoLabel(comment?.created_at)}</Text>
                        </View>
                        <Text style={{ marginTop: 6, fontSize: 15, color: "#fff" }}>{comment?.content}</Text>

                                <View style={{ flexDirection: "row", marginTop: 8, alignItems: "center" }}>
                                  <TouchableOpacity onPress={() => {
                                    setReplyTarget({ commentId: comment.id, displayName: prof?.full_name ?? prof?.username ?? "user" });
                                  }} style={{ marginRight: 18 }}>
                                    <Text style={{ color: "#6b7280", fontWeight: "700" }}>Reply</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity onPress={() => toggleCommentLike(comment.id)} style={{ flexDirection: "row", alignItems: "center" }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                    <Ionicons name="heart" size={18} color={liked ? "#FF4D6D" : "#9AA4B2"} />
                                    <Text style={{ color: "#9AA4B2", marginLeft: 8, fontWeight: "700" }}>{formatCount(likeCnt)}</Text>
                                  </TouchableOpacity>

                                  {/* optimistic / failed status */}
                                  {comment._optimistic ? (
                                    <View style={{ marginLeft: 12, flexDirection: 'row', alignItems: 'center' }}>
                                      <ActivityIndicator size="small" color="#9AA4B2" />
                                      <Text style={{ color: '#9AA4B2', marginLeft: 8, fontWeight: '700' }}>Sending…</Text>
                                    </View>
                                  ) : comment._failed ? (
                                    <View style={{ marginLeft: 12, flexDirection: 'row', alignItems: 'center' }}>
                                      <Text style={{ color: '#ef4444', fontWeight: '800', marginRight: 8 }}>Failed</Text>
                                      <TouchableOpacity onPress={() => retryComment(comment.id)}>
                                        <Text style={{ color: VELT_ACCENT, fontWeight: '800' }}>Retry</Text>
                                      </TouchableOpacity>
                                    </View>
                                  ) : null}
                                </View>
                      </View>
                    </View>

                    {/* replies list for this comment */}
                    {replies.length > 0 ? (
                      <View style={{ paddingLeft: 16, paddingRight: 16, marginTop: 0 }}>
                        <TouchableOpacity onPress={() => setExpandedComments((p) => ({ ...(p || {}), [comment.id]: !isExpanded }))} style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: VELT_ACCENT, backgroundColor: 'transparent' }}>
                            <Text style={{ color: VELT_ACCENT, fontSize: 13, fontWeight: '700' }}>{isExpanded ? `Hide ${replies.length} repl${replies.length>1?'ies':'y'}` : `Show ${Math.min(replies.length, maxShow)} repl${replies.length>1?'ies':'y'}`}</Text>
                          </View>
                        </TouchableOpacity>

                        {isExpanded && shownReplies.map((r: any) => renderCommentWithReplies(r, Math.min(level + 1, 3)))}

                        {isExpanded && replies.length > maxShow && !isFull && (
                          <TouchableOpacity onPress={() => setFullExpandedComments((p) => ({ ...(p || {}), [comment.id]: true }))} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: VELT_ACCENT, backgroundColor: 'transparent' }}>
                              <Text style={{ color: VELT_ACCENT, fontSize: 13, fontWeight: '700' }}>{`Show all ${replies.length} replies`}</Text>
                            </View>
                          </TouchableOpacity>
                        )}

                        {isExpanded && isFull && replies.length > maxShow && (
                          <TouchableOpacity onPress={() => setFullExpandedComments((p) => ({ ...(p || {}), [comment.id]: false }))} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: VELT_ACCENT, backgroundColor: 'transparent' }}>
                              <Text style={{ color: VELT_ACCENT, fontSize: 13, fontWeight: '700' }}>{`Show less`}</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              };

              return (
                <NativeViewGestureHandler ref={commentsNativeRef}>
                  <View style={{ flex: 1 }}>
                    <FlatList
                      data={topLevel}
                      keyExtractor={(it: any) => String(it.id ?? Math.random())}
                      renderItem={({ item }: any) => renderCommentWithReplies(item, 0)}
                      style={{ flex: 1 }}
                      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
                      showsVerticalScrollIndicator={false}
                      keyboardDismissMode="on-drag"
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                      scrollEnabled={true}
                      onScroll={({ nativeEvent }) => { commentScrollOffsetRef.current = nativeEvent.contentOffset.y; }}
                      scrollEventThrottle={16}
                      onScrollBeginDrag={() => { listDraggingRef.current = true; }}
                      onScrollEndDrag={() => { setTimeout(() => (listDraggingRef.current = false), 50); }}
                      onMomentumScrollBegin={() => { listDraggingRef.current = true; }}
                      onMomentumScrollEnd={() => { listDraggingRef.current = false; }}
                      // Performance optimizations
                      removeClippedSubviews={Platform.OS === 'android'}
                      maxToRenderPerBatch={10}
                      windowSize={5}
                      initialNumToRender={8}
                      getItemLayout={undefined}
                      ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                          <Ionicons name="chatbubble-outline" size={48} color="rgba(255,255,255,0.2)" />
                          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 15 }}>No comments yet</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.35)', marginTop: 4, fontSize: 13 }}>Be the first to share your thoughts</Text>
                        </View>
                      }
                    />
                  </View>
                </NativeViewGestureHandler>
              );
            })()
          )}

        </Animated.View>
      </Modal>
    );
  }

  function renderViewersModal(): React.ReactNode {
    if (!viewersModalVisible) return null;

    return (
      <Modal
        visible={viewersModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          animateViewersTo(VIEWERS_SHEET_CLOSED, () => setViewersModalVisible(false));
        }}
      >
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback
            onPress={() => {
              animateViewersTo(VIEWERS_SHEET_CLOSED, () => setViewersModalVisible(false));
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          </TouchableWithoutFeedback>
        </BlurView>

        <Animated.View style={[styles.commentSheetContainer, { top: viewersY, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,25,0.88)' }]} />
          </BlurView>
          
          {/* Drag handle */}
          <View style={[styles.sheetDragHandleWrap, { paddingTop: 12 }]} {...panResponderViewers.panHandlers}>
            <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Viewers</Text>
            <Pressable
              onPress={() => {
                animateViewersTo(VIEWERS_SHEET_CLOSED, () => setViewersModalVisible(false));
              }}
              style={({ pressed }) => ({
                padding: 10,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.06)',
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          {loadingViewers ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color={VELT_ACCENT} />
              <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>Loading viewers...</Text>
            </View>
          ) : (
            <FlatList
              data={viewersList}
              keyExtractor={(it: any, idx) => String(it.viewer_id ?? idx)}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="eye-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>No viewers yet</Text>
                </View>
              }
              renderItem={({ item }: any) => {
                const prof = item.profile ?? null;
                return (
                  <Pressable 
                    onPress={() => {
                      try {
                        if (prof?.id) {
                          // Prefetch profile data before navigation
                          prefetchProfile(String(prof.id)).catch(() => {});
                          animateViewersTo(VIEWERS_SHEET_CLOSED, () => setViewersModalVisible(false));
                          router.push({ pathname: "/profile/view/[id]", params: { id: String(prof.id) } });
                        }
                      } catch {}
                    }}
                    style={({ pressed }) => ({ 
                      flexDirection: "row", 
                      paddingVertical: 14, 
                      paddingHorizontal: 16, 
                      alignItems: "center",
                      backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent',
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Image
                      source={prof?.avatar_url ? { uri: buildCloudinaryUrl(prof.avatar_url, "image") ?? prof.avatar_url } : { uri: PLACEHOLDER_AVATAR }}
                      style={{ width: 48, height: 48, borderRadius: 24, marginRight: 14 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", color: "#fff", fontSize: 15 }}>{prof?.full_name ?? prof?.username ?? "Unknown"}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.5)", marginTop: 4, fontSize: 13 }}>{timeAgoLabel(item.viewed_at)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginHorizontal: 16 }} />}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </Animated.View>
      </Modal>
    );
  }

  // Location bottom sheet
  function renderLocationSheet() {
    if (!locationSheetVisible || !locationSheetText) return null;
    const sheetTop = locationY;
    return (
      <Modal visible={locationSheetVisible} animationType="fade" transparent onRequestClose={() => closeLocationSheet()}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback onPress={() => closeLocationSheet()}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
          </TouchableWithoutFeedback>
        </BlurView>

        <Animated.View style={[styles.locationSheetContainer, { top: sheetTop, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,25,0.88)' }]} />
          </BlurView>
          
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 20, 
                  backgroundColor: 'rgba(0,212,255,0.15)', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="location" size={20} color={VELT_ACCENT} />
                </View>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>Location</Text>
              </View>
              <Pressable 
                onPress={() => closeLocationSheet()}
                style={({ pressed }) => ({
                  padding: 10,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                })}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17, marginBottom: 16 }}>{locationSheetText}</Text>

            {/* lifestyle / decorative area */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={[styles.lifestyleIconWrap, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <Ionicons name="leaf" size={18} color={VELT_ACCENT} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Nearby</Text>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Places & vibes</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={[styles.lifestyleIconWrap, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <Ionicons name="star" size={18} color={VELT_ACCENT} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Featured</Text>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Popular spots</Text>
                </View>
              </View>
            </View>

            <Pressable 
              onPress={() => { closeLocationSheet(); Alert.alert("Open maps", "This would open the location in maps (implement deep link)."); }} 
              style={({ pressed }) => ([
                styles.openMapsBtn, 
                { 
                  backgroundColor: VELT_ACCENT,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                }
              ])}
            >
              <Ionicons name="navigate" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: "#fff", fontWeight: "800" }}>Open in Maps</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <View style={styles.safeContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <NotificationBanner
        visible={banner.visible}
        title={banner.title}
        body={banner.body}
        onClose={() => setBanner((s) => ({ ...s, visible: false }))}
        onPress={() => { banner.onPress?.(); setBanner((s) => ({ ...s, visible: false })); }}
        topOffset={TOP_INSET + 8}
      />
      {showOfflineHeader ? (
        <View style={[styles.staticHeaderWrap, { top: TOP_INSET + 8, backgroundColor: '#F97316', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8 }}>
            <Ionicons name="cloud-offline-outline" size={20} color="#fff" />
            <Text style={{ fontWeight: '800', fontSize: 16, color: '#fff' }}>Offline</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.staticHeaderWrap, { top: TOP_INSET + 8 }]}>
          <TouchableOpacity
            style={styles.viewerAvatarWrap}
            onPress={() => {
              try {
                router.push("/home/profile");
              } catch {}
            }}
            activeOpacity={0.85}
          >
            <View style={styles.viewerAvatarShadow}>
              <Image source={profile?.avatar_url ? { uri: profile.avatar_url } : { uri: PLACEHOLDER_AVATAR }} style={styles.viewerAvatar} />
            </View>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.tabPill}>
              <TouchableOpacity onPress={() => selectTab("Following")}
                activeOpacity={0.85}
                style={styles.topTabBtn}>
                <Text style={[styles.topTabText, selectedTab === "Following" ? styles.topTabActiveText : null]}>Following</Text>
              </TouchableOpacity>

              <View style={{ width: 12 }} />

              <TouchableOpacity onPress={() => selectTab("ForYou")}
                activeOpacity={0.85}
                style={styles.topTabBtn}>
                <Text style={[styles.topTabText, selectedTab === "ForYou" ? styles.topTabActiveText : null]}>For You</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                try {
                  router.push('/explore');
                } catch {}
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="search" size={22} color="#fff" style={{
                textShadowColor: 'rgba(0,0,0,0.9)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
              }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setFetchErrorMessage(null);
                loadStories();
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={22} color="#fff" style={{
                textShadowColor: 'rgba(0,0,0,0.9)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
              }} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Animated.View
        style={{ flex: 1, opacity: tabTransition }}
        onLayout={({ nativeEvent }) => {
          try {
            const h = Math.round(nativeEvent.layout.height || 0);
            if (h && Math.abs(h - measuredItemHRef.current) > 2) {
              measuredItemHRef.current = h;
              setMeasuredItemH(h);
            }
          } catch {}
        }}
      >
        <FlatList
          ref={flatListRef}
          data={visibleStories}
          keyExtractor={(it) => it.id}
          renderItem={renderStoryItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={3}
          windowSize={5}
          getItemLayout={getItemLayout}
          contentContainerStyle={{ paddingBottom: reservedBottom, flexGrow: 1 }}
          onMomentumScrollEnd={async () => {
            // haptic feedback on vertical swipe
            try { await Haptics.selectionAsync(); } catch {}
          }}
          onScroll={({ nativeEvent }) => {
            try { setDebugScrollOffset(Math.round(nativeEvent.contentOffset.y)); } catch {}
          }}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={{ flex: 1, width: WINDOW_W, height: WINDOW_H, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
              {loadingInitial ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={{ color: '#9AA4B2', marginTop: 16, fontSize: 15 }}>Loading content...</Text>
                </View>
              ) : selectedTab === 'Following' && followingIds.length === 0 ? (
                <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                  <Ionicons name="people-outline" size={64} color="#4B5563" />
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>No one you follow yet</Text>
                  <Text style={{ color: '#9AA4B2', fontSize: 15, marginTop: 8, textAlign: 'center' }}>Follow creators to see their content here</Text>
                  <TouchableOpacity
                    style={{ marginTop: 20, backgroundColor: VELT_ACCENT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}
                    onPress={() => selectTab('ForYou')}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>Discover creators</Text>
                  </TouchableOpacity>
                </View>
              ) : selectedTab === 'Following' ? (
                <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                  <Ionicons name="videocam-off-outline" size={64} color="#4B5563" />
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>No posts from people you follow</Text>
                  <Text style={{ color: '#9AA4B2', fontSize: 15, marginTop: 8, textAlign: 'center' }}>Check back later or discover new creators</Text>
                  <TouchableOpacity
                    style={{ marginTop: 20, backgroundColor: VELT_ACCENT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}
                    onPress={() => selectTab('ForYou')}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>Explore For You</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                  <Ionicons name="film-outline" size={64} color="#4B5563" />
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>No content available</Text>
                  <Text style={{ color: '#9AA4B2', fontSize: 15, marginTop: 8, textAlign: 'center' }}>Pull down to refresh</Text>
                </View>
              )}
            </View>
          }
        />
      </Animated.View>
      {renderCommentsSheet()}
      {/* Debug overlay (dev-only) */}
      {/* debug overlay removed */}
      {renderViewersModal()}
      {renderCalloutModal()}
      {renderLocationSheet()}
    </View>
  );
}

/* styles */
const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: "#000" },

  offlineBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 48 : 32,
    left: 12,
    right: 12,
    zIndex: 1200,
    backgroundColor: "#1f1f1fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offlineText: { color: "#fff", fontWeight: "800" },
  offlineRetryBtn: { marginLeft: 12, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  offlineRetryText: { color: "#fff", fontWeight: "800" },

  inlineFetchError: {
    position: "absolute",
    top: Platform.OS === "ios" ? 96 : 72,
    left: 12,
    right: 12,
    zIndex: 1100,
    backgroundColor: "#2b2b2bff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 75,
    alignItems: "center",
    justifyContent: "center",
  },

  skeletonOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 75,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },

  retryCard: { padding: 16, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 12, alignItems: "center" },
  retryBtn: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#2b2b2bff", borderRadius: 8 },

  staticHeaderWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    pointerEvents: "box-none",
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  headerCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  refreshBtn: {
    marginLeft: 10,
    backgroundColor: "transparent",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  viewerAvatarWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 16 },
  viewerAvatarShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  viewerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },

  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 30,
  },
  topTabBtn: { paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" },
  topTabText: { color: "rgba(255,255,255,0.95)", fontWeight: "800", fontSize: 20 },
  topTabActiveText: { color: "#fff", textDecorationLine: "underline" },

  bottomUserOverlay: {
    position: "absolute",
    left: 12,
    right: 110,
    zIndex: 900,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  userInfoRow: { backgroundColor: "transparent" },
  headerTitleSmall: { color: "#ffffffff", fontWeight: "900", fontSize: 22 },
  headerSubSmall: { color: "#ffffffff", fontSize: 17 },
  captionTextRow: { color: "#E6EEF3", marginTop: 6, fontSize: 19, maxWidth: "100%" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  locationText: { color: "#E6EEF3", fontWeight: "800", fontSize: 15, maxWidth: WINDOW_W * 0.5 },
  multiMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  multiDotsRow: { flexDirection: "row", marginLeft: 10, alignItems: "center" },
  multiBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  videoProgressWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -55,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },

  videoProgressInlineWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    alignItems: 'center',
  },
  videoProgressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "transparent",
    justifyContent: "center",
    width: "100%",
  },
  videoProgressBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  videoProgressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#fff",
  },
  videoProgressThumb: {
    position: "absolute",
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  rightActionCol: {
    position: "absolute",
    right: 18,
    alignItems: "center",
    zIndex: 750,
    paddingVertical: 0,
  },

  sideAvatarWrap: { marginBottom: 4 },
  sideAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.06)" },

  plusOverlay: { position: "absolute", right: 0, bottom: 0, width: 18, height: 18, borderRadius: 10, backgroundColor: "#000000ff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fff" },

  // action cluster / buttons
  actionCluster: { marginTop: 2, marginBottom: 6, alignItems: "center", justifyContent: "center" },
  actionItem: { marginVertical: 0, alignItems: "center", justifyContent: "center" },

  iconBackdrop: { width: 52, height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 6, backgroundColor: "transparent" },
  actionLabel: { fontSize: 14, marginTop: 2, padding: 0, margin: 0, fontWeight: "700", color: "#ffffffff", textAlign: "center" },

  sheetOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  bottomSheetContainer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#000000ff", borderTopLeftRadius: 16, borderTopRightRadius: 16, elevation: 20 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255, 255, 255, 0.04)" },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#ffffffff" },

  commentSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    backgroundColor: "#000000ff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 30,
  },
  sheetDragHandleWrap: { alignItems: "center", paddingTop: 8, paddingBottom: 6 },
  sheetDragHandle: { width: 48, height: 5, backgroundColor: "#E5E7EB", borderRadius: 10 },

  sheetHandle: { width: 52, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)" },
  sheetDesc: { color: "rgba(255,255,255,0.8)", marginBottom: 12 },
  sheetBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, gap: 10 },
  sheetText: { fontSize: 18 },

  shootBtnPill: {
    marginLeft: 8,
    backgroundColor: "#000000ff",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#b1b1b1ff",
    alignSelf: "flex-start",
  },
  shootBtnText: {
    color: "#ffffffff",
    fontWeight: "bold",
    fontSize: 16,
  },

  shootSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WINDOW_H - Math.round(WINDOW_H * 0.36) + 20,
    backgroundColor: "#000000ff",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    elevation: 30,
  },

  playPauseOverlay: {
    position: "absolute",
    top: "40%",
    left: "40%",
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },

  tabBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, marginRight: 8, backgroundColor: "transparent" },
  tabActive: { backgroundColor: "#111827" },
  tabText: { color: "#ddd", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#fff" },

  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  recipientAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#ddd" },
  recipientName: { marginLeft: 12, fontWeight: "700", color: "#fff", maxWidth: WINDOW_W * 0.65, fontSize: 14 },

  circleWrap: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#9AA4B2" },
  checkWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: VELT_ACCENT, alignItems: "center", justifyContent: "center" },

  chuteBtn: { paddingVertical: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  sendSheetBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  /* label / location styles */
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  labelPillSlim: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    minWidth: 36,
    alignItems: "center",
  },
  labelPillTextLarge: {
    color: "#FF69B4",
    fontSize: 14,
    fontWeight: "800",
  },

  /* partnership collide avatars */
  collideWrap: { height: 28, position: "relative", marginLeft: 2 },
  collideImgBase: { position: "absolute", borderRadius: 12, backgroundColor: "#ddd" },

  // multi-image badge and dots
  multiBadge: { backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", marginRight: 6 },
  dotActive: { backgroundColor: "#fff" },

  // first comment card
  firstCommentCard: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  firstCommentBtn: { backgroundColor: VELT_ACCENT, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },

  // first viewer toast
  firstViewerToast: { position: "absolute", top: 110, left: 24, right: 24, backgroundColor: "#111827", padding: 12, borderRadius: 10, alignItems: "center", zIndex: 2000 },

  // location sheet
  locationSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: Math.round(WINDOW_H * 0.36),
    backgroundColor: "#0b1220",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 30,
    zIndex: 2000,
  },
  lifestyleIconWrap: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  openMapsBtn: { backgroundColor: VELT_ACCENT, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 8 },
});
