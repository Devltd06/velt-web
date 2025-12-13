// app/profile/view/[id].tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from 'app/themes';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useDoodleFeatures } from '@/lib/doodleFeatures';
import { getCachedProfile } from '@/lib/store/prefetchStore';

// Simple HD badge component (matches other screens)
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COVER_HEIGHT = Math.max(160, SCREEN_HEIGHT * 0.28);
const STORAGE_PREFIX = 'profile_view_cache:';

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
  isHD?: boolean;
};

function isVideoUri(uri?: string | null) {
  if (!uri) return false;
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(uri);
}

export default function ProfileViewScreen() {
  const { id: paramId } = useLocalSearchParams<{ id?: string }>();
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();

  const [meId, setMeId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [stories, setStories] = useState<Story[]>([]);
  const [commercials, setCommercials] = useState<Story[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [revives, setRevives] = useState<Story[]>([]);
  const [revivesLoading, setRevivesLoading] = useState(false);
  const [hasActiveStory, setHasActiveStory] = useState(false);

  const [storyLikesMap, setStoryLikesMap] = useState<Record<string, number>>({});
  const [storyCommentsMap, setStoryCommentsMap] = useState<Record<string, number>>({});

  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [totalLikesCount, setTotalLikesCount] = useState<number | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [announcementVisible, setAnnouncementVisible] = useState(true);

  const [pageIndex, setPageIndex] = useState<number>(0);
  const horizRef = useRef<ScrollView | null>(null);

  const cacheKey = (k: string) => `${STORAGE_PREFIX}${k}:${profileId ?? 'anon'}`;

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

  // Decorative deep doodles for public profile (theme-linked, respectful of reduced-motion)
  const [reduceMotion, setReduceMotion] = useState(false);
  const doodleA = useRef(new Animated.Value(0)).current;
  const doodleB = useRef(new Animated.Value(0)).current;
  const doodleC = useRef(new Animated.Value(0)).current;
  const doodleLoopRef = useRef<any | null>(null);
  const doodleStatusRef = useRef<'idle' | 'running' | 'stopped'>('idle');
  const { enabled: doodlesEnabled } = useDoodleFeatures('profile');

  // keep a ref to the loop so we can restart/stop it on focus changes
  const startDoodleLoop = useCallback(() => {
    if (reduceMotion) return;
    // if a loop exists, stop and clear it so we can create a fresh instance — avoids stale/stuck animations
    if (doodleLoopRef.current) {
      try { doodleLoopRef.current.stop?.(); } catch {}
      doodleLoopRef.current = null;
    }
    // reset animated values so new loop shows movement from the start
    try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {}
    try {
      const a = Animated.loop(
        Animated.parallel([
          Animated.sequence([Animated.timing(doodleA, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleA, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
          Animated.sequence([Animated.delay(320), Animated.timing(doodleB, { toValue: 1, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleB, { toValue: 0, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
          Animated.sequence([Animated.delay(680), Animated.timing(doodleC, { toValue: 1, duration: 9600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleC, { toValue: 0, duration: 9600, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
        ])
      );
      doodleLoopRef.current = a;
      try { console.log('[profile/view] starting doodle loop'); } catch {}
      doodleStatusRef.current = 'running';
      a.start();
    } catch (err) {
      doodleLoopRef.current = null;
    }
  }, [doodleA, doodleB, doodleC, reduceMotion]);

  const stopDoodleLoop = useCallback(() => {
    try { doodleLoopRef.current?.stop?.(); } catch {}
    doodleStatusRef.current = 'stopped';
    try { console.log('[profile/view] stopped doodle loop'); } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((isReduced) => {
        if (!mounted) return;
        setReduceMotion(isReduced);
        if (!isReduced && doodlesEnabled) startDoodleLoop();
      })
      .catch(() => setReduceMotion(false));
    return () => { mounted = false; stopDoodleLoop(); doodleLoopRef.current = null; };
  }, [startDoodleLoop, stopDoodleLoop]);

  useFocusEffect(
    useCallback(() => {
      if (doodlesEnabled && !reduceMotion) startDoodleLoop();
      return () => stopDoodleLoop();
    }, [startDoodleLoop, stopDoodleLoop, doodlesEnabled, reduceMotion])
  );

  // respond to doodle feature toggle changes
  useEffect(() => {
    if (doodlesEnabled && !reduceMotion) startDoodleLoop(); else stopDoodleLoop();
  }, [doodlesEnabled, reduceMotion, startDoodleLoop, stopDoodleLoop]);

  const statusBarStyle = theme.isDark ? 'light' : 'dark';
  const headerButtonBg = theme.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)';
  const headerButtonBorder = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

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

  const formatDate = useCallback((d?: string | null) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString();
    } catch {
      return d;
    }
  }, []);

  const formatRelativeTime = useCallback((value?: string | null) => {
    if (!value) return '';
    try {
      const ts = new Date(value).getTime();
      if (Number.isNaN(ts)) return value;
      const diff = Date.now() - ts;
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

  useEffect(() => {
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
  }, [paramId]);

  const isOwnProfile = !!profileId && !!meId && profileId === meId;

  const fetchProfile = useCallback(async (opts?: { writeCache?: boolean }) => {
    if (!profileId) return;
    try {
      const cols = 'id,username,full_name,bio,avatar_url,cover_photo_url,profession,date_of_birth,business_name';
      const r = await supabase.from('profiles').select(cols).eq('id', profileId).maybeSingle();
      if (!r.error && r.data) {
        setProfile(r.data as Profile);
        if (opts?.writeCache) await saveCache('profile', r.data);
        return;
      }
      const fallbacks = ['user_profiles', 'public_profiles', 'users'];
      for (const t of fallbacks) {
        const f = await supabase.from(t).select(cols).eq('id', profileId).maybeSingle();
        if (!f.error && f.data) {
          setProfile(f.data as Profile);
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
        const r = await supabase
          .from(t)
          .select('id,user_id,media_url,media_type,created_at,revived_at,is_hd,expires_at')
          .eq('user_id', profileId)
          .order('created_at', { ascending: false })
          .limit(500);
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
      const r = await supabase
        .from('business_stories')
        .select('id,user_id,media_url,media_type,created_at,is_hd')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (!r.error && Array.isArray(r.data)) {
        const mapped = r.data.map((x: any) => ({
          id: x.id,
          user_id: x.user_id,
          media_url: x.media_url ?? null,
          media_type: x.media_type ?? null,
          created_at: x.created_at,
          isHD: Boolean(x.is_hd),
        })) as Story[];
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
        const r = await supabase
          .from(t)
          .select('id,user_id,title,price,images,description,created_at')
          .eq('user_id', profileId)
          .order('created_at', { ascending: false })
          .limit(500);
        if (!r.error && Array.isArray(r.data)) {
          const mapped = r.data.map((x: any) => ({
            id: x.id,
            user_id: x.user_id,
            title: x.title ?? '',
            price: Number(x.price || 0),
            images: Array.isArray(x.images) ? x.images : x.images ? [x.images] : [],
            description: x.description ?? '',
            created_at: x.created_at,
          })) as Product[];
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
      // Fetch revives from both user stories and business_stories so Revives tab shows both kinds
      const [{ data: sRows, error: sErr }, { data: bRows, error: bErr }] = await Promise.all([
        supabase
          .from('stories')
          .select('id,user_id,media_url,media_type,created_at,revived_at')
          .eq('user_id', profileId)
          .not('revived_at', 'is', null)
          .order('revived_at', { ascending: false })
          .limit(200),
        supabase
          .from('business_stories')
          .select('id,user_id,media_url,media_type,created_at,revived_at')
          .eq('user_id', profileId)
          .not('revived_at', 'is', null)
          .order('revived_at', { ascending: false })
          .limit(200),
      ]);
      if (sErr) throw sErr;
      if (bErr) {
        console.warn('fetchRevives business_stories err', bErr);
      }

      const sMapped = (sRows ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        media_url: row.media_url ?? null,
        media_type: row.media_type ?? null,
        created_at: row.created_at,
        revived_at: row.revived_at,
        isHD: Boolean(row.is_hd),
      } as Story));
      const bMapped = (bRows ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        media_url: row.media_url ?? null,
        media_type: row.media_type ?? null,
        created_at: row.created_at,
        revived_at: row.revived_at,
        isHD: Boolean(row.is_hd),
      } as Story));

      // Merge and sort by revived_at desc
      const merged = [...sMapped, ...bMapped].sort((a, z) => {
        const aT = a.revived_at ? new Date(a.revived_at).getTime() : 0;
        const bT = z.revived_at ? new Date(z.revived_at).getTime() : 0;
        return bT - aT;
      });

      setRevives(merged);
      if (merged.length) {
        const ids = merged.map((item) => item.id);
        await fetchStoryStats(ids).catch(() => {});
      }
      if (opts?.writeCache) await saveCache('revives', merged);
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

  useEffect(() => {
    if (!profileId) return;
    let mounted = true;
    (async () => {
      setInitialLoading(true);
      try {
        // First, check for prefetched profile data (from navigation prefetch)
        const prefetchedProfile = getCachedProfile(profileId);
        if (prefetchedProfile) {
          setProfile({
            id: prefetchedProfile.id,
            username: prefetchedProfile.username,
            full_name: prefetchedProfile.full_name,
            avatar_url: prefetchedProfile.avatar_url,
          } as Profile);
        }
        
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
        if (cachedProfile) setProfile(cachedProfile);
        if (cachedStories) setStories(cachedStories);
        if (cachedCommercials) setCommercials(cachedCommercials);
        if (cachedProducts) setProducts(cachedProducts);
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
      } catch {
        // ignore
      } finally {
        await Promise.all([
          fetchProfile({ writeCache: true }),
          fetchStories({ writeCache: true }),
          fetchCommercials({ writeCache: true }),
          fetchProducts({ writeCache: true }),
          fetchFollowerCounts({ writeCache: true }),
          fetchRevives({ writeCache: true }),
        ]).catch(() => {});
        const ids = [...(stories.map((s) => s.id) ?? []), ...(commercials.map((c) => c.id) ?? [])];
        if (ids.length) await fetchStoryStats(ids).catch(() => {});
        if (!mounted) return;
        setInitialLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

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

  useEffect(() => {
    const totalLikes = Object.values(storyLikesMap).reduce((a, b) => a + (b || 0), 0);
    setTotalLikesCount(totalLikes);
  }, [storyLikesMap]);

  const totalStoryLikes = Object.values(storyLikesMap).reduce((a, b) => a + (b || 0), 0);
  const totalStoryComments = Object.values(storyCommentsMap).reduce((a, b) => a + (b || 0), 0);

  const renderStoriesCard = () => {
    const s = stories[0];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
        <Pressable 
          style={({ pressed }) => [styles.storyCard, { backgroundColor: theme.card, transform: [{ scale: pressed ? 0.96 : 1 }] }]} 
          onPress={() => router.push(`/explore/user_stories/${profileId}`)}
        >
          <View style={{ position: 'relative' }}>
            {s?.media_url ? (
              isVideoUri(s.media_url) ? (
                <Video source={{ uri: s.media_url }} style={styles.storyCardMedia} resizeMode={ResizeMode.COVER} useNativeControls={false} isLooping isMuted />
              ) : (
                <ExpoImage source={{ uri: s.media_url }} style={styles.storyCardMedia} contentFit="cover" />
              )
            ) : (
              <View style={[styles.storyCardMedia, { alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="image" size={28} color={theme.sub} />
              </View>
            )}
            <HDBadge />
          </View>
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }} numberOfLines={2}>
                {profile?.full_name ?? profile?.username ?? 'Stories'}
              </Text>
              <Ionicons name="checkmark-circle" size={16} color={VELT_ACCENT} />
            </View>
            <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>{s?.created_at ? formatDate(s.created_at) : ''}</Text>
          </View>
        </Pressable>

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
        <Pressable 
          style={({ pressed }) => [styles.storyCard, { backgroundColor: theme.card, transform: [{ scale: pressed ? 0.96 : 1 }] }]} 
          onPress={() => router.push(`/explore/stories_plug/${profileId}`)}
        >
          <View style={{ position: 'relative' }}>
            {c?.media_url ? (
              isVideoUri(c.media_url) ? (
                <Video source={{ uri: c.media_url }} style={styles.storyCardMedia} resizeMode={ResizeMode.COVER} useNativeControls={false} isLooping isMuted />
              ) : (
                <ExpoImage source={{ uri: c.media_url }} style={styles.storyCardMedia} contentFit="cover" />
              )
            ) : (
              <View style={[styles.storyCardMedia, { alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="image" size={28} color={theme.sub} />
              </View>
            )}
            <HDBadge />
          </View>
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }} numberOfLines={2}>
                {profile?.full_name ?? profile?.username ?? 'Commercials'}
              </Text>
              <Ionicons name="checkmark-circle" size={16} color={VELT_ACCENT} />
            </View>
            <Text style={{ color: theme.sub, marginTop: 6, fontSize: 13 }}>{c?.created_at ? formatDate(c.created_at) : ''}</Text>
          </View>
        </Pressable>

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
            <Pressable
              key={revive.id}
              style={({ pressed }) => [styles.reviveCard, { borderColor: theme.hair, backgroundColor: theme.card, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
              onPress={() => router.push(`/Contents?storyId=${revive.id}`)}
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
                  <Ionicons name="heart" size={13} color={VELT_ACCENT} />
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{likes}</Text>
                </View>
                <View style={styles.reviveStat}>
                  <Ionicons name="chatbubble" size={13} color={theme.sub} />
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{comments}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const firstMedia = (arr?: string[] | null) => (Array.isArray(arr) && arr.length ? arr[0] : undefined);
  const renderProductCell = ({ item }: { item: Product }) => {
    const uri = firstMedia(item.images);
    return (
      <Pressable
        style={({ pressed }) => [styles.productCell, { backgroundColor: theme.hair, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        onPress={() => router.push(`/market/product-details?id=${item.id}`)}
      >
        {uri ? (
          <ExpoImage source={{ uri }} cachePolicy="disk" style={styles.productImage} contentFit="cover" />
        ) : (
          <View style={[styles.productImage, { alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="box" size={18} color={theme.sub} />
          </View>
        )}
        <View style={{ padding: 8 }}>
          <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={{ color: theme.sub }}>₵{item.price}</Text>
        </View>
      </Pressable>
    );
  };

  // always render main profile UI — no early placeholder screen; content will render immediately

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={statusBarStyle} translucent />

      {/* Decorative doodles rendered behind the main profile content so the shapes are visible immediately */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {!reduceMotion ? (
          <>
            <Animated.View style={[styles.profileViewDoodleLarge, { borderColor: theme.accent, opacity: 0.72, transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [-28, 40] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [-20, 72] }) }, { rotate: doodleA.interpolate({ inputRange: [0,1], outputRange: ['-8deg', '6deg'] }) }] }]} />
            <Animated.View style={[styles.profileViewDoodleRight, { borderColor: theme.sub, opacity: 0.58, transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [44, -34] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [10, -40] }) }, { rotate: doodleB.interpolate({ inputRange: [0,1], outputRange: ['6deg', '-10deg'] }) }] }]} />
            <Animated.View style={[styles.profileViewDoodleLower, { borderColor: theme.faint || theme.accent, opacity: 0.66, transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [-36, 28] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [6, -36] }) }, { rotate: doodleC.interpolate({ inputRange: [0,1], outputRange: ['-10deg', '12deg'] }) }] }]} />
          </>
        ) : (
          <>
            <View style={[styles.profileViewDoodleLarge, { borderColor: theme.accent, opacity: 0.64 }]} />
            <View style={[styles.profileViewDoodleRight, { borderColor: theme.sub, opacity: 0.5 }]} />
            <View style={[styles.profileViewDoodleLower, { borderColor: theme.faint || theme.accent, opacity: 0.6 }]} />
          </>
        )}
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={silentRefresh} tintColor={theme.accent} colors={[theme.accent]} />
        }
      >
        <View style={{ width: '100%', height: COVER_HEIGHT }}>
          <ImageBackground
            source={profile?.cover_photo_url ? { uri: profile.cover_photo_url } : undefined}
            style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start' }]}
            imageStyle={{ resizeMode: 'cover' }}
          >
            {/* Gradient overlay for glassmorphism effect */}
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.topBar}>
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
              </View>
            </View>
          </ImageBackground>
        </View>

        <View style={{ marginTop: -40, paddingHorizontal: 12 }}>
          {/* Glassmorphism profile card */}
          <BlurView intensity={80} tint={colors.isDark ? "dark" : "light"} style={styles.profileCard}>
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
                {profile?.profession ? (
                  <View style={[styles.pill, { backgroundColor: theme.hair }]}>
                    <Text style={[styles.pillText, { color: theme.text }]}>{profile.profession}</Text>
                  </View>
                ) : null}
                {profile?.date_of_birth ? (
                  <View style={styles.pillFilled}>
                    <Text style={styles.pillFilledText}>{formatDate(profile.date_of_birth)}</Text>
                  </View>
                ) : null}
                {profile?.business_name ? (
                  <View style={[styles.pill, { backgroundColor: theme.hair }]}>
                    <Text style={[styles.pillTextBold, { color: theme.text }]} numberOfLines={1}>
                      {profile.business_name}
                    </Text>
                  </View>
                ) : null}
              </View>

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

              {announcementVisible && (
                <View style={[styles.announcement, { backgroundColor: theme.card, borderColor: theme.hair }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>New Feature: Quick Shares</Text>
                    <Text style={{ color: theme.sub, marginTop: 4 }}>
                      Share stories directly into campaigns — try Quick Share now.
                    </Text>
                  </View>
                  <Pressable onPress={() => setAnnouncementVisible(false)} style={({ pressed }) => [{ marginLeft: 12, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
                    <Ionicons name="close" size={18} color={theme.sub} />
                  </Pressable>
                </View>
              )}
            </View>
          </BlurView>
        </View>

        <View style={[styles.tabsRow, { borderBottomColor: theme.hair, marginTop: 12 }]}>
          <Pressable
            onPress={() => {
              horizRef.current?.scrollTo({ x: SCREEN_WIDTH * 0, y: 0, animated: true });
              setPageIndex(0);
            }}
            style={({ pressed }) => [styles.tabSlim, pageIndex === 0 && styles.tabActive, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Text style={[styles.tabSlimTxt, pageIndex === 0 ? { color: VELT_ACCENT, fontWeight: '800' } : { color: theme.sub }]}>Posts</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              horizRef.current?.scrollTo({ x: SCREEN_WIDTH * 1, y: 0, animated: true });
              setPageIndex(1);
            }}
            style={({ pressed }) => [styles.tabSlim, pageIndex === 1 && styles.tabActive, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Text style={[styles.tabSlimTxt, pageIndex === 1 ? { color: VELT_ACCENT, fontWeight: '800' } : { color: theme.sub }]}>Revives</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              horizRef.current?.scrollTo({ x: SCREEN_WIDTH * 2, y: 0, animated: true });
              setPageIndex(2);
            }}
            style={({ pressed }) => [styles.tabSlim, pageIndex === 2 && styles.tabActive, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <Text style={[styles.tabSlimTxt, pageIndex === 2 ? { color: VELT_ACCENT, fontWeight: '800' } : { color: theme.sub }]}>Products</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={(r) => {
            horizRef.current = r;
          }}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = Math.round(x / SCREEN_WIDTH);
            if (idx !== pageIndex) setPageIndex(idx);
          }}
        >
          <View style={{ width: SCREEN_WIDTH, padding: 12 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>Stories</Text>
            {renderStoriesCard()}
            <View style={{ height: 12 }} />
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>Commercials</Text>
            {renderCommercialsCard()}
            <View style={{ height: 36 }} />
          </View>

          <View style={{ width: SCREEN_WIDTH, padding: 12 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>Revives</Text>
            {renderRevivesGrid()}
          </View>

          <View style={{ width: SCREEN_WIDTH, padding: 8 }}>
            <FlatList
              data={products}
              keyExtractor={(it: any, i) => (it?.id ? it.id : `${i}`)}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
              renderItem={renderProductCell as any}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 32 }}>
                  <Text style={{ color: theme.sub }}>No products yet</Text>
                </View>
              }
              refreshControl={<RefreshControl refreshing={false} onRefresh={silentRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
            />
          </View>
        </ScrollView>
      </ScrollView>
      {/* dev-only status anchored to content area so it reflects the visible page content */}
    </SafeAreaView>
  );
}

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
  // Glassmorphism header button
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
  // Glassmorphism profile card
  profileCard: {
    width: '100%',
    padding: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  profileOverlay: { width: '100%', padding: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  // Avatar with accent ring - borderColor set dynamically based on hasActiveStory
  avatarRing: {
    padding: 3,
    borderRadius: 50,
    borderWidth: 3,
  },
  avatar: { width: 92, height: 92, borderRadius: 46 },
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
  announcement: { marginTop: 12, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
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
  // public profile doodles
  profileViewDoodleLarge: { position: 'absolute', left: -40, top: -36, width: 520, height: 520, borderRadius: 300, borderWidth: 6.2, borderStyle: 'solid' },
  profileViewDoodleRight: { position: 'absolute', right: -64, top: 24, width: 360, height: 360, borderRadius: 220, borderWidth: 5.2, borderStyle: 'solid' },
  profileViewDoodleLower: { position: 'absolute', left: 28, right: 28, bottom: 120, height: 160, borderRadius: 120, borderWidth: 6.0, borderStyle: 'solid' },
});






