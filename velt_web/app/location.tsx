import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image, Modal, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, PanResponder, GestureResponderEvent, PanResponderGestureState, Text, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import Reanimated, { FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withTiming, interpolate } from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from 'app/themes';
import { supabase } from '@/lib/supabase';
import { getCurrentUserIdAsync } from '@/lib/currentuser';
import Svg, { Line, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import AnimatedPressable from '@/components/AnimatedPressable';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfileStore } from '@/lib/store/profile';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { prefetchLocationPosts } from '@/lib/store/prefetchStore';
import { Video, ResizeMode } from 'expo-av';


const { width } = Dimensions.get('window');

type Post = {
  id: string;
  place: string;
  images: string[];
  videos: string[];
  media_type: string;
  avatar: string;
  authorId?: string | null; // author / owner of post
  stars?: number; // total stars
  comments?: Array<{ id: string; user: string; text: string; created_at?: string }>;
  country: string; // country code / name
  x: number; // 0..1 relative position
  y: number; // 0..1 relative position
  latitude?: number | null; // raw geographic latitude
  longitude?: number | null; // raw geographic longitude
  caption?: string | null;
  created_at?: string | null;
  authorName?: string | null;
};

// Basic country list used by the country selector (include 'All' to show every post)
// Country selector removed per request — map pins are shown on posts directly.

// positionsMap is computed later (useMemo) — no top-level placeholder needed

export default function YourCheckinsScreen() {
  const { colors } = useTheme();
  const { profile } = useProfileStore();
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  // viewer moved to its own page at /location/[id]
  const router = useRouter();
  // starred posts by the current user (in-memory for now)
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  // current user id for filtering
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{ visible: boolean; post?: Post | null }>({ visible: false, post: null });
  const [deleting, setDeleting] = useState(false);
  
  // Stats card preview modal
  const [statsPreview, setStatsPreview] = useState<{ visible: boolean; type: string; title: string; value: string; description: string; icon: string; color: string } | null>(null);

  // posts loaded from DB
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  // comment drafts keyed by postId
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  // optional place filter when user drills into a country
  const [selectedPlaceFilter, setSelectedPlaceFilter] = useState<string | null>(null);
  // country explorer (removed) — keep placeholder state if needed in future
  const [countryExplorer, setCountryExplorer] = useState<{ visible: boolean; country?: string | null }>({ visible: false, country: null });
  // search modal state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Reduced motion preference
  const reduceMotion = useReducedMotion();
  
  // Animated ring rotation for avatar
  const ringRotation = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  
  // Start avatar ring animation
  useEffect(() => {
    if (reduceMotion) return;
    
    // Continuous rotation animation
    const rotationAnim = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    // Subtle pulse animation
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    rotationAnim.start();
    pulseAnim.start();
    
    return () => {
      rotationAnim.stop();
      pulseAnim.stop();
    };
  }, [reduceMotion, ringRotation, ringScale]);
  
  // Animated values for card entry effects - track which cards have been animated
  const cardAnimations = useRef<Map<string, Animated.Value>>(new Map()).current;
  const animatedCards = useRef<Set<string>>(new Set()).current;
  
  const getCardAnim = useCallback((id: string) => {
    if (!cardAnimations.has(id)) {
      cardAnimations.set(id, new Animated.Value(animatedCards.has(id) ? 1 : 0));
    }
    return cardAnimations.get(id)!;
  }, [cardAnimations, animatedCards]);

  const filtered = useMemo(() => {
    let result = posts;
    // keep country filtering capability but country UI removed — filter only applies
    // when a specific place filter is chosen (we still support 'selectedPlaceFilter').
    if (selectedPlaceFilter) {
      result = result.filter((p) => (p.place ?? '').toLowerCase() === selectedPlaceFilter.toLowerCase());
    }
    return result;
  }, [selectedCountry, posts, selectedPlaceFilter]);

  // Track post IDs for animation - only animate NEW cards
  const prevPostIds = useRef<Set<string>>(new Set());
  
  // Trigger card entry animations only for NEW cards (not on every state update)
  useEffect(() => {
    if (reduceMotion) return;
    
    const currentIds = new Set(filtered.map(p => p.id));
    const newCards = filtered.filter(p => !prevPostIds.current.has(p.id));
    
    // Only animate cards that are truly new
    newCards.forEach((p, idx) => {
      if (!animatedCards.has(p.id)) {
        const anim = getCardAnim(p.id);
        anim.setValue(0);
        Animated.spring(anim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay: idx * 50,
          useNativeDriver: true,
        }).start(() => {
          animatedCards.add(p.id);
        });
      }
    });
    
    // Update tracked IDs
    prevPostIds.current = currentIds;
  }, [filtered, reduceMotion, getCardAnim, animatedCards]);

  // Build tree-like parent-child connections for an organic vertical flow.
  // We partition posts into levels using a repeating pattern [2,1,2,1,...]
  // then connect parents -> children (branching). This gives a waterfall/branch
  // visual instead of a simple grid or sequential rope.
  const { connections, levels } = useMemo(() => {
    const resultPairs: Array<[Post, Post]> = [];
    const lvls: Post[][] = [];
    const arr = filtered || [];

    // Build one post per row so we render a zigzag (alternating left/right)
    for (let i = 0; i < arr.length; i++) {
      lvls.push([arr[i]]);
    }

    // Connect each row to the next (adjacent rows) so ropes link each post
    for (let l = 0; l < lvls.length - 1; l++) {
      const a = lvls[l]?.[0];
      const b = lvls[l + 1]?.[0];
      if (a && b) resultPairs.push([a, b]);
    }

    // Ensure every post appears in at least one connection (as either parent or child)
    // so that the rope network touches every card. If a node currently has no
    // connection, try to link it to a nearby node in the previous level (preferred)
    // or next level if previous is absent.
    const connected = new Set<string>();
    for (const [a, b] of resultPairs) {
      connected.add(String(a.id));
      connected.add(String(b.id));
    }

    for (let li = 0; li < lvls.length; li++) {
      const row = lvls[li];
      for (let idxInRow = 0; idxInRow < row.length; idxInRow++) {
        const node = row[idxInRow];
        if (!node) continue;
        if (connected.has(node.id)) continue; // already connected

        // prefer to attach to previous level
        if (li > 0 && lvls[li - 1] && lvls[li - 1].length > 0) {
          const parents = lvls[li - 1];
          const pid = Math.floor((idxInRow * parents.length) / Math.max(1, row.length));
          const parent = parents[Math.min(pid, parents.length - 1)];
          if (parent) {
            resultPairs.push([parent, node]);
            connected.add(String(parent.id));
            connected.add(String(node.id));
            continue;
          }
        }

        // otherwise attach to next level
        if (li < lvls.length - 1 && lvls[li + 1] && lvls[li + 1].length > 0) {
          const children = lvls[li + 1];
          const cid = Math.floor((idxInRow * children.length) / Math.max(1, row.length));
          const child = children[Math.min(cid, children.length - 1)];
          if (child) {
            resultPairs.push([node, child]);
            connected.add(String(node.id));
            connected.add(String(child.id));
            continue;
          }
        }
      }
    }

    

    return { connections: resultPairs, levels: lvls };
  }, [filtered]);

  // map each post id to its level index so render-phase can decide left/right
  const levelIndexMap = useMemo(() => {
    const m: Record<string, number> = {};
    (levels || []).forEach((row, li) => (row || []).forEach((p) => { if (p) m[String(p.id)] = li; }));
    return m;
  }, [levels]);

  

  

  

  

  

  // compute total stars for authors
  const starsByAuthor = useMemo(() => {
    const map: Record<string, number> = {};
    posts.forEach((p) => {
      const id = p.authorId ?? 'unknown';
      map[id] = (map[id] || 0) + (p.stars ?? 0);
    });
    return map;
  }, [posts]);

  // fetch comments for a post
  const fetchCommentsForPost = useCallback(async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('location_post_comments')
        .select('id, location_post_id, user_id, content, created_at, profiles(id, username, full_name, avatar_url)')
        .eq('location_post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const mapped = (data ?? []).map((r: any) => ({ id: r.id, user: r.profiles?.username ?? r.user_id, text: r.content, created_at: r.created_at }));
      setPosts((cur) => cur.map((p) => (p.id === postId ? { ...p, comments: mapped } : p)));
    } catch (err) {
      console.warn('fetchCommentsForPost', err);
    }
  }, []);

  // load posts from DB + star counts + current user's starred map
  // Now only fetches the CURRENT USER's check-ins
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getCurrentUserIdAsync();
      if (!me) {
        setPosts([]);
        setLoading(false);
        return;
      }
      setCurrentUserId(me);
      
      // Only fetch user's own check-ins
      let q = supabase.from('location_posts').select('id, place, caption, country, images, videos, media_type, avatar_url, author_display_name, user_id, position, latitude, longitude, created_at, profiles(id, username, full_name)').eq('user_id', me).order('created_at', { ascending: false }).limit(200);
      if (selectedCountry && selectedCountry !== 'All') q = q.eq('country', selectedCountry);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
        const mapped: Post[] = rows.map((r) => ({
        id: String(r.id),
        place: r.place ?? '—',
          caption: r.caption ?? null,
        images: Array.isArray(r.images) ? r.images : r.images ? [r.images] : [],
        videos: Array.isArray(r.videos) ? r.videos : [],
        media_type: r.media_type ?? 'image',
        avatar: r.avatar_url ?? null,
        authorId: r.user_id ?? null,
        // Prefer denormalized name stored on post, then profile full_name/username, then user id
        authorName: (r.author_display_name ?? r.profiles?.[0]?.full_name ?? r.profiles?.[0]?.username ?? (r.user_id ? String(r.user_id) : null)) ?? null,
        created_at: r.created_at ?? null,
        stars: 0,
        comments: [],
        country: r.country ?? 'Unknown',
        x: (r.position?.x ?? Math.random() * 0.9) as number,
        y: (r.position?.y ?? Math.random() * 0.9) as number,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
      }));
      setPosts(mapped);

      const ids = mapped.map((p) => p.id);
      if (ids.length) {
        // Try to get counts from the counts table first
        const { data: sc } = await supabase.from('location_post_star_counts').select('location_post_id, star_count').in('location_post_id', ids as string[]);
        const scMap: Record<string, number> = {};
        (sc ?? []).forEach((row: any) => (scMap[String(row.location_post_id)] = Number(row.star_count ?? 0)));
        
        // For any post without a count in the table, query the stars table directly
        const missingIds = ids.filter((id) => scMap[id] === undefined);
        if (missingIds.length) {
          // Get counts for posts not in the counts table
          for (const postId of missingIds) {
            try {
              const { count } = await supabase.from('location_post_stars').select('*', { count: 'exact', head: true }).eq('location_post_id', postId);
              scMap[postId] = count ?? 0;
            } catch {
              scMap[postId] = 0;
            }
          }
        }
        
        setPosts((cur) => cur.map((p) => ({ ...p, stars: scMap[p.id] ?? 0 })));

        if (me) {
          const { data: meStars } = await supabase.from('location_post_stars').select('location_post_id').eq('user_id', me).in('location_post_id', ids as string[]);
          const starredMap: Record<string, boolean> = {};
          (meStars ?? []).forEach((r: any) => (starredMap[String(r.location_post_id)] = true));
          setStarred(starredMap);
        }
      }
    } catch (err) {
      console.warn('loadPosts error', err);
      Alert.alert('Error', 'Could not load location posts');
    } finally {
      setLoading(false);
    }
  }, [selectedCountry]);

  useEffect(() => {
    loadPosts().catch(() => {});
  }, [loadPosts]);

  // helper: given an RPC response, try to extract a numeric star count
  const extractStarCount = async (rpcData: any, postId: string): Promise<number> => {
    // handle common RPC shapes:
    // - a plain number or string number
    // - an array like [123] or [{ star_count: 123 }]
    // - an object with star_count / count
    if (typeof rpcData === 'number') {
      return Number.isFinite(rpcData) ? rpcData : 0;
    }
    if (typeof rpcData === 'string') {
      const n = Number(rpcData);
      return Number.isFinite(n) ? n : 0;
    }
    if (Array.isArray(rpcData)) {
      if (rpcData.length > 0) {
        const first = rpcData[0];
        if (typeof first === 'number' || typeof first === 'string') {
          const n = Number(first);
          if (Number.isFinite(n)) return n;
        }
        if (first && typeof first === 'object') {
          if ('star_count' in first) return Number(first.star_count ?? 0);
          if ('count' in first) return Number(first.count ?? 0);
        }
      }
    }
    if (rpcData && typeof rpcData === 'object') {
      if ('star_count' in rpcData) return Number(rpcData.star_count ?? 0);
      if ('count' in rpcData) return Number(rpcData.count ?? 0);
    }

    // fallback: query authoritative count from location_post_star_counts
    try {
      const { data: res } = await supabase.from('location_post_star_counts').select('star_count').eq('location_post_id', postId).maybeSingle();
      if (res?.star_count != null) return Number(res.star_count);
    } catch (e) {
      console.warn('fallback star count query failed', e);
    }
    
    // Final fallback: count directly from location_post_stars
    try {
      const { count } = await supabase.from('location_post_stars').select('*', { count: 'exact', head: true }).eq('location_post_id', postId);
      if (count != null) return count;
    } catch (e) {
      console.warn('direct star count query failed', e);
    }
    
    return 0;
  };

  // Memoized star toggle handler to prevent unnecessary re-renders
  const handleToggleStar = useCallback(async (postId: string, currentlyStarred: boolean, currentStars: number, ev?: any) => {
    ev?.stopPropagation?.();
    // light haptic feedback for star tap
    Haptics.selectionAsync().catch(() => {});
    // optimistic update
    const optimisticCount = Math.max(0, (currentStars ?? 0) + (currentlyStarred ? -1 : 1));
    setStarred((s) => ({ ...s, [postId]: !currentlyStarred }));
    setPosts((cur) => cur.map((x) => (x.id === postId ? { ...x, stars: optimisticCount } : x)));
    try {
      const me = await getCurrentUserIdAsync();
      if (!me) throw new Error('not-signed-in');
      const { data: rpcData, error } = await supabase.rpc('toggle_location_post_star', { p_post_id: postId, p_user_id: me });
      if (error) throw error;
      
      // Always get the authoritative count
      const newCount = await extractStarCount(rpcData, postId);
      setPosts((cur) => cur.map((x) => (x.id === postId ? { ...x, stars: newCount } : x)));
      
      // Ensure the user's starred map reflects server state
      try {
        const { data: meStarRows } = await supabase.from('location_post_stars').select('location_post_id').eq('user_id', me).eq('location_post_id', postId).limit(1);
        const didStar = (meStarRows ?? []).length > 0;
        setStarred((s) => ({ ...s, [postId]: didStar }));
      } catch (e) {
        // ignore — we leave optimistic value if query fails
      }
    } catch (err) {
      console.warn('star toggle error', err);
      // rollback
      setStarred((s) => ({ ...s, [postId]: currentlyStarred }));
      setPosts((cur) => cur.map((x) => (x.id === postId ? { ...x, stars: currentStars } : x)));
    }
  }, [extractStarCount]);

  // Search logic: local (loaded posts) + remote (supabase) combined.
  useEffect(() => {
    if (!searchVisible) return;
    let cancelled = false;
    const q = (searchQuery || '').trim();
    async function run() {
      setSearchLoading(true);
      try {
        // local matches first (fast)
        const term = q.toLowerCase();
        const local = (filtered || []).filter((p) => {
          return (
            (p.place || '').toLowerCase().includes(term) ||
            (p.caption || '').toLowerCase().includes(term) ||
            (p.authorName || '').toLowerCase().includes(term) ||
            (p.country || '').toLowerCase().includes(term)
          );
        }).slice(0, 12).map((p) => ({ source: 'local', id: p.id, label: p.place, subtitle: p.caption ?? '', item: p }));

        // remote search if query bigger than 1 char
        let remote: any[] = [];
        if (q.length > 1) {
          try {
            const termEsc = q.replace(/'/g, "''");
            const { data, error } = await supabase
              .from('location_posts')
              .select('id, place, caption, country, images, avatar_url, author_display_name, created_at')
              .or(`place.ilike.%${termEsc}%,caption.ilike.%${termEsc}%,country.ilike.%${termEsc}%,author_display_name.ilike.%${termEsc}%`)
              .order('created_at', { ascending: false })
              .limit(20);
            if (!error && data) {
              remote = (data || []).map((r: any) => ({ source: 'remote', id: String(r.id), label: r.place ?? r.author_display_name ?? '', subtitle: r.caption ?? r.country ?? '', item: r }));
            }
          } catch (e) {
            console.warn('search remote error', e);
          }
        }

        if (!cancelled) {
          // merge: dedupe by id, local first
          const map: Record<string, any> = {};
          [...local, ...remote].forEach((r) => { if (!map[r.id]) map[r.id] = r; });
          setSearchResults(Object.values(map));
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }

    const handle = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [searchVisible, searchQuery, filtered]);

  // comments for posts are fetched when needed (viewer page handles loading comments for a single post)

  // Allow the canvas to use the full available width (minus padding) so
  // left/right branching can spread naturally on wider screens.
  const PHONE_WIDTH = Math.max(320, width - 40);
  const PHONE_HEIGHT = PHONE_WIDTH * (840 / 420); // vertical phone box

  

  const [hoverPopup, setHoverPopup] = useState<{ visible: boolean; post?: Post | null }>({ visible: false, post: null });
  // viewer modal, pan gestures and internal viewer indexes moved to /location/[id]

  // We'll render every post separately. When multiple posts share the same coords/place
  // they should not be stacked exactly on top of one another — instead we spread them
  // deterministically around the base point. This produces consistent, readable layouts
  // without overlapping cards.
  const jitterFor = useCallback((id: string) => {
    // Simple deterministic hash -> small offset in px (fallback when single post at place)
    let h = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
    // produce -12..+12 px offsets
    const x = ((h % 25) - 12);
    const y = (((h >>> 6) % 25) - 12);
    return { dx: x, dy: y };
  }, []);

  // Group posts by normalized place key so we can spread posts that share same place
  const { groupMap, indexInGroup } = useMemo(() => {
    const groups: Record<string, string[]> = {};
    (filtered || []).forEach((pp) => {
      const key = `${pp.country || ''}||${(pp.place || '').trim().toLowerCase()}`;
      groups[key] = groups[key] ?? [];
      groups[key].push(pp.id);
    });
    const idxMap: Record<string, number> = {};
    Object.keys(groups).forEach((k) => {
      (groups[k] || []).forEach((id, i) => (idxMap[id] = i));
    });
    return { groupMap: groups, indexInGroup: idxMap };
  }, [filtered]);

  // compute a stable positions map for each post so components can read positionsMap[p.id]
  // This spreads posts that share the same place and falls back to deterministic jitter.
  const positionsMeta = useMemo(() => {
    const map: Record<string, { left: number; top: number }> = {};
    // card size used by post rendering (kept consistent with the render-time constants)
    const CARD_W = 170;
    const CARD_H = 220;

    // seed map according to tree levels we built above
    // layout rules:
    //  - levels alternate between 2 nodes (left/right) and 1 node (center)
    //  - y increases per level (vertical flow)
    //  - x positions are chosen to alternate left/right but stay organic
    // make the layout more roomy vertically and add a bit more horizontal spread
    const LEVEL_MARGIN = 48; // padding at top and bottom (larger for a breathing layout)
    // allow fewer levels to increase per-level spacing for a taller waterfall
    const maxLevels = Math.max(3, Math.ceil((filtered.length || 1) / 2));
    const LEVEL_SPACING = Math.max(120, PHONE_HEIGHT / Math.max(3, maxLevels)); // larger vertical spacing
    // estimated canvas height (used for clamping before we compute a final layout height)
    const EST_CANVAS_H = Math.max(PHONE_HEIGHT, LEVEL_MARGIN + (levels?.length ?? 0) * LEVEL_SPACING + CARD_H + 24);

    if (levels && levels.length) {
      for (let li = 0; li < levels.length; li++) {
        const row = levels[li];
        const yCenter = Math.max(24, Math.min(EST_CANVAS_H - 24, LEVEL_MARGIN + li * LEVEL_SPACING));
          if (row.length === 1) {
          const p = row[0];
            // Zigzag: alternate alignment left/right per level so posts form a vertical
            // zigzag pattern. Even levels align right, odd levels align left.
            const alignRight = (li % 2 === 0);
            const sideGap = Math.max(8, Math.round(PHONE_WIDTH * 0.04));
            let left = alignRight ? Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, PHONE_WIDTH - CARD_W - sideGap)) : Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, sideGap));
          // if this centered level is acting as a middle branch (surrounded by multi-node levels)
          // nudge it downward so it visually separates the branches and feels like a midpoint
          const isMiddleBranch = ((levels[li - 1]?.length ?? 0) > 1) || ((levels[li + 1]?.length ?? 0) > 1);
          // make the middle branch more visually distinct by pushing it down further
          const extraDown = isMiddleBranch ? Math.round(LEVEL_SPACING * 0.40) : 0; // ~40% of spacing
          let top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, yCenter - CARD_H / 2 + extraDown));
          // If this middle branch sits between multi-node levels, nudge it left or right
          // so it doesn't sit exactly on center and the connecting ropes get space.
          let horizNudge = 0;
          const leftNeighbors = (levels[li - 1]?.length ?? 0) > 1;
          const rightNeighbors = (levels[li + 1]?.length ?? 0) > 1;
          if (leftNeighbors || rightNeighbors) {
            // pick deterministic side using id hash (stable) so layout doesn't jump
            let h = 2166136261 >>> 0;
            for (let i = 0; i < p.id.length; i++) h = Math.imul(h ^ p.id.charCodeAt(i), 16777619) >>> 0;
            const side = (h % 2 === 0) ? -1 : 1; // -1 left, +1 right
            // nudging amount depends on screen size so middle nodes don't overlap the neighbor branches
            horizNudge = side * Math.max(28, Math.round(PHONE_WIDTH * 0.08));
          }
          // slight random-ish deterministic nudge so layout feels organic
          const { dx, dy } = jitterFor(p.id);
          left += dx * 0.33 + horizNudge;
          top += dy * 0.2;
          map[p.id] = { left: Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, left)), top };
        } else if (row.length === 2) {
          // left and right nodes
          // compute an outward gap from center (safe clamped) so branches spread horizontally
          const centerX = PHONE_WIDTH * 0.5;
          // prefer a large gap but don't overflow the frame (respect CARD_W/2 + padding)
          // compute a much larger gap so branches appear clearly separated from the center
          // Calculate outward branch separation. We want branches to be visually apart
          // but not so far they overflow the frame or feel disconnected. Use a
          // balanced, screen-relative gap with a modest minimum so it's visible on
          // small screens and reasonable on large screens.
          const safeMax = Math.max(8, Math.min(centerX - (CARD_W / 2) - 20, Math.round(PHONE_WIDTH * 0.45)));
          // moderate relative gap (fraction of phone width) but clamped to safe bounds
          // nudge preferred gap significantly wider so parent/child ropes have
          // extra breathing room. This makes left/right branches much more
          // visibly apart while staying inside the phone canvas bounds.
          // make the horizontal branch gap stronger so left/right branches are
          // visibly far apart on most screens. This makes ropes less dense.
          const preferred = Math.round(PHONE_WIDTH * 0.46); // much wider spread
          // enforce larger minimum so small screens still show a clear separation
          const gap = Math.max(260, Math.min(safeMax, preferred));
          const leftX = centerX - gap;
          const rightX = centerX + gap;
          const pL = row[0];
          const pR = row[1];
          const top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, yCenter - CARD_H / 2));
          // add a small deterministic horizontal nudge so columns don't feel too symmetrical
          // amplify horizontal nudge for branches so they feel more offset
          // even stronger horizontal nudge so asymmetry is highly visible
          // a small deterministic horizontal nudge so columns don't feel too symmetrical
          // alternate a slight additional outward offset so the left branch leans left
          // and the right branch leans right — this gives a subtle organic separation.
          // stronger outward bias so left branch leans clearly left and right branch
          // leans clearly right. The bias keeps them visually separated even if
          // collision passes run later.
          // further bias left/right so the two-node level visibly fans out
          const lJ = jitterFor(pL.id).dx * 2.4 - 56; // stronger left bias
          const rJ = jitterFor(pR.id).dx * 2.4 + 56; // stronger right bias
          map[pL.id] = { left: Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, leftX - CARD_W / 2 + lJ)), top };
          map[pR.id] = { left: Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, rightX - CARD_W / 2 + rJ)), top };
        } else {
          // if row has >2 (rare), distribute evenly across width but keep center bias
          const span = Math.min(row.length - 1, Math.max(1, row.length - 1));
          for (let k = 0; k < row.length; k++) {
            const p = row[k];
            const ratio = span === 0 ? 0.5 : k / span;
            const cx = 0.12 * PHONE_WIDTH + (0.76 * PHONE_WIDTH) * ratio; // padded 0.12..0.88 range
            const left = Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, cx - CARD_W / 2));
            const top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, yCenter - CARD_H / 2));
            map[p.id] = { left, top };
          }
        }
      }
    } else {
      (filtered || []).forEach((p) => {
        // fallback to previous behavior
      // base center point inside the phone frame for the post
      const cx = Math.max(CARD_W / 2 + 4, Math.min(PHONE_WIDTH - (CARD_W / 2) - 4, (p.x ?? 0.5) * PHONE_WIDTH));
      const cy = Math.max(CARD_H / 2 + 4, Math.min(EST_CANVAS_H - (CARD_H / 2) - 4, (p.y ?? 0.5) * EST_CANVAS_H));

      const placeKey = `${p.country || ''}||${(p.place || '').trim().toLowerCase()}`;
      const members = groupMap?.[placeKey] ?? [];
      const idxInGroup = indexInGroup?.[p.id] ?? 0;

      let left = cx - CARD_W / 2;
      let top = cy - CARD_H / 2;

      if (members.length > 1) {
        // spread posts around the center in a small circle based on index
        const angle = (idxInGroup / members.length) * Math.PI * 2;
        const radius = Math.min(36, 8 + members.length * 6);
        left += Math.cos(angle) * radius;
        top += Math.sin(angle) * radius;
      } else {
        // slight deterministic jitter so singletons aren't exactly overlapping visually
        const { dx, dy } = jitterFor(p.id);
        left += dx;
        top += dy;
      }

      // clamp into bounds
      left = Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, left));
      top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, top));

        map[p.id] = { left, top };
      });
    }

    // --- Vertical spacing pass for center/middle nodes ---
    // Ensure posts that fall into the same horizontal column (e.g. centered)
    // maintain a minimum vertical separation so ropes between them remain readable.
    // This pass runs after initial placement but before connection/collision tuning.
    // increase vertical minimum separation for centered nodes
    const minVsep = Math.max(220, Math.round(LEVEL_SPACING * 0.95));
    const centerThreshold = Math.round(CARD_W * 0.6);
    const centerKeys = Object.keys(map).sort();
    for (let i = 0; i < centerKeys.length; i++) {
      for (let j = i + 1; j < centerKeys.length; j++) {
        const A = map[centerKeys[i]];
        const B = map[centerKeys[j]];
        if (!A || !B) continue;
        const ax = A.left + CARD_W / 2;
        const ay = A.top + CARD_H / 2;
        const bx = B.left + CARD_W / 2;
        const by = B.top + CARD_H / 2;
        const horizDist = Math.abs(ax - bx);
        const vertDist = Math.abs(ay - by);
        if (horizDist <= centerThreshold && vertDist < minVsep) {
          const need = (minVsep - vertDist) + 6;
          const push = Math.round(need / 2);
          const sign = centerKeys[i].localeCompare(centerKeys[j]) < 0 ? -1 : 1;
          A.top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, A.top - push * sign));
          B.top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, B.top + push * sign));
        }
      }
    }

    // After initial placement, apply an extra pass to ensure connected nodes
    // (parents <-> children) keep a little extra spacing so the rope lines are
    // clearly visible and visual clusters don't feel cramped. This pass nudges
    // only the child node outward to preserve the branch topology.
    // increase the minimum center-to-center spacing for connected nodes so
    // ropes have prominent breathing room
    const minConnSep = Math.max(320, Math.round(CARD_W * 1.5)); // larger minimum separation
    if (connections && connections.length) {
      for (const [pa, pb] of connections) {
        const A = map[pa.id];
        const B = map[pb.id];
        if (!A || !B) continue;
        const ax = A.left + CARD_W / 2;
        const ay = A.top + CARD_H / 2;
        const bx = B.left + CARD_W / 2;
        const by = B.top + CARD_H / 2;
        let dx = bx - ax;
        let dy = by - ay;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < minConnSep) {
          // distribute the push between both connected nodes so lines expand
          // outward and the entire link becomes more spacious.
          const need = (minConnSep - dist) + 8;
          const ux = dx / dist;
          const uy = dy / dist;
          // push both A and B half the required distance, biasing both slightly
          // more horizontally so ropes fan outward
          // push more strongly in both axes so connected nodes spread nicely
          const pushOverallX = ux * Math.max(18, Math.round(need * 1.1));
          const pushOverallY = uy * Math.max(10, Math.round(need * 0.9));
          const pushAX = -pushOverallX * 0.5;
          const pushAY = -pushOverallY * 0.5;
          const pushBX = pushOverallX * 0.5;
          const pushBY = pushOverallY * 0.5;
          A.left = Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, A.left + pushAX));
          A.top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, A.top + pushAY));
          B.left = Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, B.left + pushBX));
          B.top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, B.top + pushBY));
        }
      }
    }

    // Collision-resolution pass (deterministic):
    // - Iterate a few times; for any overlapping card pairs, push them away from each
    //   other along the vector between centers.
    // - Work in a deterministic order (sorted keys) so identical inputs produce
    //   identical outputs across runs.
    const keys = Object.keys(map).sort();
    const maxIter = 24;
    const EPS = 0.5; // minimum push threshold in px

    const overlaps = (a: { left: number; top: number }, b: { left: number; top: number }) => {
      return !(a.left + CARD_W <= b.left || b.left + CARD_W <= a.left || a.top + CARD_H <= b.top || b.top + CARD_H <= a.top);
    };

    // iterative resolve
    for (let iter = 0; iter < maxIter; iter++) {
      let moved = false;
      // pairwise compare in deterministic order
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const A = map[keys[i]];
          const B = map[keys[j]];
          if (!A || !B) continue;
          if (!overlaps(A, B)) continue;

          // compute centers
          const ax = A.left + CARD_W / 2;
          const ay = A.top + CARD_H / 2;
          const bx = B.left + CARD_W / 2;
          const by = B.top + CARD_H / 2;

          let dx = ax - bx;
          let dy = ay - by;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

          // minimum separation needed
          const overlapX = (CARD_W - Math.abs(ax - bx));
          const overlapY = (CARD_H - Math.abs(ay - by));
          const pushX = (overlapX / 2) + 1; // split push between both
          const pushY = (overlapY / 2) + 1;

          // normalize vector and apply push composed of both axes,
          // fallback to small deterministic jitter if centers match
          if (dist <= 1) {
            // use id-based deterministic jitter to break perfect ties
            const sign = (keys[i].localeCompare(keys[j]) < 0) ? 1 : -1;
            dx = sign * 0.5;
            dy = sign * -0.5;
          }

          const nx = dx / dist;
          const ny = dy / dist;

          // Bias: prefer vertical motion to preserve deliberate horizontal branch spread.
          // Reduce horizontal movement so previously placed left/right branches stay far apart.
          const HORIZ_SCALE = 0.02; // near-zero horizontal movement to preserve branch spread
          const VERT_SCALE = 1.0; // full vertical movement

          // decide how much to move A and B (move both away half distance)
          const moveAX = Math.max(EPS, Math.abs(nx * pushX) * HORIZ_SCALE);
          const moveAY = Math.max(EPS, Math.abs(ny * pushY) * VERT_SCALE);
          const moveBX = Math.max(EPS, Math.abs(nx * pushX) * HORIZ_SCALE);
          const moveBY = Math.max(EPS, Math.abs(ny * pushY) * VERT_SCALE);

          // update positions
          A.left = Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, A.left + moveAX * (nx > 0 ? 1 : -1)));
          A.top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, A.top + moveAY * (ny > 0 ? 1 : -1)));

          B.left = Math.max(4, Math.min(PHONE_WIDTH - CARD_W - 4, B.left - moveBX * (nx > 0 ? 1 : -1)));
          B.top = Math.max(4, Math.min(EST_CANVAS_H - CARD_H - 4, B.top - moveBY * (ny > 0 ? 1 : -1)));

          moved = true;
        }
      }
      if (!moved) break;
    }


    // compute a layout height large enough to contain all cards (so the phone frame
    // can expand and the parent scrollview can scroll vertically)
    let maxBottom = 0;
    Object.values(map).forEach((v) => {
      maxBottom = Math.max(maxBottom, v.top + CARD_H + 12);
    });
    const layoutHeight = Math.max(EST_CANVAS_H, maxBottom + LEVEL_MARGIN);

    return { map, height: layoutHeight };
  }, [filtered, PHONE_WIDTH, PHONE_HEIGHT, groupMap, indexInGroup, jitterFor, levels, connections]);

  // keep backwards-compatible variable for mapping lookups
  const positionsMap = positionsMeta.map;
  const canvasHeight = positionsMeta.height;

  // Calculate statistics for the header
  const totalStars = useMemo(() => posts.reduce((acc, p) => acc + (p.stars ?? 0), 0), [posts]);
  const uniquePlaces = useMemo(() => new Set(posts.map(p => p.place)).size, [posts]);
  const uniqueCountries = useMemo(() => new Set(posts.filter(p => p.country && p.country !== 'Unknown').map(p => p.country)).size, [posts]);

  // Delete post handler
  const handleDeletePost = useCallback(async (postId: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('location_posts').delete().eq('id', postId);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPosts((cur) => cur.filter((p) => p.id !== postId));
      setDeleteModal({ visible: false, post: null });
    } catch (err) {
      console.warn('delete post error', err);
      Alert.alert('Error', 'Could not delete check-in. Please try again.');
    } finally {
      setDeleting(false);
    }
  }, []);

  return (
    <SwipeBackContainer>
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Background uses theme colors directly */}
      
      {/* Subtle accent gradient overlay */}
      <LinearGradient
        colors={colors.isDark
          ? [`${VELT_ACCENT}08`, 'transparent', `${VELT_ACCENT}04`]
          : [`${VELT_ACCENT}06`, 'transparent', `${VELT_ACCENT}03`]
        }
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 48 }}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="never"
          scrollEventThrottle={16}
        >
          {/* ═══════════════════════════════════════════════════════════════════
              MARVELOUS PERSONAL HEADER - "Your Check-ins"
              ═══════════════════════════════════════════════════════════════════ */}
          <Reanimated.View entering={FadeInDown.duration(600).springify()} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
            {/* Top row: Back button + Search */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Pressable 
                onPress={() => router.back()} 
                style={({ pressed }) => ({
                  width: 44, 
                  height: 44, 
                  borderRadius: 22,
                  backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              
              <Pressable 
                onPress={() => setSearchVisible(true)} 
                style={({ pressed }) => ({
                  width: 44, 
                  height: 44, 
                  borderRadius: 22,
                  backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="search-outline" size={22} color={colors.text} />
              </Pressable>
            </View>

            {/* Hero Section with Avatar */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              {/* Animated decorative rings behind avatar */}
              <Animated.View style={{ 
                position: 'absolute', 
                top: -30, 
                width: 180, 
                height: 180, 
                borderRadius: 90, 
                borderWidth: 1.5, 
                borderColor: `${VELT_ACCENT}15`,
                borderStyle: 'dashed',
                transform: [
                  { rotate: ringRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                  { scale: ringScale },
                ],
              }} />
              <Animated.View style={{ 
                position: 'absolute', 
                top: -20, 
                width: 160, 
                height: 160, 
                borderRadius: 80, 
                borderWidth: 2, 
                borderColor: `${VELT_ACCENT}25`,
                transform: [
                  { rotate: ringRotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) },
                  { scale: ringScale.interpolate({ inputRange: [1, 1.05], outputRange: [1.02, 0.98] }) },
                ],
              }} />
              <Animated.View style={{ 
                position: 'absolute', 
                top: -10, 
                width: 140, 
                height: 140, 
                borderRadius: 70, 
                borderWidth: 2.5, 
                borderColor: `${VELT_ACCENT}40`,
                transform: [
                  { rotate: ringRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] }) },
                ],
              }} />
              
              {/* Avatar with glow */}
              <Animated.View style={{ 
                shadowColor: VELT_ACCENT, 
                shadowOpacity: 0.5, 
                shadowRadius: 25, 
                shadowOffset: { width: 0, height: 0 },
                marginBottom: 16,
                transform: [{ scale: ringScale.interpolate({ inputRange: [1, 1.05], outputRange: [1, 1.02] }) }],
              }}>
                <LinearGradient
                  colors={[VELT_ACCENT, '#00d4ff', '#7c3aed', VELT_ACCENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    padding: 3,
                  }}
                >
                  {(profile as any)?.avatar_url ? (
                    <Image 
                      source={{ uri: (profile as any).avatar_url }} 
                      style={{ width: 94, height: 94, borderRadius: 47, borderWidth: 3, borderColor: colors.isDark ? '#000' : colors.bg }} 
                    />
                  ) : (
                    <View style={{ 
                      width: 94, 
                      height: 94, 
                      borderRadius: 47, 
                      backgroundColor: colors.card,
                      borderWidth: 3,
                      borderColor: colors.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="person" size={40} color={colors.subtext} />
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>

              {/* Title */}
              <Reanimated.View entering={FadeInUp.delay(200).duration(500)}>
                <Text style={{ 
                  fontSize: 32, 
                  fontWeight: '900', 
                  color: colors.text,
                  textAlign: 'center',
                  letterSpacing: -0.5,
                }}>
                  Your Check-ins
                </Text>
                <Text style={{ 
                  fontSize: 15, 
                  color: colors.subtext, 
                  textAlign: 'center',
                  marginTop: 6,
                }}>
                  {(profile as any)?.full_name || (profile as any)?.username || 'Your'} travel memories
                </Text>
              </Reanimated.View>
            </View>

            {/* Stats Cards - Compact Row with Custom Preview */}
            <Reanimated.View entering={FadeInUp.delay(400).duration(500)} style={{ marginBottom: 8 }}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
              >
                {/* Check-ins Card */}
                <Pressable 
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setStatsPreview({ visible: true, type: 'checkins', title: 'Check-ins', value: String(posts.length), description: `Across ${uniquePlaces} unique places`, icon: 'location', color: VELT_ACCENT });
                  }}
                  style={({ pressed }) => ({ 
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    minWidth: 80,
                    borderWidth: 1,
                    borderColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <View style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    backgroundColor: `${VELT_ACCENT}20`,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}>
                    <Ionicons name="location" size={16} color={VELT_ACCENT} />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{posts.length}</Text>
                  <Text style={{ fontSize: 10, color: colors.subtext, marginTop: 2 }}>Check-ins</Text>
                </Pressable>

                {/* Places Card */}
                <Pressable 
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    const placesList = [...new Set(posts.map(p => p.place))].slice(0, 5).join(', ');
                    setStatsPreview({ visible: true, type: 'places', title: 'Places Visited', value: String(uniquePlaces), description: placesList || 'None yet', icon: 'map-marker-multiple', color: '#8B5CF6' });
                  }}
                  style={({ pressed }) => ({ 
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    minWidth: 80,
                    borderWidth: 1,
                    borderColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <View style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    backgroundColor: 'rgba(139,92,246,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}>
                    <MaterialCommunityIcons name="map-marker-multiple" size={16} color="#8B5CF6" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{uniquePlaces}</Text>
                  <Text style={{ fontSize: 10, color: colors.subtext, marginTop: 2 }}>Places</Text>
                </Pressable>

                {/* Stars Card */}
                <Pressable 
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    const avgStars = posts.length > 0 ? (totalStars / posts.length).toFixed(1) : '0';
                    setStatsPreview({ visible: true, type: 'stars', title: 'Stars Received', value: String(totalStars), description: `${avgStars} avg per post`, icon: 'star', color: '#f5c518' });
                  }}
                  style={({ pressed }) => ({ 
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    minWidth: 80,
                    borderWidth: 1,
                    borderColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <View style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    backgroundColor: 'rgba(245,197,24,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}>
                    <Ionicons name="star" size={16} color="#f5c518" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{totalStars}</Text>
                  <Text style={{ fontSize: 10, color: colors.subtext, marginTop: 2 }}>Stars</Text>
                </Pressable>

                {/* Earnings Card */}
                <Pressable 
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setStatsPreview({ visible: true, type: 'earnings', title: 'Earnings', value: `$${(totalStars * 0.05).toFixed(2)}`, description: 'Based on engagement', icon: 'wallet', color: '#10B981' });
                  }}
                  style={({ pressed }) => ({ 
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    minWidth: 80,
                    borderWidth: 1,
                    borderColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <View style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    backgroundColor: 'rgba(16,185,129,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}>
                    <Ionicons name="wallet" size={16} color="#10B981" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>${(totalStars * 0.05).toFixed(0)}</Text>
                  <Text style={{ fontSize: 10, color: colors.subtext, marginTop: 2 }}>Earnings</Text>
                </Pressable>

                {/* Countries Card */}
                <Pressable 
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    const countriesList = [...new Set(posts.filter(p => p.country && p.country !== 'Unknown').map(p => p.country))].slice(0, 5).join(', ');
                    setStatsPreview({ visible: true, type: 'countries', title: 'Countries Explored', value: String(uniqueCountries), description: countriesList || 'None yet', icon: 'globe-outline', color: '#3B82F6' });
                  }}
                  style={({ pressed }) => ({ 
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    alignItems: 'center',
                    minWidth: 80,
                    borderWidth: 1,
                    borderColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <View style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    backgroundColor: 'rgba(59,130,246,0.2)',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 6,
                  }}>
                    <Ionicons name="globe-outline" size={16} color="#3B82F6" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{uniqueCountries}</Text>
                  <Text style={{ fontSize: 10, color: colors.subtext, marginTop: 2 }}>Countries</Text>
                </Pressable>
              </ScrollView>
            </Reanimated.View>

            {/* Empty State */}
            {!loading && posts.length === 0 && (
              <Reanimated.View entering={FadeIn.delay(300).duration(500)} style={{ alignItems: 'center', paddingVertical: 40 }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Ionicons name="compass-outline" size={40} color={colors.subtext} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 }}>No check-ins yet</Text>
                <Text style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', maxWidth: 260 }}>
                  Start exploring and sharing your favorite places with the world!
                </Text>
                <Pressable 
                  onPress={() => router.push('/explore/create_story')}
                  style={({ pressed }) => ({
                    marginTop: 20,
                    backgroundColor: VELT_ACCENT,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 25,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Check-in</Text>
                </Pressable>
              </Reanimated.View>
            )}
          </Reanimated.View>

      {/* Country selector removed — using map-based pins and search instead */}
      {selectedPlaceFilter ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ThemedText style={{ color: colors.subtext }}>Filter:</ThemedText>
          <TouchableOpacity style={[styles.countryPill, { borderColor: colors.accent, backgroundColor: colors.card }]} onPress={() => { setSelectedPlaceFilter(null); }}>
            <ThemedText style={{ fontWeight: '700' }}>{selectedPlaceFilter}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedPlaceFilter(null)} style={{ marginLeft: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <ThemedText style={{ color: '#FF4D4F', fontWeight: '700' }}>Clear</ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* country explorer removed */}

      {/* Search modal - full integration to search local posts and remote DB */}
      <Modal visible={searchVisible} transparent animationType="fade" onRequestClose={() => setSearchVisible(false)}>
        <BlurView intensity={25} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable onPress={() => setSearchVisible(false)} style={{ flex: 1, backgroundColor: colors.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }} />
        </BlurView>
        
        <Animated.View style={{ 
          position: 'absolute',
          top: 80,
          left: 16,
          right: 16,
          borderRadius: 20,
          overflow: 'hidden',
          maxHeight: 520,
        }}>
          <BlurView intensity={80} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? 'rgba(20,20,25,0.88)' : 'rgba(255,255,255,0.92)' }]} />
          </BlurView>
          
          <Pressable style={{ padding: 16 }} onPress={() => {}}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderRadius: 14,
              paddingHorizontal: 14,
            }}>
              <Ionicons name="search" size={18} color={colors.subtext} style={{ marginRight: 10 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search your check-ins..."
                placeholderTextColor={colors.subtext}
                autoFocus
                style={{ 
                  flex: 1,
                  paddingVertical: 14, 
                  color: colors.text,
                  fontSize: 15,
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable 
                  onPress={() => setSearchQuery('')}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons name="close-circle" size={18} color={colors.subtext} />
                </Pressable>
              )}
            </View>

            {searchLoading ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator color={VELT_ACCENT} size="large" />
                <Text style={{ color: colors.subtext, marginTop: 12 }}>Searching...</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(it) => `${it.source}-${it.id}`}
                style={{ maxHeight: 380, marginTop: 12 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  searchQuery.length > 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <Ionicons name="search-outline" size={40} color={colors.subtext} />
                      <Text style={{ color: colors.subtext, marginTop: 12 }}>No results found</Text>
                    </View>
                  ) : null
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      try {
                        setSearchVisible(false);
                        Haptics.selectionAsync().catch(() => {});
                        // Always filter by place instead of navigating to a single post
                        // This shows all posts from the selected location
                        setSelectedPlaceFilter(item.label ?? null);
                        setSelectedCountry('All');
                      } catch (e) { console.warn('search select', e); }
                    }}
                    onLongPress={() => {
                      // Long press goes directly to the specific post
                      try {
                        setSearchVisible(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        prefetchLocationPosts(item.id).catch(() => {});
                        router.push(`/location/${item.id}`);
                      } catch (e) { console.warn('search long press', e); }
                    }}
                    style={({ pressed }) => ({ 
                      paddingVertical: 14, 
                      paddingHorizontal: 12, 
                      borderRadius: 12,
                      backgroundColor: pressed ? (colors.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent',
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      marginBottom: 4,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {/* Location icon */}
                      <View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: `${VELT_ACCENT}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="location" size={18} color={VELT_ACCENT} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{item.label}</Text>
                        {item.subtitle ? <Text style={{ color: colors.subtext, marginTop: 2, fontSize: 13 }} numberOfLines={1}>{item.subtitle}</Text> : null}
                      </View>
                      <View style={{ 
                        backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                      }}>
                        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: '600' }}>TAP TO FILTER</Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Animated.View>
      </Modal>

      <View style={styles.body}>
        {/* Zigzag Layout - matches home screen */}
        <View style={{ paddingHorizontal: 16, width: '100%' }}>
          {loading && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={VELT_ACCENT} size="large" />
            </View>
          )}
          
          {filtered.map((post, idx) => {
            // Zigzag: even rows = card LEFT, info RIGHT; odd rows = info LEFT, card RIGHT
            const cardOnLeft = idx % 2 === 0;
            const isStarred = !!starred[post.id];
            const cardWidth = Math.min(180, (width - 48) * 0.48);
            const cardHeight = 220;
            const infoWidth = Math.min(160, (width - 48) * 0.44);
            const hasVideo = (post.videos?.length ?? 0) > 0;
            const isStack = post.images.length > 1 || hasVideo;
            const primaryMediaUrl = hasVideo ? post.videos[0] : post.images[0];
            const primaryMediaType = hasVideo ? 'video' : 'image';

            // Get animation value for this card
            const cardAnim = getCardAnim(post.id);
            const cardScale = reduceMotion ? 1 : cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            });
            const cardOpacity = reduceMotion ? 1 : cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            });
            const cardTranslateY = reduceMotion ? 0 : cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            });

            return (
              <Animated.View
                key={post.id}
                style={{
                  opacity: cardOpacity,
                  transform: [
                    { scale: cardScale as any },
                    { translateY: cardTranslateY as any },
                  ],
                }}
              >
                <View 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 24,
                    paddingHorizontal: 4,
                  }}
                >
                  {/* Card on LEFT for even rows */}
                  {cardOnLeft && (
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        prefetchLocationPosts(post.id).catch(() => {});
                        try { router.push(`/location/${post.id}`); } catch {}
                      }}
                      onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        setHoverPopup({ visible: true, post });
                      }}
                      style={({ pressed }) => ({
                        width: cardWidth,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <View style={{ 
                        width: '100%', 
                        height: cardHeight, 
                        borderRadius: 18, 
                        overflow: 'hidden', 
                        backgroundColor: '#111',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.5,
                        shadowRadius: 16,
                        elevation: 10,
                      }}>
                        {/* Full-bleed media (video or image) */}
                        {primaryMediaType === 'video' ? (
                          <Video
                            source={{ uri: primaryMediaUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay
                            isLooping
                            isMuted
                          />
                        ) : (
                          <Image
                            source={{ uri: primaryMediaUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        )}
                        
                        {/* Stack indicator (multiple media) */}
                        {isStack && (
                          <View style={{ 
                            position: 'absolute', top: 10, left: 10,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                            flexDirection: 'row', alignItems: 'center',
                          }}>
                            <Ionicons name={hasVideo ? 'videocam' : 'layers'} size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{post.images.length + (post.videos?.length ?? 0)}</Text>
                          </View>
                        )}
                        
                        {/* Stars badge - display only (own posts can't be starred by self) */}
                        <View style={{
                          position: 'absolute', top: 10, right: 10,
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                        }}>
                          <Text style={{ color: '#fff', fontWeight: '800', marginRight: 5, fontSize: 14 }}>{post.stars ?? 0}</Text>
                          <Ionicons name="star" size={18} color="#f5c518" />
                        </View>
                        
                        {/* Gradient overlay */}
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.85)']}
                          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
                        />
                        
                        {/* Avatar at bottom center */}
                        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }}>
                          {post.avatar ? (
                            <Image source={{ uri: post.avatar }} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' }} />
                          ) : (
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                              <Ionicons name="person" size={14} color="#fff" />
                            </View>
                          )}
                        </View>
                        
                        {/* Delete button */}
                        <Pressable 
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                            setDeleteModal({ visible: true, post });
                          }}
                          style={({ pressed }) => ({
                            position: 'absolute',
                            left: 8,
                            bottom: 50,
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: 'rgba(255,59,48,0.8)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.7 : 1,
                          })}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={13} color="#fff" />
                        </Pressable>
                      </View>
                    </Pressable>
                  )}

                  {/* Info box - on RIGHT for even rows, on LEFT for odd rows */}
                  <View style={{ 
                    width: infoWidth, 
                    justifyContent: 'center',
                    paddingHorizontal: 8,
                  }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 6 }} numberOfLines={2}>
                      {post.place}
                    </Text>
                    {post.caption ? (
                      <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 8, lineHeight: 18 }} numberOfLines={3}>
                        {post.caption}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="time-outline" size={12} color={colors.subtext} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.subtext, fontSize: 11 }}>
                        {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Card on RIGHT for odd rows */}
                  {!cardOnLeft && (
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        prefetchLocationPosts(post.id).catch(() => {});
                        try { router.push(`/location/${post.id}`); } catch {}
                      }}
                      onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        setHoverPopup({ visible: true, post });
                      }}
                      style={({ pressed }) => ({
                        width: cardWidth,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <View style={{ 
                        width: '100%', 
                        height: cardHeight, 
                        borderRadius: 18, 
                        overflow: 'hidden', 
                        backgroundColor: '#111',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.5,
                        shadowRadius: 16,
                        elevation: 10,
                      }}>
                        {/* Full-bleed media (video or image) */}
                        {primaryMediaType === 'video' ? (
                          <Video
                            source={{ uri: primaryMediaUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay
                            isLooping
                            isMuted
                          />
                        ) : (
                          <Image
                            source={{ uri: primaryMediaUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        )}
                        
                        {/* Stack indicator (multiple media) */}
                        {isStack && (
                          <View style={{ 
                            position: 'absolute', top: 10, left: 10,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                            flexDirection: 'row', alignItems: 'center',
                          }}>
                            <Ionicons name={hasVideo ? 'videocam' : 'layers'} size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{post.images.length + (post.videos?.length ?? 0)}</Text>
                          </View>
                        )}
                        
                        {/* Stars badge - display only (own posts can't be starred by self) */}
                        <View style={{
                          position: 'absolute', top: 10, right: 10,
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                        }}>
                          <Text style={{ color: '#fff', fontWeight: '800', marginRight: 5, fontSize: 14 }}>{post.stars ?? 0}</Text>
                          <Ionicons name="star" size={18} color="#f5c518" />
                        </View>
                        
                        {/* Gradient overlay */}
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.85)']}
                          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
                        />
                        
                        {/* Avatar at bottom center */}
                        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }}>
                          {post.avatar ? (
                            <Image source={{ uri: post.avatar }} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' }} />
                          ) : (
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                              <Ionicons name="person" size={14} color="#fff" />
                            </View>
                          )}
                        </View>
                        
                        {/* Delete button */}
                        <Pressable 
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                            setDeleteModal({ visible: true, post });
                          }}
                          style={({ pressed }) => ({
                            position: 'absolute',
                            right: 8,
                            bottom: 50,
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: 'rgba(255,59,48,0.8)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.7 : 1,
                          })}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={13} color="#fff" />
                        </Pressable>
                      </View>
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </View>
      </View>

      </ScrollView>

      {/* long-press popup - personalized for user's own check-ins */}
      <Modal visible={hoverPopup.visible} transparent animationType="fade" onRequestClose={() => setHoverPopup({ visible: false, post: null })}>
        <BlurView intensity={40} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setHoverPopup({ visible: false, post: null }); }} 
            style={{ flex: 1, backgroundColor: colors.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View style={{ 
              width: Math.min(380, width - 48), 
              borderRadius: 24, 
              overflow: 'hidden',
            }}>
              <BlurView intensity={80} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? 'rgba(20,20,25,0.88)' : 'rgba(255,255,255,0.92)' }]} />
              </BlurView>
              
              <View style={{ padding: 20, alignItems: 'center' }}>
                {/* Memory icon */}
                <View style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 28, 
                  backgroundColor: colors.isDark ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.1)', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  marginBottom: 14,
                }}>
                  <Ionicons name="heart" size={28} color={VELT_ACCENT} />
                </View>
                
                <Text style={{ fontSize: 12, color: colors.subtext, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Your Memory At</Text>
                <ThemedText style={{ fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' }}>{hoverPopup.post?.place ?? ''}</ThemedText>
                {hoverPopup.post?.caption ? (
                  <ThemedText style={{ color: colors.subtext, marginBottom: 10, textAlign: 'center', fontSize: 14 }}>{hoverPopup.post?.caption}</ThemedText>
                ) : null}
                
                <ThemedText style={{ color: colors.subtext, fontSize: 12, marginBottom: 14 }}>
                  Checked in on {hoverPopup.post?.created_at ? new Date(hoverPopup.post.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </ThemedText>
                
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    backgroundColor: colors.isDark ? 'rgba(255,215,0,0.12)' : 'rgba(255,215,0,0.15)',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                  }}>
                    <Ionicons name="star" size={14} color="#f5c518" style={{ marginRight: 6 }} />
                    <ThemedText style={{ fontWeight: '700' }}>{hoverPopup.post?.stars ?? 0} Stars</ThemedText>
                  </View>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                  }}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.subtext} style={{ marginRight: 6 }} />
                    <ThemedText style={{ fontWeight: '700' }}>{(hoverPopup.post?.comments?.length ?? 0)}</ThemedText>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                  <Pressable
                    onPress={() => {
                      setHoverPopup({ visible: false, post: null });
                      if (hoverPopup.post) {
                        prefetchLocationPosts(hoverPopup.post.id).catch(() => {});
                        router.push(`/location/${hoverPopup.post.id}`);
                      }
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: VELT_ACCENT,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>View Details</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setHoverPopup({ visible: false, post: null });
                      if (hoverPopup.post) {
                        setDeleteModal({ visible: true, post: hoverPopup.post });
                      }
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,59,48,0.12)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,59,48,0.3)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </Pressable>
        </BlurView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModal.visible} transparent animationType="fade" onRequestClose={() => setDeleteModal({ visible: false, post: null })}>
        <BlurView intensity={50} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable 
            onPress={() => !deleting && setDeleteModal({ visible: false, post: null })} 
            style={{ flex: 1, backgroundColor: colors.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Pressable onPress={() => {}} style={{ width: Math.min(340, width - 48) }}>
              <Animated.View style={{ 
                borderRadius: 24, 
                overflow: 'hidden',
              }}>
                <BlurView intensity={90} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? 'rgba(20,20,25,0.92)' : 'rgba(255,255,255,0.95)' }]} />
                </BlurView>
                
                <View style={{ padding: 24, alignItems: 'center' }}>
                  {/* Warning Icon */}
                  <View style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: 32, 
                    backgroundColor: 'rgba(255,59,48,0.15)', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    marginBottom: 16,
                  }}>
                    <Ionicons name="warning" size={32} color="#FF3B30" />
                  </View>
                  
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' }}>Delete Check-in?</Text>
                  <Text style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', marginBottom: 8 }}>
                    Are you sure you want to delete your check-in at
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' }}>
                    "{deleteModal.post?.place ?? ''}"?
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.subtext, textAlign: 'center', marginBottom: 20 }}>
                    This action cannot be undone. All stars and comments on this check-in will also be removed.
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                    <Pressable
                      onPress={() => setDeleteModal({ visible: false, post: null })}
                      disabled={deleting}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        opacity: deleting ? 0.5 : pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteModal.post && handleDeletePost(deleteModal.post.id)}
                      disabled={deleting}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: '#FF3B30',
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: deleting ? 0.7 : pressed ? 0.8 : 1,
                      })}
                    >
                      {deleting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="trash" size={16} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Delete</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            </Pressable>
          </Pressable>
        </BlurView>
      </Modal>

      {/* viewer page moved to app/location/[id].tsx */}

      {/* Stats Preview Modal - Custom Card */}
      <Modal visible={!!statsPreview?.visible} transparent animationType="fade" onRequestClose={() => setStatsPreview(null)}>
        <BlurView intensity={60} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setStatsPreview(null); }} 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
          >
            <Pressable 
              onPress={(e) => e.stopPropagation()}
              style={{ 
                width: '100%',
                maxWidth: 320,
                borderRadius: 24, 
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 20 },
                shadowOpacity: 0.35,
                shadowRadius: 30,
                elevation: 24,
              }}
            >
              <LinearGradient
                colors={colors.isDark 
                  ? ['rgba(35,35,50,0.98)', 'rgba(25,25,40,0.98)']
                  : ['rgba(255,255,255,0.99)', 'rgba(248,250,252,0.99)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ padding: 28 }}
              >
                {/* Close button */}
                <Pressable 
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setStatsPreview(null); }}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="close" size={18} color={colors.subtext} />
                </Pressable>

                {/* Icon with accent background */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: 36,
                    backgroundColor: `${statsPreview?.color ?? VELT_ACCENT}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4,
                  }}>
                    {statsPreview?.icon === 'map-marker-multiple' ? (
                      <MaterialCommunityIcons name="map-marker-multiple" size={32} color={statsPreview?.color ?? VELT_ACCENT} />
                    ) : (
                      <Ionicons name={(statsPreview?.icon ?? 'star') as any} size={32} color={statsPreview?.color ?? VELT_ACCENT} />
                    )}
                  </View>
                </View>

                {/* Title */}
                <Text style={{ 
                  fontSize: 16, 
                  fontWeight: '600', 
                  color: colors.subtext, 
                  textAlign: 'center',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  {statsPreview?.title}
                </Text>

                {/* Value */}
                <Text style={{ 
                  fontSize: 48, 
                  fontWeight: '800', 
                  color: colors.text, 
                  textAlign: 'center',
                  marginBottom: 12,
                }}>
                  {statsPreview?.value}
                </Text>

                {/* Description */}
                <Text style={{ 
                  fontSize: 14, 
                  color: colors.subtext, 
                  textAlign: 'center',
                  lineHeight: 20,
                }}>
                  {statsPreview?.description}
                </Text>

                {/* Decorative accent bar */}
                <View style={{ 
                  marginTop: 24, 
                  height: 4, 
                  borderRadius: 2,
                  backgroundColor: `${statsPreview?.color ?? VELT_ACCENT}30`,
                  overflow: 'hidden',
                }}>
                  <View style={{ 
                    width: '60%', 
                    height: '100%', 
                    backgroundColor: statsPreview?.color ?? VELT_ACCENT,
                    borderRadius: 2,
                  }} />
                </View>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </BlurView>
      </Modal>

      </SafeAreaView>
    </View>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  body: { alignItems: 'center', paddingTop: 8, flex: 1 },
  // don't clip child elements so expanded branch cards / avatars and ropes can overflow
  // alignItems/justifyContent moved to ScrollView.contentContainerStyle to avoid
  // ScrollView invariant that disallows layout props on the root style.
  phoneFrame: { overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  countryPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  // allow visible overflow so avatar (which sits outside the card bounds) can render above
  // Enhanced with larger border radius and strong shadow - matches home screen All Stories style
  postCard: { position: 'absolute', borderRadius: 18, borderWidth: 0, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  // bring action pills to the front so they are always tappable and visible
  starPill: { position: 'absolute', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, zIndex: 9999, elevation: 50 },
  stackContainer: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stackInner: { width: 158, height: 200, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  stackImg: { width: 158, height: 200, borderRadius: 14, borderWidth: 0, borderColor: '#000' },
  stackImgAbsolute: { position: 'absolute', width: 158, height: 200, borderRadius: 14, borderWidth: 0, borderColor: '#000' },
  infoBox: { position: 'absolute', padding: 14, borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  avatarWrap: { position: 'absolute', left: 0, right: 0, bottom: -10, alignItems: 'center', zIndex: 99, elevation: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, overflow: 'hidden' },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'flex-end' },
  viewerCard: { width: Dimensions.get('window').width, height: Dimensions.get('window').height - 120, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height - 220 },
});
