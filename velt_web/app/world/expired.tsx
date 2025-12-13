import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { Ionicons, Feather } from "@expo/vector-icons";
import { Video } from "expo-av";
import { PinchGestureHandler, State as GestureState } from "react-native-gesture-handler";

import { useTheme } from "app/themes";
import { supabase } from "@/lib/supabase";

type VideoInstance = InstanceType<typeof Video>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GRID_PADDING = 12;
const GRID_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;
const CARD_MEDIA_HEIGHT = CARD_WIDTH * 1.15;
const EXPIRED_CACHE_KEY = "velt:expiredStoriesCache:v1";
const EXPIRED_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

const buildMediaType = (value?: string | null) => {
  if (!value) return "image";
  return value.toLowerCase().startsWith("video") ? "video" : "image";
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
};

type ExpiredStory = {
  id: string;
  user_id: string;
  media_url?: string | null;
  media_type?: string | null;
  created_at?: string | null;
  expire_at?: string | null;
  revived_at?: string | null;
  likes: number;
  comments: number;
  views: number;
  table?: string;
  isHD?: boolean;
};

type TrendDirection = "up" | "down" | "flat";
type TrendSummary = { direction: TrendDirection; percent: number; delta: number };

const StoryMedia: React.FC<{ story: ExpiredStory; isActive: boolean }> = ({ story, isActive }) => {
  const videoRef = useRef<VideoInstance | null>(null);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const [isPlaying, setIsPlaying] = useState(isActive);

  useEffect(() => {
    setIsPlaying(isActive);
  }, [isActive]);

  useEffect(() => {
    if (story.media_type !== "video") return;
    (async () => {
      try {
        if (isPlaying) {
          await videoRef.current?.playAsync();
        } else {
          await videoRef.current?.pauseAsync();
        }
      } catch (error) {}
    })();
  }, [isPlaying, story.media_type]);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true });

  const handlePinchStateChange = (event: any) => {
    if (event.nativeEvent.state === GestureState.END || event.nativeEvent.state === GestureState.CANCELLED) {
      Animated.spring(baseScale, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start(() => {
        pinchScale.setValue(1);
      });
    }
  };

  const togglePlayback = useCallback(async () => {
    if (story.media_type !== "video") return;
    try {
      if (isPlaying) {
        await videoRef.current?.pauseAsync();
        setIsPlaying(false);
      } else {
        await videoRef.current?.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {}
  }, [isPlaying, story.media_type]);

  return (
    <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={handlePinchStateChange}>
      <Animated.View
        style={{
          width: SCREEN_WIDTH,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: Animated.multiply(baseScale, pinchScale) }],
        }}
      >
        {story.media_type === "video" ? (
          <>
            <Video
              ref={(node: VideoInstance | null) => {
                videoRef.current = node;
              }}
              source={{ uri: story.media_url ?? "" }}
              style={styles.viewerMedia}
              resizeMode="cover"
              shouldPlay={false}
              isLooping
              isMuted={false}
            />
            <TouchableOpacity style={styles.viewerPlayBtn} onPress={togglePlayback} activeOpacity={0.9}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
            </TouchableOpacity>
          </>
        ) : story.media_url ? (
          <Image source={{ uri: story.media_url }} style={styles.viewerMedia} resizeMode="cover" />
        ) : (
          <View style={[styles.viewerMedia, styles.viewerFallback]}>
            <Feather name="image" size={32} color="#ffffff" />
          </View>
        )}
      </Animated.View>
    </PinchGestureHandler>
  );
};

export default function ExpiredStoriesScreen() {
  const router = withSafeRouter(useRouter());
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = Boolean((theme as any)?.isDark);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stories, setStories] = useState<ExpiredStory[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "stories" | "commercials">("all");
  const [viewerStories, setViewerStories] = useState<ExpiredStory[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviveBusy, setReviveBusy] = useState(false);

  const viewerTranslateY = useRef(new Animated.Value(0)).current;
  const viewerOpacity = viewerTranslateY.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [0.2, 1, 0.2],
    extrapolate: "clamp",
  });
  const viewerScale = viewerTranslateY.interpolate({
    inputRange: [-250, 0, 250],
    outputRange: [0.95, 1, 0.95],
    extrapolate: "clamp",
  });

  const viewerListRef = useRef<FlatList<ExpiredStory> | null>(null);
  const filteredStories = useMemo(() => {
    if (activeTab === "all") return stories;
    if (activeTab === "stories") return stories.filter((s) => s.table !== "business_stories");
    return stories.filter((s) => s.table === "business_stories");
  }, [stories, activeTab]);

  const businessStories = useMemo(() => stories.filter((story) => story.table === "business_stories"), [stories]);

  const analytics = useMemo(() => {
    const sumBy = (data: ExpiredStory[], field: keyof ExpiredStory) =>
      data.reduce((total, story) => total + (Number(story[field]) || 0), 0);

    const computeTrend = (field: keyof ExpiredStory): TrendSummary => {
      const WINDOW = 5;
      const recent = businessStories.slice(0, WINDOW);
      const previous = businessStories.slice(WINDOW, WINDOW * 2);
      const currentValue = sumBy(recent, field);
      const previousValue = sumBy(previous, field);
      const delta = currentValue - previousValue;
      const percent = previousValue ? (delta / previousValue) * 100 : currentValue ? 100 : 0;
      let direction: TrendDirection = "flat";
      if (delta > 0.5) direction = "up";
      else if (delta < -0.5) direction = "down";
      return { direction, percent: Number(percent.toFixed(1)), delta };
    };

    const businessLikes = sumBy(businessStories, "likes");
    const businessComments = sumBy(businessStories, "comments");
    const businessViews = sumBy(businessStories, "views");

    return {
      totals: {
        archived: stories.length,
        businessCount: businessStories.length,
        businessLikes,
        businessComments,
        businessViews,
        businessShare: stories.length ? Math.round((businessStories.length / stories.length) * 100) : 0,
      },
      trends: {
        likes: computeTrend("likes"),
        comments: computeTrend("comments"),
        views: computeTrend("views"),
      },
    };
  }, [businessStories, stories]);

  const metricCards = useMemo(
    () => [
      { key: "likes", label: "Likes", value: analytics.totals.businessLikes, trend: analytics.trends.likes },
      { key: "comments", label: "Comments", value: analytics.totals.businessComments, trend: analytics.trends.comments },
      { key: "views", label: "Views", value: analytics.totals.businessViews, trend: analytics.trends.views },
    ],
    [analytics],
  );

  const formatCompactNumber = useCallback((value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return value.toString();
  }, []);

  const getTrendColor = useCallback(
    (direction: TrendDirection) => {
      if (direction === "up") return "#16a34a";
      if (direction === "down") return "#f97316";
      return colors.subtext;
    },
    [colors.subtext],
  );

  const getTrendLabel = useCallback((direction: TrendDirection) => {
    if (direction === "down") return "Drop";
    if (direction === "up") return "Growth";
    return "Flat";
  }, []);

  const viewerData = viewerStories.length ? viewerStories : filteredStories;

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerStories([]);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    if (!viewerVisible) return;
    if (!viewerData.length) {
      closeViewer();
      return;
    }
    if (activeIndex >= viewerData.length) {
      setActiveIndex(Math.max(viewerData.length - 1, 0));
    }
  }, [viewerVisible, viewerData.length, activeIndex, closeViewer]);

  const fetchExpiredStories = useCallback(async ({ showLoader = false }: { showLoader?: boolean } = {}) => {
    if (showLoader) setLoading(true);
    setRefreshing(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setStories([]);
        return;
      }

      const nowIso = new Date().toISOString();
      // fetch expired personal stories
      const [{ data: storyRows, error: storyErr }, { data: bizRows, error: bizErr }] = await Promise.all([
        supabase
          .from("stories")
          .select("id,user_id,media_url,media_type,created_at,expire_at,revived_at,is_deleted")
          .eq("user_id", userId)
          .is("is_deleted", false)
          .lt("expire_at", nowIso)
          .order("expire_at", { ascending: false })
          .limit(300),
        supabase
          .from("business_stories")
          .select("id,user_id,media_url,media_type,created_at,expire_at,revived_at,is_deleted,is_hd")
          .eq("user_id", userId)
          .is("is_deleted", false)
          .lt("expire_at", nowIso)
          .order("expire_at", { ascending: false })
          .limit(300),
      ]);

      if (storyErr) throw storyErr;
      if (bizErr) {
        // continue — business stories may not exist in some environments
        console.warn("fetch expired business_stories err", bizErr);
      }

      const baseStories = (storyRows ?? []).map((story) => ({
        id: story.id,
        user_id: story.user_id,
        media_url: story.media_url,
        media_type: buildMediaType(story.media_type),
        created_at: story.created_at,
        expire_at: story.expire_at,
        revived_at: story.revived_at,
        likes: 0,
        comments: 0,
        views: 0,
        table: 'stories',
      } as ExpiredStory));

      const bizStories = (bizRows ?? []).map((story) => ({
        id: story.id,
        user_id: story.user_id,
        media_url: story.media_url,
        media_type: buildMediaType(story.media_type),
        created_at: story.created_at,
        expire_at: story.expire_at,
        revived_at: story.revived_at,
        likes: 0,
        comments: 0,
        views: 0,
        table: 'business_stories',
        isHD: Boolean(story.is_hd),
      } as ExpiredStory));

      const allStories = [...baseStories, ...bizStories];
      const base = allStories.sort((a, b) => {
        const A = a.expire_at ? new Date(a.expire_at).getTime() : 0;
        const B = b.expire_at ? new Date(b.expire_at).getTime() : 0;
        return B - A;
      });

      const storyIds = baseStories.map((story) => story.id).filter(Boolean);
      const businessIds = bizStories.map((story) => story.id).filter(Boolean);
      const ids = base.map((story) => story.id).filter(Boolean);
      if (ids.length) {
        const likeMap: Record<string, number> = {};
        const commentMap: Record<string, number> = {};
        const viewMap: Record<string, number> = {};
        const fetchMetricMap = async (table: string, column: string, sourceIds: string[], targetMap: Record<string, number>, label: string) => {
          if (!sourceIds.length) return;
          try {
            const { data } = await supabase.from(table).select(column).in(column, sourceIds);
            (data ?? []).forEach((row: any) => {
              const key = row?.[column];
              if (!key) return;
              targetMap[key] = (targetMap[key] || 0) + 1;
            });
          } catch (error) {
            console.warn(`expired ${label} err`, error);
          }
        };

        await Promise.all([
          fetchMetricMap("story_likes", "story_id", storyIds, likeMap, "likes"),
          fetchMetricMap("business_story_likes", "business_story_id", businessIds, likeMap, "business likes"),
          fetchMetricMap("story_comments", "story_id", storyIds, commentMap, "comments"),
          fetchMetricMap("business_story_comments", "business_story_id", businessIds, commentMap, "business comments"),
          fetchMetricMap("story_views", "story_id", ids, viewMap, "views"),
        ]);
        const enriched = base.map((story) => ({
          ...story,
          likes: likeMap[story.id] || 0,
          comments: commentMap[story.id] || 0,
          views: viewMap[story.id] || 0,
        }));
        setStories(enriched);
        try {
          await AsyncStorage.setItem(EXPIRED_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), stories: enriched }));
        } catch (cacheErr) {
          console.warn("expired stories cache write err", cacheErr);
        }
      } else {
        setStories([]);
      }
    } catch (error) {
      console.warn("expired stories err", error);
      Alert.alert("Archive", "Unable to load expired stories.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let hasFreshCache = false;
      try {
        const raw = await AsyncStorage.getItem(EXPIRED_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { timestamp?: number; stories?: ExpiredStory[] };
          const cachedStories = Array.isArray(parsed?.stories) ? parsed?.stories ?? [] : [];
          const isFresh = typeof parsed?.timestamp === "number" ? Date.now() - parsed.timestamp < EXPIRED_CACHE_TTL_MS : false;
          if (mounted && cachedStories.length) {
            setStories(cachedStories);
            setLoading(false);
          }
          hasFreshCache = Boolean(cachedStories.length && isFresh);
        }
      } catch (error) {
        console.warn("expired stories cache load err", error);
      }
      await fetchExpiredStories({ showLoader: !hasFreshCache });
    })();
    return () => {
      mounted = false;
    };
  }, [fetchExpiredStories]);

  const openViewer = useCallback(
    (storyId: string) => {
      const dataset = filteredStories;
      const index = dataset.findIndex((story) => story.id === storyId);
      if (index < 0) return;
      setViewerStories(dataset);
      setActiveIndex(index);
      viewerTranslateY.setValue(0);
      setViewerVisible(true);
      requestAnimationFrame(() => {
        viewerListRef.current?.scrollToIndex({ index, animated: false });
      });
    },
    [filteredStories, viewerTranslateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx) && Math.abs(gesture.dy) > 12,
        onPanResponderMove: (_, gesture) => {
          viewerTranslateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dy) > 160) {
            Animated.timing(viewerTranslateY, {
              toValue: gesture.dy > 0 ? SCREEN_HEIGHT : -SCREEN_HEIGHT,
              duration: 220,
              useNativeDriver: true,
            }).start(() => {
              viewerTranslateY.setValue(0);
              closeViewer();
            });
          } else {
            Animated.spring(viewerTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
          }
        },
      }),
    [closeViewer, viewerTranslateY],
  );

  const renderCard = useCallback(
    ({ item }: { item: ExpiredStory; index: number }) => {
      const mediaType = buildMediaType(item.media_type);
      return (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => openViewer(item.id)}
          activeOpacity={0.85}
        >
          <View style={[styles.cardMedia, { backgroundColor: isDark ? "#0e1522" : "#f4f4f4" }]}> 
            {item.media_url && mediaType === "image" ? (
              <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : item.media_url && mediaType === "video" ? (
              <>
                <Video
                  source={{ uri: item.media_url }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  shouldPlay
                  isLooping
                  isMuted
                />
                <View style={styles.videoBadge}>
                  <Ionicons name="play" size={18} color="#fff" />
                </View>
              </>
            ) : (
              <View style={styles.cardFallback}>
                <Feather name="image" size={20} color={colors.subtext} />
              </View>
            )}
          </View>
          <View style={styles.cardMetaRow}>
            <View style={styles.statPill}>
              <Ionicons name="heart" size={13} color="#ff6b81" />
              <Text style={[styles.statText, { color: colors.text }]}>{item.likes}</Text>
            </View>
            <View style={styles.statPill}>
              <Ionicons name="chatbubble" size={13} color={colors.subtext} />
              <Text style={[styles.statText, { color: colors.text }]}>{item.comments}</Text>
            </View>
            <View style={styles.statPill}>
              <Ionicons name="eye" size={13} color={colors.subtext} />
              <Text style={[styles.statText, { color: colors.text }]}>{item.views}</Text>
            </View>
          </View>
          <Text style={[styles.cardDate, { color: colors.subtext }]}>Expired {formatDate(item.expire_at)}</Text>
        </TouchableOpacity>
      );
    },
    [colors.border, colors.card, colors.subtext, colors.text, isDark, openViewer],
  );

  const keyExtractor = useCallback((item: ExpiredStory) => item.id, []);

  const handleMomentumEnd = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index >= 0 && index < viewerData.length) {
        setActiveIndex(index);
      }
    },
    [viewerData.length],
  );

  const renderViewerItem = useCallback(
    ({ item, index }: { item: ExpiredStory; index: number }) => (
      <StoryMedia story={item} isActive={index === activeIndex} />
    ),
    [activeIndex],
  );

  const getItemLayout = useCallback((_: ArrayLike<ExpiredStory> | null | undefined, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  const handleRevive = useCallback(async () => {
    const story = viewerData[activeIndex];
    if (!story || reviveBusy) return;
    setReviveBusy(true);
    const previousExpireAt = story.expire_at;
    const previousRevivedAt = story.revived_at;
    const revivedAt = new Date().toISOString();
    const nextExpireAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error("You need to be signed in.");
      if (story.user_id !== userId) throw new Error("You can only revive your own stories.");
      // Update the correct table (stories or business_stories)
      if (story.table === 'business_stories') {
        const { error: updateError } = await supabase
          .from('business_stories')
          .update({ expire_at: nextExpireAt, is_deleted: false, revived_at: revivedAt })
          .eq('id', story.id)
          .eq('user_id', userId);
        if (updateError) throw updateError;

        const revivePayload: any = {
          business_story_id: story.id,
          revived_by: userId,
          revived_at: revivedAt,
          seed_likes: story.likes,
          seed_comments: story.comments,
        };

        const { error: logError } = await supabase.from('story_revives').insert(revivePayload);
        if (logError && logError.code !== 'PGRST205') {
          if (previousExpireAt) {
            try {
              await supabase
                .from('business_stories')
                .update({ expire_at: previousExpireAt, revived_at: previousRevivedAt ?? null })
                .eq('id', story.id)
                .eq('user_id', userId);
            } catch (rollbackErr) {
              console.warn('revive rollback err', rollbackErr);
            }
          }
          throw logError;
        } else if (logError?.code === 'PGRST205') {
          console.warn('story_revives missing; skipping log insert', logError);
        }
      } else {
        const { error: updateError } = await supabase
          .from('stories')
          .update({ expire_at: nextExpireAt, is_deleted: false, revived_at: revivedAt })
          .eq('id', story.id)
          .eq('user_id', userId);
        if (updateError) throw updateError;

        const revivePayload: any = {
          story_id: story.id,
          revived_by: userId,
          revived_at: revivedAt,
          seed_likes: story.likes,
          seed_comments: story.comments,
        };

        const { error: logError } = await supabase.from('story_revives').insert(revivePayload);
        if (logError && logError.code !== 'PGRST205') {
          if (previousExpireAt) {
            try {
              await supabase
                .from('stories')
                .update({ expire_at: previousExpireAt, revived_at: previousRevivedAt ?? null })
                .eq('id', story.id)
                .eq('user_id', userId);
            } catch (rollbackErr) {
              console.warn('revive rollback err', rollbackErr);
            }
          }
          throw logError;
        } else if (logError?.code === 'PGRST205') {
          console.warn('story_revives missing; skipping log insert', logError);
        }
      }

      closeViewer();
      Alert.alert("Revived", "Story is live again for the next 24 hours.");
      fetchExpiredStories({ showLoader: true }).catch((err) => console.warn("expired refresh err", err));
    } catch (error: any) {
      console.warn("revive err", error);
      Alert.alert("Revive failed", error?.message ?? "Unable to revive this story right now.");
    } finally {
      setReviveBusy(false);
    }
  }, [activeIndex, closeViewer, fetchExpiredStories, reviveBusy, viewerData]);

  const emptyState = !loading && stories.length === 0;
  const activeStory = viewerData[activeIndex];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}> 
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { borderColor: colors.border }]}> 
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerEyebrow, { color: colors.subtext }]}>Archive</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Expired stories</Text>
        </View>
        <TouchableOpacity onPress={() => fetchExpiredStories({ showLoader: true })} style={[styles.iconBtn, { borderColor: colors.border }]}> 
          <Feather name="refresh-ccw" size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.analyticsPanel, { borderColor: colors.border, backgroundColor: isDark ? "rgba(11,16,27,0.92)" : "#f6f7ff" }]}> 
        <View style={styles.analyticsHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.analyticsTitle, { color: colors.text }]}>Business archive</Text>
            <Text style={[styles.analyticsSubtitle, { color: colors.subtext }]}>
              {analytics.totals.businessCount} of {analytics.totals.archived} records
            </Text>
          </View>
          <View style={[styles.archiveChip, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#fff" }]}> 
            <Feather name="archive" size={14} color={colors.text} />
            <Text style={[styles.archiveChipText, { color: colors.text }]}>{analytics.totals.archived}</Text>
          </View>
        </View>
        <Text style={[styles.analyticsSubcopy, { color: colors.subtext }]}>
          {analytics.totals.archived
            ? `${analytics.totals.businessShare}% of your archive is commercial media.`
            : "Archive a story to unlock your commercial intel."}
        </Text>
        <View style={styles.analyticsGrid}>
          {metricCards.map((metric) => {
            const trendColor = getTrendColor(metric.trend.direction);
            const trendIcon = metric.trend.direction === "down" ? "trending-down" : metric.trend.direction === "up" ? "trending-up" : "minus";
            const pct = Math.abs(metric.trend.percent).toFixed(1);
            return (
              <View key={metric.key} style={[styles.metricCard, { borderColor: colors.border, backgroundColor: isDark ? "rgba(14,18,30,0.95)" : "#fff" }]}> 
                <Text style={[styles.metricLabel, { color: colors.subtext }]}>{metric.label}</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>{formatCompactNumber(metric.value)}</Text>
                <View style={styles.metricTrendRow}>
                  <Feather name={trendIcon as any} size={14} color={trendColor} />
                  <Text style={[styles.metricTrendText, { color: trendColor }]}>
                    {getTrendLabel(metric.trend.direction)} {pct}%
                  </Text>
                  <Text style={[styles.metricDelta, { color: colors.subtext }]}>
                    {metric.trend.delta > 0 ? "+" : ""}
                    {Math.round(metric.trend.delta)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setActiveTab("all")}
          style={[styles.tabBtn, activeTab === "all" ? styles.tabBtnActive : null]}
        >
          <Text style={[styles.tabText, activeTab === "all" ? styles.tabTextActive : null]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("stories")}
          style={[styles.tabBtn, activeTab === "stories" ? styles.tabBtnActive : null]}
        >
          <Text style={[styles.tabText, activeTab === "stories" ? styles.tabTextActive : null]}>Stories</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("commercials")}
          style={[styles.tabBtn, activeTab === "commercials" ? styles.tabBtnActive : null]}
        >
          <Text style={[styles.tabText, activeTab === "commercials" ? styles.tabTextActive : null]}>Commercials</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : emptyState ? (
        <View style={styles.loadingState}>
          <Feather name="archive" size={36} color={colors.subtext} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No expired stories</Text>
          <Text style={[styles.emptySub, { color: colors.subtext }]}>Stories you archive will appear here for historical insights.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStories}
          keyExtractor={keyExtractor}
          renderItem={renderCard}
          numColumns={2}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: GRID_PADDING, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: GRID_GAP, justifyContent: "space-between" }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchExpiredStories} tintColor={colors.subtext} />}
        />
      )}

      {viewerVisible ? (
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.viewerOverlay, { opacity: viewerOpacity }]}> 
          <Animated.View
            style={[styles.viewerSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: viewerTranslateY }, { scale: viewerScale }] }]}
            {...panResponder.panHandlers}
          >
            <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={closeViewer} style={styles.iconGhost}> 
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.viewerTitle}>Story {viewerData.length ? activeIndex + 1 : 0}/{viewerData.length}</Text>
                <Text style={styles.viewerSubtitle}>{activeStory ? formatDate(activeStory.expire_at) : ""}</Text>
              </View>
            </View>
            <FlatList
              ref={(ref) => {
                viewerListRef.current = ref;
              }}
              data={viewerData}
              renderItem={renderViewerItem}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumEnd}
              initialScrollIndex={activeIndex}
              getItemLayout={getItemLayout}
            />
            <View style={styles.viewerFooter}>
              <View style={styles.viewerStatRow}>
                <View style={styles.viewerStat}>
                  <Ionicons name="heart" size={16} color="#ff6b81" />
                  <Text style={styles.viewerStatText}>{activeStory?.likes ?? 0}</Text>
                </View>
                <View style={styles.viewerStat}>
                  <Ionicons name="chatbubble" size={16} color="#fff" />
                  <Text style={styles.viewerStatText}>{activeStory?.comments ?? 0}</Text>
                </View>
                <View style={styles.viewerStat}>
                  <Ionicons name="eye" size={16} color="#fff" />
                  <Text style={styles.viewerStatText}>{activeStory?.views ?? 0}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleRevive} style={[styles.reviveBtn, reviveBusy && { opacity: 0.5 }]} disabled={reviveBusy || !activeStory}>
                {reviveBusy ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Feather name="activity" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.reviveBtnText}>Revive</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.9 },
  headerTitle: { fontSize: 26, fontWeight: "900" },
  analyticsPanel: { marginHorizontal: 16, marginTop: 18, borderWidth: 1, borderRadius: 22, padding: 16, gap: 12 },
  analyticsHeaderRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  analyticsTitle: { fontSize: 18, fontWeight: "800" },
  analyticsSubtitle: { fontSize: 14, marginTop: 2 },
  analyticsSubcopy: { fontSize: 14, lineHeight: 20 },
  analyticsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  archiveChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  archiveChipText: { fontWeight: "800", fontSize: 14 },
  metricCard: { flex: 1, minWidth: 110, borderWidth: 1, borderRadius: 18, padding: 14, gap: 6 },
  metricLabel: { fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  metricValue: { fontSize: 22, fontWeight: "900" },
  metricTrendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricTrendText: { fontSize: 13, fontWeight: "700" },
  metricDelta: { fontSize: 12, fontWeight: "600" },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "800", marginTop: 12 },
  emptySub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  card: { width: CARD_WIDTH, borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  cardMedia: { height: CARD_MEDIA_HEIGHT, borderRadius: 14, overflow: "hidden" },
  cardFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  videoBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  statText: { fontWeight: "700", fontSize: 13 },
  cardDate: { fontSize: 13, marginTop: 4 },
  viewerOverlay: { backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center" },
  viewerSheet: { flex: 1, paddingTop: 12 },
  viewerHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  viewerTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
  viewerSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 2 },
  viewerMedia: { width: SCREEN_WIDTH * 0.9, height: SCREEN_HEIGHT * 0.65, borderRadius: 24, backgroundColor: "#090b14" },
  viewerFallback: { alignItems: "center", justifyContent: "center" },
  viewerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  viewerStatRow: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1, flexWrap: "wrap" },
  viewerStat: { flexDirection: "row", alignItems: "center", gap: 8 },
  viewerStatText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  iconGhost: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  viewerPlayBtn: {
    position: "absolute",
    bottom: 20,
    right: 30,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviveBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  reviveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 8, alignItems: "center" },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  tabBtnActive: { backgroundColor: "rgba(255,255,255,0.08)" },
  tabText: { color: "#c3c7cc", fontWeight: "700", fontSize: 14 },
  tabTextActive: { color: "#fff" },
});
