// ChatsScreen.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
  AccessibilityInfo,
  Animated,
  Modal,
  Easing,
  StyleSheet,
  Platform,
  Dimensions,
  TouchableOpacity,
  TouchableWithoutFeedback,
  PanResponder,
  Keyboard,
} from "react-native";
import { Swipeable } from 'react-native-gesture-handler';
// UnifiedBottomSheet removed — reverting to RN Modal usage
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { useDoodleFeatures } from '@/lib/doodleFeatures';
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/lib/store/profile";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openImagePickerAsync } from '@/utils/imagepicker';
import { uploadToCloudinaryLocal } from '@/utils/cloudinary';
import { useCustomAlert } from '@/components/CustomAlert';
import NetInfo from "@react-native-community/netinfo";
import { useTheme, VELT_ACCENT } from "app/themes";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/* ----------------------------- Types ----------------------------- */
type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role?: string | null;
};

type Conversation = {
  id: string;
  created_at: string;
  is_group: boolean;
  title: string | null;
  avatar_url: string | null;
  otherUser?: Profile | null;
    last_message?: {
      id: string;
      sender_id: string;
      content: string;
      created_at: string;
      media_type?: string | null;
      story_id?: string | null;
    } | null;
  last_read_by_me?: boolean;
  pinned?: boolean;
};

type FilterKey = "all" | "unread";

const AVATAR_FALLBACK = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

/* ---------------- LOCAL BADGES (require) ----------------
 Ensure these assets exist; adjust paths if needed.
 - assets/badges/pro-plan.png
 - assets/badges/celebrity-plan.png
 - assets/badges/channel-plan.png
 - assets/badges/partnership-plan.png
---------------------------------------------------------*/


function findLocalBadgeForRole(role?: string | null) {
  if (!role) return null;
  const r = String(role).trim().toLowerCase();
  const variants = [
    r,
    `${r}.png`,
    r.replace(/\s+/g, "-"),
    r.replace(/\s+/g, "_"),
    r.replace(/\s+/g, ""),
  ];
  // Add badge lookup logic here if needed
  return null;
}

/* ---------------- STORAGE KEYS ----------------- */
const CACHE_CONVOS_KEY = "cache:conversations";
const CACHE_PINNED_KEY = "cache:convos:pinned";
const CACHE_STORY_USERS_KEY = "cache:stories:user_ids";

/* --------------------------- Utilities --------------------------- */
const whenShort = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/* ----------------------------- Screen ---------------------------- */
export default function ChatsScreen() {
  const router = withSafeRouter(useRouter());
  const { profile } = useProfileStore();
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();

  // use centralized app theme from app/themes.tsx
  const { colors: themeColors } = useTheme();
  const isDark = themeColors.isDark;

  // compose local color tokens from theme for minimal changes to your UI
  const colors = useMemo(
    () => ({
      bg: themeColors.bg,
      text: themeColors.text,
      sub: themeColors.subtext,
      line: themeColors.border,
      pillBg: themeColors.card,
      accent: VELT_ACCENT, // Use unified Velt accent
      card: themeColors.card,
      glassTint: themeColors.faint,
    }),
    [themeColors]
  );

      // doodles: deep background shapes for chat screen (theme linked)
      const [reduceMotion, setReduceMotion] = useState(false);
      const doodleA = useRef(new Animated.Value(0)).current;
      const doodleB = useRef(new Animated.Value(0)).current;
      const doodleC = useRef(new Animated.Value(0)).current;
      const doodleAnimRef = useRef<any>(null);
      const doodleStatusRef = useRef<'idle'|'running'|'stopped'>('idle');
      const { enabled: doodlesEnabled, loaded: doodleLoaded } = useDoodleFeatures('chat');

      useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled()
          .then((isReduced) => {
            setReduceMotion(isReduced);
          })
          .catch(() => setReduceMotion(false));
      }, []);

      const startDoodleLoop = useCallback(() => {
        if (reduceMotion) return;
        if (doodleAnimRef.current) {
          try { doodleAnimRef.current.stop?.(); } catch {}
          doodleAnimRef.current = null;
        }
        try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {}

        try {
          const loop = Animated.loop(
            Animated.parallel([
              Animated.sequence([Animated.timing(doodleA, { toValue: 1, duration: 8400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleA, { toValue: 0, duration: 8400, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
              Animated.sequence([Animated.delay(400), Animated.timing(doodleB, { toValue: 1, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleB, { toValue: 0, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
              Animated.sequence([Animated.delay(900), Animated.timing(doodleC, { toValue: 1, duration: 10000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleC, { toValue: 0, duration: 10000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
            ])
          );
          doodleAnimRef.current = loop;
          doodleStatusRef.current = 'running';
          loop.start();
        } catch (e) {
          doodleAnimRef.current = null;
        }
      }, [doodleA, doodleB, doodleC, reduceMotion]);

      const stopDoodleLoop = useCallback(() => {
        try { doodleAnimRef.current?.stop?.(); } catch {}
        doodleAnimRef.current = null;
        doodleStatusRef.current = 'stopped';
        try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {}
      }, [doodleA, doodleB, doodleC]);

      useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled()
          .then((isReduced) => {
            if (!mounted) return;
            setReduceMotion(isReduced);
            if (!isReduced && doodleLoaded && doodlesEnabled) startDoodleLoop();
          })
          .catch(() => setReduceMotion(false));

        return () => { mounted = false; stopDoodleLoop(); doodleAnimRef.current = null; };
      }, [doodleLoaded, doodlesEnabled, startDoodleLoop, stopDoodleLoop]);

      useFocusEffect(
        useCallback(() => {
          if (doodleLoaded && doodlesEnabled && !reduceMotion) startDoodleLoop();
          return () => stopDoodleLoop();
        }, [doodleLoaded, doodlesEnabled, reduceMotion, startDoodleLoop, stopDoodleLoop])
      );

      useEffect(() => {
        if (!doodleLoaded) return;
        if (!doodlesEnabled) {
          stopDoodleLoop();
        } else {
          if (!reduceMotion) startDoodleLoop();
        }
      }, [doodlesEnabled, doodleLoaded, reduceMotion, startDoodleLoop, stopDoodleLoop]);

  // Network status and offline header
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [showOfflineHeader, setShowOfflineHeader] = useState(false);
  const offlineHeaderTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      setIsConnected(connected);
      
      if (!connected) {
        if (offlineHeaderTimeoutRef.current) clearTimeout(offlineHeaderTimeoutRef.current);
        setShowOfflineHeader(true);
        offlineHeaderTimeoutRef.current = setTimeout(() => setShowOfflineHeader(false), 5000);
      } else {
        if (offlineHeaderTimeoutRef.current) clearTimeout(offlineHeaderTimeoutRef.current);
        setShowOfflineHeader(false);
      }
    });
    return () => {
      sub();
      if (offlineHeaderTimeoutRef.current) clearTimeout(offlineHeaderTimeoutRef.current);
    };
  }, []);

  // safe refs + state
  const searchRef = useRef<TextInput | null>(null);
  const channelMapRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [users, setUsers] = useState<Profile[]>([]);
  const [suggested, setSuggested] = useState<Profile[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createCandidates, setCreateCandidates] = useState<Profile[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSearchQuery, setCreateSearchQuery] = useState("");
  const navigationLockRef = useRef(false);
  const createPan = useRef<any>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [storyUsers, setStoryUsers] = useState<Profile[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Content fade-in animation (similar to home screen)
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const [contentReady, setContentReady] = useState(false);
  
  // Skeleton shimmer animation
  const skeletonAnim = useRef(new Animated.Value(0)).current;

  // Colorful message preview colors - cycle through these for variety
  const PREVIEW_COLORS = ['#FF6B6B', '#4CAF50', '#2196F3', '#E91E63', '#9C27B0', '#673AB7'];
  const getPreviewColor = useCallback((index: number) => PREVIEW_COLORS[index % PREVIEW_COLORS.length], []);

  // story users set (IDs of users who currently have an active story)
  const [storyUserIds, setStoryUserIds] = useState<Set<string>>(new Set());

  const liquidAvailable = useMemo(() => {
    try {
      return typeof isLiquidGlassAvailable === "function" ? isLiquidGlassAvailable() : false;
    } catch {
      return false;
    }
  }, []);

  // Skeleton shimmer effect
  useEffect(() => {
    if (loading) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(skeletonAnim, { toValue: 0, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [loading, skeletonAnim]);

  // Fade in content when data is ready
  useEffect(() => {
    if (!loading && convos.length > 0 && !contentReady) {
      setContentReady(true);
      Animated.timing(contentFadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else if (!loading && convos.length === 0 && !contentReady) {
      // No conversations - still fade in the empty state
      setContentReady(true);
      Animated.timing(contentFadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [loading, convos.length, contentReady, contentFadeAnim]);

  /* ------------------------- Data loading ------------------------- */
  const loadStoryUsers = useCallback(async () => {
    try {
      // fetch stories that are active (not deleted and not expired)
      const { data: rows, error } = await supabase
        .from("stories")
        .select("user_id,created_at,expire_at,is_deleted")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      const now = new Date();
      const activeUserIds = Array.from(
        new Set(
          (rows || [])
            .filter((r: any) => {
              if (!r) return false;
              if (r.is_deleted) return false;
              if (!r.expire_at) return true;
              try {
                return new Date(r.expire_at).getTime() > now.getTime();
              } catch {
                return true;
              }
            })
            .map((r: any) => r.user_id)
            .filter(Boolean)
        )
      );

      const s = new Set(activeUserIds);
      setStoryUserIds(s);

      // persist for other screens
      try {
        await AsyncStorage.setItem(CACHE_STORY_USERS_KEY, JSON.stringify(activeUserIds));
      } catch {}
    } catch (err) {
      // fallback to whatever we have
      console.warn("Failed loading story users:", err);
    }
  }, []);

  const loadConversations = async (opts: { remoteOnly?: boolean } = {}) => {
    if (!profile?.id) return;
    if (!opts.remoteOnly) {
      // load from cache first (fast-path)
      try {
        const raw = await AsyncStorage.getItem(CACHE_CONVOS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Conversation[];
          setConvos(parsed);
        }
        const rawPinned = await AsyncStorage.getItem(CACHE_PINNED_KEY);
        if (rawPinned) {
          const parsed = JSON.parse(rawPinned) as string[];
          setPinnedIds(new Set(parsed));
        }
        const rawStoryUsers = await AsyncStorage.getItem(CACHE_STORY_USERS_KEY);
        if (rawStoryUsers) {
          const parsed = JSON.parse(rawStoryUsers) as string[];
          setStoryUserIds(new Set(parsed || []));
        }
      } catch (e) {
        // ignore cache errors
      }
    }

    setLoading(true);

    try {
      const { data: partRows, error: partErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", profile.id);

      if (partErr) throw partErr;
      const convoIds = (partRows || []).map((r: any) => r.conversation_id);
      if (!convoIds.length) {
        setConvos([]);
        try {
          await AsyncStorage.setItem(CACHE_CONVOS_KEY, JSON.stringify([]));
        } catch {}
        setLoading(false);
        return;
      }

      const { data: baseConvos, error: convoErr } = await supabase
        .from("conversations")
        .select("id, created_at, is_group, title, avatar_url")
        .in("id", convoIds);

      if (convoErr) throw convoErr;

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at, media_type, story_id")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false });

      const lastMap = new Map<string, Conversation["last_message"]>();
      (msgs || []).forEach((m: any) => {
        if (!lastMap.has(m.conversation_id)) {
          lastMap.set(m.conversation_id, {
            id: m.id,
            sender_id: m.sender_id,
            content: m.content,
            created_at: m.created_at,
            media_type: m.media_type ?? null,
            story_id: m.story_id ?? null,
          });
        }
      });

      // DMs -> other user with role
      const dmIds = (baseConvos || []).filter((c: any) => !c.is_group).map((c: any) => c.id);
      const otherUserMap = new Map<string, Profile | null>();
      if (dmIds.length) {
        const { data: dmParts } = await supabase
          .from("conversation_participants")
          .select("conversation_id, user_id, profiles(id, full_name, avatar_url, role)")
          .in("conversation_id", dmIds);

        const byConvo: Record<string, any[]> = {};
        (dmParts || []).forEach((row: any) => {
          if (!byConvo[row.conversation_id]) byConvo[row.conversation_id] = [];
          byConvo[row.conversation_id].push(row);
        });

        Object.entries(byConvo).forEach(([cid, rows]) => {
          const other = (rows as any[]).find((r) => r.user_id !== profile.id);
          otherUserMap.set(
            cid,
            other?.profiles
              ? {
                  id: other.profiles.id,
                  full_name: other.profiles.full_name,
                  avatar_url: other.profiles.avatar_url,
                  role: other.profiles.role ?? null,
                }
              : null
          );
        });
      }

      const lastIds = Array.from(lastMap.values()).filter(Boolean).map((lm) => lm!.id);
      const readSet = new Set<string>();
      if (lastIds.length) {
        const { data: reads } = await supabase
          .from("message_reads")
          .select("message_id")
          .in("message_id", lastIds)
          .eq("user_id", profile.id);
        (reads || []).forEach((r: any) => readSet.add(r.message_id));
      }

      const list: Conversation[] = (baseConvos || []).map((c: any) => {
        const lm = lastMap.get(c.id) || null;
        const read = !lm || lm.sender_id === profile.id || readSet.has(lm.id);
        return {
          id: c.id,
          created_at: c.created_at,
          is_group: c.is_group,
          title: c.title,
          avatar_url: c.avatar_url,
          otherUser: c.is_group ? null : otherUserMap.get(c.id) || null,
          last_message: lm,
          last_read_by_me: read,
          pinned: pinnedIds.has(c.id),
        };
      });

      // pinned first, then activity
      list.sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        const at = a.last_message?.created_at || a.created_at;
        const bt = b.last_message?.created_at || b.created_at;
        return new Date(bt).getTime() - new Date(at).getTime();
      });

      setConvos(list);

      // persist cache
      try {
        await AsyncStorage.setItem(CACHE_CONVOS_KEY, JSON.stringify(list));
      } catch {}

      attachRealtime(list.map((c) => c.id));
    } catch (err) {
      console.error("Error fetching convos:", err);
      // keep cached convos if available
    } finally {
      setLoading(false);
    }
  };

  const attachRealtime = (ids: string[]) => {
    for (const [cid, ch] of channelMapRef.current) {
      if (!ids.includes(cid)) {
        supabase.removeChannel(ch);
        channelMapRef.current.delete(cid);
      }
    }
    ids.forEach((cid) => {
      if (channelMapRef.current.has(cid)) return;
      const ch = supabase
        .channel(`messages:${cid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` },
          () => loadConversations({ remoteOnly: true })
        )
        .subscribe();
      channelMapRef.current.set(cid, ch);
    });
  };

  useEffect(() => {
    if (!profile?.id) return;

    // load cached story-user ids quickly, then refresh remote
    (async () => {
      try {
        const rawStory = await AsyncStorage.getItem(CACHE_STORY_USERS_KEY);
        if (rawStory) {
          const parsed = JSON.parse(rawStory) as string[];
          setStoryUserIds(new Set(parsed || []));
        }
      } catch {}
      // always refresh remote in background
      loadStoryUsers();
    })();

    loadConversations();

    const base = supabase
      .channel(`convoparts:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants", filter: `user_id=eq.${profile.id}` },
        () => loadConversations({ remoteOnly: true })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(base);
      for (const [, ch] of channelMapRef.current) supabase.removeChannel(ch);
      channelMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // fetch unread notifications count and realtime updates for chat header badge
  useEffect(() => {
    if (!profile?.id) return;
    let mounted = true;
    (async () => {
      try {
        const { data: cnt, error: cntErr } = await supabase.rpc("notifications_unread_count", { p_recipient: profile.id });
        if (!cntErr) {
          if (Array.isArray(cnt)) {
            if (mounted) setUnreadCount(Number(cnt[0] ?? 0));
          } else {
            if (mounted) setUnreadCount(Number(cnt ?? 0));
          }
        }
      } catch (e) {}
    })();

    const ch = supabase
      .channel(`chats-notifs:${profile.id}`)
      .on(
        "postgres_changes",
        { schema: "public", table: "notifications", event: "INSERT", filter: `recipient=eq.${profile.id}` },
        (payload: any) => {
          if (!mounted) return;
          setUnreadCount((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        { schema: "public", table: "notifications", event: "UPDATE", filter: `recipient=eq.${profile.id}` },
        (payload: any) => {
          const old = payload.old;
          const n = payload.new;
          if (!old || !n) return;
          if (old.read === false && n.read === true) setUnreadCount((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      try {
        ch.unsubscribe();
      } catch {}
    };
  }, [profile?.id]);

  /* ----------------------- Search / Suggestions ----------------------- */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!search.trim()) {
        setUsers([]);
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .neq("id", profile?.id)
          .order("full_name", { ascending: true })
          .limit(12);
        if (!cancelled) setSuggested((data || []) as Profile[]);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .ilike("full_name", `%${search}%`)
        .neq("id", profile?.id)
        .limit(25);
      if (!cancelled) {
        if (error) {
          console.error(error);
          setUsers([]);
        } else {
          setUsers((data || []) as Profile[]);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [search, profile?.id]);

  // load the people who have stories (prefer followers + following)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!profile?.id) return;
      try {
        const myId = profile.id;
        const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", myId).limit(500);
        const { data: followerRows } = await supabase.from("follows").select("follower_id").eq("following_id", myId).limit(500);
        const ids = new Set<string>();
        (followingRows || []).forEach((r: any) => r.following_id && ids.add(r.following_id));
        (followerRows || []).forEach((r: any) => r.follower_id && ids.add(r.follower_id));
        ids.delete(myId);
        const idArray = Array.from(ids).slice(0, 60);
        let candidates: any[] = [];
        if (idArray.length) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", idArray).order("full_name", { ascending: true }).limit(60);
          candidates = profs || [];
        }
        if (mounted) {
          setStoryUsers(candidates as Profile[]);
        }
      } catch (err) {
        console.warn('load story users err', err);
      }
    })();
    return () => { mounted = false; };
  }, [profile?.id]);

  /* ----------------------------- Actions ----------------------------- */
  const onRefresh = async () => {
    Haptics.selectionAsync();
    setRefreshing(true);
    await Promise.all([loadConversations({ remoteOnly: true }), loadStoryUsers()]);
    setRefreshing(false);
  };

  const changeFilter = async (key: FilterKey) => {
    await Haptics.selectionAsync();
    setFilter(key);
  };

  const openListMenu = async () => {
    await Haptics.selectionAsync();
    showAlert({ title: "More", message: "List actions coming soon." });
  };

  const openRowMenu = async (c: Conversation) => {
    await Haptics.selectionAsync();
    const actions: Array<any> = [
      { text: c.pinned ? "Unpin chat" : "Pin chat", onPress: async () => { await Haptics.selectionAsync(); togglePin(c.id); } },
      { text: "Mute notifications", onPress: async () => { await Haptics.selectionAsync(); showAlert({ title: "Muted", message: "Notifications muted (placeholder)." }); } },
      {
        text: "Delete chat",
        style: "destructive" as const,
        onPress: async () => {
          await Haptics.selectionAsync();
          const { error } = await supabase.from("conversations").delete().eq("id", c.id);
          if (error) showAlert({ title: "Error", message: "Could not delete conversation." });
          else setConvos((prev) => prev.filter((x) => x.id !== c.id));
        },
      },
      { text: "Cancel", style: "cancel" as const },
    ];
    showAlert({ title: "Conversation options", message: "", buttons: actions });
  };

  const togglePin = (cid: string) => {
    Haptics.selectionAsync();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      setConvos((lst) => lst.map((c) => (c.id === cid ? { ...c, pinned: next.has(cid) } : c)));

      // persist pinned
      (async () => {
        try {
          await AsyncStorage.setItem(CACHE_PINNED_KEY, JSON.stringify(Array.from(next)));
        } catch {}
      })();

      return next;
    });
  };

  const startOrOpenDM = async (target: Profile) => {
    await Haptics.selectionAsync();
    if (!profile?.id) return;
    if (navigationLockRef.current) return; // prevent double-tap routing
    navigationLockRef.current = true;

    const { data: myParts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", profile.id);

    const myConvoIds = (myParts || []).map((p: any) => p.conversation_id);

    let existing: string | null = null;
    if (myConvoIds.length) {
      const { data: dmRows } = await supabase
        .from("conversations")
        .select("id")
        .in("id", myConvoIds)
        .eq("is_group", false);

      const dmIds = (dmRows || []).map((r: any) => r.id);

      if (dmIds.length) {
        const { data: combos } = await supabase
          .from("conversation_participants")
          .select("conversation_id, user_id")
          .in("conversation_id", dmIds);

        const byConvo: Record<string, Set<string>> = {};
        (combos || []).forEach((row: any) => {
          const set = byConvo[row.conversation_id] || new Set<string>();
          set.add(row.user_id);
          byConvo[row.conversation_id] = set;
        });

        for (const [cid, members] of Object.entries(byConvo)) {
          if (members.size === 2 && members.has(profile.id) && members.has(target.id)) {
            existing = cid;
            break;
          }
        }
      }
    }

    const go = (cid: string) =>
      router.push({
        pathname: `/message/chat/${cid}`,
        params: { otherName: target.full_name, otherAvatar: target.avatar_url || "" },
      });

    if (existing) {
      go(existing);
      setTimeout(() => (navigationLockRef.current = false), 900);
      return;
    }

    let ins = await supabase
      .from("conversations")
      .insert({ is_group: false, created_by: profile.id } as any)
      .select("id")
      .single();

    if (ins.error) {
      ins = await supabase.from("conversations").insert({ is_group: false }).select("id").single();
    }
    if (ins.error || !ins.data) {
      showAlert({ title: "Error", message: "Could not start conversation." });
      navigationLockRef.current = false;
      return;
    }
    const cid = ins.data.id;

    // try inserting participants with explicit accepted flags. If the DB does not
    // accept the extra column (older schemas, RLS, etc.) attempt a fallback
    // insert without the `accepted` field and surface diagnostics to console.
    let partErr: any = null;
    try {
      const { error } = await supabase.from("conversation_participants").insert([
        { conversation_id: cid, user_id: profile.id, accepted: true },
        { conversation_id: cid, user_id: target.id, accepted: false },
      ]);
      partErr = error;
    } catch (e) {
      partErr = e;
    }

    if (partErr) {
      console.warn("participants.insert failed with accepted flag, attempting fallback", partErr);
      // fallback - try the older insert shape (no accepted column)
      try {
        const { error: fallbackErr } = await supabase.from("conversation_participants").insert([
          { conversation_id: cid, user_id: profile.id },
          { conversation_id: cid, user_id: target.id },
        ]);
        if (fallbackErr) {
          console.error("participants.insert fallback also failed", fallbackErr);
          showAlert({ title: "Error", message: "Could not add participants." });
          return;
        }
      } catch (e) {
        console.error("participants.insert fallback threw", e);
        showAlert({ title: "Error", message: "Could not add participants." });
        return;
      }
    }
    // invites are prompt-driven via conversation_participants.accepted; do not create message rows

    go(cid);
    setTimeout(() => (navigationLockRef.current = false), 900);
  };

  const safeNavigateConversation = (cid: string, params?: any) => {
    if (navigationLockRef.current) return;
    navigationLockRef.current = true;
    try {
      router.push({ pathname: `/message/chat/${cid}`, params: params || {} });
    } finally {
      setTimeout(() => (navigationLockRef.current = false), 900);
    }
  };

  /* --------------------------- New Chat Modal --------------------------- */
  const openCreateBottomSheet = async () => {
    await Haptics.selectionAsync();
    Keyboard.dismiss();
    setCreateSearchQuery("");
    // use prefetched candidates if available for snappy open
    if (createCandidates && createCandidates.length) {
      setCreateModalVisible(true);
      // refresh in background
      (async () => {
        try {
          await loadCreateCandidates();
        } catch {}
      })();
      return;
    }
    setCreateLoading(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const myId = profile?.id ?? authUser?.user?.id ?? null;
      let candidates: any[] = [];
      if (myId) {
        const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", myId).limit(500);
        const { data: followerRows } = await supabase.from("follows").select("follower_id").eq("following_id", myId).limit(500);
        const ids = new Set<string>();
        (followingRows || []).forEach((r: any) => r.following_id && ids.add(r.following_id));
        (followerRows || []).forEach((r: any) => r.follower_id && ids.add(r.follower_id));
        ids.delete(myId);
        const idArray = Array.from(ids).slice(0, 100);
        if (idArray.length) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", idArray).order("full_name", { ascending: true }).limit(100);
          candidates = profs || [];
        }
      }
      if (!candidates.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").neq("id", profile?.id).order("full_name", { ascending: true }).limit(40);
        candidates = profs || [];
      }
      setCreateCandidates(candidates as Profile[]);
      setCreateModalVisible(true);
    } catch (err) {
      console.warn('openCreateBottomSheet err', err);
      setCreateCandidates([]);
      setCreateModalVisible(true);
    } finally {
      setCreateLoading(false);
    }
  };

  const loadCreateCandidates = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const myId = profile?.id ?? authUser?.user?.id ?? null;
      let candidates: any[] = [];
      if (myId) {
        const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", myId).limit(500);
        const { data: followerRows } = await supabase.from("follows").select("follower_id").eq("following_id", myId).limit(500);
        const ids = new Set<string>();
        (followingRows || []).forEach((r: any) => r.following_id && ids.add(r.following_id));
        (followerRows || []).forEach((r: any) => r.follower_id && ids.add(r.follower_id));
        ids.delete(myId);
        const idArray = Array.from(ids).slice(0, 100);
        if (idArray.length) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", idArray).order("full_name", { ascending: true }).limit(100);
          candidates = profs || [];
        }
      }
      if (!candidates.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").neq("id", profile?.id).order("full_name", { ascending: true }).limit(40);
        candidates = profs || [];
      }
      setCreateCandidates(candidates as Profile[]);
      try {
        await AsyncStorage.setItem('cache:create_candidates', JSON.stringify(candidates || []));
      } catch {}
    } catch (err) {
      console.warn('loadCreateCandidates err', err);
    }
  };

  useEffect(() => {
    // prefetch candidates on mount/profile change to make sheet open faster
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('cache:create_candidates');
        if (raw) {
          const parsed = JSON.parse(raw) as Profile[];
          if (mounted && parsed && parsed.length) setCreateCandidates(parsed);
        }
      } catch {}
      if (mounted) loadCreateCandidates();
    })();
    return () => { mounted = false; };
  }, [profile?.id]);

  // Filter create candidates based on search query
  const filteredCreateCandidates = useMemo(() => {
    if (!createSearchQuery.trim()) return createCandidates;
    const q = createSearchQuery.toLowerCase();
    return createCandidates.filter((c) => 
      c.full_name?.toLowerCase().includes(q) || 
      (c as any).username?.toLowerCase().includes(q)
    );
  }, [createCandidates, createSearchQuery]);

  /* ----------------------------- Filters ----------------------------- */
  // Only show DMs (filter out groups)
  const filteredConvos = convos.filter((c) => {
    // Always exclude groups - this is a DMs-only screen
    if (c.is_group) return false;
    if (filter === "all") return true;
    if (filter === "unread") return !c.last_read_by_me && c.last_message?.sender_id !== profile?.id;
    return true;
  });

  /* ---------------------------- Renderers ---------------------------- */
  const PillComp = ({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void; }) => (
    <Pressable
      onPress={async () => { await Haptics.selectionAsync(); onPress(); }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: active ? colors.text : colors.pillBg,
        borderWidth: 1,
        borderColor: colors.line,
        marginRight: 8,
      }}
    >
      <Ionicons name={icon} size={16} color={active ? (isDark ? "#000" : "#fff") : colors.text} style={{ marginRight: 6 }} />
      <Text style={{ color: active ? (isDark ? "#000" : "#fff") : colors.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  const renderSuggestion = (item: Profile) => {
    const hasStory = storyUserIds.has(item.id);
    return (
      <Pressable
        key={item.id}
        onPress={async () => { await Haptics.selectionAsync(); try { router.push(`/explore/user_stories/${item.id}`); } catch { router.push(`/explore/stories_plug/${item.id}`); } }}
        style={{ alignItems: "center", marginRight: 16 }}
      >
        <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', borderWidth: hasStory ? 3 : 0, borderColor: hasStory ? colors.accent : 'transparent' }}>
            <Image source={{ uri: item.avatar_url || AVATAR_FALLBACK }} style={{ width: 68, height: 68, borderRadius: 34 }} />
          </View>
        </View>
        <Text numberOfLines={1} style={{ color: colors.text, maxWidth: 90, fontSize: 13, fontWeight: '500' }}>{item.full_name}</Text>
      </Pressable>
    );
  };

  const renderConversationRow = (item: Conversation, index: number) => {
    const name = item.is_group ? item.title || "Group" : item.otherUser?.full_name || "Unknown";
    const avatar = item.is_group ? item.avatar_url || AVATAR_FALLBACK : item.otherUser?.avatar_url || AVATAR_FALLBACK;
    const preview = item.last_message?.content || "No messages yet";
    const time = whenShort(item.last_message?.created_at || item.created_at);
    const isUnread = !item.last_read_by_me && item.last_message?.sender_id !== profile?.id;
    const tileBadge = findLocalBadgeForRole(item.otherUser?.role);
    const otherId = item.otherUser?.id ?? null;
    const hasStory = otherId ? storyUserIds.has(otherId) : false;
    // Colorful message preview - cycle through vibrant colors
    const previewColor = getPreviewColor(index);

    const renderRightActions = () => {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Pin / unpin */}
          <TouchableOpacity onPress={async () => { await Haptics.selectionAsync(); togglePin(item.id); }} style={{ backgroundColor: item.pinned ? '#ffd700' : colors.pillBg, padding: 12, justifyContent: 'center', alignItems: 'center', borderColor: colors.line, borderWidth: item.pinned ? 0 : 1 }}>
            <Ionicons name="pin" size={18} color={item.pinned ? '#000' : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { await Haptics.selectionAsync(); showAlert({ title: 'Muted', message: 'Notifications muted (placeholder).' }); }} style={{ backgroundColor: '#bdbdbd', padding: 12, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="notifications-off" size={18} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { await Haptics.selectionAsync(); openRowMenu(item); }} style={{ backgroundColor: '#ff6b6b', padding: 12, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="ellipsis-vertical" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View key={item.id}>
        <Swipeable renderRightActions={renderRightActions}>
          <Pressable
            onPress={async () => { await Haptics.selectionAsync(); safeNavigateConversation(item.id, !item.is_group && item.otherUser ? { otherName: item.otherUser.full_name, otherAvatar: item.otherUser.avatar_url || "" } : {}); }}
            onLongPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openRowMenu(item); }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.bg,
            }}
          >
            <View style={{ marginRight: 12 }}>
              {/* Avatar: highlight with a story ring when the other user currently has a story */}
              <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", justifyContent: 'center', alignItems: 'center', borderWidth: hasStory ? 3 : 0, borderColor: hasStory ? VELT_ACCENT : 'transparent', padding: hasStory ? 2 : 0 }}>
                  <Image source={{ uri: avatar }} style={{ width: 58, height: 58, borderRadius: 29 }} />
                </View>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: 'space-between' }}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: isUnread ? "800" : "600", fontSize: 15 }}>{name}</Text>
                    {/* show a small pinned icon when the conversation is pinned */}
                    {item.pinned ? (
                      <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(255,215,0,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="pin" size={13} color={'#FFD700'} />
                      </View>
                    ) : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {item.pinned ? (
                    <View style={{ backgroundColor: 'rgba(255,215,0,0.12)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, marginRight: 8 }}>
                      <Text style={{ color: '#FFD700', fontWeight: '800', fontSize: 11 }}>Pinned</Text>
                    </View>
                  ) : null}
                  <Text style={{ color: colors.sub, fontSize: 12 }}>{time}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Text numberOfLines={1} style={{ color: previewColor, flex: 1, fontWeight: '500' }}>{preview}</Text>
                {/* show a small callout indicator when the last message references a story */}
                {item.last_message?.story_id ? (
                  <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.accent }}>
                    <Text style={{ color: isDark ? '#000' : '#fff', fontSize: 11, fontWeight: '800' }}>Callout</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        </Swipeable>
        <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 88, marginRight: 12 }} />
      </View>
    );
  };

  /* ------------------------------ UI ------------------------------- */
  const showAnimatedDoodles = Boolean(doodlesEnabled) && !reduceMotion;
  const showStaticDoodles = Boolean(doodlesEnabled) && reduceMotion;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      {/* decorative doodle background for Chats (theme-linked) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {showAnimatedDoodles ? (
          <>
            <Animated.View style={[styles.chatsDoodleLarge, { borderColor: colors.accent, opacity: 0.72, transform: [{ translateX: doodleA.interpolate({ inputRange: [0, 1], outputRange: [-24, 48] }) }, { translateY: doodleA.interpolate({ inputRange: [0, 1], outputRange: [-28, 72] }) }, { rotate: doodleA.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] }) }] }]} />
            <Animated.View style={[styles.chatsDoodleRight, { borderColor: colors.sub, opacity: 0.58, transform: [{ translateX: doodleB.interpolate({ inputRange: [0, 1], outputRange: [40, -44] }) }, { translateY: doodleB.interpolate({ inputRange: [0, 1], outputRange: [10, -40] }) }, { rotate: doodleB.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '-12deg'] }) }] }]} />
            <Animated.View style={[styles.chatsDoodleLower, { borderColor: themeColors.faint || colors.accent, opacity: 0.62, transform: [{ translateX: doodleC.interpolate({ inputRange: [0, 1], outputRange: [-28, 26] }) }, { translateY: doodleC.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }, { rotate: doodleC.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) }] }]} />
          </>
        ) : showStaticDoodles ? (
          <>
            <View style={[styles.chatsDoodleLarge, { borderColor: colors.accent, opacity: 0.64 }]} />
            <View style={[styles.chatsDoodleRight, { borderColor: colors.sub, opacity: 0.5 }]} />
            <View style={[styles.chatsDoodleLower, { borderColor: themeColors.faint || colors.accent, opacity: 0.6 }]} />
          </>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar - Glass or fallback */}
        {/* header row - render plain (no surrounding container) so buttons and title stand alone */}
        <View style={{ paddingTop: 12, paddingHorizontal: 12, backgroundColor: showOfflineHeader ? '#FF8C00' : 'transparent' }}>
          {showOfflineHeader ? (
            <View style={[styles.topBarInner, { justifyContent: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cloud-offline-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Offline</Text>
              </View>
            </View>
          ) : (
          <View style={styles.topBarInner}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable onPress={async () => { await Haptics.selectionAsync(); router.back(); }} style={[styles.iconButton, { backgroundColor: colors.pillBg, borderColor: colors.line, paddingHorizontal: 12 }]}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>OK</Text>
                </Pressable>
              </View>

              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>Messages</Text>

              {/* top-right compose */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={async () => { await Haptics.selectionAsync(); /* mark read then navigate */ try { if (profile?.id) { await supabase.from('notifications').update({ read: true }).eq('recipient', profile.id).eq('read', false); } } catch (e) { console.warn('mark read err', e); } setUnreadCount(0); router.push("/notifications"); }} style={[styles.iconButton, { backgroundColor: colors.pillBg, borderColor: colors.line }]}> 
                  <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="notifications-outline" size={20} color={colors.text} />
                    {unreadCount > 0 ? (
                      <View style={{ position: 'absolute', right: -4, top: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable 
                    onPress={openCreateBottomSheet} 
                    style={({ pressed }) => ([
                      styles.iconButton, 
                      { 
                        backgroundColor: VELT_ACCENT, 
                        borderColor: VELT_ACCENT,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      }
                    ])}
                  > 
                    <Ionicons name="add" size={22} color="#000" />
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          </View>
        

        {/* search button (navigates to full search view) */}
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 16 }}>
          <Pressable 
            onPress={async () => { await Haptics.selectionAsync(); router.push('/explore'); }} 
            style={({ pressed }) => ({ 
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.pillBg,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: colors.line,
              opacity: pressed ? 0.8 : 1,
            })}
          > 
            <Ionicons name="search" size={18} color={colors.sub} />
            <Text style={{ marginLeft: 10, color: colors.sub, fontSize: 15 }}>Search messages...</Text>
          </Pressable>
        </View>

        {/* Stories Section - Horizontal Scroll */}
        {search.trim().length === 0 && storyUsers.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Stories</Text>
              <View style={{ backgroundColor: 'rgba(255,75,118,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#FF4B76', fontSize: 12, fontWeight: '700' }}>{storyUserIds.size ?? 0} active</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
              {storyUsers.map((u) => renderSuggestion(u))}
            </ScrollView>
          </View>
        )}

        {/* Section Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Direct Messages</Text>
          {filteredConvos.filter(c => !c.last_read_by_me && c.last_message?.sender_id !== profile?.id).length > 0 && (
            <Pressable 
              onPress={() => changeFilter(filter === "unread" ? "all" : "unread")}
              style={({ pressed }) => ({
                backgroundColor: filter === "unread" ? VELT_ACCENT : 'rgba(255,255,255,0.08)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ 
                color: filter === "unread" ? '#000' : colors.sub, 
                fontSize: 12, 
                fontWeight: '700' 
              }}>
                {filter === "unread" ? "Show All" : `${filteredConvos.filter(c => !c.last_read_by_me && c.last_message?.sender_id !== profile?.id).length} Unread`}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Content: if searching show users, else show convos */}
        {search.trim() ? (
          <View>
            {users.map((u) => (
              <Pressable key={u.id} onPress={async () => { await Haptics.selectionAsync(); startOrOpenDM(u); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
                <Image source={{ uri: u.avatar_url || AVATAR_FALLBACK }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>{u.full_name}</Text>
              </Pressable>
            ))}
            {users.length === 0 && <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 24 }}>No users found</Text>}
          </View>
        ) : loading ? (
          /* Skeleton loading - shimmer effect */
          <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Animated.View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  opacity: skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
                }}
              >
                <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.pillBg, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ width: '60%', height: 14, borderRadius: 7, backgroundColor: colors.pillBg, marginBottom: 8 }} />
                  <View style={{ width: '80%', height: 12, borderRadius: 6, backgroundColor: colors.pillBg }} />
                </View>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Animated.View style={{ opacity: contentFadeAnim }}>
            {filteredConvos.length === 0 ? (
              <Text style={{ color: colors.sub, textAlign: "center", marginTop: 40 }}>No conversations yet</Text>
            ) : (
              filteredConvos.map((c, idx) => renderConversationRow(c, idx))
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* New Chat Modal - Fullscreen with search */}
      <Modal visible={createModalVisible} animationType="slide" onRequestClose={() => { setCreateModalVisible(false); setCreateSearchQuery(''); }}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          {/* Safe Area Header */}
          <View style={{ paddingTop: insets.top, backgroundColor: colors.bg }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              paddingHorizontal: 16, 
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}>
              <Pressable 
                onPress={() => { setCreateModalVisible(false); setCreateSearchQuery(''); }}
                style={({ pressed }) => ({ 
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderWidth: 1,
                  borderColor: colors.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                })}
              >
                <Ionicons name="chevron-down" size={24} color={colors.text} />
              </Pressable>
              
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
                    <Ionicons name="chatbubble" size={14} color={VELT_ACCENT} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: 0.3 }}>New Message</Text>
                </View>
                <Text style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
                  {createCandidates.length} people you follow
                </Text>
              </View>
              
              <View style={{ width: 40 }} />
            </View>
            
            {/* Search Bar */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', 
                borderRadius: 14,
                paddingHorizontal: 14,
                height: 48,
                borderWidth: 1,
                borderColor: colors.line,
              }}>
                <Ionicons name="search" size={20} color={colors.sub} />
                <TextInput
                  value={createSearchQuery}
                  onChangeText={setCreateSearchQuery}
                  placeholder="Search people..."
                  placeholderTextColor={colors.sub}
                  style={{ 
                    flex: 1, 
                    marginLeft: 12, 
                    color: colors.text, 
                    fontSize: 16,
                    fontWeight: '500',
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {createSearchQuery.length > 0 && (
                  <Pressable 
                    onPress={() => setCreateSearchQuery('')} 
                    style={({ pressed }) => ({ 
                      padding: 6,
                      borderRadius: 12,
                      backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                    })}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.sub} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
          
          {/* Users List */}
          {createLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={VELT_ACCENT} />
              <Text style={{ color: colors.sub, marginTop: 16, fontSize: 15 }}>Loading people you follow...</Text>
            </View>
          ) : filteredCreateCandidates.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Ionicons name="search" size={48} color={colors.sub} style={{ opacity: 0.5 }} />
              <Text style={{ color: colors.text, marginTop: 16, fontSize: 16, fontWeight: '600' }}>No results found</Text>
              <Text style={{ color: colors.sub, marginTop: 6, fontSize: 14, textAlign: 'center' }}>
                Try a different search term
              </Text>
            </View>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, paddingBottom: insets.bottom + 20 }}
            >
              {filteredCreateCandidates.map((u, index) => {
                const hasStory = storyUserIds.has(u.id);
                return (
                  <Pressable 
                    key={u.id} 
                    onPress={async () => { 
                      setCreateModalVisible(false); 
                      setCreateSearchQuery('');
                      await Haptics.selectionAsync(); 
                      startOrOpenDM(u); 
                    }} 
                    style={({ pressed }) => ({ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent',
                      marginBottom: 4,
                    })}
                  >
                    {/* Avatar with story ring */}
                    <View style={{ position: 'relative' }}>
                      <View style={{ 
                        width: 56, 
                        height: 56, 
                        borderRadius: 28, 
                        borderWidth: hasStory ? 2.5 : 0,
                        borderColor: hasStory ? VELT_ACCENT : 'transparent',
                        padding: hasStory ? 2 : 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Image 
                          source={{ uri: u.avatar_url || AVATAR_FALLBACK }} 
                          style={{ 
                            width: hasStory ? 48 : 56, 
                            height: hasStory ? 48 : 56, 
                            borderRadius: hasStory ? 24 : 28,
                          }} 
                        />
                      </View>
                      {/* Online indicator placeholder */}
                      <View style={{
                        position: 'absolute',
                        bottom: hasStory ? 2 : 0,
                        right: hasStory ? 2 : 0,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: '#4CAF50',
                        borderWidth: 2,
                        borderColor: colors.bg,
                      }} />
                    </View>
                    
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{u.full_name}</Text>
                      {hasStory && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: VELT_ACCENT, marginRight: 6 }} />
                          <Text style={{ color: VELT_ACCENT, fontSize: 12, fontWeight: '600' }}>Has active story</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={{ 
                      paddingHorizontal: 14, 
                      paddingVertical: 8, 
                      borderRadius: 20,
                      backgroundColor: VELT_ACCENT,
                    }}>
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Message</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ------------------------------ Styles ------------------------------ */
const styles = StyleSheet.create({
  // topBar/container style removed; header now renders without an enclosing box so buttons and title
  // appear as standalone elements on the screen.
  topBar: {
    // kept for compatibility if referenced elsewhere
    marginHorizontal: 0,
    marginTop: 0,
    overflow: "visible",
  },
  topBarInner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // chats doodles - deep, non-fading decorative shapes
  chatsDoodleLarge: {
    position: 'absolute',
    left: -36,
    top: -36,
    width: 480,
    height: 480,
    borderRadius: 280,
    borderWidth: 6.2,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  chatsDoodleRight: {
    position: 'absolute',
    right: -68,
    top: 24,
    width: 320,
    height: 320,
    borderRadius: 200,
    borderWidth: 5.2,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  chatsDoodleLower: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 120,
    height: 140,
    borderRadius: 100,
    borderWidth: 6.0,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  topBarFallback: {
    // fallback container removed — keep neutral defaults
    marginHorizontal: 0,
    marginTop: 0,
  },
  iconButton: {
    padding: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  searchCard: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: "hidden",
  },
  searchCardFallback: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
});





