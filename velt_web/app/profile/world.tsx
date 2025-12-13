// app/(tabs)/World.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { safePush } from '@/lib/navigation';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";

import NotificationBanner from "components/NotificationsBanner";
import TabSwipeContainer from "components/TabSwipeContainer";
import { useTheme } from "app/themes";
import { supabase } from "@/lib/supabase";

const capitalize = (value?: string | null) => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
};

type Story = {
  id: string;
  user_id: string;
  media_url?: string | null;
  media_type?: string | null;
  created_at?: string | null;
  expire_at?: string | null;
  likes?: number;
  comments?: number;
  isHD?: boolean;
};

const isVideoMedia = (story?: Story) => {
  if (!story) return false;
  if (story.media_type) return story.media_type.toLowerCase().startsWith("video");
  if (story.media_url) return /\.(mp4|mov|webm|mkv|avi)$/i.test(story.media_url);
  return false;
};

type WalletRow = {
  id: string;
  wallet_id: string;
  balance: number;
};

type BannerState = {
  visible: boolean;
  title?: string;
  body?: string;
  onPress?: () => void;
};

export default function World() {
  const router = withSafeRouter(useRouter());
  const { colors: themeColors } = useTheme();
  const isDark = Boolean((themeColors as any)?.isDark);

  const colors = useMemo(
    () => ({
      bg: themeColors.bg,
      text: themeColors.text,
      subtext: themeColors.subtext,
      card: themeColors.card,
      border: themeColors.border,
      accent: themeColors.accent,
      separator: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    }),
    [themeColors, isDark],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profession, setProfession] = useState<string | null>(null);

  const [banner, setBanner] = useState<BannerState>({ visible: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"general" | "earnings">("general");

  const [likesMonth, setLikesMonth] = useState(0);
  const [commentsMonth, setCommentsMonth] = useState(0);
  const [likesYear, setLikesYear] = useState(0);
  const [commentsYear, setCommentsYear] = useState(0);

  const [walletRow, setWalletRow] = useState<WalletRow | null>(null);
  const [pulseRate, setPulseRate] = useState(0.02);
  const [showFullWalletId, setShowFullWalletId] = useState(false);

  const [allStories, setAllStories] = useState<Story[]>([]);
  const [activeStories, setActiveStories] = useState<Story[]>([]);
  const [pastStories, setPastStories] = useState<Story[]>([]);

  const [earnings30, setEarnings30] = useState(0);
  const [earnings365, setEarnings365] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);

  const gradAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(gradAnim, {
        toValue: 1,
        duration: 4200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ).start();
  }, [gradAnim]);

  const loadAll = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.warn("auth getUser err", authError);
      }
      const userId = authData?.user?.id;
      if (!userId) {
        return;
      }

      let computedPastStories: Story[] = [];

      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("id, avatar_url, profession, full_name")
          .eq("id", userId)
          .maybeSingle();
        if (profileRow) {
          setProfile(profileRow);
          setAvatarUrl(profileRow.avatar_url ?? null);
          setProfession(profileRow.profession ?? profileRow.full_name ?? null);
        }
      } catch (error) {
        console.warn("profile fetch err", error);
      }

      try {
        const { data: pulseRows } = await supabase
          .from("pulse_rates")
          .select("rate_to_ghs, effective_at")
          .order("effective_at", { ascending: false })
          .limit(1);
        if (Array.isArray(pulseRows) && pulseRows.length) {
          setPulseRate(Number(pulseRows[0].rate_to_ghs ?? 0.02));
        }
      } catch (error) {}

      let fetchedWallet: WalletRow | null = null;
      try {
        const { data: wallet } = await supabase.from("wallets").select("id,wallet_id,balance").eq("user_id", userId).maybeSingle();
        if (wallet) {
          fetchedWallet = wallet as WalletRow;
          setWalletRow(wallet as WalletRow);
        }
      } catch (error) {
        console.warn("wallet fetch err", error);
      }

      let fetchedStories: Story[] = [];
      try {
        const { data: stories } = await supabase
          .from("stories")
          .select("id,user_id,media_url,media_type,created_at,expire_at,is_deleted,is_hd")
          .eq("user_id", userId)
          .is("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1000);
        if (Array.isArray(stories)) {
          // map is_hd to isHD for compatibility
          fetchedStories = stories.filter(Boolean).map((s: any) => ({ ...s, isHD: Boolean(s.is_hd) })) as Story[];
          setAllStories(fetchedStories);
        }
      } catch (error) {
        console.warn("stories fetch err", error);
      }

      const nowTs = Date.now();
      const active: Story[] = [];
      const past: Story[] = [];
      fetchedStories.forEach((story) => {
        const expireTs = story.expire_at ? new Date(story.expire_at).getTime() : undefined;
        if (!expireTs || expireTs > nowTs) active.push(story);
        else past.push(story);
      });
      setActiveStories(active);
      computedPastStories = past;

      if (past.length) {
        const ids = past.map((s) => s.id).filter(Boolean);
        const likeMap: Record<string, number> = {};
        const commentMap: Record<string, number> = {};
        try {
          const { data: likeRows } = await supabase.from("story_likes").select("story_id");
          (likeRows ?? []).forEach((row: any) => {
            if (ids.includes(row.story_id)) {
              likeMap[row.story_id] = (likeMap[row.story_id] || 0) + 1;
            }
          });
        } catch (error) {
          console.warn("likes map err", error);
        }
        try {
          const { data: commentRows } = await supabase.from("story_comments").select("story_id");
          (commentRows ?? []).forEach((row: any) => {
            if (ids.includes(row.story_id)) {
              commentMap[row.story_id] = (commentMap[row.story_id] || 0) + 1;
            }
          });
        } catch (error) {
          console.warn("comments map err", error);
        }
        setPastStories(past.map((story) => ({ ...story, likes: likeMap[story.id] || 0, comments: commentMap[story.id] || 0 })));
      } else {
        setPastStories([]);
      }

      try {
        let storyIds = fetchedStories.map((s) => s.id).filter(Boolean);
        if (storyIds.length === 0) {
          const { data: storyRows } = await supabase.from("stories").select("id").eq("user_id", userId);
          storyIds = (storyRows ?? []).map((row: any) => row.id).filter(Boolean);
        }

        const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const cutoff365 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

        const countFor = async (table: string, cutoffIso: string) => {
          if (!storyIds.length) return 0;
          const response = await supabase
            .from(table)
            .select("id", { count: "exact" })
            .in("story_id", storyIds)
            .gte("created_at", cutoffIso);
          return Number((response as any).count ?? 0);
        };

        const [likes30, comments30, likes365, comments365] = await Promise.all([
          countFor("story_likes", cutoff30),
          countFor("story_comments", cutoff30),
          countFor("story_likes", cutoff365),
          countFor("story_comments", cutoff365),
        ]);

        setLikesMonth(likes30);
        setCommentsMonth(comments30);
        setLikesYear(likes365);
        setCommentsYear(comments365);
      } catch (error) {
        console.warn("counts err", error);
      }

      try {
        const { count: likesTotal } = (await supabase
          .from("story_likes")
          .select("id", { count: "exact" })
          .eq("user_id", userId)) as any;
        const { count: commentsTotal } = (await supabase
          .from("story_comments")
          .select("id", { count: "exact" })
          .eq("user_id", userId)) as any;
        setTotalLikes(Number(likesTotal ?? 0));
        setTotalComments(Number(commentsTotal ?? 0));
      } catch (error) {
        const derivedLikes = computedPastStories.reduce((sum, story) => sum + Number(story.likes || 0), 0);
        const derivedComments = computedPastStories.reduce((sum, story) => sum + Number(story.comments || 0), 0);
        setTotalLikes(derivedLikes);
        setTotalComments(derivedComments);
      }

      try {
        const walletId = fetchedWallet?.id;
        if (walletId) {
          const [{ data: rpc30 }, { data: rpc365 }] = await Promise.all([
            supabase.rpc("earnings_for_wallet_interval", { p_wallet: walletId, p_days: 30 }),
            supabase.rpc("earnings_for_wallet_interval", { p_wallet: walletId, p_days: 365 }),
          ]);
          const normalize = (value: any) => {
            if (typeof value === "number") return value;
            if (value && typeof value === "object") {
              return Number(value.amount ?? value.value ?? 0);
            }
            return 0;
          };
          setEarnings30(normalize(rpc30));
          setEarnings365(normalize(rpc365));
        } else {
          setEarnings30(0);
          setEarnings365(0);
        }
      } catch (error) {
        console.warn("earnings rpc err", error);
        setEarnings30(0);
        setEarnings365(0);
      }
    } catch (error) {
      console.warn("world load err", error);
      Alert.alert("Error", "Could not load World data.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  useEffect(() => {
    if (!profile?.id) return;
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.rpc("notifications_unread_count", { p_recipient: profile.id });
        if (!mounted || error) return;
        if (Array.isArray(data)) {
          setUnreadCount(Number(data[0] ?? 0));
        } else {
          setUnreadCount(Number(data ?? 0));
        }
      } catch (error) {}
    })();

    const channel = supabase
      .channel(`world-notifs:${profile.id}`)
      .on(
        "postgres_changes",
        { schema: "public", table: "notifications", event: "INSERT", filter: `recipient=eq.${profile.id}` },
        (payload: any) => {
          if (!mounted) return;
          setUnreadCount((count) => count + 1);
          const n = payload.new;
          if (!n) return;
          setBanner({
            visible: true,
            title: n.title ?? (n.type === "message_received" ? "New message" : "Notification"),
            body: n.body ?? "",
              onPress: () => {
              const data = n.data ?? {};
              if (data?.conversation_id) {
                safePush(router, `/message/chat/${data.conversation_id}`);
              } else if (data?.screen) {
                safePush(router, { pathname: data.screen, params: data.params ?? {} });
              }
            },
          });
        },
      )
      .on(
        "postgres_changes",
        { schema: "public", table: "notifications", event: "UPDATE", filter: `recipient=eq.${profile.id}` },
        (payload: any) => {
          if (payload.old?.read === false && payload.new?.read === true) {
            setUnreadCount((count) => Math.max(0, count - 1));
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      try {
        channel.unsubscribe();
      } catch (error) {}
    };
  }, [profile?.id, router]);

  const truncatedWalletId = (value?: string | null) => {
    if (!value) return "—";
    if (showFullWalletId) return value;
    const text = String(value);
    const left = text.slice(0, 4);
    const right = text.slice(-4);
    return `${left}...${right}`;
  };

  const displayBalanceGhs = () => {
    const balancePulse = Number(walletRow?.balance ?? 0);
    const ghs = balancePulse * Number(pulseRate || 0);
    return ghs.toFixed(2);
  };

  const expectedPayoutFor = (likes: number, comments: number) => {
    const pulse = (likes + comments) / 2;
    return { payoutPulse: pulse, payoutGhs: pulse * (pulseRate || 0) };
  };

  const openActiveStory = (storyId: string) => {
    safePush(router, `/Contents?storyId=${encodeURIComponent(storyId)}`);
  };

  const payoutMonth = useMemo(
    () => expectedPayoutFor(likesMonth, commentsMonth),
    [likesMonth, commentsMonth, pulseRate],
  );
  const payoutYear = useMemo(
    () => expectedPayoutFor(likesYear, commentsYear),
    [likesYear, commentsYear, pulseRate],
  );
  const { payoutPulse: payoutMonthPulse, payoutGhs: payoutMonthGhs } = payoutMonth;
  const { payoutPulse: payoutYearPulse, payoutGhs: payoutYearGhs } = payoutYear;

  const heroMetrics = useMemo(
    () => [
      {
        label: "Live stories",
        value: String(activeStories.length),
        caption: `${activeStories.length} active · ${allStories.length} total`,
      },
      {
        label: "Pulse runway",
        value: `₵ ${payoutMonthGhs.toFixed(0)}`,
        caption: `${payoutMonthPulse.toFixed(0)} PULSE / 30d`,
      },
      {
        label: "Inbox",
        value: unreadCount > 99 ? "99+" : String(unreadCount),
        caption: unreadCount === 1 ? "item waiting" : "items waiting",
      },
    ],
    [activeStories.length, allStories.length, payoutMonthGhs, payoutMonthPulse, unreadCount],
  );

  const storyMomentumCopy = useMemo(() => {
    if (!allStories.length) return "Publish a drop to unlock analytics, payouts, and trends.";
    if (!activeStories.length) return "All stories are archived. Queue a new release to stay top of mind.";
    return `Running ${activeStories.length} active ${activeStories.length === 1 ? "story" : "stories"} with ${totalLikes + totalComments} lifetime reactions.`;
  }, [activeStories.length, allStories.length, totalLikes, totalComments]);

  const generalInsights = useMemo(
    () => [
      {
        label: "30 day engagement",
        value: `${likesMonth + commentsMonth}`,
        caption: `${likesMonth} likes · ${commentsMonth} comments`,
      },
      {
        label: "Lifetime reactions",
        value: `${totalLikes + totalComments}`,
        caption: `${totalLikes} likes · ${totalComments} comments`,
      },
      {
        label: "Story cadence",
        value: `${activeStories.length}/${Math.max(1, pastStories.length || 1)}`,
        caption: `${activeStories.length} live · ${pastStories.length} archived`,
      },
    ],
    [likesMonth, commentsMonth, totalLikes, totalComments, activeStories.length, pastStories.length],
  );

  const highlightedPastStories = useMemo(() => pastStories.slice(0, 6), [pastStories]);

  const earningsTiles = useMemo(
    () => [
      {
        label: "Last 30 days",
        amount: earnings30,
        ghs: earnings30 * pulseRate,
        projection: `${payoutMonthPulse.toFixed(2)} PULSE · ₵ ${payoutMonthGhs.toFixed(2)}`,
      },
      {
        label: "Last 365 days",
        amount: earnings365,
        ghs: earnings365 * pulseRate,
        projection: `${payoutYearPulse.toFixed(2)} PULSE · ₵ ${payoutYearGhs.toFixed(2)}`,
      },
    ],
    [earnings30, earnings365, pulseRate, payoutMonthPulse, payoutMonthGhs, payoutYearPulse, payoutYearGhs],
  );

  const translateX = gradAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });

  if (loading) {
    return (
      <TabSwipeContainer style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }, styles.center]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </SafeAreaView>
      </TabSwipeContainer>
    );
  }

  return (
    <TabSwipeContainer style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <NotificationBanner
          visible={banner.visible}
          title={banner.title}
          body={banner.body}
          onClose={() => setBanner((prev) => ({ ...prev, visible: false }))}
          onPress={() => {
            banner.onPress?.();
            setBanner((prev) => ({ ...prev, visible: false }));
          }}
        />

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.subtext}
              progressBackgroundColor={colors.bg}
            />
          }
        >
          <View style={styles.headerRow}>
            <TouchableOpacity style={[styles.avatarRing, { borderColor: colors.accent }]} onPress={() => safePush(router, "/profile")}> 
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.card }]} />
              )}
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={[styles.professionTxt, { color: colors.subtext }]} numberOfLines={1}>
                {profession ?? "—"}
              </Text>
              <Text style={[styles.worldTitle, { color: colors.text }]}>World</Text>
              <Text style={[styles.worldSubtitle, { color: colors.subtext }]}>Account · Operations</Text>
            </View>

            <TouchableOpacity onPress={() => safePush(router, "/notifications")}>
              <View style={styles.notificationIcon}>
                <Ionicons name="notifications-outline" size={22} color={colors.subtext} />
                {unreadCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? "99+" : String(unreadCount)}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.heroCard, { borderColor: colors.border }]}> 
            <LinearGradient
              colors={isDark ? ["#070a11", "#040507"] : ["#f5f7ff", "#ffffff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroContent}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.heroEyebrow, { color: colors.subtext }]}>VELT OPS</Text>
                <Text style={[styles.heroHeadline, { color: colors.text }]}>World control center</Text>
                <Text style={[styles.heroBody, { color: colors.subtext }]}>{storyMomentumCopy}</Text>
              </View>
              <TouchableOpacity
                onPress={() => safePush(router, "/profile/edit-profile")}
                style={[styles.heroAction, { borderColor: colors.border, backgroundColor: colors.accent }]}
              >
                <Feather name="edit-2" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.heroMetricsRow}>
              {heroMetrics.map((metric) => (
                <View key={metric.label} style={styles.heroMetric}>
                  <Text style={[styles.heroMetricLabel, { color: colors.subtext }]}>{metric.label}</Text>
                  <Text style={[styles.heroMetricValue, { color: colors.text }]}>{metric.value}</Text>
                  <Text style={[styles.heroMetricCaption, { color: colors.subtext }]}>{metric.caption}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "general" ? { backgroundColor: colors.accent } : { borderColor: colors.border }]}
              onPress={() => setActiveTab("general")}
            >
              <Text style={[styles.tabTxt, activeTab === "general" ? styles.tabTxtActive : { color: colors.subtext }]}>General</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "earnings" ? { backgroundColor: colors.accent } : { borderColor: colors.border }]}
              onPress={() => setActiveTab("earnings")}
            >
              <Text style={[styles.tabTxt, activeTab === "earnings" ? styles.tabTxtActive : { color: colors.subtext }]}>Earnings</Text>
            </TouchableOpacity>
          </View>

          {activeTab === "general" && (
            <>
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: colors.subtext }]}>Pulse</Text>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Engagement overview</Text>
                  </View>
                  <View style={[styles.periodToggle, { borderColor: colors.border }]}> 
                    <View style={[styles.periodPill, { backgroundColor: colors.accent }]}> 
                      <Text style={styles.periodPillText}>30d</Text>
                    </View>
                    <View style={styles.periodPillMuted}>
                      <Text style={[styles.periodPillTextMuted, { color: colors.subtext }]}>12m</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.insightsGrid}>
                  {generalInsights.map((insight) => (
                    <View key={insight.label} style={[styles.insightTile, { borderColor: colors.separator }]}> 
                      <Text style={[styles.insightLabel, { color: colors.subtext }]}>{insight.label}</Text>
                      <Text style={[styles.insightValue, { color: colors.text }]}>{insight.value}</Text>
                      <Text style={[styles.insightCaption, { color: colors.subtext }]}>{insight.caption}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.sectionNote, { color: colors.subtext }]}>{storyMomentumCopy}</Text>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: colors.subtext }]}>Wallet</Text>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Pulse balance</Text>
                  </View>
                </View>
                <Animated.View style={[styles.walletGradient, { transform: [{ translateX }] }]}> 
                  <LinearGradient colors={[isDark ? "#ffffff" : "#000000", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, opacity: 0.08 }} />
                </Animated.View>
                <View style={styles.walletValuesRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.walletLabel, { color: colors.subtext }]}>Wallet ID</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                      <Text numberOfLines={1} style={[styles.walletId, { color: colors.text }]}>
                        {walletRow ? truncatedWalletId(walletRow.wallet_id) : "—"}
                      </Text>
                      <TouchableOpacity onPress={() => setShowFullWalletId((prev) => !prev)} style={{ marginLeft: 8 }}>
                        <Feather name={showFullWalletId ? "eye-off" : "eye"} size={16} color={colors.subtext} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.walletHint, { color: colors.subtext }]}>Tap to reveal full identifier</Text>
                  </View>
                  <View style={styles.walletBalanceBlock}>
                    <Text style={[styles.walletLabel, { color: colors.subtext }]}>Balance</Text>
                    <Text style={[styles.walletBalanceMajor, { color: colors.text }]}>₵ {displayBalanceGhs()}</Text>
                    <Text style={[styles.walletBalanceMinor, { color: colors.subtext }]}>
                      {walletRow ? `${Number(walletRow.balance).toFixed(4)} PULSE` : "0.0000 PULSE"}
                    </Text>
                    <Text style={[styles.walletHint, { color: colors.subtext }]}>1 PULSE ≈ ₵ {Number(pulseRate || 0).toFixed(4)}</Text>
                  </View>
                </View>
                <View style={styles.walletFooterRow}>
                  <View>
                    <Text style={[styles.walletLabel, { color: colors.subtext }]}>Expected (30d)</Text>
                    <Text style={[styles.walletFooterValue, { color: colors.text }]}>{payoutMonthPulse.toFixed(2)} PULSE · ₵ {payoutMonthGhs.toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text style={[styles.walletLabel, { color: colors.subtext }]}>Expected (12m)</Text>
                    <Text style={[styles.walletFooterValue, { color: colors.text }]}>{payoutYearPulse.toFixed(2)} PULSE · ₵ {payoutYearGhs.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: colors.subtext }]}>Active stories</Text>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Live drops</Text>
                  </View>
                  <TouchableOpacity style={[styles.pillButton, { borderColor: colors.border }]} onPress={() => safePush(router, "/explore/create_story")}>
                    <Feather name="plus" size={16} color={colors.text} style={{ marginRight: 6 }} />
                    <Text style={[styles.pillButtonText, { color: colors.text }]}>New story</Text>
                  </TouchableOpacity>
                </View>
                {activeStories.length === 0 ? (
                  <Text style={{ color: colors.subtext, marginTop: 8 }}>No active stories right now.</Text>
                ) : (
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {activeStories.map((story) => (
                      <TouchableOpacity
                        key={story.id}
                        style={[styles.activeStoryCard, { borderColor: colors.border, backgroundColor: colors.bg }]}
                        onPress={() => openActiveStory(story.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.storyTitle, { color: colors.text }]}>
                            {story.media_type ? capitalize(story.media_type) : "Story"}
                          </Text>
                          <Text style={[styles.storyMeta, { color: colors.subtext }]}>Live since {formatTimestamp(story.created_at)}</Text>
                          {story.expire_at ? (
                            <Text style={[styles.storyMeta, { color: colors.subtext }]}>Expires {formatTimestamp(story.expire_at)}</Text>
                          ) : null}
                        </View>
                        <View style={[styles.storyStatus, { borderColor: colors.border }]}> 
                          <Text style={[styles.storyStatusText, { color: colors.accent }]}>LIVE</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: colors.subtext }]}>Archive</Text>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Past releases</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => safePush(router, "/world/expired")}
                    style={[styles.pillButton, { borderColor: colors.border }]}
                  >
                    <Feather name="archive" size={16} color={colors.text} style={{ marginRight: 6 }} />
                    <Text style={[styles.pillButtonText, { color: colors.text }]}>{pastStories.length} archived</Text>
                  </TouchableOpacity>
                </View>
                {highlightedPastStories.length === 0 ? (
                  <Text style={{ color: colors.subtext, marginTop: 8 }}>No expired stories yet.</Text>
                ) : (
                  <View style={styles.storyGrid}>
                    {highlightedPastStories.map((story) => (
                        <TouchableOpacity
                        key={story.id}
                        style={[styles.storyArchiveTile, { borderColor: colors.separator }]}
                        onPress={() => safePush(router, "/world/expired")}
                      >
                        <View style={[styles.storyThumb, { backgroundColor: isDark ? "#0b1623" : "#f6f6f6" }]}> 
                          {story.media_url ? (
                            isVideoMedia(story) ? (
                              <Video
                                source={{ uri: story.media_url }}
                                style={styles.storyThumbImage}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay
                                isLooping
                                isMuted
                              />
                            ) : (
                              <Image source={{ uri: story.media_url }} style={styles.storyThumbImage} />
                            )
                          ) : (
                            <View style={styles.storyThumbPlaceholder}>
                              <Feather name="image" size={18} color={colors.subtext} />
                            </View>
                          )}
                          <View style={styles.storyThumbOverlay} />
                          <View style={styles.storyThumbStats}>
                            <View style={styles.storyStatRow}>
                              <Ionicons name="heart" size={12} color="#fff" />
                              <Text style={styles.storyStatText}>{story.likes ?? 0}</Text>
                            </View>
                            <View style={styles.storyStatRow}>
                              <Ionicons name="chatbubble" size={12} color="#fff" />
                              <Text style={styles.storyStatText}>{story.comments ?? 0}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={[styles.storyArchiveMeta, { color: colors.subtext }]}>Expired {story.expire_at ? new Date(story.expire_at).toLocaleDateString() : "—"}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {pastStories.length > highlightedPastStories.length ? (
                  <Text style={[styles.sectionNote, { color: colors.subtext }]}>Showing {highlightedPastStories.length} of {pastStories.length} stories.</Text>
                ) : null}
              </View>
            </>
          )}

          {activeTab === "earnings" && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: colors.subtext }]}>Earnings</Text>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Platform payouts</Text>
                </View>
              </View>
              <Text style={[styles.sectionNote, { color: colors.subtext }]}>
                Amounts reflect credited Pulse prior to settlement fees.
              </Text>
              <View style={styles.earningsGrid}>
                {earningsTiles.map((tile) => (
                  <View key={tile.label} style={[styles.earningsTile, { borderColor: colors.separator }]}> 
                    <Text style={[styles.earningsLabel, { color: colors.subtext }]}>{tile.label}</Text>
                    <Text style={[styles.earningsValue, { color: colors.text }]}>{tile.amount.toFixed(2)} PULSE</Text>
                    <Text style={[styles.earningsGhs, { color: colors.subtext }]}>≈ ₵ {tile.ghs.toFixed(2)}</Text>
                    <Text style={[styles.earningsProjection, { color: colors.subtext }]}>Projection: {tile.projection}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

      </SafeAreaView>
    </TabSwipeContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarRing: { borderWidth: 2, borderRadius: 30, padding: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  professionTxt: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  worldTitle: { fontSize: 22, fontWeight: "900", marginTop: 2 },
  worldSubtitle: { fontSize: 12, fontWeight: "600" },
  notificationIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ff3b30",
    borderRadius: 9,
    paddingHorizontal: 4,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  heroCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 18, overflow: "hidden" },
  heroContent: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  heroEyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  heroHeadline: { fontSize: 22, fontWeight: "900", marginTop: 6 },
  heroBody: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  heroAction: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  heroActionText: { fontWeight: "800", marginRight: 6 },
  heroMetricsRow: { flexDirection: "row", gap: 12 },
  heroMetric: { flex: 1 },
  heroMetricLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  heroMetricValue: { fontSize: 20, fontWeight: "900", marginTop: 4 },
  heroMetricCaption: { fontSize: 12, marginTop: 2 },
  tabRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  tabBtn: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 10, alignItems: "center" },
  tabTxt: { fontWeight: "800" },
  tabTxtActive: { color: "#fff", fontWeight: "800" },
  sectionCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 18 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionEyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  sectionTitle: { fontSize: 18, fontWeight: "900", marginTop: 4 },
  sectionNote: { fontSize: 13, marginTop: 16, lineHeight: 20 },
  periodToggle: { flexDirection: "row", borderWidth: 1, borderRadius: 999, padding: 4 },
  periodPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  periodPillText: { color: "#fff", fontWeight: "800" },
  periodPillMuted: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  periodPillTextMuted: { fontWeight: "800" },
  insightsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  insightTile: { flex: 1, minWidth: "30%", borderWidth: 1, borderRadius: 16, padding: 12 },
  insightLabel: { fontSize: 12, fontWeight: "700" },
  insightValue: { fontSize: 20, fontWeight: "900", marginTop: 6 },
  insightCaption: { fontSize: 12, marginTop: 2 },
  pillButton: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  pillButtonText: { fontWeight: "800" },
  walletGradient: { position: "absolute", top: 16, bottom: 16, left: 16, right: 16, borderRadius: 16, overflow: "hidden" },
  walletValuesRow: { flexDirection: "row", gap: 20, marginTop: 12 },
  walletLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  walletId: { fontSize: 16, fontWeight: "900" },
  walletHint: { fontSize: 12, marginTop: 4 },
  walletBalanceBlock: { minWidth: 160 },
  walletBalanceMajor: { fontSize: 28, fontWeight: "900", marginTop: 8 },
  walletBalanceMinor: { fontSize: 14, marginTop: 2 },
  walletFooterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  walletFooterValue: { fontSize: 14, fontWeight: "800", marginTop: 4 },
  activeStoryCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  storyTitle: { fontSize: 16, fontWeight: "800" },
  storyMeta: { fontSize: 12, marginTop: 4 },
  storyStatus: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  storyStatusText: { fontWeight: "900", fontSize: 12 },
  storyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  storyArchiveTile: { width: "47%", borderWidth: 1, borderRadius: 16, padding: 10 },
  storyThumb: { height: 120, borderRadius: 12, overflow: "hidden", marginBottom: 10 },
  storyThumbImage: { width: "100%", height: "100%" },
  storyThumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  storyThumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.1)" },
  storyThumbStats: { position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between" },
  storyStatRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  storyStatText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  storyArchiveMeta: { fontSize: 12 },
  earningsGrid: { flexDirection: "row", gap: 12, marginTop: 16 },
  earningsTile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14 },
  earningsLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  earningsValue: { fontSize: 20, fontWeight: "900", marginTop: 6 },
  earningsGhs: { fontSize: 14, marginTop: 2 },
  earningsProjection: { fontSize: 12, marginTop: 10, lineHeight: 18 },
});