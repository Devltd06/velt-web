import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { safePush } from '@/lib/navigation';
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/lib/store/profile";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "app/themes";

import NotificationBanner from "components/NotificationsBanner";

/* Theme colors now come directly from the shared ThemeProvider. */

/* ---------- Types ---------- */
type ActivityType = "timecut_story" | "explore_post" | "market_post" | "message_received" | "generic";

type ProfileBrief = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

interface NotificationItem {
  id: string;
  actor?: string | null;
  actor_profile?: ProfileBrief | null;
  type: ActivityType | string;
  title?: string | null;
  body?: string | null;
  data?: any;
  read: boolean;
  delivered?: boolean;
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: ActivityType;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string;
  image_url?: string | null;
  timestamp: string;
  source_id: string;
  conversation_id?: string;
  unread?: boolean;
}

/* ---------- Constants ---------- */
const AVATAR_FALLBACK = "https://via.placeholder.com/96x96.png?text=%20";
const IMAGE_FALLBACK = "https://via.placeholder.com/800x600.png?text=No+Image";

/* ---------- Component ---------- */
export default function Activities(): React.ReactElement {
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();
  const { profile } = useProfileStore();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredNotifications, setFilteredNotifications] = useState<NotificationItem[]>([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // banner state
  const [bannerState, setBannerState] = useState<{
    visible: boolean;
    title?: string;
    body?: string;
    onPress?: () => void;
  }>({ visible: false, title: "", body: "", onPress: undefined });

  // sound
  const refreshSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(require("@/assets/sounds/refresh.mp3"));
        if (mounted) refreshSoundRef.current = sound;
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
      refreshSoundRef.current?.unloadAsync();
      refreshSoundRef.current = null;
    };
  }, []);

  /* ----------------- Load notifications + unread count ----------------- */
  const loadNotifications = useCallback(
    async (limit = 50, offset = 0) => {
      if (!profile?.id) return;
      setLoading(true);
      try {
        const { data: list, error: listErr } = await supabase.rpc("notifications_list", {
          p_recipient: profile.id,
          p_limit: limit,
          p_offset: offset,
        });
        if (listErr) {
          console.error("notifications_list rpc error", listErr);
          throw listErr;
        }

        const mapped: NotificationItem[] = (list ?? []).map((r: any) => ({
          id: r.id,
          actor: r.actor,
          actor_profile: null,
          type: r.type ?? "generic",
          title: r.title ?? null,
          body: r.body ?? null,
          data: r.data ?? {},
          read: !!r.read,
          delivered: !!r.delivered,
          created_at: r.created_at,
        }));

        setNotifications(mapped);
        setFilteredNotifications(mapped);

        const { data: cnt, error: cntErr } = await supabase.rpc("notifications_unread_count", {
          p_recipient: profile.id,
        });
        if (!cntErr) {
          setUnreadCount(Number(cnt ?? 0));
        } else {
          console.warn("unread count rpc err", cntErr);
        }
      } catch (e) {
        console.error("loadNotifications error", e);
      } finally {
        setLoading(false);
      }
    },
    [profile?.id]
  );

  /* ----------------- Realtime subscription ----------------- */
  useEffect(() => {
    if (!profile?.id) return;
    loadNotifications();

    const notifChannel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "notifications",
          event: "INSERT",
          filter: `recipient=eq.${profile.id}`,
        },
        (payload: any) => {
          const n = payload.new;
          if (!n) return;
          const newItem: NotificationItem = {
            id: n.id,
            actor: n.actor,
            actor_profile: null,
            type: n.type ?? "generic",
            title: n.title ?? null,
            body: n.body ?? null,
            data: n.data ?? {},
            read: !!n.read,
            delivered: !!n.delivered,
            created_at: n.created_at,
          };

          // Prepend
          setNotifications((prev) => [newItem, ...prev.filter((x) => x.id !== newItem.id)]);
          setFilteredNotifications((prev) => [newItem, ...prev.filter((x) => x.id !== newItem.id)]);
          if (!newItem.read) setUnreadCount((c) => c + 1);

          // Show banner — use the DB-provided title/body (fallbacks included)
          setBannerState({
            visible: true,
            title: newItem.title ?? (newItem.type === "message" ? "New message" : "Notification"),
            body: newItem.body ?? "",
            onPress: () => {
              // on press, hide banner and open notification
              setBannerState((s) => ({ ...s, visible: false }));
              openNotification(newItem);
            },
          });
        }
      )
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "notifications",
          event: "UPDATE",
          filter: `recipient=eq.${profile.id}`,
        },
        (payload: any) => {
          const n = payload.new;
          const old = payload.old;
          if (!n) return;
          setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, ...n } : p)));
          setFilteredNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, ...n } : p)));
          if (old && old.read === false && n.read === true) {
            setUnreadCount((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    // Keep message realtime preview (works even if DB trigger also creates notifications)
    const msgChannel = supabase
      .channel(`rt-activities-messages-${profile.id}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "messages",
          event: "INSERT",
        },
        async (payload: any) => {
          try {
            const m = payload.new;
            if (!m) return;
            if (m.sender_id === profile.id) return;
            // check membership quickly
            const { data: rows } = await supabase
              .from("conversation_participants")
              .select("user_id")
              .eq("conversation_id", m.conversation_id)
              .eq("user_id", profile.id)
              .limit(1);
            if (!rows?.length) return;

            const { data: sender } = await supabase
              .from("profiles")
              .select("id, username, full_name, avatar_url")
              .eq("id", m.sender_id)
              .maybeSingle();

            const preview: NotificationItem = {
              id: `message-preview-${m.id}`,
              actor: m.sender_id,
              actor_profile: sender ?? null,
              type: "message_received",
              title: sender?.username ?? sender?.full_name ?? "New message",
              body: m.content ?? "",
              data: { conversation_id: m.conversation_id, message_id: m.id, screen: "/message/chat/[id]", params: { id: m.conversation_id } },
              read: false,
              delivered: true,
              created_at: m.created_at,
            };

            setNotifications((prev) => [preview, ...prev.filter((x) => x.id !== preview.id)]);
            setFilteredNotifications((prev) => [preview, ...prev.filter((x) => x.id !== preview.id)]);
            setUnreadCount((c) => c + 1);

            // Show banner for preview too
            setBannerState({
              visible: true,
              title: preview.title,
              body: preview.body,
              onPress: () => {
                setBannerState((s) => ({ ...s, visible: false }));
                openNotification(preview);
              },
            });
          } catch (err) {
            // swallow
          }
        }
      )
      .subscribe();

    return () => {
      try {
        notifChannel.unsubscribe();
      } catch {}
      try {
        msgChannel.unsubscribe();
      } catch {}
    };
  }, [profile?.id, loadNotifications]);

  /* ----------------- Search filter ----------------- */
  useEffect(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      setFilteredNotifications(notifications);
      return;
    }
    setFilteredNotifications(
      notifications.filter(
        (n) =>
          (n.title ?? "").toLowerCase().includes(lower) ||
          (n.body ?? "").toLowerCase().includes(lower) ||
          JSON.stringify(n.data ?? {}).toLowerCase().includes(lower)
      )
    );
  }, [query, notifications]);

  /* ----------------- Utilities ----------------- */
  const timeAgoLabel = (iso: string) => {
    if (!iso) return "";
    const ts = new Date(iso).getTime();
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString();
  };

  /* ----------------- Actions ----------------- */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSoundRef.current?.replayAsync();
    } catch {}
    await loadNotifications();
    setRefreshing(false);
  };

  const markNotificationRead = async (notifId: string) => {
    if (!profile?.id || !notifId) return;
    try {
      await supabase.rpc("notifications_mark_read", { p_recipient: profile.id, p_ids: [notifId] });
      setNotifications((prev) => prev.map((p) => (p.id === notifId ? { ...p, read: true } : p)));
      setFilteredNotifications((prev) => prev.map((p) => (p.id === notifId ? { ...p, read: true } : p)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.warn("mark read failed", e);
    }
  };

  const openNotification = async (n: NotificationItem) => {
    try {
      if (!n) return;
      if (!n.read) await markNotificationRead(n.id);

      const payload = n.data ?? {};
        if (payload?.conversation_id) {
        safePush(router, `/message/chat/${payload.conversation_id}`);
        return;
      }
      if (payload?.screen && payload?.params) {
        safePush(router, { pathname: payload.screen, params: payload.params });
        return;
      }
      if (n.type === "timecut_story" && payload?.story_id) {
        safePush(router, { pathname: "/timecuts/[id]", params: { id: payload.story_id } });
      } else if ((n.type === "market_post" || n.type === "post_gift") && payload?.post_id) {
        safePush(router, { pathname: "/market/product-details", params: { id: payload.post_id } });
      } else {
        Alert.alert(n.title ?? "Notification", n.body ?? "No details available");
      }
    } catch (e) {
      console.error("openNotification err", e);
    }
  };

  /* ----------------- Section grouping ----------------- */
  const sections = useMemo(() => {
    const arr = filteredNotifications ?? [];
    if (arr.length === 0) return [];

    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;
    const oneWeek = oneDay * 7;

    const buckets: { title: string; data: NotificationItem[] }[] = [
      { title: "New", data: [] },
      { title: "This Week", data: [] },
      { title: "Earlier", data: [] },
    ];

    arr.forEach((it) => {
      const diff = now - new Date(it.created_at).getTime();
      if (diff < oneDay) buckets[0].data.push(it);
      else if (diff < oneWeek) buckets[1].data.push(it);
      else buckets[2].data.push(it);
    });

    return buckets.filter((s) => s.data.length > 0);
  }, [filteredNotifications]);

  /* ----------------- Renderers ----------------- */
  const renderRow = ({ item }: { item: NotificationItem }) => {
    const actorName = item.actor_profile?.username ?? item.actor_profile?.full_name ?? (item.actor ? "Someone" : "System");
    const title = item.title ?? actorName;
    const subtitle = item.body ?? "";
    const media = (item.data?.image as string) ?? (Array.isArray(item.data?.media_urls) ? item.data.media_urls[0] : null);

    return (
      <TouchableOpacity
        onPress={() => openNotification(item)}
        activeOpacity={0.8}
        style={[styles.row, { borderBottomColor: colors.border, backgroundColor: item.read ? "transparent" : colors.faint }]}
      >
        <TouchableOpacity
            onPress={() => {
            if (item.actor) safePush(router, { pathname: "/profile/[id]", params: { id: item.actor } });
          }}>
        >
          <Image source={{ uri: (item.actor_profile?.avatar_url ?? AVATAR_FALLBACK) as string }} style={styles.avatar} />
        </TouchableOpacity>

        <View style={styles.centerCol}>
          <Text style={[styles.rowText, { color: colors.text }]}>
            <Text style={[styles.username, { color: colors.text }]}>{title}</Text>{" "}
            <Text style={{ color: colors.subtext }}>{subtitle ? "" : ""}</Text>
          </Text>

          {!!subtitle && (
            <Text style={[styles.snippet, { color: colors.subtext }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}

          <Text style={[styles.timeLabel, { color: colors.subtext }]}>{timeAgoLabel(item.created_at)}</Text>
        </View>

        <View style={styles.rightCol}>
          {media ? <Image source={{ uri: (media ?? IMAGE_FALLBACK) as string }} style={styles.thumb} /> : <Ionicons name="notifications-outline" size={26} color={colors.subtext} />}

          {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{section.title}</Text>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="notifications-off-outline" size={42} color={colors.subtext} />
      <Text style={[styles.emptyText, { color: colors.subtext }]}>No notifications yet</Text>
    </View>
  );

  /* ---------- Main render ---------- */
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Banner sits here (absolute). NotificationBanner handles animation and auto-close */}
      <NotificationBanner
        visible={bannerState.visible}
        title={bannerState.title}
        body={bannerState.body}
        onClose={() => setBannerState((s) => ({ ...s, visible: false }))}
        onPress={() => {
          bannerState.onPress?.();
          setBannerState((s) => ({ ...s, visible: false }));
        }}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => {}} style={{ marginRight: 12 }}>
              <Ionicons name="mail-open-outline" size={20} color={colors.subtext} />
            </TouchableOpacity>
            <View style={{ minWidth: 32, alignItems: "flex-end" }}>
              <Text style={{ color: colors.subtext }}>{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.subtext} style={{ marginLeft: 10 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.subtext}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")} style={{ padding: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.subtext} />}
          ListEmptyComponent={<ListEmpty />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 4,
    marginHorizontal: 0,
    height: 44,
    paddingRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 15,
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.75,
  },

  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#222",
  },
  centerCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  rightCol: {
    width: 64,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  rowText: {
    fontSize: 15,
    lineHeight: 20,
  },
  username: {
    fontWeight: "800",
  },
  snippet: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.96,
  },
  timeLabel: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.9,
  },

  thumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#ddd",
  },

  unreadDot: {
    marginTop: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  empty: {
    padding: 48,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
});
