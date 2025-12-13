// app/explore/user_stories/[userId].tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  FlatList,
  ListRenderItem,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { Video, AVPlaybackStatus, ResizeMode } from "expo-av";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import { downloadAsync as downloadAsyncHelper } from '@/utils/filesystem';
import { supabase } from "@/lib/supabase";
import { Ionicons, Feather } from "@expo/vector-icons";
import { NativeViewGestureHandler } from "react-native-gesture-handler";
import { getCachedCommercials } from '@/lib/store/prefetchStore';

const CLOUDINARY_CLOUD = "dpejjmjxg";
const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get("window");

const SWIPE_THRESHOLD = 80; // horizontal threshold to switch users
const VERTICAL_SWIPE_THRESHOLD = 120;

// bottom action bar height (anchored to bottom)
const ACTION_BAR_HEIGHT = 74;
const BOTTOM_BAR_MARGIN = 10;

// top overlay height
const TOP_OVERLAY_HEIGHT = Platform.OS === "ios" ? 110 : 64;

// available media max height (leave room for top & bottom overlays)
const RESERVED_BOTTOM_SPACE = BOTTOM_BAR_MARGIN + 5;
const MAX_MEDIA_HEIGHT = Math.round(WINDOW_H - TOP_OVERLAY_HEIGHT - RESERVED_BOTTOM_SPACE);

// file-system dir compatibility
const FS_ANY = FileSystem as any;
const STORIES_CACHE_DIR = `${FS_ANY.cacheDirectory ?? FS_ANY.documentDirectory ?? ""}stories/`;

/**
 * SIZE PRESETS
 * Choose "small" | "medium" | "large" — this affects buttons and caption font.
 * You can change SIZE_PRESET value below to test variants.
 */
const SIZE_PRESET: "small" | "medium" | "large" = "medium";
const SIZE_CONFIG = {
  small: { pillPaddingH: 12, pillPaddingV: 10, pillIcon: 18, pillFont: 13, captionFont: 14, followFont: 12, followPadV: 6 },
  medium: { pillPaddingH: 16, pillPaddingV: 12, pillIcon: 20, pillFont: 15, captionFont: 16, followFont: 14, followPadV: 8 },
  large: { pillPaddingH: 20, pillPaddingV: 14, pillIcon: 22, pillFont: 17, captionFont: 18, followFont: 16, followPadV: 10 },
}[SIZE_PRESET];

const PLACEHOLDER_AVATAR = "https://api.dicebear.com/7.x/identicon/png?seed=anon&backgroundType=gradientLinear";

function buildCloudinaryUrl(publicIdOrUrl: string | null | undefined, mediaType: "image" | "video") {
  if (!publicIdOrUrl) return null;
  const s = String(publicIdOrUrl).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const resource = mediaType === "video" ? "video" : "image";
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/${resource}/upload/f_auto,q_auto/${s}`;
}

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

type UserStoriesViewProps = {
  initialUserId?: string | null;
  onClose?: () => void;
};

type VideoInstance = React.ComponentRef<typeof Video>;

/* -------------------------
   CACHING / PRELOADING HELPERS
   ------------------------- */

const mediaCache = new Map<string, { localUri: string }>();
const watchedSet = new Set<string>();

async function ensureCacheDir() {
  try {
    const info = await FS_ANY.getInfoAsync(STORIES_CACHE_DIR);
    if (!info.exists) {
      await FS_ANY.makeDirectoryAsync(STORIES_CACHE_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn("ensureCacheDir failed", e);
  }
}

function cacheFilenameForUrl(url: string) {
  const encoded = encodeURIComponent(url);
  return `${STORIES_CACHE_DIR}${encoded}`;
}

async function downloadToCache(url: string) {
  if (!url) return null;
  const cached = mediaCache.get(url);
  if (cached?.localUri) return cached.localUri;

  await ensureCacheDir();
  const destination = cacheFilenameForUrl(url);

  try {
    const info = await FS_ANY.getInfoAsync(destination);
    if (info.exists) {
      mediaCache.set(url, { localUri: info.uri });
      return info.uri;
    }
  } catch {
    // ignore read errors
  }

  try {
    const result = await downloadAsyncHelper(url, destination);
    if (result?.uri) {
      mediaCache.set(url, { localUri: result.uri });
      return result.uri;
    }
  } catch (err) {
    console.warn("downloadToCache failed", err);
  }

  return null;
}

async function preloadMediaToCache(url: string | null | undefined) {
  if (!url) return null;
  const cached = mediaCache.get(url);
  if (cached?.localUri) return cached.localUri;
  try {
    return await downloadToCache(url);
  } catch (err) {
    console.warn("preloadMediaToCache error", err);
    return null;
  }
}

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  height?: number;
  title?: string;
  children?: React.ReactNode;
};

function BottomSheet({ visible, onClose, height = 260, title, children }: BottomSheetProps) {
  const [isMounted, setIsMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      requestAnimationFrame(() => {
        translateY.setValue(height);
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else if (isMounted) {
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setIsMounted(false);
      });
    }
  }, [visible, height, translateY, isMounted]);

  const closeWithAnimation = useCallback(() => {
    Animated.timing(translateY, {
      toValue: height,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [translateY, height, onClose]);

  if (!isMounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={closeWithAnimation}>
      <TouchableWithoutFeedback onPress={closeWithAnimation}>
        <View style={styles.sheetOverlay} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.bottomSheetContainer, { height, transform: [{ translateY }] }]}>
        {title ? (
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={closeWithAnimation} style={styles.sheetClose}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

/* -------------------------
   Component
   ------------------------- */

export function UserStoriesView({ initialUserId: initialUserIdProp = null, onClose }: UserStoriesViewProps) {
  const router = withSafeRouter(useRouter());
  const initialUserId = initialUserIdProp;

  // -------------------- State & refs --------------------
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ userId: string; profile: ProfileShort; stories: StoryItem[] }[]>([]);
  const [activeUserIndex, setActiveUserIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Map<string, any>>(new Map());
  const progress = useRef(new Animated.Value(0)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchingRef = useRef(false);
  const progressRunningRef = useRef(false);
  const entryOpacity = useRef(new Animated.Value(0.4)).current;
  const entryScale = useRef(new Animated.Value(0.92)).current;
  const interactScale = useRef(new Animated.Value(1)).current;
  const verticalDrag = useRef(new Animated.Value(0)).current;
  const swipeAxisRef = useRef<"horizontal" | "vertical" | null>(null);
  const segmentWidthMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const zeroWidth = useRef(new Animated.Value(0)).current;

  const [preloadMap, setPreloadMap] = useState<Record<string, boolean>>({});
  const [viewsCountMap, setViewsCountMap] = useState<Record<string, number>>({});

  const pausedByKeyboardRef = useRef(false);

  // social
  const [isFollowingState, setIsFollowingState] = useState<Record<string, boolean>>({});
  const [isLikedState, setIsLikedState] = useState<Record<string, boolean>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});

  // comments sheet
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ commentId: string; displayName?: string } | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [fullExpandedComments, setFullExpandedComments] = useState<Record<string, boolean>>({});
  const [commentLikesMap, setCommentLikesMap] = useState<Record<string, number>>({});
  const [commentLikedByMe, setCommentLikedByMe] = useState<Record<string, boolean>>({});

  const [shootSheetVisible, setShootSheetVisible] = useState(false);
  const [shootTarget, setShootTarget] = useState<StoryItem | null>(null);
  const [shootActiveTab, setShootActiveTab] = useState<"following" | "suggestions">("following");
  const [shootFollowing, setShootFollowing] = useState<ProfileShort[]>([]);
  const [shootSuggestions, setShootSuggestions] = useState<ProfileShort[]>([]);
  const [shootSelected, setShootSelected] = useState<Set<string>>(new Set());
  const [shootSending, setShootSending] = useState(false);

  // action sheet
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const sheetsPausedRef = useRef(false);

  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const [viewersList, setViewersList] = useState<
    { viewer_id: string; viewed_at: string; device_info?: string | null; profile?: ProfileShort | null }[]
  >([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // store computed aspect ratios: width / height
  const [mediaAspectMap, setMediaAspectMap] = useState<Record<string, number>>({});

  // animated height for media so it resizes smoothly
  const animatedMediaHeight = useRef(new Animated.Value(Math.round(MAX_MEDIA_HEIGHT))).current;

  // store current user id to show/hide Delete option
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileShort | null>(null);

  // PanResponder for swipe left / right
  const panRef = useRef<any>(null);

  // emoji picker
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  // comment input ref
  const commentInputRef = useRef<TextInput | null>(null);
  const commentsNativeRef = useRef<any>(null);
  const commentListRef = useRef<FlatList<any> | null>(null);

  const SHEET_CLOSED = WINDOW_H;
  const SHEET_OPEN_TOP = Math.round(WINDOW_H * 0.22);
  const sheetY = useRef(new Animated.Value(SHEET_CLOSED)).current;
  const sheetYRef = useRef<number>(SHEET_CLOSED);
  const startSheetDragY = useRef<number>(sheetYRef.current);

  const SHOOT_SHEET_CLOSED = WINDOW_H;
  const SHOOT_SHEET_OPEN_TOP = Math.round(WINDOW_H * 0.36);
  const shootY = useRef(new Animated.Value(SHOOT_SHEET_CLOSED)).current;
  const shootYRef = useRef<number>(SHOOT_SHEET_CLOSED);
  const startShootDragY = useRef<number>(shootYRef.current);

  const firstCommentPulse = useRef(new Animated.Value(1)).current;

  // -------------------- Lifecycle --------------------
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id ?? null;
        setCurrentUserId(userId);
        if (userId) {
          const { data: profileRow } = await supabase.from("profiles").select("id, username, full_name, avatar_url").eq("id", userId).maybeSingle();
          if (profileRow) {
            setCurrentProfile({
              id: profileRow.id,
              username: profileRow.username ?? undefined,
              full_name: profileRow.full_name ?? undefined,
              avatar_url: profileRow.avatar_url ?? undefined,
            });
          }
        } else {
          setCurrentProfile(null);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(entryScale, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [entryOpacity, entryScale]);

  useEffect(() => {
    fetchAllStories();

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e: any) => {
      pauseAllForKeyboard();
      pausedByKeyboardRef.current = true;
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (pausedByKeyboardRef.current) {
        pausedByKeyboardRef.current = false;
        resumeAllAfterKeyboard();
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      pauseAllVideos();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (commentSheetVisible) {
      sheetY.setValue(SHEET_CLOSED);
      requestAnimationFrame(() => animateSheetTo(SHEET_OPEN_TOP));
    } else {
      sheetY.setValue(SHEET_CLOSED);
    }
  }, [commentSheetVisible]);

  useEffect(() => {
    const anySheetVisible = commentSheetVisible || shootSheetVisible || actionSheetVisible;
    if (anySheetVisible && !sheetsPausedRef.current) {
      sheetsPausedRef.current = true;
      pauseAllForKeyboard().catch(() => {});
    } else if (!anySheetVisible && sheetsPausedRef.current && !pausedByKeyboardRef.current) {
      sheetsPausedRef.current = false;
      resumeAllAfterKeyboard().catch(() => {});
    }
  }, [commentSheetVisible, shootSheetVisible, actionSheetVisible]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (commentSheetVisible && commentsList.length === 0) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(firstCommentPulse, { toValue: 1.06, duration: 680, useNativeDriver: true }),
          Animated.timing(firstCommentPulse, { toValue: 1, duration: 680, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      firstCommentPulse.setValue(1);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [commentSheetVisible, commentsList.length, firstCommentPulse]);

  useEffect(() => {
    if (!commentSheetVisible) return;
    if (!commentsList.length) return;
    requestAnimationFrame(() => {
      commentListRef.current?.scrollToEnd?.({ animated: true });
    });
  }, [commentsList.length, commentSheetVisible]);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 6,
      onPanResponderGrant: () => {
        startSheetDragY.current = sheetYRef.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        const next = Math.max(SHEET_OPEN_TOP, Math.min(SHEET_CLOSED, startSheetDragY.current + gestureState.dy));
        sheetY.setValue(next);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dy, vy } = gestureState;
        if (dy > 80 || vy > 0.9) {
          animateSheetTo(SHEET_CLOSED, () => {
            setCommentSheetVisible(false);
            setReplyTarget(null);
          });
        } else if (dy < -60 || vy < -0.8) {
          animateSheetTo(SHEET_OPEN_TOP);
        } else {
          const midpoint = (SHEET_CLOSED + SHEET_OPEN_TOP) / 2;
          if (sheetYRef.current > midpoint) {
            animateSheetTo(SHEET_CLOSED, () => {
              setCommentSheetVisible(false);
              setReplyTarget(null);
            });
          } else {
            animateSheetTo(SHEET_OPEN_TOP);
          }
        }
      },
    })
  ).current;

  const shootPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dy) > 6,
      onPanResponderGrant: () => {
        startShootDragY.current = shootYRef.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        const next = Math.max(SHOOT_SHEET_OPEN_TOP, Math.min(SHOOT_SHEET_CLOSED, startShootDragY.current + gestureState.dy));
        shootY.setValue(next);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dy, vy } = gestureState;
        if (dy > 80 || vy > 0.9) {
          animateShootTo(SHOOT_SHEET_CLOSED, () => setShootSheetVisible(false));
        } else if (dy < -60 || vy < -0.8) {
          animateShootTo(SHOOT_SHEET_OPEN_TOP);
        } else {
          const midpoint = (SHOOT_SHEET_CLOSED + SHOOT_SHEET_OPEN_TOP) / 2;
          if (shootYRef.current > midpoint) {
            animateShootTo(SHOOT_SHEET_CLOSED, () => setShootSheetVisible(false));
          } else {
            animateShootTo(SHOOT_SHEET_OPEN_TOP);
          }
        }
      },
    })
  ).current;

  useEffect(() => {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        if (absDx > 12 || absDy > 12) {
          swipeAxisRef.current = absDy > absDx ? "vertical" : "horizontal";
          return true;
        }
        return false;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (swipeAxisRef.current === "vertical") {
          const { dy } = gestureState;
          if (dy >= 0) {
            verticalDrag.setValue(dy);
            const ratio = Math.min(1, Math.max(0, dy / WINDOW_H));
            interactScale.setValue(1 - ratio * 0.15);
          } else {
            verticalDrag.setValue(dy * 0.25);
            interactScale.setValue(1);
          }
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (swipeAxisRef.current === "vertical") {
          const shouldDismiss = gestureState.dy > VERTICAL_SWIPE_THRESHOLD || gestureState.vy > 1;
          if (shouldDismiss) {
            Animated.parallel([
              Animated.timing(verticalDrag, { toValue: WINDOW_H, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
              Animated.timing(interactScale, { toValue: 0.82, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            ]).start(() => {
              verticalDrag.setValue(0);
              interactScale.setValue(1);
              handleClose();
            });
          } else {
            Animated.parallel([
              Animated.spring(verticalDrag, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }),
              Animated.spring(interactScale, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 18 }),
            ]).start();
          }
        } else {
          const { dx } = gestureState;
          if (dx < -SWIPE_THRESHOLD) {
            goToNextUser();
          } else if (dx > SWIPE_THRESHOLD) {
            goToPrevUser();
          }
        }
        swipeAxisRef.current = null;
      },
      onPanResponderTerminate: () => {
        swipeAxisRef.current = null;
        Animated.parallel([
          Animated.spring(verticalDrag, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }),
          Animated.spring(interactScale, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 18 }),
        ]).start();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserIndex, groups]);

  useEffect(() => {
    if (activeUserIndex == null) return;
    fadeAnim.setValue(0);
    slideAnim.setValue(activeUserIndex % 2 === 0 ? 18 : -18);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    progress.stopAnimation?.();
    progress.setValue(0);
    progressRunningRef.current = false;

    preloadCurrentGroupMedia();
    preloadNextGroupsFirstMedia();
  }, [activeUserIndex, activeStoryIndex]);

  useEffect(() => {
    const s = getActiveStory();
    if (s) {
      fetchViewCount(s.id);
      loadSocialStateForActive().catch(() => {});
      fetchCommentsForActive().catch(() => {});
      // animate height to new computed height
      const target = mediaHeightForStory(s);
      Animated.timing(animatedMediaHeight, { toValue: target, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserIndex, activeStoryIndex, mediaAspectMap]);

  useEffect(() => {
    const s = getActiveStory();
    if (!s) return;
    if (s.media_type === "image") {
      startProgressForStory(s);
    } else {
      const vref = videoRefs.current.get(s.id);
      safePlayVideo(vref).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserIndex, activeStoryIndex]);

  // -------------------- Helpers --------------------
  const safePauseVideo = async (vref: any) => {
    if (!vref) return;
    try {
      const ref = vref?.current ?? vref;
      if (!ref) return;
      if (typeof ref.pauseAsync === "function") {
        const status = typeof ref.getStatusAsync === "function" ? await ref.getStatusAsync().catch(() => null) : null;
        if (!status || status?.isPlaying) {
          await ref.pauseAsync().catch(() => {});
        }
      }
    } catch {}
  };

  const safePlayVideo = async (vref: any) => {
    if (!vref) return;
    try {
      const ref = vref?.current ?? vref;
      if (!ref) return;
      if (typeof ref.playAsync === "function") {
        const status = typeof ref.getStatusAsync === "function" ? await ref.getStatusAsync().catch(() => null) : null;
        if (!status || !status?.isPlaying) {
          await ref.playAsync().catch(() => {});
        }
      }
    } catch {}
  };

  const pauseAllVideos = async () => {
    try {
      videoRefs.current.forEach((vref) => {
        safePauseVideo(vref).catch(() => {});
      });
    } catch {}
  };

  // -------------------- Data / supabase --------------------
  async function fetchAllStories() {
    setLoading(true);
    try {
      const now = new Date().toISOString();

      const trySelectWithCaption = `id, user_id, media_url, media_type, duration, created_at, is_deleted, expire_at, is_hd,
           profiles:profiles!business_stories_user_id_fkey(id, username, full_name, avatar_url),
           caption`;

      const { data, error } = await supabase
        .from("business_stories")
        .select(trySelectWithCaption)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const active = (data || []).filter((r: any) => {
        if (r.expire_at && new Date(r.expire_at).toISOString() <= now) return false;
        return true;
      });

      const items: StoryItem[] = active.map((r: any) => {
        const mediaType: "image" | "video" = r.media_type === "video" ? "video" : "image";
        const built = buildCloudinaryUrl(r.media_url, mediaType) ?? "";
        return {
          id: r.id,
          user_id: r.user_id,
          raw_media_url: r.media_url,
          isHD: !!r.is_hd,
          media_url: built,
          media_type: mediaType,
          duration: r.duration,
          created_at: r.created_at,
          profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles ?? null,
          expire_at: r.expire_at ?? null,
          caption: typeof r.caption !== "undefined" ? r.caption : null,
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

        // preload first group's stories + next group's first story
        const thisFirst = arr[0]?.stories?.[0];
        const nextFirst = arr[1]?.stories?.[0];
        if (thisFirst) preloadMediaToCache(thisFirst.media_url).catch(() => {});
        if (nextFirst) preloadMediaToCache(nextFirst.media_url).catch(() => {});
        // also preload a few items more for snappy experience
        for (let i = 0; i < Math.min(3, arr.length); i++) {
          const g = arr[i];
          if (g?.stories?.length) {
            for (let j = 0; j < Math.min(2, g.stories.length); j++) {
              preloadMediaToCache(g.stories[j].media_url).catch(() => {});
            }
          }
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
    if (activeUserIndex == null) return null;
    const g = groups[activeUserIndex];
    if (!g) return null;
    return g.stories[activeStoryIndex] ?? null;
  }, [activeUserIndex, activeStoryIndex, groups]);

  async function markStoryViewed(storyId: string) {
    try {
      watchedSet.add(String(storyId));
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      await supabase.from("story_views").upsert({ story_id: storyId, viewer_id: uid, viewed_at: new Date().toISOString() }, { onConflict: "story_id,viewer_id" });
      fetchViewCount(storyId).catch(() => {});
    } catch {
      // ignore
    }
  }

  async function fetchStoryViewers(storyId: string) {
    setLoadingViewers(true);
    try {
      const { data, error } = await supabase
        .from("story_views")
        .select("viewer_id, viewed_at, device_info")
        .eq("story_id", storyId)
        .order("viewed_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const viewerIds = Array.from(new Set(rows.map((r) => r.viewer_id).filter(Boolean)));
      let profilesById: Record<string, ProfileShort> = {};
      if (viewerIds.length) {
        const { data: profRows } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", viewerIds);
        (profRows || []).forEach((p: any) => {
          profilesById[p.id] = { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url };
        });
      }

      const merged = rows.map((r) => ({
        viewer_id: r.viewer_id,
        viewed_at: r.viewed_at,
        device_info: r.device_info ?? null,
        profile: profilesById[r.viewer_id] ?? null,
      }));

      setViewersList(merged);
    } catch (err) {
      console.warn("fetchStoryViewers err", err);
      setViewersList([]);
    } finally {
      setLoadingViewers(false);
    }
  }

  async function fetchViewCount(storyId: string) {
    try {
      const { data, count, error } = await supabase.from("story_views").select("id", { count: "exact" }).eq("story_id", storyId);
      if (error) {
        const { data: d2 } = await supabase.from("story_views").select("id").eq("story_id", storyId);
        setViewsCountMap((m: Record<string, number>) => ({ ...m, [storyId]: (d2 || []).length }));
        return;
      }
      const cnt = typeof count === "number" ? count : Array.isArray(data) ? data.length : 0;
      setViewsCountMap((m: Record<string, number>) => ({ ...m, [storyId]: cnt }));
    } catch (e) {
      // ignore
    }
  }

  const ensureSegmentWidthValue = useCallback((key: string) => {
    let val = segmentWidthMapRef.current.get(key);
    if (!val) {
      val = new Animated.Value(0);
      segmentWidthMapRef.current.set(key, val);
    }
    return val;
  }, []);

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

  function animateSheetTo(toValue: number, cb?: () => void) {
    Animated.timing(sheetY, { toValue, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      sheetYRef.current = toValue;
      if (cb) cb();
    });
  }

  function animateShootTo(toValue: number, cb?: () => void) {
    Animated.timing(shootY, { toValue, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      shootYRef.current = toValue;
      if (cb) cb();
    });
  }

  const VerificationBadge = ({ size = 16 }: { size?: number }) => (
    <View
      style={{
        marginLeft: 6,
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#3b82f6",
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Ionicons name="checkmark" size={size * 0.7} color="#fff" />
    </View>
  );

  async function startOrOpenDM(targetId: string, targetName?: string, targetAvatar?: string) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const currentUserId = u?.user?.id;
      if (!currentUserId) {
        Alert.alert("Not signed in", "You must sign in to message someone.");
        return;
      }

      const { data: myParts } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", currentUserId);
      const myConvoIds = (myParts || []).map((p: any) => p.conversation_id);

      let dmIds: string[] = [];
      if (myConvoIds.length) {
        const { data: dmRows } = await supabase.from("conversations").select("id").in("id", myConvoIds).eq("is_group", false);
        dmIds = (dmRows || []).map((r: any) => r.id);
      }

      if (dmIds.length) {
        const { data: combos } = await supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", dmIds);
        const byConvo: Record<string, Set<string>> = {};
        (combos || []).forEach((row: any) => {
          if (!byConvo[row.conversation_id]) byConvo[row.conversation_id] = new Set<string>();
          byConvo[row.conversation_id].add(row.user_id);
        });

        for (const [cid, members] of Object.entries(byConvo)) {
          if (members.size === 2 && members.has(currentUserId) && members.has(targetId)) {
            router.push({
              pathname: `/message/chat/${cid}`,
              params: { otherName: targetName ?? "", otherAvatar: targetAvatar ?? "" } as any,
            });
            return;
          }
        }
      }

      const { data: convData, error: convErr } = await supabase.from("conversations").insert({ is_group: false }).select("id").single();
      if (convErr || !convData) {
        Alert.alert("Error", "Could not start conversation (failed to create conversation).");
        return;
      }
      const cid = convData.id;
      let partErr: any = null;
      try {
        const { error } = await supabase.from("conversation_participants").insert([
          { conversation_id: cid, user_id: currentUserId, accepted: true },
          { conversation_id: cid, user_id: targetId, accepted: false },
        ]);
        partErr = error;
      } catch (e) { partErr = e; }
      if (partErr) {
        console.warn('conversation_participants insert failed with accepted flag', partErr);
        try {
          const { error: fbErr } = await supabase.from('conversation_participants').insert([
            { conversation_id: cid, user_id: currentUserId },
            { conversation_id: cid, user_id: targetId },
          ]);
          if (fbErr) throw fbErr;
        } catch (e) {
          try { await supabase.from('conversations').delete().eq('id', cid); } catch {};
          Alert.alert('Error', 'Could not add participants to the conversation.');
          return;
        }
      }

      router.push({
        pathname: `/message/chat/${cid}`,
        params: { otherName: targetName ?? "", otherAvatar: targetAvatar ?? "" } as any,
      });
    } catch (err) {
      console.error("startOrOpenDM error", err);
      Alert.alert("Error", "Could not start conversation.");
    }
  }

  // -------------------- Playback / controls --------------------
  async function pauseAllForKeyboard() {
    try {
      progress.stopAnimation?.();
    } catch {}
    progressRunningRef.current = false;

    videoRefs.current.forEach((vref) => {
      safePauseVideo(vref).catch(() => {});
    });
  }

  async function resumeAllAfterKeyboard() {
    const story = getActiveStory();
    if (!story) return;

    if (story.media_type === "video") {
      const vref = videoRefs.current.get(story.id);
      safePlayVideo(vref).catch(() => {});
    } else {
      progress.stopAnimation((value: number) => {
        const remaining = 1 - (value ?? 0);
        const dur = ((story.duration && story.duration > 0 ? story.duration : 6) * 1000) * remaining;
        progressRunningRef.current = true;
        Animated.timing(progress, { toValue: 1, duration: Math.max(300, dur), easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
          progressRunningRef.current = false;
          if (finished) goToNextStoryOrUser();
        });
      });
    }
  }

  function startProgressForStory(story: StoryItem) {
    const active = getActiveStory();
    if (!active || active.id !== story.id) return;

    try {
      progress.stopAnimation?.();
    } catch {}
    progress.setValue(0);
    progressRunningRef.current = true;

    if (story.media_type === "image") {
      const durMs = (story.duration && story.duration > 0 ? story.duration : 6) * 1000;
      Animated.timing(progress, { toValue: 1, duration: durMs, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
        progressRunningRef.current = false;
        if (finished) goToNextStoryOrUser();
      });
    } else {
      const vref = videoRefs.current.get(story.id);
      if (vref) {
        safePlayVideo(vref).catch(() => {});
      }
    }

    markStoryViewed(story.id).catch(() => {});
  }

  function stopProgress() {
    try {
      progress.stopAnimation?.();
    } catch {}
    progressRunningRef.current = false;
  }

  function goToNextStoryOrUser() {
    if (activeUserIndex == null) return;
    const g = groups[activeUserIndex];
    if (!g) return;
    stopProgress();
    pauseAllVideos().catch(() => {});

    if (activeStoryIndex + 1 < g.stories.length) {
      setActiveStoryIndex((i) => i + 1);
      progress.setValue(0);
      return;
    }
    goToNextUser();
  }

  function goToPrevStoryOrUser() {
    if (activeUserIndex == null) return;
    stopProgress();
    pauseAllVideos().catch(() => {});
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((i) => i - 1);
      progress.setValue(0);
      return;
    }
    goToPrevUser();
  }

  function goToNextUser() {
    if (switchingRef.current) return;
    if (activeUserIndex == null) return;
    const next = activeUserIndex + 1;
    if (next >= groups.length) {
      handleClose();
      return;
    }
    verticalDrag.setValue(0);
    interactScale.setValue(1);
    switchingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -12, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setActiveUserIndex(next);
      setActiveStoryIndex(0);
      switchingRef.current = false;
    });
  }

  function goToPrevUser() {
    if (switchingRef.current) return;
    if (activeUserIndex == null) return;
    const prev = activeUserIndex - 1;
    if (prev < 0) {
      handleClose();
      return;
    }
    verticalDrag.setValue(0);
    interactScale.setValue(1);
    switchingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 12, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setActiveUserIndex(prev);
      setActiveStoryIndex(0);
      switchingRef.current = false;
    });
  }

  async function handleClose() {
    videoRefs.current.forEach((vref) => {
      safePauseVideo(vref).catch(() => {});
    });

    stopProgress();

    setActiveUserIndex(null);

    if (onClose) {
      onClose();
      return;
    }

    try {
      router.back();
    } catch {
      try {
        router.replace("/");
      } catch {
        // noop
      }
    }
  }

  // -------------------- Preload / aspect helpers --------------------
  function preloadCurrentGroupMedia() {
    if (activeUserIndex == null) return;
    const g = groups[activeUserIndex];
    if (!g) return;

    // preload all of this group's stories (or at least first few)
    for (let i = 0; i < Math.min(4, g.stories.length); i++) {
      const s = g.stories[i];
      const key = `${g.userId}:${s.id}`;
      if (preloadMap[key]) continue;

      if (s.media_type === "image") {
        Image.prefetch(s.media_url)
          .then(() => setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: true })))
          .catch(() => setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: false })));
        preloadMediaToCache(s.media_url).catch(() => {});
      } else {
        setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: false }));
        preloadMediaToCache(s.media_url).catch(() => {});
      }
    }
  }

  function preloadNextGroupsFirstMedia() {
    if (activeUserIndex == null) return;
    // preload next 2 groups first 2 medias
    for (let gIdx = activeUserIndex + 1; gIdx <= activeUserIndex + 2 && gIdx < groups.length; gIdx++) {
      const nextGroup = groups[gIdx];
      if (!nextGroup) continue;
      for (let i = 0; i < Math.min(2, nextGroup.stories.length); i++) {
        const s = nextGroup.stories[i];
        const key = `${nextGroup.userId}:${s.id}`;
        if (preloadMap[key]) continue;
        if (s.media_type === "image") {
          Image.prefetch(s.media_url)
            .then(() => setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: true })))
            .catch(() => setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: false })));
          preloadMediaToCache(s.media_url).catch(() => {});
        } else {
          setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: false }));
          preloadMediaToCache(s.media_url).catch(() => {});
        }
      }
    }
  }

  // Determine height using aspect ratio if available, but never exceed MAX_MEDIA_HEIGHT (keeps bottom action bar free)
  function mediaHeightForStory(s: StoryItem | null) {
    if (!s) return Math.round(MAX_MEDIA_HEIGHT);
    const aspect = mediaAspectMap[s.id];
    if (aspect && aspect > 0) {
      // aspect = width / height -> height = windowWidth / aspect
      const h = Math.round(WINDOW_W / aspect);
      return Math.min(h, Math.round(MAX_MEDIA_HEIGHT));
    }
    return Math.round(MAX_MEDIA_HEIGHT);
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

  function navigateToProfile(profileId?: string | null) {
    if (!profileId) return;
    try {
      router.push({ pathname: "/profile/view/[id]", params: { id: profileId } });
    } catch {
      router.push(`/profile/view/${encodeURIComponent(profileId)}`);
    }
  }

  function renderPreloaders() {
    if (activeUserIndex == null) return null;
    const arr: StoryItem[] = [];

    const currentGroup = groups[activeUserIndex];
    if (currentGroup) arr.push(...currentGroup.stories);

    const next = activeUserIndex + 1;
    if (next < groups.length) {
      const nextG = groups[next];
      if (nextG?.stories?.[0]) arr.push(nextG.stories[0]);
    }

    const seen = new Set<string>();
    const uniq = arr.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    return (
      <View style={{ width: 0, height: 0, position: "absolute", left: -9999, top: -9999 }}>
        {uniq.map((s) => {
          const key = `${s.user_id}:${s.id}`;
          if (s.media_type === "image") {
            return <Image key={key} source={{ uri: s.media_url }} style={{ width: 1, height: 1 }} onLoad={() => setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: true }))} />;
          } else {
            return (
              <Video
                key={key}
                source={{ uri: s.media_url }}
                style={{ width: 1, height: 1 }}
                shouldPlay={false}
                resizeMode={ResizeMode.CONTAIN}
                onLoad={() => handleVideoPreloadLoaded(s.user_id, s.id)}
                onError={() => setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: false }))}
              />
            );
          }
        })}
      </View>
    );
  }

  function handleVideoPreloadLoaded(groupUserId: string, storyId: string) {
    const key = `${groupUserId}:${storyId}`;
    setPreloadMap((m: Record<string, boolean>) => ({ ...m, [key]: true }));
  }

  // -------------------- Social helpers --------------------
  async function getCurrentUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }

  async function isFollowing(targetUserId: string) {
    try {
      const myId = await getCurrentUserId();
      if (!myId) return false;
      const { count } = await supabase.from("follows").select("id", { count: "exact" }).eq("follower_id", myId).eq("following_id", targetUserId);
      return (count ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async function toggleFollowServer(targetUserId: string) {
    const myId = await getCurrentUserId();
    if (!myId) throw new Error("Not signed in");
    const { data: existing } = await supabase.from("follows").select("id").eq("follower_id", myId).eq("following_id", targetUserId).maybeSingle();
    if (existing) {
      await supabase.from("follows").delete().eq("id", existing.id);
      return { followed: false };
    } else {
      await supabase.from("follows").insert({ follower_id: myId, following_id: targetUserId });
      return { followed: true };
    }
  }

  async function toggleLikeServer(storyId: string) {
    const myId = await getCurrentUserId();
    if (!myId) throw new Error("Not signed in");
    const { data: existing } = await supabase.from("business_story_likes").select("id").eq("business_story_id", storyId).eq("user_id", myId).maybeSingle();
    if (existing) {
      await supabase.from("business_story_likes").delete().eq("id", existing.id);
      return { liked: false };
    } else {
      await supabase.from("business_story_likes").insert({ business_story_id: storyId, user_id: myId });
      return { liked: true };
    }
  }

  async function fetchLikesCount(storyId: string) {
    const { count } = await supabase.from("business_story_likes").select("id", { count: "exact" }).eq("business_story_id", storyId);
    return count ?? 0;
  }

  async function addComment(storyId: string, content: string, parentId?: string | null) {
    const { data } = await supabase.auth.getUser();
    const myId = data?.user?.id;
    if (!myId) throw new Error("Not signed in");

    const payload: Record<string, any> = { business_story_id: storyId, user_id: myId, content };
    if (parentId) payload.parent_id = parentId;

    const insertRes = await supabase.from("business_story_comments").insert(payload).select("id").single();
    if ((insertRes as any).error) throw (insertRes as any).error;
    const newId = (insertRes as any).data?.id;
    if (!newId) throw new Error("Insert failed");

    const { data: row, error } = await supabase
      .from("business_story_comments")
      .select("id, business_story_id, user_id, content, created_at, parent_id, profiles(id, username, full_name, avatar_url)")
      .eq("id", newId)
      .single();
    if (error) throw error;
    return row;
  }

  async function fetchCommentsForActive() {
    const s = getActiveStory();
    if (!s) return;
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_story_comments")
        .select("id, business_story_id, user_id, content, created_at, parent_id, profiles(id, username, full_name, avatar_url)")
        .eq("business_story_id", s.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setCommentsList(data ?? []);
      setExpandedComments({});
      setFullExpandedComments({});
      const commentIds = (data ?? []).map((row) => row.id).filter(Boolean) as string[];
      if (commentIds.length) {
        fetchCommentLikesFor(commentIds).catch(() => {});
      } else {
        setCommentLikesMap({});
        setCommentLikedByMe({});
      }
    } catch (err) {
      console.warn("fetchCommentsForActive", err);
      setCommentsList([]);
      setCommentLikesMap({});
      setCommentLikedByMe({});
    } finally {
      setCommentsLoading(false);
    }
  }

  async function fetchCommentLikesFor(commentIds: string[]) {
    if (!commentIds || !commentIds.length) {
      setCommentLikesMap({});
      setCommentLikedByMe({});
      return;
    }
    try {
      const { data: u } = await supabase.auth.getUser();
      const myId = u?.user?.id;
      const { data } = await supabase
        .from("story_comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);
      const counts: Record<string, number> = {};
      const likedByMe: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
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

      const { data: existing } = await supabase
        .from("story_comment_likes")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", myId)
        .maybeSingle();

      let toggledToLike = false;
      setCommentLikedByMe((prev) => {
        const next = { ...prev };
        const current = !!prev[commentId];
        toggledToLike = !current;
        next[commentId] = !current;
        return next;
      });

      setCommentLikesMap((prev) => {
        const current = prev[commentId] ?? 0;
        const next = Math.max(0, current + (toggledToLike ? 1 : -1));
        return { ...prev, [commentId]: next };
      });

      if (existing) {
        await supabase.from("story_comment_likes").delete().eq("id", existing.id);
      } else {
        await supabase.from("story_comment_likes").insert({ comment_id: commentId, user_id: myId });
      }

      await fetchCommentLikesFor([commentId]);
    } catch (err) {
      console.warn("toggleCommentLike err", err);
      Alert.alert("Error", "Could not toggle like");
      setCommentLikedByMe((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
    }
  }

  async function retryComment(localId: string) {
    const pending = (commentsList || []).find((c: any) => c.id === localId);
    if (!pending) return;
    const targetStoryId = pending.business_story_id ?? pending.story_id;
    if (!targetStoryId) {
      Alert.alert("Error", "Missing story reference. Please try sending a new comment.");
      return;
    }
    try {
      setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? { ...c, _failed: false, _optimistic: true } : c)));
      const saved = await addComment(targetStoryId, pending.content, pending.parent_id ?? undefined);
      setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? saved : c)));
      if (saved?.id) fetchCommentLikesFor([saved.id]).catch(() => {});
      fetchCommentsForActive().catch(() => {});
    } catch (err) {
      console.warn("retryComment err", err);
      setCommentsList((prev) => (prev || []).map((c: any) => (c.id === localId ? { ...c, _failed: true, _optimistic: false } : c)));
      Alert.alert("Error", "Retry failed");
    }
  }

  /* ---------------------- Shoot sheet helpers ---------------------- */

  async function openShootModalFor(target?: StoryItem | null) {
    try {
      setShootActiveTab("following");
      setShootFollowing([]);
      setShootSuggestions([]);
      setShootSelected(new Set());
      if (target) setShootTarget(target);

      const { data } = await supabase.auth.getUser();
      const myId = data?.user?.id;
      if (!myId) return;

      const { data: followRows } = await supabase.from("follows").select("following_id").eq("follower_id", myId).limit(500);
      const followingIds = ((followRows || []) as any[]).map((r) => r.following_id).filter((x): x is string => !!x);

      if (followingIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", followingIds);
        setShootFollowing(
          (profs || []).map((p: any) => ({ id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url }))
        );
      } else {
        setShootFollowing([]);
      }

      const exclude = [myId, ...followingIds];
      let query = supabase.from("profiles").select("id, full_name, username, avatar_url").order("full_name", { ascending: true }).limit(60);
      if (exclude.length) {
        const notExpr = `(${exclude.map((x) => `'${x}'`).join(",")})`;
        query = supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .not("id", "in", notExpr)
          .order("full_name", { ascending: true })
          .limit(60);
      }
      const { data: suggestions } = await query;
      setShootSuggestions(
        (suggestions || []).map((p: any) => ({ id: p.id, full_name: p.full_name, username: p.username, avatar_url: p.avatar_url }))
      );
    } catch (err) {
      console.warn("openShootModalFor err", err);
      Alert.alert("Error", "Could not load recipients.");
    }
  }

  const toggleShootSelect = (id: string) => {
    setShootSelected((prev) => {
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
      const { error: partErr } = await supabase.from("conversation_participants").insert([
        { conversation_id: cid, user_id: myId, accepted: true },
        { conversation_id: cid, user_id: targetId, accepted: false },
      ]);
      if (partErr) {
        console.warn("participant insert err", partErr);
      }
      // invitations are represented by participants.accepted — don't insert system messages
      return cid;
    } catch (err) {
      console.warn("findOrCreateDM err", err);
      throw err;
    }
  };

  const sendShootToSelected = async (overrideIds?: string[]) => {
    if (!shootTarget) {
      Alert.alert("No target", "No story selected to shoot.");
      return;
    }
    const ids = overrideIds ?? Array.from(shootSelected);
    if (!ids.length) {
      Alert.alert("Select recipients", "Pick at least one person to send to.");
      return;
    }
    setShootSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const myId = u?.user?.id;
      if (!myId) throw new Error("Not signed in");
      const mediaUrl = shootTarget.media_url || shootTarget.raw_media_url || "";
      for (const tid of ids) {
        try {
          const cid = await findOrCreateDM(tid);
          if (!cid) continue;
          const { error } = await supabase
            .from("messages")
            .insert({ conversation_id: cid, sender_id: myId, content: shootTarget.caption ?? "", media_url: mediaUrl });
          if (error) console.warn("insert message err", error);
        } catch (err) {
          console.warn("send to", tid, "err", err);
        }
      }
      Alert.alert("Sent", `Content sent to ${ids.length} recipient${ids.length > 1 ? "s" : ""}.`);
      animateShootTo(SHOOT_SHEET_CLOSED, () => setShootSheetVisible(false));
      setShootSelected(new Set());
      setShootTarget(null);
    } catch (err) {
      console.warn("sendShootToSelected err", err);
      Alert.alert("Send failed", "Could not send to some recipients.");
    } finally {
      setShootSending(false);
    }
  };

  const handleSendAll = async () => {
    const source = shootActiveTab === "following" ? shootFollowing : shootSuggestions;
    const ids = source.map((p) => p.id).filter((id): id is string => !!id);
    if (!ids.length) {
      Alert.alert("No recipients", "There are no users available here yet.");
      return;
    }
    setShootSelected(new Set(ids));
    await sendShootToSelected(ids);
  };

  async function reportStory({ targetUserId, storyId, reason }: { targetUserId?: string; storyId?: string; reason?: string }) {
    const myId = await getCurrentUserId();
    if (!myId) throw new Error("Not signed in");
    await supabase.from("reports").insert({ reporter_id: myId, target_user_id: targetUserId ?? null, story_id: storyId ?? null, reason });
  }

  async function blockUser(blockedId: string) {
    const myId = await getCurrentUserId();
    if (!myId) throw new Error("Not signed in");
    await supabase.from("blocked_users").upsert({ blocker_id: myId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  }

  async function loadSocialStateForActive() {
    const g = groups[activeUserIndex ?? 0];
    const s = getActiveStory();
    if (!g || !s) return;
    try {
      if (g.userId) {
        const following = await isFollowing(String(g.userId));
        setIsFollowingState((m) => ({ ...m, [String(g.userId)]: following }));
      }
      if (s.id) {
        const myId = await getCurrentUserId();
        if (myId) {
          const { data: liked } = await supabase
            .from("business_story_likes")
            .select("id")
            .eq("business_story_id", s.id)
            .eq("user_id", myId)
            .maybeSingle();
          setIsLikedState((m) => ({ ...m, [s.id]: !!liked }));
        }
        const cnt = await fetchLikesCount(s.id);
        setLikesCountMap((m) => ({ ...m, [s.id]: cnt }));
      }
    } catch (e) {
      // ignore
    }
  }

  // Optimistic follow toggle (fast UI)
  async function handleFollowToggle(targetId: string) {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // optimistic update
      setIsFollowingState((m) => ({ ...m, [targetId]: !m[targetId] }));
      await toggleFollowServer(targetId);
    } catch (err) {
      // revert and show error
      setIsFollowingState((m) => ({ ...m, [targetId]: !m[targetId] }));
      Alert.alert("Error", "Could not toggle follow");
    }
  }

  // Optimistic like toggle (fast UI)
  async function handleLikeToggle(storyId: string) {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // optimistic UI change
      setIsLikedState((m) => ({ ...m, [storyId]: !m[storyId] }));
      // update local count immediately
      setLikesCountMap((m) => ({ ...m, [storyId]: (m[storyId] ?? 0) + (isLikedState[storyId] ? -1 : 1) }));
      await toggleLikeServer(storyId);
      // refresh accurate count
      const newCount = await fetchLikesCount(storyId);
      setLikesCountMap((m) => ({ ...m, [storyId]: newCount }));
    } catch (err) {
      // revert on error
      setIsLikedState((m) => ({ ...m, [storyId]: !m[storyId] }));
      const cnt = await fetchLikesCount(storyId).catch(() => (likesCountMap[storyId] ?? 0));
      setLikesCountMap((m) => ({ ...m, [storyId]: cnt }));
      Alert.alert("Error", "Could not like story");
    }
  }

  async function handleAddComment(storyId: string, content: string) {
    const trimmed = content?.trim();
    if (!trimmed) return;
    try {
      Haptics.selectionAsync().catch(() => {});
      const parentId = replyTarget?.commentId ?? undefined;
      const optimisticId = `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const iso = new Date().toISOString();
      const optimisticProfile = currentProfile ?? null;

      const optimistic: any = {
        id: optimisticId,
        business_story_id: storyId,
        user_id: optimisticProfile?.id ?? null,
        content: trimmed,
        created_at: iso,
        parent_id: parentId ?? null,
        profiles: optimisticProfile,
        _optimistic: true,
      };

      setCommentsList((prev) => [...(prev || []), optimistic]);
      requestAnimationFrame(() => {
        commentListRef.current?.scrollToEnd?.({ animated: true });
      });
      setCommentDraft("");
      setReplyTarget(null);

      try {
        const saved = await addComment(storyId, trimmed, parentId);
        setCommentsList((prev) => (prev || []).map((c: any) => (c.id === optimisticId ? saved : c)));
        if (saved?.id) fetchCommentLikesFor([saved.id]).catch(() => {});
        fetchCommentsForActive().catch(() => {});
      } catch (err) {
        console.warn("optimistic comment err", err);
        setCommentsList((prev) => (prev || []).map((c: any) => (c.id === optimisticId ? { ...c, _failed: true, _optimistic: false } : c)));
        Alert.alert("Error", "Could not send comment. Tap retry.");
      }
    } catch (err) {
      console.warn("handleAddComment err", err);
      Alert.alert("Error", "Could not add comment");
    }
  }

  // -------------------- Delete story --------------------
  async function handleDeleteStory() {
    const s = getActiveStory();
    const g = groups[activeUserIndex ?? 0];
    if (!s || !g) return;
    try {
      const myId = await getCurrentUserId();
      if (!myId) {
        Alert.alert("Not signed in", "You must be signed in to delete a post.");
        return;
      }
      if (String(g.userId) !== String(myId)) {
        Alert.alert("Not allowed", "You can only delete your own stories.");
        return;
      }
      Alert.alert("Delete story", "Are you sure you want to delete this story?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // soft-delete
              const { error } = await supabase.from("business_stories").update({ is_deleted: true }).eq("id", s.id);
              if (error) throw error;

              // remove locally
              setGroups((prev) => {
                const next = prev
                  .map((grp) => {
                    if (grp.userId !== g.userId) return grp;
                    const remaining = grp.stories.filter((st) => st.id !== s.id);
                    return { ...grp, stories: remaining };
                  })
                  .filter((grp) => grp.stories.length > 0);
                return next;
              });

              setActionSheetVisible(false);
              setTimeout(() => {
                if (activeUserIndex != null) {
                  if (activeUserIndex >= groups.length - 1) {
                    handleClose();
                  } else {
                    goToNextUser();
                  }
                }
              }, 100);
            } catch (err) {
              console.warn("delete story failed", err);
              Alert.alert("Error", "Could not delete story.");
            }
          },
        },
      ]);
    } catch (err) {
      Alert.alert("Error", "Could not delete story.");
    }
  }

  // -------------------- Render helpers --------------------
  function renderTopProgress() {
    const g = groups[activeUserIndex ?? 0];
    if (!g) return null;
    return (
      <View style={styles.progressRow} pointerEvents="none">
        {g.stories.map((s, idx) => {
          const segKey = `${g.userId}:${s.id}`;
          const widthValue = ensureSegmentWidthValue(segKey);
          const showFill = idx <= activeStoryIndex;
          const fillWidth =
            idx < activeStoryIndex
              ? widthValue
              : idx === activeStoryIndex
              ? Animated.multiply(widthValue, progress)
              : zeroWidth;
          return (
            <View
              key={s.id}
              style={styles.progressSegment}
              onLayout={({ nativeEvent }) => {
                widthValue.setValue(nativeEvent.layout.width);
              }}
            >
              <View style={styles.progressTrack} />
              {showFill ? <Animated.View style={[styles.progressFill, { width: fillWidth }]} /> : null}
            </View>
          );
        })}
      </View>
    );
  }

  // -------------------- Comments sheet --------------------
  function renderCommentsSheet() {
    const story = getActiveStory();
    const storyId = story?.id ?? "";

    return (
      <>
        {commentSheetVisible ? (
          <Modal
            visible
            animationType="none"
            transparent
            onRequestClose={() => {
              animateSheetTo(SHEET_CLOSED, () => {
                setCommentSheetVisible(false);
                setReplyTarget(null);
              });
            }}
          >
            <TouchableWithoutFeedback
              onPress={() => {
                animateSheetTo(SHEET_CLOSED, () => {
                  setCommentSheetVisible(false);
                  setReplyTarget(null);
                });
              }}
            >
              <View style={styles.sheetOverlay} />
            </TouchableWithoutFeedback>

            <Animated.View style={[styles.commentSheetContainer, { top: sheetY }]} {...sheetPanResponder.panHandlers}>
              <View style={styles.sheetDragHandleWrap}>
                <View style={styles.sheetDragHandle} />
              </View>

              <View style={styles.commentSheetHeader}>
                <Text style={styles.sheetTitle}>Comments</Text>
                <TouchableOpacity
                  onPress={() => {
                    animateSheetTo(SHEET_CLOSED, () => {
                      setCommentSheetVisible(false);
                      setReplyTarget(null);
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}>
                <View style={styles.commentSheetBody}>
                  {replyTarget ? (
                    <View style={styles.replyBanner}>
                      <Text style={styles.replyBannerText}>Replying to </Text>
                      <Text style={styles.replyBannerName}>{replyTarget.displayName ?? "user"}</Text>
                      <TouchableOpacity onPress={() => setReplyTarget(null)} style={styles.replyBannerCancel}>
                        <Text style={styles.replyBannerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <View style={styles.commentsListWrap}>
                    {commentsLoading ? (
                      <View style={styles.commentsLoader}>
                        <ActivityIndicator color="#9AA4B2" />
                      </View>
                    ) : commentsList.length === 0 ? (
                      <Animated.View style={[styles.firstCommentWrapper, { transform: [{ scale: firstCommentPulse }] }]}>
                        <TouchableOpacity
                          onPress={() => commentInputRef.current?.focus()}
                          activeOpacity={0.88}
                          style={styles.firstCommentCard}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Ionicons name="chatbubble-ellipses" size={22} color="#fff" style={{ marginRight: 12 }} />
                            <View>
                              <Text style={styles.firstCommentTitle}>Be the first to comment</Text>
                              <Text style={styles.firstCommentSubtitle}>Share your thoughts — spark the conversation.</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    ) : (
                      (() => {
                        const repliesMap: Record<string, any[]> = {};
                        const topLevel: any[] = [];

                        (commentsList || []).forEach((c: any) => {
                          const pid = c.parent_id ?? null;
                          if (!pid) topLevel.push(c);
                          else {
                            if (!repliesMap[pid]) repliesMap[pid] = [];
                            repliesMap[pid].push(c);
                          }
                        });

                        const maxShow = 5;

                        const renderCommentWithReplies = (comment: any, level = 0): React.ReactElement => {
                          const prof = comment?.profiles ?? null;
                          const likeCnt = commentLikesMap[comment.id] ?? 0;
                          const liked = !!commentLikedByMe[comment.id];

                          const replies = repliesMap[comment.id]
                            ? [...repliesMap[comment.id]].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            : [];
                          const isExpanded = !!expandedComments[comment.id];
                          const isFull = !!fullExpandedComments[comment.id];
                          const shownReplies = isExpanded ? (isFull ? replies : replies.slice(0, maxShow)) : [];

                          return (
                            <View key={comment.id}>
                              <View style={[styles.commentItemRow, { marginLeft: level ? 12 * Math.min(level, 3) : 0 }]}>
                                <Image
                                  source={prof?.avatar_url ? { uri: buildCloudinaryUrl(prof.avatar_url, "image") ?? prof.avatar_url } : { uri: PLACEHOLDER_AVATAR }}
                                  style={[styles.commentAvatar, level ? styles.replyAvatarSmall : null]}
                                />
                                <View style={{ flex: 1 }}>
                                  <View style={styles.commentHeaderRow}>
                                    <View style={styles.commentNameWrap}>
                                      <Text style={styles.commentName} numberOfLines={1}>
                                        {prof?.full_name ?? prof?.username ?? "Unknown"}
                                      </Text>
                                      {prof?.full_name ? <VerificationBadge size={14} /> : null}
                                      {level > 0 ? <Text style={styles.commentReplyTag}>Reply</Text> : null}
                                    </View>
                                    <Text style={styles.commentTimestamp}>{timeAgoLabel(comment?.created_at)}</Text>
                                  </View>

                                  <Text style={styles.commentBody}>{comment?.content}</Text>

                                  <View style={styles.commentActionsRow}>
                                    <TouchableOpacity onPress={() => setReplyTarget({ commentId: comment.id, displayName: prof?.full_name ?? prof?.username ?? "user" })} style={{ marginRight: 18 }}>
                                      <Text style={styles.commentReplyBtn}>Reply</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => toggleCommentLike(comment.id)} style={styles.commentLikeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                      <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={liked ? "#FF4D6D" : "#9AA4B2"} />
                                      <Text style={styles.commentLikeCount}>{formatCount(likeCnt)}</Text>
                                    </TouchableOpacity>

                                    {comment._optimistic ? (
                                      <View style={styles.commentStatusRow}>
                                        <ActivityIndicator size="small" color="#9AA4B2" />
                                        <Text style={styles.commentStatusText}>Sending…</Text>
                                      </View>
                                    ) : comment._failed ? (
                                      <View style={styles.commentStatusRow}>
                                        <Text style={styles.commentFailedText}>Failed</Text>
                                        <TouchableOpacity onPress={() => retryComment(comment.id)}>
                                          <Text style={styles.commentRetryText}>Retry</Text>
                                        </TouchableOpacity>
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              {replies.length > 0 ? (
                                <View style={styles.commentRepliesSection}>
                                  <TouchableOpacity onPress={() => setExpandedComments((p) => ({ ...(p || {}), [comment.id]: !isExpanded }))} style={styles.commentToggleReplies}>
                                    <View style={styles.commentTogglePill}>
                                      <Text style={styles.commentToggleText}>
                                        {isExpanded
                                          ? `Hide ${replies.length} repl${replies.length > 1 ? "ies" : "y"}`
                                          : `Show ${Math.min(replies.length, maxShow)} repl${replies.length > 1 ? "ies" : "y"}`}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>

                                  {isExpanded && shownReplies.map((r: any) => renderCommentWithReplies(r, Math.min(level + 1, 3)))}

                                  {isExpanded && replies.length > maxShow && !isFull ? (
                                    <TouchableOpacity onPress={() => setFullExpandedComments((p) => ({ ...(p || {}), [comment.id]: true }))} style={styles.commentToggleReplies}>
                                      <View style={styles.commentTogglePill}>
                                        <Text style={styles.commentToggleText}>{`Show all ${replies.length} replies`}</Text>
                                      </View>
                                    </TouchableOpacity>
                                  ) : null}

                                  {isExpanded && isFull && replies.length > maxShow ? (
                                    <TouchableOpacity onPress={() => setFullExpandedComments((p) => ({ ...(p || {}), [comment.id]: false }))} style={styles.commentToggleReplies}>
                                      <View style={styles.commentTogglePill}>
                                        <Text style={styles.commentToggleText}>{`Show less`}</Text>
                                      </View>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
                          );
                        };

                        return (
                          <NativeViewGestureHandler ref={commentsNativeRef}>
                            <FlatList
                              ref={commentListRef}
                              data={topLevel}
                              keyExtractor={(item: any) => String(item.id ?? Math.random())}
                              renderItem={({ item }: { item: any }) => renderCommentWithReplies(item, 0)}
                              style={{ flex: 1 }}
                              contentContainerStyle={{ paddingBottom: 16, paddingTop: 4 }}
                              keyboardShouldPersistTaps="handled"
                            />
                          </NativeViewGestureHandler>
                        );
                      })()
                    )}
                  </View>

                  <View style={styles.commentInputRow}>
                    <TextInput
                      ref={(r) => {
                        commentInputRef.current = r;
                      }}
                      value={commentDraft}
                      onChangeText={setCommentDraft}
                      placeholder={replyTarget ? `Reply to ${replyTarget.displayName}` : "Add a comment..."}
                      placeholderTextColor="#9AA4B2"
                      multiline
                      style={styles.commentInputField}
                      returnKeyType="send"
                      onSubmitEditing={() => {
                        if (!storyId) {
                          Alert.alert("Error", "No active story to comment on.");
                          return;
                        }
                        handleAddComment(storyId, commentDraft);
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (!storyId) {
                          Alert.alert("Error", "No active story to comment on.");
                          return;
                        }
                        handleAddComment(storyId, commentDraft);
                        Keyboard.dismiss();
                      }}
                      style={styles.sendBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.sendBtnText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Animated.View>
          </Modal>
        ) : null}

        {/* Emoji picker removed by design; keep state for future reuse if needed */}
      </>
    );
  }

  function renderShootSheet() {
    return (
      <Modal
        visible={shootSheetVisible}
        animationType="none"
        transparent
        onRequestClose={() => {
          animateShootTo(SHOOT_SHEET_CLOSED, () => setShootSheetVisible(false));
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            animateShootTo(SHOOT_SHEET_CLOSED, () => setShootSheetVisible(false));
          }}
        >
          <View style={styles.sheetOverlay} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.shootSheetContainer, { top: shootY }]} {...shootPanResponder.panHandlers}>
          <View style={styles.sheetDragHandleWrap}>
            <View style={styles.sheetDragHandle} />
          </View>

          <View style={styles.shootHeaderRow}>
            <Text style={styles.shootHeaderTitle}>Shoot</Text>
            <TouchableOpacity onPress={() => animateShootTo(SHOOT_SHEET_CLOSED, () => setShootSheetVisible(false))} style={{ padding: 8 }}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.shootTabRow}>
            <TouchableOpacity onPress={() => setShootActiveTab("following")} style={[styles.shootTabBtn, shootActiveTab === "following" ? styles.shootTabActive : null]}>
              <Text style={[styles.shootTabText, shootActiveTab === "following" ? styles.shootTabTextActive : null]}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShootActiveTab("suggestions")} style={[styles.shootTabBtn, shootActiveTab === "suggestions" ? styles.shootTabActive : null]}>
              <Text style={[styles.shootTabText, shootActiveTab === "suggestions" ? styles.shootTabTextActive : null]}>Suggestions</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shootListWrap}>
            <FlatList
              data={shootActiveTab === "following" ? shootFollowing : shootSuggestions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }: { item: ProfileShort }) => {
                const selected = shootSelected.has(item.id);
                return (
                  <TouchableOpacity onPress={() => toggleShootSelect(item.id)} style={[styles.recipientRow, selected ? styles.recipientRowActive : null]} activeOpacity={0.85}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <Image
                        source={item.avatar_url ? { uri: buildCloudinaryUrl(item.avatar_url, "image") ?? item.avatar_url } : { uri: PLACEHOLDER_AVATAR }}
                        style={styles.recipientAvatar}
                      />
                      <View style={styles.recipientNameWrap}>
                        <View style={styles.recipientNameRow}>
                          <Text numberOfLines={1} style={styles.recipientName}>
                            {item.full_name || item.username || "User"}
                          </Text>
                          {item.full_name ? <VerificationBadge size={13} /> : null}
                        </View>
                        {item.username ? (
                          <Text numberOfLines={1} style={styles.recipientHandle}>
                            @{item.username}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View>{selected ? <View style={styles.checkWrap}><Ionicons name="checkmark" size={14} color="#fff" /></View> : <View style={styles.circleWrap} />}</View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 18 }}
              ListEmptyComponent={() => (
                <View style={styles.emptyRecipients}>
                  <Text style={styles.emptyRecipientsText}>Loading...</Text>
                </View>
              )}
            />
          </View>

          <View style={styles.shootFooter}>
            <TouchableOpacity
              onPress={handleSendAll}
              disabled={shootSending || (shootActiveTab === "following" ? shootFollowing.length === 0 : shootSuggestions.length === 0)}
              style={[styles.sendAllBtn, (shootActiveTab === "following" ? shootFollowing.length === 0 : shootSuggestions.length === 0) || shootSending ? styles.disabledBtn : null]}
              activeOpacity={0.85}
            >
              <Text style={styles.sendAllText}>Send to all</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => sendShootToSelected()}
              disabled={shootSelected.size === 0 || shootSending}
              style={[styles.chuteBtn, shootSelected.size === 0 || shootSending ? styles.disabledBtn : null]}
              activeOpacity={0.85}
            >
              {shootSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.chuteBtnText}>{shootSelected.size ? `Shoot to ${shootSelected.size}` : "Shoot"}</Text>}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    );
  }

  // -------------------- Action sheet --------------------
  async function handleReport() {
    try {
      const s = getActiveStory();
      const g = groups[activeUserIndex ?? 0];
      await reportStory({ targetUserId: g?.userId ?? undefined, storyId: s?.id ?? undefined, reason: "Reported from story menu" });
      setActionSheetVisible(false);
      Alert.alert("Reported", "Thanks — we'll review this content.");
    } catch (err) {
      Alert.alert("Error", "Could not report.");
    }
  }

  async function handleBlockUser() {
    try {
      const g = groups[activeUserIndex ?? 0];
      if (!g?.userId) return;
      await blockUser(String(g.userId));
      setGroups((gprev) => gprev.filter((x) => x.userId !== g.userId));
      setActionSheetVisible(false);
      Alert.alert("Blocked", "User blocked and removed from feed.");
    } catch (err) {
      Alert.alert("Error", "Could not block user.");
    }
  }

  function handleNotInterested() {
    setActionSheetVisible(false);
    Haptics.selectionAsync().catch(() => {});
    goToNextUser();
  }

  function renderActionSheet() {
    const g = groups[activeUserIndex ?? 0];
    const isOwner = currentUserId && g?.userId && String(currentUserId) === String(g.userId);

    return (
      <BottomSheet visible={actionSheetVisible} onClose={() => setActionSheetVisible(false)} height={260} title="Actions">
        <View style={{ paddingHorizontal: 12 }}>
          <TouchableOpacity style={styles.sheetRowDark} onPress={handleReport}>
            <Text style={styles.sheetRowTextDark}>Report</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetRowDark} onPress={handleBlockUser}>
            <Text style={[styles.sheetRowTextDark, { color: "#FF6B6B" }]}>Block user</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetRowDark} onPress={handleNotInterested}>
            <Text style={styles.sheetRowTextDark}>Not interested</Text>
          </TouchableOpacity>

          {isOwner ? (
            <TouchableOpacity style={styles.sheetRowDark} onPress={handleDeleteStory}>
              <Text style={[styles.sheetRowTextDark, { color: "#FF6B6B" }]}>Delete story</Text>
            </TouchableOpacity>
          ) : null}

          <View style={{ height: 12 }} />
        </View>
      </BottomSheet>
    );
  }

  // -------------------- Root pan handlers (to switch users) --------------------
  function onRootPanHandlerStateChange(e: any) {
    // Left here for compatibility; we use PanResponder handlers on the main Animated.View.
  }

 
  const group = groups[activeUserIndex ?? 0];
  const story = getActiveStory();

  const combinedOpacity = Animated.multiply(entryOpacity, fadeAnim);
  const combinedScale = Animated.multiply(entryScale, interactScale);

  return (
    <SafeAreaView style={styles.container}>
      {renderCommentsSheet()}
      {renderActionSheet()}
      {renderShootSheet()}

      <Animated.View
        style={[
          styles.viewerWrap,
          {
            opacity: combinedOpacity,
            transform: [{ translateX: slideAnim }, { translateY: verticalDrag }, { scale: combinedScale }],
          },
        ]}
        {...(panRef.current ? panRef.current.panHandlers : {})}
      >
        {group && story && (
          <View style={{ width: "100%", height: "104%", backgroundColor: "#000000ff" }}>
            {renderTopProgress()}

            {/* top header overlay (raised up a bit) */}
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => navigateToProfile(group.profile?.id)} activeOpacity={0.85} style={styles.headerAvatarWrap}>
                <Image
                  source={group.profile?.avatar_url ? { uri: group.profile.avatar_url } : { uri: PLACEHOLDER_AVATAR }}
                  style={styles.headerAvatar}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigateToProfile(group.profile?.id)}
                onLongPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActionSheetVisible(true);
                }}
                activeOpacity={0.85}
                style={styles.headerTextWrap}
              >
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>{group.profile?.full_name ?? group.profile?.username ?? "Unknown"}</Text>
                  {group.profile?.full_name ? <VerificationBadge size={15} /> : null}
                </View>
                <Text style={styles.headerSub}>{timeAgoLabel(story.created_at)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!story) return;
                  Haptics.selectionAsync().catch(() => {});
                  setShootSelected(new Set());
                  setShootTarget(story);
                  setShootSheetVisible(true);
                  openShootModalFor(story).catch(() => {});
                  requestAnimationFrame(() => animateShootTo(SHOOT_SHEET_OPEN_TOP));
                }}
                style={styles.shootBtnPill}
                activeOpacity={0.88}
              >
                <Text style={styles.shootBtnText}>Shoot</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleFollowToggle(String(group.userId))}
                activeOpacity={0.88}
                style={[styles.followPillTop, isFollowingState[String(group.userId)] ? styles.followPillTopActive : null]}
              >
                <Text style={styles.followPillLabel}>{isFollowingState[String(group.userId)] ? "Following" : "Follow"}</Text>
              </TouchableOpacity>
            </View>

            {/* Media area with animated height */}
            <Animated.View style={[styles.mediaArea, { height: animatedMediaHeight }]}>
              <View style={[styles.mediaCard, { borderRadius: 16 }]}>
                {/* rounded container (overflow hidden) so videos/images have rounded corners */}
                <View style={{ flex: 1, width: WINDOW_W, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" }}>
                  {story.media_type === "video" ? (
                    <Video
                      ref={(r: VideoInstance | null) => {
                        if (r) videoRefs.current.set(story.id, r);
                        else videoRefs.current.delete(story.id);
                      }}
                      source={{ uri: mediaCache.get(story.media_url)?.localUri || story.media_url }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={!pausedByKeyboardRef.current}
                      isLooping={false}
                      onPlaybackStatusUpdate={(status: AVPlaybackStatus | null) => {
                        if (!status) return;
                        const st: any = status;
                        if (st.isLoaded === false) {
                          setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: true }));
                          return;
                        }

                        setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: false }));

                        const dur = st.durationMillis ?? 0;
                        const pos = st.positionMillis ?? 0;
                        if (dur > 0) {
                          const frac = Math.min(1, pos / dur);
                          progress.setValue(frac);
                        }

                        if (st.didJustFinish) {
                          progress.setValue(1);
                          goToNextStoryOrUser();
                          return;
                        }

                        if (!progressRunningRef.current) progressRunningRef.current = true;
                      }}
                      onLoad={(status: any) => {
                        setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: false }));
                        try {
                          const ns = status?.naturalSize;
                          const w = ns?.width ?? 0;
                          const h = ns?.height ?? 0;
                          if (w > 0 && h > 0) {
                            setMediaAspectMap((m: Record<string, number>) => ({ ...m, [story.id]: w / h }));
                          }
                        } catch {}
                        preloadMediaToCache(story.media_url).catch(() => {});
                        if (!progressRunningRef.current) startProgressForStory(story);
                      }}
                      onLoadStart={() => setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: true }))}
                      onError={() => {
                        setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: false }));
                        Animated.timing(progress, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
                          if (finished) goToNextStoryOrUser();
                        });
                      }}
                    />
                  ) : (
                    <Image
                      source={{ uri: mediaCache.get(story.media_url)?.localUri || story.media_url }}
                      style={{ width: "100%", height: "100%", resizeMode: "cover" as const }}
                      onLoadStart={() => setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: true }))}
                      onLoad={() => {
                        setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: false }));
                        if (!mediaAspectMap[story.id]) {
                          Image.getSize(
                            story.media_url,
                            (w, h) => {
                              if (w > 0 && h > 0) setMediaAspectMap((m: Record<string, number>) => ({ ...m, [story.id]: w / h }));
                            },
                            () => {}
                          );
                        }
                        preloadMediaToCache(story.media_url).catch(() => {});
                        if (!progressRunningRef.current) startProgressForStory(story);
                      }}
                      onError={() => setLoadingMap((m: Record<string, boolean>) => ({ ...m, [story.id]: false }))}
                    />
                  )}

                  {/* Big Blur & loader overlay while loading */}
                  {loadingMap[story.id] ? (
                    <BlurView intensity={70} tint="dark" style={styles.loadingBlur} pointerEvents="none">
                      <View style={styles.blurInner}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={{ color: "#fff", marginTop: 12, fontWeight: "700" }}>Loading…</Text>
                      </View>
                    </BlurView>
                  ) : null}
                </View>
              </View>
            </Animated.View>

            {/* Caption as full-width blur overlay above action bar */}
            {story.caption ? (
              <BlurView intensity={70} tint="dark" style={styles.captionOverlayFull}>
                <Text style={[styles.captionTextBold, { fontSize: SIZE_CONFIG.captionFont }]} numberOfLines={3}>
                  {story.caption}
                </Text>
              </BlurView>
            ) : null}

            {/* Tap zones to navigate (must be above media but below header and bottom bar) */}
            <View style={styles.tapZones} pointerEvents="box-none">
              <TouchableWithoutFeedback onPress={() => goToPrevStoryOrUser()}>
                <View style={styles.tapZoneLeft} />
              </TouchableWithoutFeedback>

              <TouchableWithoutFeedback
                onPress={() => {
                  const s = getActiveStory();
                  if (!s) return;
                  Haptics.selectionAsync().catch(() => {});
                  if (s.media_type === "video") {
                    const vref = videoRefs.current.get(s.id);
                    (async () => {
                      try {
                        const status = vref && typeof vref.getStatusAsync === "function" ? await vref.getStatusAsync().catch(() => null) : null;
                        if (status?.isPlaying) {
                          await safePauseVideo(vref);
                        } else {
                          await safePlayVideo(vref);
                        }
                      } catch {}
                    })();
                  } else {
                    if (progressRunningRef.current) {
                      stopProgress();
                    } else {
                      startProgressForStory(s);
                    }
                  }
                }}
              >
                <View style={styles.tapZoneCenter} />
              </TouchableWithoutFeedback>

              <TouchableWithoutFeedback onPress={() => goToNextStoryOrUser()}>
                <View style={styles.tapZoneRight} />
              </TouchableWithoutFeedback>
            </View>

            {/* Bottom action bar (anchored) */}
            <View style={styles.snapBottomCard}>
              <TouchableOpacity
                onPress={() => {
                  if (!story?.id) return;
                  Haptics.selectionAsync().catch(() => {});
                  fetchCommentsForActive().catch(() => {});
                  setCommentSheetVisible(true);
                }}
                activeOpacity={0.9}
                style={styles.commentStub}
              >
                <Ionicons name="chatbubble-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.commentStubText} numberOfLines={1}>
                  {commentsList.length ? `${formatCount(commentsList.length)} comments` : "Send a comment..."}
                </Text>
              </TouchableOpacity>

              <View style={styles.snapActionsRow}>
                <TouchableOpacity
                  onPress={() => handleLikeToggle(story.id)}
                  activeOpacity={0.85}
                  style={[styles.bottomIconPill, isLikedState[story.id] ? styles.bottomIconPillActive : null]}
                >
                  <Ionicons name={isLikedState[story.id] ? "heart" : "heart-outline"} size={18} color="#fff" />
                  <Text style={styles.bottomIconText}>{formatCount(likesCountMap[story.id]) || ""}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (!story?.id) return;
                    Haptics.selectionAsync().catch(() => {});
                    fetchViewCount(story.id).catch(() => {});
                  }}
                  activeOpacity={0.85}
                  style={styles.bottomIconPill}
                >
                  <Feather name="eye" size={16} color="#fff" />
                  <Text style={styles.bottomIconText}>{formatCount(viewsCountMap[story.id] ?? 0)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {renderPreloaders()}
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

/* Styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000ff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  viewerWrap: { width: "100%", height: "100%", backgroundColor: "#000000ff" },

  progressRow: {
    position: "absolute",
    left: 12,
    right: 12,
    top: Platform.OS === "ios" ? 5 : 10,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 640,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    overflow: "hidden",
    marginHorizontal: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
  },

  mediaArea: {
    width: WINDOW_W,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaCard: {
    width: WINDOW_W,
    height: "101%",
    backgroundColor: "#000",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingBlur: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 75,
    alignItems: "center",
    justifyContent: "center",
  },
  blurInner: { alignItems: "center", justifyContent: "center" },

  // header overlay moved up a bit and high zIndex so taps go to header first
  headerRow: {
    position: "absolute",
    left: 16,
    right: 16,
    top: Platform.OS === "ios" ? 22 : 26,
    zIndex: 620,
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatarWrap: {
    marginRight: 12,
    borderRadius: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "#000000ff",
  },
  headerTextWrap: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  headerSub: {
    color: "#d1d5db",
    fontSize: 12,
    marginTop: 2,
    textShadowColor: "rgba(0, 0, 0, 0.73)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  shootBtnPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    marginRight: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  shootBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  snapBottomCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: BOTTOM_BAR_MARGIN,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#000000ff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 520,
  },
  commentStub: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginRight: 12,
  },
  commentStubText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    opacity: 0.95,
  },
  snapActionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomIconPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    marginLeft: 10,
  },
  bottomIconPillActive: {
    backgroundColor: "rgba(220,38,38,0.3)",
    borderColor: "rgba(248,113,113,0.55)",
  },
  bottomIconText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    marginLeft: 6,
  },

  loadingIndicatorWrap: { position: "absolute", alignSelf: "center", top: "45%", zIndex: 50 },
  loadingIndicatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 183, 255, 0.79)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // tap zones (covering media area, but lower zIndex than header and bottom bar)
  tapZones: { position: "absolute", left: 0, right: 0, top: 0, bottom: ACTION_BAR_HEIGHT + 20, flexDirection: "row", zIndex: 200 },
  tapZoneLeft: { flex: 1 },
  tapZoneCenter: { flex: 1 },
  tapZoneRight: { flex: 1 },

  // moved bottom action bar anchored to bottom of screen and higher zIndex than tap zones
  bottomActionBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: BOTTOM_BAR_MARGIN,
    height: ACTION_BAR_HEIGHT - 20,
    justifyContent: "center",
    zIndex: 500,
    backgroundColor: "rgba(0, 0, 0, 1)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 1)",
  },

  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 1)",
  },

  bottomSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000ff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },

  sheetDragHandleWrap: { alignItems: "center", paddingVertical: 8 },
  sheetDragHandle: { width: 56, height: 6, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)" },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#E6EEF3" },
  sheetClose: { padding: 6 },

  sheetRowDark: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.03)" },
  sheetRowTextDark: { fontWeight: "700", fontSize: 16, color: "#E6EEF3" },

  viewerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f1f1" },
  viewerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#ddd" },
  viewerName: { fontWeight: "700", marginBottom: 4 },
  viewerMeta: { color: "#666", fontSize: 12 },
  messageBtn: { backgroundColor: "#4AA3FF", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },

  textMuted: { color: "#9AA4B2" },

  // caption overlay (full width blur) raised up above bottom action bar
  captionOverlayFull: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: ACTION_BAR_HEIGHT + 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 480,
    borderRadius: 0,
    alignItems: "flex-start",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  captionTextBold: {
    color: "#FFFFFF",
    lineHeight: 22,
    fontWeight: "800",
  },

  commentRow: { padding: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.03)", marginBottom: 6 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.02)" },

  sendBtn: { marginLeft: 10, backgroundColor: "#2563eb", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  commentSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000ff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 24,
    paddingBottom: Platform.OS === "ios" ? 26 : 16,
  },
  commentSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  commentSheetBody: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  commentsListWrap: { flex: 1, paddingBottom: 12 },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(37,99,235,0.14)",
    marginBottom: 12,
  },
  replyBannerText: { color: "#9AA4B2", fontWeight: "700", marginRight: 4 },
  replyBannerName: { color: "#fff", fontWeight: "800" },
  replyBannerCancel: { marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  replyBannerCancelText: { color: "#fff", fontWeight: "700" },

  firstCommentWrapper: { marginBottom: 16 },
  firstCommentCard: {
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  firstCommentTitle: { color: "#fff", fontWeight: "800", fontSize: 16 },
  firstCommentSubtitle: { color: "#9AA4B2", marginTop: 4, fontSize: 13 },

  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(12,18,28,0.92)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  commentInputField: {
    flex: 1,
    color: "#E6EEF3",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 14,
    maxHeight: 120,
  },
  commentsLoader: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 24 },

  commentItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  commentHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  commentNameWrap: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  commentName: { color: "#fff", fontWeight: "800", marginRight: 6, maxWidth: WINDOW_W * 0.45 },
  commentReplyTag: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.12)",
    color: "#93c5fd",
    fontSize: 11,
    marginLeft: 6,
  },
  commentTimestamp: { color: "#9AA4B2", fontSize: 11, marginLeft: 8 },
  commentBody: { color: "#E6EEF3", fontSize: 14, lineHeight: 20 },

  commentActionsRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  commentReplyBtn: { color: "#93c5fd", fontWeight: "700", fontSize: 13 },
  commentLikeBtn: { flexDirection: "row", alignItems: "center" },
  commentLikeCount: { color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 12 },
  commentStatusRow: { flexDirection: "row", alignItems: "center", marginLeft: 12 },
  commentStatusText: { color: "#9AA4B2", fontSize: 12, marginLeft: 6 },
  commentFailedText: { color: "#fca5a5", fontWeight: "800", marginRight: 6 },
  commentRetryText: { color: "#93c5fd", fontWeight: "800" },

  commentRepliesSection: { marginLeft: 20, marginTop: 12 },
  commentToggleReplies: { marginBottom: 8 },
  commentTogglePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.16)",
  },
  commentToggleText: { color: "#E6EEF3", fontWeight: "700" },
  replyAvatarSmall: { width: 28, height: 28, borderRadius: 14 },

  shootSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000ff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 26,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
  },
  shootHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  shootHeaderTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
  shootTabRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  shootTabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, marginRight: 12, backgroundColor: "rgba(15,23,42,0.68)" },
  shootTabActive: { backgroundColor: "rgba(0, 0, 0, 1)" },
  shootTabText: { color: "#9AA4B2", fontWeight: "700", fontSize: 13 },
  shootTabTextActive: { color: "#fff" },
  shootListWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 1)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.14)",
    marginBottom: 10,
  },
  recipientRowActive: {
    borderColor: "rgba(37,99,235,0.55)",
    backgroundColor: "rgba(37,99,235,0.18)",
  },
  recipientAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)" },
  recipientNameWrap: { marginLeft: 12, flex: 1 },
  recipientNameRow: { flexDirection: "row", alignItems: "center" },
  recipientName: { color: "#fff", fontWeight: "800", fontSize: 14, flexShrink: 1 },
  recipientHandle: { color: "#9AA4B2", fontSize: 12, marginTop: 2 },
  circleWrap: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#94a3b8" },
  checkWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  emptyRecipients: { alignItems: "center", justifyContent: "center", paddingVertical: 32 },
  emptyRecipientsText: { color: "#9AA4B2", fontWeight: "700" },
  shootFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 18 : 14,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  sendAllBtn: {
    flex: 1,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    backgroundColor: "rgba(7, 10, 15, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  sendAllText: { color: "#E6EEF3", fontWeight: "800", fontSize: 13 },
  chuteBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.45,
  },
  chuteBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  iconCircle: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },

  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0, 0, 0, 1)",
  },
  actionPillActive: {
    backgroundColor: "rgba(247,37,133,0.24)",
    borderColor: "rgba(247,37,133,0.6)",
  },
  actionPillLabel: {
    color: "#fff",
    fontWeight: "800",
    marginLeft: 8,
    fontSize: 14,
  },

  followPillTop: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(12,16,28,0.68)",
    marginLeft: 4,
  },
  followPillTopActive: {
    backgroundColor: "rgba(12,16,28,0.4)",
  },
  followPillLabel: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  eyePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  pillText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  pillTextLarge: { color: "#fff", fontWeight: "900", fontSize: SIZE_CONFIG.pillFont },

  avatarPlaceholder: { backgroundColor: "rgba(0,0,0,0.05)" },
});

export default function UserStoriesPage() {
  const params = useLocalSearchParams();
  return <UserStoriesView initialUserId={(params?.userId as string) ?? null} />;
}

