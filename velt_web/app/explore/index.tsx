import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Image, Animated, AccessibilityInfo, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ViewToken } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import * as Haptics from "expo-haptics";
import { Video, ResizeMode } from "expo-av";
import { useTheme, VELT_ACCENT } from "app/themes";

import { supabase } from "@/lib/supabase";

type StorySearchRow = {
  id: string;
  caption?: string | null;
  media_url?: string | null;
  media_urls?: string[] | string | null;
  media_type?: string | null;
  created_at?: string | null;
  profiles?: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
  story_likes?: { count: number }[] | null;
  like_count?: number | null;
};

type ProfileSearchRow = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  follower_count?: number | null;
};

type TrendingStoryRow = {
  id: string;
  caption?: string | null;
  media_url?: string | null;
  media_urls?: string[] | string | null;
  media_type?: string | null;
  created_at?: string | null;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  like_count?: number | null;
};

type RecentChip = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type SuggestionRow = {
  id: string;
  title: string;
  subtitle: string;
  dotColor: string;
  kind: "account" | "content";
  thumbUri?: string | null;
  avatarUri?: string | null;
  isHighlighted?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  storyId?: string;
  businessStoryId?: string;
  sourceType?: "story" | "business";
  mediaType?: string | null;
  likeCount?: number;
};

const BRAND_ACCENT = VELT_ACCENT;
const deriveMediaUrl = (row: { media_url?: string | null; media_urls?: string[] | string | null }): string | null => {
  if (row?.media_url) return row.media_url;
  if (Array.isArray(row?.media_urls) && row.media_urls.length) return row.media_urls[0];
  if (typeof row?.media_urls === "string" && row.media_urls.trim()) {
    try {
      const parsed = JSON.parse(row.media_urls);
      if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === "string") return parsed[0];
    } catch {}
  }
  return null;
};

const formatHandle = (username?: string | null) => {
  if (!username) return "@unknown";
  const cleaned = username.startsWith("@") ? username.slice(1) : username;
  return `@${cleaned}`;
};

const getInitials = (fullName?: string | null, username?: string | null) => {
  const source = fullName?.trim() || username?.trim() || "?";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join("")
    .padEnd(2, "");
};

const normalizeSearchTerm = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutHandle = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return withoutHandle.replace(/[%_]/g, "");
};

const formatLikes = (count?: number | null) => {
  const safe = count ?? 0;
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return `${safe}`;
};

const extractLikeCount = (row: { like_count?: number | null; story_likes?: { count: number }[] | null }) => {
  if (typeof row.like_count === "number") return row.like_count;
  const nested = row.story_likes?.[0]?.count;
  return typeof nested === "number" ? nested : 0;
};

const formatFollowerCount = (count?: number | null) => {
  const safe = typeof count === "number" && count >= 0 ? count : 0;
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return `${safe}`;
};

const formatAgo = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return "Just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
};

const ExploreSearchScreen = () => {
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();

  const palette = useMemo(
    () => ({
      background: colors?.bg ?? "#0f172a",
      text: colors?.text ?? "#f8fafc",
      subtext: colors?.subtext ?? "rgba(148,163,184,0.8)",
      border: colors?.border ?? "rgba(148,163,184,0.3)",
      inputBg: colors?.card ?? "#1e293b",
      accent: colors?.accent ?? BRAND_ACCENT,
      faint: colors?.faint ?? "rgba(230,0,80,0.08)",
    }),
    [colors]
  );

  const [query, setQuery] = useState("");
  const [storyResults, setStoryResults] = useState<StorySearchRow[]>([]);
  const [accountResults, setAccountResults] = useState<ProfileSearchRow[]>([]);
  const [trendingRows, setTrendingRows] = useState<SuggestionRow[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentChips, setRecentChips] = useState<RecentChip[]>([]);
  const [refreshWave, setRefreshWave] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 65 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const ids = viewableItems
      .map((entry) => (entry?.item as SuggestionRow | undefined)?.id)
      .filter((val): val is string => Boolean(val));
    setVisibleIds(new Set(ids));
  });

  const handleChipSelect = useCallback((label: string) => {
    Haptics.selectionAsync().catch(() => {});
    setQuery(label);
  }, []);

  const handleChipRemove = useCallback((chipId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setRecentChips((prev) => prev.filter((chip) => chip.id !== chipId));
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshWave((prev) => prev + 1);
  }, []);

  const handleOpenAI = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    try {
      router.push("/aisearch");
    } catch {}
  }, [router]);

  // Doodle background for Explore search (deep, theme-linked, no fade-out)
  const [reduceMotion, setReduceMotion] = useState(false);
  const doodleA = useRef(new Animated.Value(0)).current;
  const doodleB = useRef(new Animated.Value(0)).current;
  const doodleC = useRef(new Animated.Value(0)).current;
  const doodleAnimRef = useRef<any>(null);
  // Explore should animate doodles regardless of the user's doodle toggle — only honor reduced-motion

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((isReduced) => {
        setReduceMotion(isReduced);
        if (!isReduced) {
          // don't auto-start here; control start/stop via feature flag effect
          // Animated.loop(
            Animated.parallel([
              Animated.sequence([
                Animated.timing(doodleA, { toValue: 1, duration: 7200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(doodleA, { toValue: 0, duration: 7200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              ]),
              Animated.sequence([
                Animated.delay(300),
                Animated.timing(doodleB, { toValue: 1, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(doodleB, { toValue: 0, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              ]),
              Animated.sequence([
                Animated.delay(700),
                Animated.timing(doodleC, { toValue: 1, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(doodleC, { toValue: 0, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              ]),
            ])
          // ).start();
        }
      })
      .catch(() => setReduceMotion(false));
  }, [doodleA, doodleB, doodleC]);


  useEffect(() => {
    try {
      const willAnimate = !reduceMotion;
      if (!doodleAnimRef.current) {
        doodleAnimRef.current = Animated.loop(
          Animated.parallel([
            Animated.sequence([Animated.timing(doodleA, { toValue: 1, duration: 7200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleA, { toValue: 0, duration: 7200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
            Animated.sequence([Animated.delay(300), Animated.timing(doodleB, { toValue: 1, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleB, { toValue: 0, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
            Animated.sequence([Animated.delay(700), Animated.timing(doodleC, { toValue: 1, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleC, { toValue: 0, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
          ])
        );
      }

      if (willAnimate) { try { doodleAnimRef.current.start(); } catch {} }
      else { try { doodleAnimRef.current.stop?.(); } catch {} try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {} }
    } catch (e) {}
    return () => { try { doodleAnimRef.current?.stop?.(); } catch {} };
  }, [doodleA, doodleB, doodleC, reduceMotion]);

  const showAnimatedDoodles = !reduceMotion;
  const showStaticDoodles = reduceMotion;

  // NOTE: animation loop started/stopped above in the previous effect — no duplicate needed here.

  const fetchTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const { data, error: supaError } = await supabase
        .from("trending_stories")
        .select("id, caption, media_url, media_urls, media_type, created_at, full_name, username, avatar_url, like_count")
        .limit(12);
      if (supaError) throw supaError;
      const mapped = (data || []).map((row, index) => {
        const displayName = row.full_name?.trim() || row.username || "Creator";
        const handle = formatHandle(row.username);
        const likeCount = extractLikeCount(row);
        return {
          id: `trending-${row.id}`,
          title: row.caption?.trim() || `Story by ${displayName}`,
          subtitle: `${handle}${row.created_at ? ` • ${formatAgo(row.created_at)}` : ""}`,
          dotColor: palette.accent,
          kind: "content" as const,
          thumbUri: deriveMediaUrl(row),
          isHighlighted: index === 0,
          icon: "flame-outline",
          storyId: row.id,
          sourceType: "story" as const,
          mediaType: row.media_type ?? null,
          likeCount,
        } satisfies SuggestionRow;
      });
      setTrendingRows(mapped);
    } catch (err) {
      console.warn("trending fetch failed", err);
      setTrendingRows([]);
    } finally {
      setTrendingLoading(false);
    }
  }, [palette.accent]);

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setStoryResults([]);
      setAccountResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizeSearchTerm(trimmed);
      const fuzzyPattern = `%${normalized || trimmed}%`;
      const lowered = (normalized || trimmed).toLowerCase();

      const storiesPromise = supabase
        .from("stories")
        .select(
          "id, caption, media_url, media_urls, media_type, created_at, profiles:profiles!stories_user_id_fkey(full_name, username, avatar_url), story_likes(count)"
        )
        .eq("is_deleted", false)
        .ilike("caption", fuzzyPattern)
        .order("created_at", { ascending: false })
        .limit(60);

      const accountsPromise = supabase
        .from("profile_search_stats")
        .select("id, full_name, username, avatar_url, bio, follower_count")
        .or(`full_name.ilike.${fuzzyPattern},username.ilike.${fuzzyPattern}`)
        .order("full_name", { ascending: true })
        .limit(30);

      const [storyRes, accountRes] = await Promise.all([storiesPromise, accountsPromise]);

      if (storyRes.error) throw storyRes.error;
      if (accountRes.error) throw accountRes.error;

      const storyRows = (storyRes.data || []) as StorySearchRow[];
      const filteredStories = storyRows.filter((row) => {
        const caption = row.caption?.toLowerCase() || "";
        const fullName = row.profiles?.full_name?.toLowerCase() || "";
        const username = row.profiles?.username?.toLowerCase() || "";
        const target = lowered;
        if (!target) return true;
        return caption.includes(target) || fullName.includes(target) || username.includes(target);
      });
      const withMedia = filteredStories.filter((row) => Boolean(deriveMediaUrl(row)));
      const matchingAccounts = (accountRes.data || []) as ProfileSearchRow[];
      setRecentChips((prev) => {
        const filtered = prev.filter((chip) => chip.label.toLowerCase() !== trimmed.toLowerCase());
        const icon = trimmed.startsWith("@") ? "person-circle-outline" : "search-outline";
        const newChip: RecentChip = { id: `chip-${Date.now()}`, label: trimmed, icon };
        return [newChip, ...filtered].slice(0, 6);
      });
      setStoryResults(withMedia);
      setAccountResults(matchingAccounts);
      setError(null);
    } catch {
      setStoryResults([]);
      setAccountResults([]);
      setError("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!query.trim()) {
      setStoryResults([]);
      setAccountResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, runSearch]);

  useEffect(() => {
    fetchTrending().catch(() => {});
  }, [fetchTrending]);

  const handleOpenStory = useCallback(
    (payload: { storyId?: string | null; businessStoryId?: string | null }) => {
      const params: Record<string, string> = {};
      if (payload.storyId) params.storyId = payload.storyId;
      if (payload.businessStoryId) params.businessStoryId = payload.businessStoryId;
      if (!params.storyId && !params.businessStoryId) return;
      try {
        router.push({ pathname: "/story/preview", params } as any);
      } catch {}
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: SuggestionRow }) => {
      const isContent = item.kind === "content";
      const isVideoThumb = isContent && (item.mediaType?.toLowerCase().includes("video") ?? true);
      const shouldPlay = isContent && isVideoThumb && !!item.thumbUri && visibleIds.has(item.id);
      const initials = getInitials(item.title, item.subtitle);

      const handlePress = () => {
        Haptics.selectionAsync().catch(() => {});
        if (isContent && (item.storyId || item.businessStoryId)) {
          handleOpenStory({ storyId: item.storyId, businessStoryId: item.businessStoryId });
        }
      };

      const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      };

      return (
        <TouchableOpacity
          style={[
            styles.suggestionRow,
            item.isHighlighted && [styles.rowHighlight, { backgroundColor: palette.faint }],
          ]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          activeOpacity={0.9}
        >
          <View style={[styles.statusDot, { backgroundColor: item.isHighlighted ? palette.accent : item.dotColor }]} />
          <View style={styles.rowTextBlock}>
            <View style={styles.rowTitleLine}>
              {item.icon ? (
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={item.isHighlighted ? palette.accent : palette.subtext}
                  style={{ marginRight: 6 }}
                />
              ) : null}
              <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <Text style={[styles.rowSubtitle, { color: palette.subtext }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
            {isContent && typeof item.likeCount === "number" ? (
              <View style={styles.rowMetaLine}>
                <View style={[styles.likePill, { backgroundColor: palette.faint }]}> 
                  <Ionicons name="heart" size={12} color={palette.accent} style={{ marginRight: 4 }} />
                  <Text style={[styles.likePillText, { color: palette.text }]}>{formatLikes(item.likeCount)} likes</Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={[styles.thumbnailShell, isContent ? styles.contentThumb : styles.accountThumb]}>
            {isContent ? (
              item.thumbUri ? (
                isVideoThumb ? (
                  <>
                    <Video
                      source={{ uri: item.thumbUri }}
                      style={styles.videoThumb}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={shouldPlay}
                      isLooping
                      isMuted
                    />
                    <View style={styles.thumbBadge}>
                      <Ionicons name="play" size={12} color="#f8fafc" />
                    </View>
                  </>
                ) : (
                  <Image source={{ uri: item.thumbUri }} style={styles.videoThumb} />
                )
              ) : (
                <Ionicons name="image-outline" size={20} color={palette.subtext} />
              )
            ) : item.avatarUri ? (
              <Image source={{ uri: item.avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.thumbInitials, { color: palette.text }]}>{initials}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleOpenStory, palette.accent, palette.faint, palette.subtext, palette.text, visibleIds]
  );

  const trimmedQuery = query.trim();
  const accountFocus = trimmedQuery.startsWith("@");

  const decoratedStories = useMemo<SuggestionRow[]>(() => {
    if (!storyResults.length) return [];
    return storyResults.map((row, index) => {
      const displayName = row.profiles?.full_name?.trim() || "Someone on Velt";
      const handle = formatHandle(row.profiles?.username);
      const caption = row.caption?.trim() || `Story by ${displayName}`;
      const likeCount = extractLikeCount(row);
      return {
        id: `story-${row.id}`,
        title: caption,
        subtitle: `${handle}${row.created_at ? ` • ${formatAgo(row.created_at)}` : ""}`,
        dotColor: index === 0 ? palette.accent : palette.subtext,
        kind: "content",
        thumbUri: deriveMediaUrl(row),
        isHighlighted: index === 0,
        icon: "play-circle-outline",
        storyId: row.id,
        sourceType: "story",
        mediaType: row.media_type ?? null,
        likeCount,
      } satisfies SuggestionRow;
    });
  }, [storyResults, palette.accent, palette.subtext]);

  const decoratedAccounts = useMemo<SuggestionRow[]>(() => {
    if (!accountResults.length) return [];
    return accountResults.map((profile, index) => {
      const handle = formatHandle(profile.username);
      const displayName = profile.full_name?.trim() || handle || "@member";
      const followerCopy = `${formatFollowerCount(profile.follower_count)} followers`;
      return {
        id: `account-${profile.id}`,
        title: displayName,
        subtitle: `${handle || "@unknown"} • ${followerCopy}`,
        dotColor: index === 0 ? palette.accent : palette.subtext,
        kind: "account",
        avatarUri: profile.avatar_url ?? undefined,
        isHighlighted: index === 0,
        icon: "person-circle-outline",
      };
    });
  }, [accountResults, palette.accent, palette.subtext]);

  const combinedRows = useMemo<SuggestionRow[]>(() => {
    if (!trimmedQuery) {
      return trendingRows.length ? trendingRows : [];
    }
    if (!decoratedStories.length && !decoratedAccounts.length) return [];
    return accountFocus ? [...decoratedAccounts, ...decoratedStories] : [...decoratedStories, ...decoratedAccounts];
  }, [decoratedStories, decoratedAccounts, accountFocus, trendingRows, trimmedQuery]);

  const baseRows: SuggestionRow[] = combinedRows.length ? combinedRows : trendingRows.length ? trendingRows : [];

  const suggestionRows = useMemo<SuggestionRow[]>(() => {
    if (!baseRows.length) return [];
    const shift = baseRows.length ? refreshWave % baseRows.length : 0;
    const rotated = [...baseRows.slice(shift), ...baseRows.slice(0, shift)];
    return rotated.map((row, index) => ({ ...row, isHighlighted: index === 0 }));
  }, [baseRows, refreshWave]);

  const totalMatches = storyResults.length + accountResults.length;
  const searchMetaCopy = trimmedQuery
    ? totalMatches
      ? `${totalMatches} ${totalMatches === 1 ? "match" : "matches"} for "${trimmedQuery}"`
      : `No matches for "${trimmedQuery}" yet`
    : trendingRows.length
    ? "Trending picks are ranked by total likes."
    : "Videos loop silently so you can skim faster.";

  const sectionTitle = trimmedQuery ? "Search results" : trendingRows.length ? "Trending on VELT" : "Browse";

  const listHeader = (
    <View style={styles.listHeader}>
      {recentChips.length ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.chipLabel, { color: palette.subtext }]}>Recent searches</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {recentChips.map((chip) => (
              <View key={chip.id} style={[styles.chip, { borderColor: palette.border, backgroundColor: palette.inputBg }]}> 
                <TouchableOpacity style={styles.chipBody} onPress={() => handleChipSelect(chip.label)}>
                  <Ionicons name={chip.icon} size={14} color={palette.subtext} style={{ marginRight: 6 }} />
                  <Text style={[styles.chipText, { color: palette.text }]} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleChipRemove(chip.id)}>
                  <Ionicons name="close" size={14} color={palette.subtext} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {!trimmedQuery && trendingLoading ? (
        <View style={[styles.loadingBanner, { borderColor: palette.border, backgroundColor: palette.inputBg, marginBottom: 12 }]}> 
          <ActivityIndicator color={palette.accent} size="small" />
          <Text style={[styles.loadingText, { color: palette.subtext }]}>Ranking stories by likes…</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={[styles.loadingBanner, { borderColor: palette.border, backgroundColor: palette.inputBg, marginBottom: 12 }]}> 
          <ActivityIndicator color={palette.accent} size="small" />
          <Text style={[styles.loadingText, { color: palette.subtext }]}>One sec — surfacing matches…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.errorBanner, { borderColor: palette.border, backgroundColor: palette.inputBg, marginBottom: 12 }]}> 
          <Ionicons name="alert-circle" size={16} color={palette.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.errorText, { color: palette.text }]}>Search failed. Please try again.</Text>
        </View>
      ) : null}
      <View style={[styles.sectionHeader, { marginBottom: 4 }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{sectionTitle}</Text>
        <TouchableOpacity style={[styles.refreshButton, { borderColor: palette.border }]} onPress={handleRefresh}>
          <Ionicons name="refresh" size={16} color={palette.text} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.searchMeta, { color: palette.subtext }]}>{searchMetaCopy}</Text>
    </View>
  );

  const listFooter = suggestionRows.length ? (
    <TouchableOpacity style={styles.footerLink} onPress={handleRefresh}>
      <Text style={[styles.footerText, { color: palette.accent }]}>Rotate list</Text>
      <Ionicons name="chevron-forward" size={16} color={palette.accent} />
    </TouchableOpacity>
  ) : null;

  const listEmptyComponent = (
    <View style={styles.emptyState}>
      {loading || trendingLoading ? (
        <ActivityIndicator color={palette.accent} size="small" />
      ) : (
        <>
          <Ionicons name="planet-outline" size={28} color={palette.subtext} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to show yet</Text>
          <Text style={[styles.emptySubtitle, { color: palette.subtext }]}>Try another keyword or come back later.</Text>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}> 
      {/* decorative doodles for explore search (theme-linked, deep & non-fading) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {showAnimatedDoodles ? (
          <>
            <Animated.View style={[styles.exploreDoodleLarge, { borderColor: palette.accent, opacity: 0.78, transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [-28, 40] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [-20, 72] }) }, { rotate: doodleA.interpolate({ inputRange: [0,1], outputRange: ['-6deg', '8deg'] }) }] }]} />
            <Animated.View style={[styles.exploreDoodleRight, { borderColor: palette.subtext, opacity: 0.6, transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [46, -34] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [8, -46] }) }, { rotate: doodleB.interpolate({ inputRange: [0,1], outputRange: ['6deg', '-10deg'] }) }] }]} />
            <Animated.View style={[styles.exploreDoodleLower, { borderColor: palette.faint || palette.accent, opacity: 0.66, transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [-36, 28] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [6, -36] }) }, { rotate: doodleC.interpolate({ inputRange: [0,1], outputRange: ['-10deg', '12deg'] }) }] }]} />
          </>
        ) : showStaticDoodles ? (
          <>
            <View style={[styles.exploreDoodleLarge, { borderColor: palette.accent, opacity: 0.64 }]} />
            <View style={[styles.exploreDoodleRight, { borderColor: palette.subtext, opacity: 0.5 }]} />
            <View style={[styles.exploreDoodleLower, { borderColor: palette.faint || palette.accent, opacity: 0.6 }]} />
          </>
        ) : null}
      </View>
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}> 
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <View style={[styles.searchFieldWrap, { backgroundColor: palette.inputBg }]}>
          <Ionicons name="search" size={16} color={palette.subtext} style={{ marginRight: 6 }} />
          <TextInput
            placeholder="Search videos, accounts, sounds…"
            placeholderTextColor={palette.subtext}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchField, { color: palette.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
          />
          <TouchableOpacity style={[styles.aiButton, { backgroundColor: palette.accent }]} onPress={handleOpenAI} activeOpacity={0.9}>
            <Ionicons name="sparkles" size={14} color="#0f172a" style={{ marginRight: 4 }} />
            <Text style={styles.aiButtonLabel}>AI</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => runSearch(query)}>
          <Text style={[styles.searchAction, { color: palette.accent }]}>Search</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={suggestionRows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={[styles.rowDivider, { backgroundColor: palette.border }]} />}
        ListHeaderComponent={() => listHeader}
        ListFooterComponent={() => listFooter}
        ListEmptyComponent={() => listEmptyComponent}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48 }}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
};

export default ExploreSearchScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 6,
  },
  searchFieldWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchField: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 8,
  },
  aiButtonLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  searchAction: {
    fontWeight: "700",
    fontSize: 14,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listHeader: {
    paddingTop: 18,
    paddingBottom: 12,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  chipRow: {
    paddingRight: 16,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 6,
  },
  chipBody: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    maxWidth: 160,
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  refreshButton: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchMeta: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  rowHighlight: {
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  rowTextBlock: {
    flex: 1,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  likePill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  likePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  thumbnailShell: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.2)",
  },
  contentThumb: {
    borderRadius: 12,
  },
  accountThumb: {
    borderRadius: 28,
  },
  videoThumb: {
    width: "100%",
    height: "100%",
  },
  thumbBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    padding: 4,
  },
  thumbInitials: {
    fontSize: 14,
    fontWeight: "700",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 22,
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  // explore doodles (deep and theme-linked)
  exploreDoodleLarge: {
    position: 'absolute',
    left: -40,
    top: -36,
    width: 520,
    height: 520,
    borderRadius: 300,
    borderWidth: 6.2,
    borderStyle: 'solid',
  },
  exploreDoodleRight: {
    position: 'absolute',
    right: -64,
    top: 24,
    width: 360,
    height: 360,
    borderRadius: 220,
    borderWidth: 5.2,
    borderStyle: 'solid',
  },
  exploreDoodleLower: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 120,
    height: 160,
    borderRadius: 120,
    borderWidth: 6.0,
    borderStyle: 'solid',
  },
});
