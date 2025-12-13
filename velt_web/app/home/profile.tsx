// Simple HD badge component
const HDBadge = () => (
  <View style={{
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    zIndex: 10,
    alignSelf: 'flex-end',
  }}>
    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 }}>HD</Text>
  </View>
);
// app/(tabs)/profile.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  Share,
  ScrollView,
  FlatList,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AccessibilityInfo,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { supabase } from '@/lib/supabase';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, VELT_ACCENT, BUTTON_COLORS } from 'app/themes';
import { useProfileStore } from '@/lib/store/profile';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * NOTES:
 * - All hooks remain at top-level and unchanged in order to avoid hook-order errors.
 * - Visual adjustments:
 *   - header pills use BlurView (dark tint)
 *   - cover photo fills top (no extra top padding)
 *   - bio & username respect theme colors
 *   - font sizes increased
 *
 * After pasting this file, restart metro with: npx expo start -c
 */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COVER_HEIGHT = Math.max(160, SCREEN_HEIGHT * 0.28);
const STORAGE_PREFIX = 'profile_cache:';
type Profile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  cover_photo_url?: string | null;
  bio?: string | null;
  profession?: string | null;
  date_of_birth?: string | null;
  business_name?: string | null;
};
type Product = { id: string; user_id: string; title: string; price: number; images: string[] | null; description?: string | null; created_at?: string };
type Story = {
  id: string;
  user_id: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
  created_at?: string | null;
  revived_at?: string | null;
};
type TabKey = 'posts' | 'metrics' | 'revives' | 'products';

function isVideoUri(uri?: string | null) {
  if (!uri) return false;
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(uri);
}

/* ------------------------------- HOOKS: must be top-level and unconditional ------------------------------- */

export default function ProfileScreen() {
  // routing / params
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();
  const router = withSafeRouter(useRouter());

  const { colors } = useTheme();
  
  // Get cached profile from store for instant display
  const { profile: cachedProfile } = useProfileStore();

  // core identity state
  const [meId, setMeId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [storeForProfile, setStoreForProfile] = useState<any | null>(null);
  
  // Skeleton animation
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  // Content fade-in animation
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  // content
  const [stories, setStories] = useState<Story[]>([]);
  const [commercials, setCommercials] = useState<Story[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [revives, setRevives] = useState<Story[]>([]);
  const [revivesLoading, setRevivesLoading] = useState(false);
  const [hasActiveStory, setHasActiveStory] = useState(false);

  // stats maps
  const [storyLikesMap, setStoryLikesMap] = useState<Record<string, number>>({});
  const [storyCommentsMap, setStoryCommentsMap] = useState<Record<string, number>>({});

  // followers/following/likes totals
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [totalLikesCount, setTotalLikesCount] = useState<number | null>(null);

  // UI
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);

  // tabs
  const [pageIndex, setPageIndex] = useState<number>(0);
  const horizRef = useRef<ScrollView | null>(null);

  // metrics
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // caching helpers
  const cacheKey = (k: string) => `${STORAGE_PREFIX}${k}:${profileId ?? 'anon'}`;

  /* ------------------------------- END HOOKS ------------------------------- */

  const theme = useMemo(() => {
    const fallbackHair = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    return {
      bg: colors.bg,
      text: colors.text,
      sub: colors.subtext,
      card: colors.card,
      accent: colors.accent,
      hair: colors.border || fallbackHair,
      faint: colors.faint,
      isDark: !!colors.isDark,
    };
  }, [colors]);

  // Skeleton shimmer animation
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(skeletonAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [skeletonAnim]);

  // Fade in content when loaded
  useEffect(() => {
    if (!initialLoading && profile) {
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [initialLoading, profile, contentFadeAnim]);

  // Use cached profile initially for instant display (own profile only)
  useEffect(() => {
    if (!paramId && cachedProfile && !profile) {
      // If viewing own profile and we have cached profile, use it immediately
      setProfile({
        id: cachedProfile.id,
        username: cachedProfile.username,
        full_name: cachedProfile.full_name,
        avatar_url: cachedProfile.avatar_url,
        cover_photo_url: (cachedProfile as any).cover_photo_url,
        bio: (cachedProfile as any).bio,
        profession: (cachedProfile as any).profession,
        date_of_birth: (cachedProfile as any).date_of_birth,
        business_name: (cachedProfile as any).business_name,
      });
    }
  }, [paramId, cachedProfile, profile]);

  const statusBarStyle = theme.isDark ? 'light' : 'dark';
  const headerButtonBg = theme.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)';
  const headerButtonBorder = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  /* ------------------------------- Utility helpers ------------------------------- */

  const saveCache = useCallback(async (k: string, v: any) => {
    try {
      await AsyncStorage.setItem(cacheKey(k), JSON.stringify({ ts: Date.now(), v }));
    } catch {}
  }, [profileId]);

  

  const loadCache = useCallback(async (k: string) => {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(k));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.v ?? null;
    } catch {
      return null;
    }
  }, [profileId]);

  // format date safely
  const formatDate = useCallback((d?: string | null) => {
    if (!d) return '';
    try { const dt = new Date(d); if (isNaN(dt.getTime())) return d; return dt.toLocaleDateString(); } catch { return d; }
  }, []);

  const formatRelativeTime = useCallback((value?: string | null) => {
    if (!value) return '';
    try {
      const target = new Date(value).getTime();
      if (Number.isNaN(target)) return value;
      const diff = Date.now() - target;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(value).toLocaleDateString();
    } catch {
      return value ?? '';
    }
  }, []);

  // get auth and set profileId - use cached profile ID immediately for faster loading
  useEffect(() => {
    // If viewing own profile and we have cached profile, use its ID immediately
    if (!paramId && cachedProfile?.id) {
      setProfileId(cachedProfile.id);
      setMeId(cachedProfile.id);
    }
    
    // Then verify with auth (will update if different)
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const authId = data?.user?.id ?? null;
        setMeId(authId);
        setProfileId(paramId ?? authId ?? null);
      } catch {
        setProfileId(paramId ?? null);
      }
    })();
  }, [paramId, cachedProfile?.id]);

  const isOwnProfile = !!profileId && !!meId && profileId === meId;

  /* ------------------------------- Fetchers ------------------------------- */

  const fetchProfile = useCallback(async (opts?: { writeCache?: boolean }) => {
    if (!profileId) return;
    try {
      const cols = 'id,username,full_name,bio,avatar_url,cover_photo_url,profession,date_of_birth,business_name';
      const r = await supabase.from('profiles').select(cols).eq('id', profileId).maybeSingle();
      if (!r.error && r.data) {
        setProfile(r.data as Profile);
        // try to load store for this profile
        try {
          const storeRes = await supabase.from('stores').select('id,title,avatar_url,owner_id').eq('owner_id', profileId).maybeSingle();
          if (!storeRes?.error && storeRes?.data) setStoreForProfile(storeRes.data || null);
        } catch {}
        if (opts?.writeCache) await saveCache('profile', r.data);
        return;
      }
      const fallbacks = ['user_profiles', 'public_profiles', 'users'];
      for (const t of fallbacks) {
        const f = await supabase.from(t).select(cols).eq('id', profileId).maybeSingle();
        if (!f.error && f.data) {
          setProfile(f.data as Profile);
          try { const storeRes = await supabase.from('stores').select('id,title,avatar_url,owner_id').eq('owner_id', profileId).maybeSingle(); if (!storeRes?.error && storeRes?.data) setStoreForProfile(storeRes.data || null); } catch {}
          if (opts?.writeCache) await saveCache('profile', f.data);
          return;
        }
      }
    } catch (err) {
      console.warn('fetchProfile err', err);
    }
  }, [profileId, saveCache]);

  const fetchStories = useCallback(async (opts?: { writeCache?: boolean }) => {
    if (!profileId) return;
    try {
      const candidates = ['stories', 'user_stories', 'story'];
      for (const t of candidates) {
        const r = await supabase.from(t).select('id,user_id,media_url,media_type,created_at,revived_at,is_hd,expires_at').eq('user_id', profileId).order('created_at', { ascending: false }).limit(500);
        if (!r.error && Array.isArray(r.data)) {
          const mapped = r.data.map((x: any) => ({
            id: x.id,
            user_id: x.user_id,
            media_url: x.media_url ?? null,
            media_type: x.media_type ?? null,
            created_at: x.created_at,
            revived_at: x.revived_at ?? null,
            isHD: Boolean(x.is_hd),
          })) as Story[];
          setStories(mapped);
          
          // Check for active (non-expired) stories
          const now = new Date().toISOString();
          const activeStories = r.data.filter((s: any) => {
            if (!s.expires_at) return true; // No expiry = active
            return s.expires_at > now;
          });
          setHasActiveStory(activeStories.length > 0);
          
          if (opts?.writeCache) await saveCache('stories', mapped);
          return;
        }
      }
      setStories([]);
      setHasActiveStory(false);
    } catch (err) {
      console.warn('fetchStories err', err);
      setStories([]);
      setHasActiveStory(false);
    }
  }, [profileId, saveCache]);

  const fetchCommercials = useCallback(async (opts?: { writeCache?: boolean }) => {
    if (!profileId) return;
    try {
      const r = await supabase.from('business_stories').select('id,user_id,media_url,media_type,created_at,is_hd').eq('user_id', profileId).order('created_at', { ascending: false }).limit(500);
      if (!r.error && Array.isArray(r.data)) {
        const mapped = r.data.map((x: any) => ({ id: x.id, user_id: x.user_id, media_url: x.media_url ?? null, media_type: x.media_type ?? null, created_at: x.created_at, isHD: Boolean(x.is_hd) })) as Story[];
        setCommercials(mapped);
        if (opts?.writeCache) await saveCache('commercials', mapped);
        return;
      }
      setCommercials([]);
    } catch (err) {
      console.warn('fetchCommercials err', err);
      setCommercials([]);
    }
  }, [profileId, saveCache]);

  const fetchProducts = useCallback(async (opts?: { writeCache?: boolean }) => {
    if (!profileId) return;
    try {
      const candidates = ['products', 'market', 'marketplace', 'user_products'];
      for (const t of candidates) {
        const r = await supabase.from(t).select('id,user_id,title,price,images,description,created_at').eq('user_id', profileId).order('created_at', { ascending: false }).limit(500);
        if (!r.error && Array.isArray(r.data)) {
          const mapped = r.data.map((x: any) => ({ id: x.id, user_id: x.user_id, title: x.title ?? '', price: Number(x.price || 0), images: Array.isArray(x.images) ? x.images : x.images ? [x.images] : [], description: x.description ?? '', created_at: x.created_at })) as Product[];
          setProducts(mapped);
          if (opts?.writeCache) await saveCache('products', mapped);
          return;
        }
      }
      setProducts([]);
    } catch (err) {
      console.warn('fetchProducts err', err);
      setProducts([]);
    }
  }, [profileId, saveCache]);

  const fetchStoryStats = useCallback(async (storyIds: string[]) => {
    if (!storyIds?.length) return;
    const likeResults: Record<string, number | undefined> = {};
    const commentResults: Record<string, number | undefined> = {};
    for (const id of storyIds) {
      try {
        const l = await supabase.from('story_likes').select('id', { count: 'exact' }).eq('story_id', id);
        likeResults[id] = typeof (l as any).count === 'number' ? (l as any).count : undefined;
      } catch {
        likeResults[id] = undefined;
      }
      try {
        const c = await supabase.from('story_comments').select('id', { count: 'exact' }).eq('story_id', id);
        commentResults[id] = typeof (c as any).count === 'number' ? (c as any).count : undefined;
      } catch {
        commentResults[id] = undefined;
      }
    }

    let likesSnapshot: Record<string, number> | null = null;
    setStoryLikesMap((prev) => {
      const next = { ...prev };
      for (const id of storyIds) {
        if (typeof likeResults[id] === 'number') {
          next[id] = likeResults[id] as number;
        }
      }
      likesSnapshot = next;
      return next;
    });

    let commentsSnapshot: Record<string, number> | null = null;
    setStoryCommentsMap((prev) => {
      const next = { ...prev };
      for (const id of storyIds) {
        if (typeof commentResults[id] === 'number') {
          next[id] = commentResults[id] as number;
        }
      }
      commentsSnapshot = next;
      return next;
    });

    await saveCache('storyStats', {
      likes: likesSnapshot ?? {},
      comments: commentsSnapshot ?? {},
    }).catch(() => {});
  }, [saveCache]);

  const fetchRevives = useCallback(async (opts?: { writeCache?: boolean }) => {
    if (!profileId) return;
    setRevivesLoading(true);
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('id,user_id,media_url,media_type,created_at,revived_at')
        .eq('user_id', profileId)
        .not('revived_at', 'is', null)
        .order('revived_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        media_url: row.media_url ?? null,
        media_type: row.media_type ?? null,
        created_at: row.created_at,
        revived_at: row.revived_at,
      })) as Story[];
      setRevives(mapped);
      if (mapped.length) {
        const ids = mapped.map((item) => item.id);
        await fetchStoryStats(ids).catch(() => {});
      }
      if (opts?.writeCache) await saveCache('revives', mapped);
    } catch (err) {
      console.warn('fetchRevives err', err);
      setRevives([]);
    } finally {
      setRevivesLoading(false);
    }
  }, [profileId, saveCache, fetchStoryStats]);

  useFocusEffect(
    useCallback(() => {
      fetchRevives({ writeCache: true }).catch(() => {});
    }, [fetchRevives]),
  );

  const fetchFollowerCounts = useCallback(async (opts?: { writeCache?: boolean }) => {
    if (!profileId) return;
    try {
      const f1 = await supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', profileId);
      const f2 = await supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', profileId);
      const followers = typeof (f1 as any).count === 'number' ? (f1 as any).count : null;
      const following = typeof (f2 as any).count === 'number' ? (f2 as any).count : null;
      setFollowersCount(followers ?? null);
      setFollowingCount(following ?? null);
      if (opts?.writeCache) await saveCache('followers', { followers, following });
    } catch (err) {
      // ignore
    }
  }, [profileId, saveCache]);

  /* ------------------------------- Cache-first load + silent refresh ------------------------------- */
  useEffect(() => {
    if (!profileId) return;
    let mounted = true;
    (async () => {
      setInitialLoading(true);
      setHasCachedData(false);
      
      // Step 1: Try to load from cache for instant display
      try {
        const [cachedProfile, cachedStories, cachedCommercials, cachedProducts, cachedStats, cachedFollowers, cachedRevives] = await Promise.all([
          loadCache('profile'),
          loadCache('stories'),
          loadCache('commercials'),
          loadCache('products'),
          loadCache('storyStats'),
          loadCache('followers'),
          loadCache('revives'),
        ]);
        if (!mounted) return;
        
        let hasAnyCache = false;
        if (cachedProfile) {
          setProfile(cachedProfile);
          hasAnyCache = true;
        }
        if (cachedStories) {
          setStories(cachedStories);
          hasAnyCache = true;
        }
        if (cachedCommercials) {
          setCommercials(cachedCommercials);
          hasAnyCache = true;
        }
        if (cachedProducts) {
          setProducts(cachedProducts);
          hasAnyCache = true;
        }
        if (cachedStats) {
          setStoryLikesMap(cachedStats.likes ?? {});
          setStoryCommentsMap(cachedStats.comments ?? {});
        }
        if (cachedFollowers) {
          setFollowersCount(cachedFollowers.followers ?? null);
          setFollowingCount(cachedFollowers.following ?? null);
        }
        if (cachedRevives) {
          if (Array.isArray(cachedRevives) && cachedRevives.length && cachedRevives[0]?.story) {
            const legacy = cachedRevives.map((entry: any) => entry?.story).filter(Boolean);
            setRevives(legacy);
          } else {
            setRevives(cachedRevives);
          }
        }
        
        // If we have cached data, show content immediately and fetch fresh data in background
        if (hasAnyCache) {
          setHasCachedData(true);
          setInitialLoading(false);
        }
      } catch {
        // ignore cache errors
      }
      
      // Step 2: Fetch fresh data from server
      try {
        await Promise.all([
          fetchProfile({ writeCache: true }),
          fetchStories({ writeCache: true }),
          fetchCommercials({ writeCache: true }),
          fetchProducts({ writeCache: true }),
          fetchFollowerCounts({ writeCache: true }),
          fetchRevives({ writeCache: true }),
        ]);
        
        // fetch stats for any loaded stories/commercials
        const ids = [...(stories.map(s => s.id) ?? []), ...(commercials.map(c => c.id) ?? [])];
        if (ids.length) await fetchStoryStats(ids).catch(() => {});
      } catch (err) {
        console.warn('Profile fetch error:', err);
      } finally {
        if (mounted) {
          setInitialLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchProfile({ writeCache: true }),
        fetchStories({ writeCache: true }),
        fetchCommercials({ writeCache: true }),
        fetchProducts({ writeCache: true }),
        fetchFollowerCounts({ writeCache: true }),
        fetchRevives({ writeCache: true }),
      ]);
      const ids = [...stories.map((s) => s.id), ...commercials.map((c) => c.id)];
      if (ids.length) await fetchStoryStats(ids);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchStories, fetchCommercials, fetchProducts, fetchFollowerCounts, fetchRevives, stories, commercials, fetchStoryStats]);

  // Silent refresh function (for background updates)
  const silentRefresh = useCallback(async () => {
    try {
      await Promise.all([
        fetchStories({ writeCache: true }),
        fetchCommercials({ writeCache: true }),
        fetchProducts({ writeCache: true }),
        fetchFollowerCounts({ writeCache: true }),
        fetchRevives({ writeCache: true }),
      ]);
      const ids = [...stories.map((s) => s.id), ...commercials.map((c) => c.id)];
      if (ids.length) await fetchStoryStats(ids);
    } catch {
      // ignore
    }
  }, [fetchStories, fetchCommercials, fetchProducts, fetchFollowerCounts, fetchRevives, stories, commercials, fetchStoryStats]);

  // background refresh this page every 20 seconds while a profile is loaded
  useEffect(() => {
    let t: any = null;
    if (profileId) {
      silentRefresh().catch(() => {});
      t = setInterval(() => {
        silentRefresh().catch(() => {});
      }, 20_000);
    }
    return () => {
      try {
        if (t) clearInterval(t);
      } catch {}
    };
  }, [profileId, silentRefresh]);

  /* ------------------------------- Derived / UI helpers ------------------------------- */

  // total likes across fetched stories + commercials
  useEffect(() => {
    const totalLikes = Object.values(storyLikesMap).reduce((a, b) => a + (b || 0), 0);
    setTotalLikesCount(totalLikes);
  }, [storyLikesMap]);

  const totalStoryLikes = Object.values(storyLikesMap).reduce((a, b) => a + (b || 0), 0);
  const totalStoryComments = Object.values(storyCommentsMap).reduce((a, b) => a + (b || 0), 0);

  // metrics calculation (real aggregation based on created_at)
  const computePeriodRange = useCallback((p: typeof period) => {
    const now = new Date();
    if (p === 'day') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: now };
    }
    if (p === 'week') {
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    if (p === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end: now };
  }, []);

  const buildMetrics = useCallback(() => {
    const { start, end } = computePeriodRange(period);
    let likes = 0;
    let comments = 0;
    const all = [...stories, ...commercials];
    all.forEach((s) => {
      if (!s.created_at) return;
      const dt = new Date(s.created_at);
      if (dt >= start && dt <= end) {
        likes += storyLikesMap[s.id] ?? 0;
        comments += storyCommentsMap[s.id] ?? 0;
      }
    });
    return { likes, comments, start, end };
  }, [period, computePeriodRange, stories, commercials, storyLikesMap, storyCommentsMap]);

  const metrics = buildMetrics();

  // compare with previous period (for green/red)
  const compareWithPrevious = useCallback(() => {
    const prevStart = new Date(metrics.start);
    const prevEnd = new Date(metrics.start);
    const delta = metrics.end.getTime() - metrics.start.getTime();
    prevStart.setTime(metrics.start.getTime() - delta);
    prevEnd.setTime(metrics.end.getTime() - delta);
    let prevLikes = 0;
    let prevComments = 0;
    const all = [...stories, ...commercials];
    all.forEach((s) => {
      if (!s.created_at) return;
      const dt = new Date(s.created_at);
      if (dt >= prevStart && dt <= prevEnd) {
        prevLikes += storyLikesMap[s.id] ?? 0;
        prevComments += storyCommentsMap[s.id] ?? 0;
      }
    });
    return { prevLikes, prevComments };
  }, [metrics, stories, commercials, storyLikesMap, storyCommentsMap]);

  const prev = compareWithPrevious();
  const likesUp = metrics.likes >= prev.prevLikes;
  const commentsUp = metrics.comments >= prev.prevComments;

  /* ------------------------------- Render helpers ------------------------------- */

  const renderStoriesCard = () => {
    const s = stories[0];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
        <TouchableOpacity style={[styles.storyCard, { backgroundColor: theme.card, position: 'relative' }]} onPress={() => router.push(`/explore/user_stories/${profileId}`)}>
          <View style={{ position: 'relative' }}>
            {s?.media_url ? (
              isVideoUri(s.media_url)
                ? <Video source={{ uri: s.media_url }} style={styles.storyCardMedia} resizeMode={ResizeMode.COVER} useNativeControls={false} isLooping isMuted />
                : <ExpoImage source={{ uri: s.media_url }} style={styles.storyCardMedia} contentFit="cover" />
            ) : (
              <View style={[styles.storyCardMedia, { alignItems: 'center', justifyContent: 'center' }]}><Feather name="image" size={28} color={theme.sub} /></View>
            )}
            {/* Always show HD badge for uploaded media */}
            <HDBadge />
          </View>
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }} numberOfLines={2}>{profile?.full_name ?? profile?.username ?? 'Stories'}</Text>
            </View>
            <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>{s?.created_at ? formatDate(s.created_at) : ''}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>{totalStoryLikes}</Text>
          <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>Total Likes</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text, marginTop: 12 }}>{totalStoryComments}</Text>
          <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>Total Comments</Text>
        </View>
      </View>
    );
  };

  const renderCommercialsCard = () => {
    const c = commercials[0];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
        <TouchableOpacity style={[styles.storyCard, { backgroundColor: theme.card, position: 'relative' }]} onPress={() => router.push(`/explore/stories_plug/${profileId}`)}>
          <View style={{ position: 'relative' }}>
            {c?.media_url ? (
              isVideoUri(c.media_url)
                ? <Video source={{ uri: c.media_url }} style={styles.storyCardMedia} resizeMode={ResizeMode.COVER} useNativeControls={false} isLooping isMuted />
                : <ExpoImage source={{ uri: c.media_url }} style={styles.storyCardMedia} contentFit="cover" />
            ) : (
              <View style={[styles.storyCardMedia, { alignItems: 'center', justifyContent: 'center' }]}><Feather name="image" size={28} color={theme.sub} /></View>
            )}
            {/* Always show HD badge for uploaded media */}
            <HDBadge />
          </View>
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }} numberOfLines={2}>{profile?.full_name ?? profile?.username ?? 'Commercials'}</Text>
            </View>
            <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>{c?.created_at ? formatDate(c.created_at) : ''}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>{totalStoryLikes}</Text>
          <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>Total Likes</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text, marginTop: 12 }}>{totalStoryComments}</Text>
          <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>Total Comments</Text>
        </View>
      </View>
    );
  };

  const renderRevivesGrid = () => {
    if (revivesLoading) {
      return (
        <View style={styles.revivesPlaceholder}>
          <ActivityIndicator color={theme.accent} />
        </View>
      );
    }
    if (!revives.length) {
      return (
        <View style={styles.revivesPlaceholder}>
          <Text style={{ color: theme.sub }}>No revives yet</Text>
        </View>
      );
    }
    return (
      <View style={styles.revivesGrid}>
        {revives.map((revive) => {
          const preview = revive.media_url ?? null;
          const isVideo = isVideoUri(preview ?? undefined);
          const likes = storyLikesMap[revive.id] ?? 0;
          const comments = storyCommentsMap[revive.id] ?? 0;
          return (
            <TouchableOpacity
              key={revive.id}
              style={[styles.reviveCard, { borderColor: theme.hair, backgroundColor: theme.card }]}
              onPress={() => router.push(`/Contents?storyId=${revive.id}`)}
              activeOpacity={0.85}
            >
              <View style={[styles.reviveMedia, { backgroundColor: theme.faint }]}> 
                {preview ? (
                  <ExpoImage source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="image" size={20} color={theme.sub} />
                  </View>
                )}
                {isVideo ? (
                  <View style={styles.reviveBadge}>
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                ) : null}
              </View>
              <Text style={{ color: theme.sub, fontSize: 12, marginTop: 8 }}>Revived {formatRelativeTime(revive.revived_at)}</Text>
              <View style={styles.reviveMetaRow}>
                <View style={styles.reviveStat}>
                  <Ionicons name="heart" size={13} color={theme.accent} />
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{likes}</Text>
                </View>
                <View style={styles.reviveStat}>
                  <Ionicons name="chatbubble" size={13} color={theme.sub} />
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{comments}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const firstMedia = (arr?: string[] | null) => (Array.isArray(arr) && arr.length ? arr[0] : undefined);
  const renderProductCell = ({ item }: { item: Product }) => {
    const uri = firstMedia(item.images);
    return (
      <TouchableOpacity style={[styles.productCell, { backgroundColor: theme.hair }]} onPress={() => router.push(`/market/product-details?id=${item.id}`)}>
        {uri ? <ExpoImage source={{ uri }} cachePolicy="disk" style={styles.productImage} contentFit="cover" /> : <View style={[styles.productImage, { alignItems: 'center', justifyContent: 'center' }]}><Feather name="box" size={18} color={theme.sub} /></View>}
        <View style={{ padding: 8 }}>
          <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>{item.title}</Text>
          <Text style={{ color: theme.sub }}>₵{item.price}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  /* ------------------------------- RENDER ------------------------------- */

  // Skeleton opacity for shimmer effect
  const skeletonOpacity = skeletonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Show skeleton when loading and no cached profile
  const showSkeleton = initialLoading && !profile;

  return (
    <SwipeBackContainer>
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={statusBarStyle} translucent />

      {/* Skeleton Loading UI */}
      {showSkeleton && (
        <ScrollView style={{ flex: 1 }}>
          {/* Cover skeleton */}
          <Animated.View style={{ width: '100%', height: COVER_HEIGHT, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
          
          {/* Profile info skeleton */}
          <View style={{ paddingHorizontal: 12, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {/* Avatar skeleton */}
              <Animated.View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
              
              <View style={{ flex: 1, marginLeft: 12 }}>
                {/* Name skeleton */}
                <Animated.View style={{ width: 140, height: 22, borderRadius: 6, backgroundColor: theme.faint, opacity: skeletonOpacity, marginBottom: 8 }} />
                {/* Username skeleton */}
                <Animated.View style={{ width: 100, height: 16, borderRadius: 4, backgroundColor: theme.faint, opacity: skeletonOpacity, marginBottom: 8 }} />
                {/* Bio skeleton */}
                <Animated.View style={{ width: '90%', height: 14, borderRadius: 4, backgroundColor: theme.faint, opacity: skeletonOpacity, marginBottom: 4 }} />
                <Animated.View style={{ width: '70%', height: 14, borderRadius: 4, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
              </View>
            </View>

            {/* Stats skeleton */}
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
              <Animated.View style={{ width: 80, height: 50, borderRadius: 10, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
              <Animated.View style={{ width: 80, height: 50, borderRadius: 10, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
              <Animated.View style={{ width: 80, height: 50, borderRadius: 10, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
            </View>

            {/* Tabs skeleton */}
            <View style={{ flexDirection: 'row', marginTop: 20, gap: 16 }}>
              <Animated.View style={{ width: 60, height: 20, borderRadius: 4, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
              <Animated.View style={{ width: 60, height: 20, borderRadius: 4, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
              <Animated.View style={{ width: 60, height: 20, borderRadius: 4, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
              <Animated.View style={{ width: 60, height: 20, borderRadius: 4, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
            </View>

            {/* Content skeleton */}
            <View style={{ marginTop: 20 }}>
              <Animated.View style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: theme.faint, opacity: skeletonOpacity, marginBottom: 12 }} />
              <Animated.View style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: theme.faint, opacity: skeletonOpacity }} />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Main content with fade animation */}
      {!showSkeleton && (
      <Animated.View style={{ flex: 1, opacity: contentFadeAnim }}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >

        {/* Cover (fills top; no extra top padding) */}
        <View style={{ width: '100%', height: COVER_HEIGHT }}>
          <ImageBackground source={profile?.cover_photo_url ? { uri: profile.cover_photo_url } : undefined} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start' }]} imageStyle={{ resizeMode: 'cover' }}>
            {/* Gradient overlay for glassmorphism effect */}
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.topBar}>
              {/* Back - Glassmorphism button */}
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.headerButton,
                  { transform: [{ scale: pressed ? 0.92 : 1 }] }
                ]}
              >
                <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </BlurView>
              </Pressable>

              {/* Right buttons */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={async () => {
                    try {
                      await Share.share({ message: `${profile?.full_name ?? profile?.username} — profile` });
                    } catch {}
                  }}
                  style={({ pressed }) => [
                    styles.headerButton,
                    { transform: [{ scale: pressed ? 0.92 : 1 }] }
                  ]}
                >
                  <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                    <Ionicons name="share-social-outline" size={20} color="#fff" />
                  </BlurView>
                </Pressable>

                {isOwnProfile && (
                  <Pressable 
                    onPress={() => router.push('/profile/edit-profile')} 
                    style={({ pressed }) => [
                      styles.headerButton,
                      { transform: [{ scale: pressed ? 0.92 : 1 }] }
                    ]}
                  > 
                    <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                      <Feather name="edit-3" size={18} color="#fff" />
                    </BlurView>
                  </Pressable>
                )}

                <Pressable 
                  onPress={() => router.push('/logout/settings')} 
                  style={({ pressed }) => [
                    styles.headerButton,
                    { transform: [{ scale: pressed ? 0.92 : 1 }] }
                  ]}
                >
                  <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                    <Ionicons name="settings-outline" size={20} color="#fff" />
                  </BlurView>
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Profile card with glassmorphism - matching profile/view/[id] */}
        <View style={{ marginTop: -40, paddingHorizontal: 12 }}>
          <BlurView intensity={80} tint={theme.isDark ? "dark" : "light"} style={styles.profileCard}>
            <View style={{ flex: 1 }}>
            <View style={styles.profileRow}>
              {/* Avatar with accent ring - tappable for stories */}
              <Pressable
                onPress={() => {
                  if (hasActiveStory && profileId) {
                    router.push(`/explore/user_stories/${profileId}`);
                  }
                }}
                style={({ pressed }) => [{ transform: [{ scale: pressed && hasActiveStory ? 0.95 : 1 }] }]}
              >
                <View style={[styles.avatarRing, { borderColor: hasActiveStory ? VELT_ACCENT : (theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') }]}>
                  {profile?.avatar_url ? (
                    <ExpoImage source={{ uri: profile.avatar_url }} cachePolicy="disk" style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.hair }]}>
                      <Ionicons name="person" size={28} color={theme.text} />
                    </View>
                  )}
                  {isOwnProfile && (
                    <Pressable 
                      onPress={() => router.push('/explore/create_story')} 
                      style={({ pressed }) => [styles.avatarPlus, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
                    >
                      <View style={[styles.plusInner, { backgroundColor: VELT_ACCENT, borderColor: theme.isDark ? '#fff' : '#e5e7eb' }]}>
                      <Ionicons name="add" size={18} color="#fff" />
                    </View>
                  </Pressable>
                )}
                </View>
              </Pressable>

              <View style={styles.profileMeta}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {profile?.full_name ?? profile?.username ?? 'User'}
                  </Text>
                  <Ionicons name="checkmark-circle" size={18} color={VELT_ACCENT} />
                </View>

                {profile?.username && (
                  <Text style={[styles.handle, { color: theme.sub }]} numberOfLines={1}>
                    @{profile.username}
                  </Text>
                )}
                {profile?.bio && (
                  <Text style={[styles.bio, { color: theme.sub }]} numberOfLines={3}>
                    {profile.bio}
                  </Text>
                )}
              </View>
            </View>
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {profile?.profession ? <View style={[styles.pill, { backgroundColor: theme.hair }]}><Text style={[styles.pillText, { color: theme.text }]}>{profile.profession}</Text></View> : null}
                {profile?.date_of_birth ? <View style={styles.pillFilled}><Text style={styles.pillFilledText}>{formatDate(profile.date_of_birth)}</Text></View> : null}
                {profile?.business_name ? <View style={[styles.pill, { backgroundColor: theme.hair }]}><Text style={[styles.pillTextBold, { color: theme.text }]} numberOfLines={1}>{profile.business_name}</Text></View> : null}
              </View>

              {/* Followers / Following / Likes - matching profile/view styling */}
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
                <Pressable
                  onPress={() => router.push(`/profile/connections?id=${profileId}&section=followers`)}
                  style={({ pressed }) => [styles.statPill, { backgroundColor: theme.hair, transform: [{ scale: pressed ? 0.95 : 1 }], borderWidth: 1, borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                >
                  <Text style={[styles.statNum, { color: VELT_ACCENT }]}>{typeof followersCount === 'number' ? followersCount : '—'}</Text>
                  <Text style={[styles.statLabel, { color: theme.sub }]}>Followers</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push(`/profile/connections?id=${profileId}&section=following`)}
                  style={({ pressed }) => [styles.statPill, { backgroundColor: theme.hair, transform: [{ scale: pressed ? 0.95 : 1 }], borderWidth: 1, borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                >
                  <Text style={[styles.statNum, { color: BUTTON_COLORS.success }]}>{typeof followingCount === 'number' ? followingCount : '—'}</Text>
                  <Text style={[styles.statLabel, { color: theme.sub }]}>Following</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push(`/profile/connections?id=${profileId}&section=likes`)}
                  style={({ pressed }) => [styles.statPill, { backgroundColor: theme.hair, transform: [{ scale: pressed ? 0.95 : 1 }], borderWidth: 1, borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                >
                  <Text style={[styles.statNum, { color: BUTTON_COLORS.like }]}>{typeof totalLikesCount === 'number' ? totalLikesCount : '—'}</Text>
                  <Text style={[styles.statLabel, { color: theme.sub }]}>Likes</Text>
                </Pressable>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/profile/world')}
                style={[styles.worldButton, { borderColor: theme.hair, backgroundColor: theme.card }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="globe-outline" size={18} color={theme.text} />
                  <Text style={[styles.worldBtnText, { color: theme.text, marginLeft: 8 }]}>World</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: theme.sub, fontWeight: '600' }}>Control center</Text>
                  <Feather name="arrow-up-right" size={14} color={theme.sub} />
                </View>
              </TouchableOpacity>

              {/* Visit store button - only show if user has a store */}
              {storeForProfile ? (
                <TouchableOpacity onPress={() => router.push({ pathname: '/market/store/[id]', params: { id: storeForProfile.id }})} style={[styles.storeBtn, { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: theme.accent }] }>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Visit store</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            </View>
          </BlurView>
        </View>

        {/* Tabs row */}
        <View style={[styles.tabsRow, { borderBottomColor: theme.hair, marginTop: 12 }]}>
          <TouchableOpacity onPress={() => { horizRef.current?.scrollTo({ x: SCREEN_WIDTH * 0, y: 0, animated: true }); setPageIndex(0); }} style={[styles.tabSlim, pageIndex === 0 && styles.tabActive]}>
            <Text style={[styles.tabSlimTxt, pageIndex === 0 ? { color: theme.accent, fontWeight: '800' } : { color: theme.sub }]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { horizRef.current?.scrollTo({ x: SCREEN_WIDTH * 1, y: 0, animated: true }); setPageIndex(1); }} style={[styles.tabSlim, pageIndex === 1 && styles.tabActive]}>
            <Text style={[styles.tabSlimTxt, pageIndex === 1 ? { color: theme.accent, fontWeight: '800' } : { color: theme.sub }]}>Metrics</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { horizRef.current?.scrollTo({ x: SCREEN_WIDTH * 2, y: 0, animated: true }); setPageIndex(2); }} style={[styles.tabSlim, pageIndex === 2 && styles.tabActive]}>
            <Text style={[styles.tabSlimTxt, pageIndex === 2 ? { color: theme.accent, fontWeight: '800' } : { color: theme.sub }]}>Revives</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { horizRef.current?.scrollTo({ x: SCREEN_WIDTH * 3, y: 0, animated: true }); setPageIndex(3); }} style={[styles.tabSlim, pageIndex === 3 && styles.tabActive]}>
            <Text style={[styles.tabSlimTxt, pageIndex === 3 ? { color: theme.accent, fontWeight: '800' } : { color: theme.sub }]}>Products</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal pager */}
        <ScrollView
          ref={(r) => { horizRef.current = r; }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = Math.round(x / SCREEN_WIDTH);
            if (idx !== pageIndex) setPageIndex(idx);
          }}
        >
          {/* Posts tab */}
          <View style={{ width: SCREEN_WIDTH, padding: 12 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>Stories</Text>
            {renderStoriesCard()}
            <View style={{ height: 12 }} />
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>Commercials</Text>
            {renderCommercialsCard()}
            <View style={{ height: 36 }} />
          </View>

          {/* Metrics tab */}
          <View style={{ width: SCREEN_WIDTH, padding: 12 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 12 }}>Metrics</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['day', 'week', 'month', 'year'] as const).map((p) => (
                <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[styles.metricPeriodBtn, { backgroundColor: period === p ? theme.accent : theme.card }]}>
                  <Text style={{ color: period === p ? '#fff' : theme.text, fontWeight: '800' }}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ padding: 12, backgroundColor: theme.card, borderRadius: 12 }}>
              <Text style={{ color: theme.sub }}>Period: {period}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <View>
                  <Text style={{ color: likesUp ? 'green' : 'red', fontSize: 18, fontWeight: '900' }}>{metrics.likes}</Text>
                  <Text style={{ color: theme.sub }}>Likes</Text>
                </View>
                <View>
                  <Text style={{ color: commentsUp ? 'green' : 'red', fontSize: 18, fontWeight: '900' }}>{metrics.comments}</Text>
                  <Text style={{ color: theme.sub }}>Comments</Text>
                </View>
                <View>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>{new Date(metrics.start).toLocaleDateString()} - {new Date(metrics.end).toLocaleDateString()}</Text>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '800', marginBottom: 8 }}>Top Stories / Commercials (period)</Text>
              {(() => {
                const all = [...stories, ...commercials].filter((s) => {
                  if (!s.created_at) return false;
                  const dt = new Date(s.created_at);
                  return dt >= metrics.start && dt <= metrics.end;
                });
                const scored = all.map((s) => ({ s, score: (storyLikesMap[s.id] ?? 0) + (storyCommentsMap[s.id] ?? 0) })).sort((a, b) => b.score - a.score);
                if (!scored.length) return <Text style={{ color: theme.sub }}>No items in this period.</Text>;
                return scored.map(({ s, score }) => (
                  <TouchableOpacity key={s.id} onPress={() => router.push(s.user_id ? `/explore/stories_plug/${s.user_id}` : `/explore/stories_plug/${profileId}`)} style={{ padding: 12, backgroundColor: theme.card, borderRadius: 12, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: theme.text, fontWeight: '800' }}>{s.media_url ? (isVideoUri(s.media_url) ? 'Video' : 'Image') : 'Item'}</Text>
                      <Text style={{ color: theme.sub }}>{score} engagements</Text>
                    </View>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </View>

          {/* Revives placeholder */}
          <View style={{ width: SCREEN_WIDTH, padding: 12 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>Revives</Text>
            {renderRevivesGrid()}
          </View>

          {/* Products */}
          <View style={{ width: SCREEN_WIDTH, padding: 8 }}>
            <FlatList
              data={products}
              keyExtractor={(it: any, i) => (it?.id ? it.id : `${i}`)}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
              renderItem={renderProductCell as any}
              ListEmptyComponent={<View style={{ alignItems: 'center', padding: 32 }}><Text style={{ color: theme.sub }}>No products yet</Text></View>}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
            />
          </View>
        </ScrollView>
      </ScrollView>
      </Animated.View>
      )}
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

/* ------------------------------- STYLES ------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    paddingHorizontal: 12,
    paddingTop: 16,
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Glassmorphism header button - matching profile/view/[id]
  headerButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },

  headerPill: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
  },

  editBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 36, borderRadius: 12, gap: 6 },
  editTxt: { fontSize: 12, fontWeight: '700' },

  // Glassmorphism profile card - matching profile/view/[id]
  profileCard: {
    width: '100%',
    padding: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  profileOverlay: { width: '100%', padding: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 0 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  // Avatar with accent ring - borderColor set dynamically based on hasActiveStory
  avatarRing: {
    padding: 3,
    borderRadius: 50,
    borderWidth: 3,
  },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarPlus: { position: 'absolute', right: 0, bottom: 0 },
  plusInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  profileMeta: { marginLeft: 12, flex: 1 },
  name: { marginTop: 0, fontSize: 20, fontWeight: '900' },
  handle: { marginTop: 4, fontSize: 14 },
  bio: { marginTop: 8, fontSize: 15, lineHeight: 20 },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 0, minWidth: 64 },
  pillText: { fontSize: 13, fontWeight: '700' },
  pillTextBold: { fontSize: 13, fontWeight: '900' },

  pillFilled: { backgroundColor: '#111827', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minWidth: 86, alignItems: 'center', justifyContent: 'center' },
  pillFilledText: { fontSize: 13, color: '#fff', fontWeight: '800', letterSpacing: 0.6 },

  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 8, paddingHorizontal: 8 },
  tabSlim: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  tabSlimTxt: { fontSize: 16, fontWeight: '700' },
  tabActive: {},

  storyCard: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', width: SCREEN_WIDTH * 0.66 },
  storyCardMedia: { width: 120, height: 120 },

  statPill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginTop: 8, minWidth: 96, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 13 },
  worldButton: { marginTop: 16, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  worldBtnText: { fontSize: 16, fontWeight: '800' },

  announcement: { marginTop: 12, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },

  metricPeriodBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },

  productCell: { width: SCREEN_WIDTH * 0.46, borderRadius: 12, overflow: 'hidden', paddingBottom: 4 },
  productImage: { width: '100%', height: 140, borderRadius: 8 },
  revivesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reviveCard: { width: SCREEN_WIDTH * 0.44, borderWidth: 1, borderRadius: 18, padding: 12 },
  revivesPlaceholder: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  reviveMedia: { height: SCREEN_WIDTH * 0.42, borderRadius: 14, overflow: 'hidden', backgroundColor: '#0b0b0b' },
  reviveBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  reviveMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  reviveStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  productCellCompact: {},
  storeBtn: { alignItems: 'center', justifyContent: 'center' },
});









