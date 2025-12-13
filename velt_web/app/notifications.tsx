// app/notifications.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Image,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/lib/store/profile";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from "app/themes";
import * as Haptics from "expo-haptics";
import { Swipeable, TouchableOpacity } from "react-native-gesture-handler";

import NotificationBanner from "components/NotificationsBanner";
import SwipeBackContainer from '@/components/SwipeBackContainer';

const { width: SCREEN_W } = Dimensions.get("window");

/* ---------- Types ---------- */
type ActivityType = "timecut_story" | "explore_post" | "market_post" | "message_received" | "generic" | "like" | "comment" | "follow" | "mention" | "share";

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
type SoundInstance = InstanceType<typeof Audio.Sound>;

/* ---------- Helper: Get icon for notification type ---------- */
const getNotificationIcon = (type: string): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (type) {
    case "like":
      return { name: "heart", color: "#FF4D6D" };
    case "comment":
      return { name: "chatbubble", color: VELT_ACCENT };
    case "follow":
      return { name: "person-add", color: "#8B5CF6" };
    case "mention":
      return { name: "at", color: "#F59E0B" };
    case "share":
      return { name: "share-social", color: "#10B981" };
    case "message_received":
    case "message":
      return { name: "chatbubble-ellipses", color: VELT_ACCENT };
    case "timecut_story":
    case "story":
      return { name: "time", color: "#EC4899" };
    case "market_post":
    case "post_gift":
    case "product":
      return { name: "gift", color: "#F97316" };
    case "explore_post":
    case "post":
      return { name: "compass", color: VELT_ACCENT };
    case "reply":
      return { name: "arrow-undo", color: "#6366F1" };
    case "repost":
      return { name: "repeat", color: "#10B981" };
    case "invite":
      return { name: "mail", color: "#F59E0B" };
    default:
      return { name: "notifications", color: "#6B7280" };
  }
};

/* ---------- Helper: Get notification title based on type ---------- */
const getNotificationTitle = (type: string, actorName: string): string => {
  switch (type) {
    case "like":
      return `${actorName} liked your post`;
    case "comment":
      return `${actorName} commented`;
    case "follow":
      return `${actorName} followed you`;
    case "mention":
      return `${actorName} mentioned you`;
    case "share":
      return `${actorName} shared your post`;
    case "message_received":
    case "message":
      return `New message from ${actorName}`;
    case "timecut_story":
    case "story":
      return `${actorName} posted a story`;
    case "market_post":
    case "product":
      return `${actorName} listed a new product`;
    case "post_gift":
      return `${actorName} sent you a gift`;
    case "explore_post":
    case "post":
      return `${actorName} posted something new`;
    case "reply":
      return `${actorName} replied to you`;
    case "repost":
      return `${actorName} reposted your content`;
    case "invite":
      return `${actorName} invited you`;
    default:
      return "New notification";
  }
};

/* ---------- Helper: Get notification body based on type ---------- */
const getNotificationBody = (type: string, actorName: string): string => {
  switch (type) {
    case "like":
      return "Tap to see the post";
    case "comment":
      return "Tap to view the comment";
    case "follow":
      return "Tap to view their profile";
    case "mention":
      return "Tap to see where you were mentioned";
    case "share":
      return "Your content is being shared!";
    case "message_received":
    case "message":
      return "Tap to open the conversation";
    case "timecut_story":
    case "story":
      return "Tap to watch their story";
    case "market_post":
    case "product":
      return "Check out this new listing";
    case "post_gift":
      return "You received a gift!";
    case "reply":
      return "Tap to see the reply";
    case "repost":
      return "Your content is getting attention!";
    case "invite":
      return "Tap to view the invitation";
    default:
      return "";
  }
};

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
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // banner state
  const [bannerState, setBannerState] = useState<{
    visible: boolean;
    title?: string;
    body?: string;
    avatarUrl?: string;
    onPress?: () => void;
  }>({ visible: false, title: "", body: "", avatarUrl: undefined, onPress: undefined });

  // sound and swipeable refs
  const refreshSoundRef = useRef<SoundInstance | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

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

        // Fetch actor profiles for all notifications with actors
        const actorIds = [...new Set(mapped.filter(n => n.actor).map(n => n.actor!))];
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', actorIds);
          
          if (profiles) {
            const profileMap = new Map(profiles.map(p => [p.id, p]));
            mapped.forEach(n => {
              if (n.actor && profileMap.has(n.actor)) {
                n.actor_profile = profileMap.get(n.actor) as ProfileBrief;
              }
            });
          }
        }

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
        async (payload: any) => {
          const n = payload.new;
          if (!n) return;
          // Fetch actor profile for the new notification
          let actorProfile: ProfileBrief | null = null;
          if (n.actor) {
            try {
              const { data: actorData } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url')
                .eq('id', n.actor)
                .maybeSingle();
              actorProfile = actorData || null;
            } catch {}
          }

          const newItem: NotificationItem = {
            id: n.id,
            actor: n.actor,
            actor_profile: actorProfile,
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

          // Build display name for banner
          const displayName = actorProfile?.full_name || actorProfile?.username || 'Someone';
          const bannerTitle = newItem.title || getNotificationTitle(newItem.type, displayName);
          const bannerBody = newItem.body || getNotificationBody(newItem.type, displayName);

          // Show banner with actor info
          setBannerState({
            visible: true,
            title: bannerTitle,
            body: bannerBody,
            avatarUrl: actorProfile?.avatar_url || undefined,
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
              title: sender?.full_name ?? sender?.username ?? "New message",
              body: m.content ?? "",
              data: { conversation_id: m.conversation_id, message_id: m.id, screen: "/message/chat/[id]", params: { id: m.conversation_id } },
              read: false,
              delivered: true,
              created_at: m.created_at,
            };

            setNotifications((prev) => [preview, ...prev.filter((x) => x.id !== preview.id)]);
            setFilteredNotifications((prev) => [preview, ...prev.filter((x) => x.id !== preview.id)]);
            setUnreadCount((c) => c + 1);

            // Build display name for banner
            const displayName = sender?.full_name || sender?.username || 'Someone';

            // Show banner for message preview
            setBannerState({
              visible: true,
              title: `Message from ${displayName}`,
              body: m.content || "Sent you a message",
              avatarUrl: sender?.avatar_url || undefined,
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  const markAllAsRead = async () => {
    if (!profile?.id || unreadCount === 0) return;
    setMarkingAllRead(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabase.rpc("notifications_mark_read", { p_recipient: profile.id, p_ids: unreadIds });
        setNotifications((prev) => prev.map((p) => ({ ...p, read: true })));
        setFilteredNotifications((prev) => prev.map((p) => ({ ...p, read: true })));
        setUnreadCount(0);
      }
    } catch (e) {
      console.warn("mark all read failed", e);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const deleteNotification = async (notifId: string) => {
    if (!profile?.id || !notifId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      swipeableRefs.current.get(notifId)?.close();
      const wasUnread = notifications.find((n) => n.id === notifId)?.read === false;
      setNotifications((prev) => prev.filter((p) => p.id !== notifId));
      setFilteredNotifications((prev) => prev.filter((p) => p.id !== notifId));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      await supabase.from("notifications").delete().eq("id", notifId).eq("recipient", profile.id);
    } catch (e) {
      console.warn("delete notification failed", e);
      loadNotifications();
    }
  };

  const openNotification = async (n: NotificationItem) => {
    try {
      if (!n) return;
      Haptics.selectionAsync().catch(() => {});
      if (!n.read) await markNotificationRead(n.id);

      const payload = n.data ?? {};
      
      // Priority 1: Direct conversation routing (messages)
      if (payload?.conversation_id) {
        router.push({ pathname: "/message/chat/[id]", params: { id: payload.conversation_id } });
        return;
      }
      
      // Priority 2: Explicit screen/params in payload
      if (payload?.screen && payload?.params) {
        router.push({ pathname: payload.screen, params: payload.params });
        return;
      }
      
      // Priority 3: Route based on notification type
      switch (n.type) {
        case "message_received":
        case "message":
          // If we somehow don't have conversation_id, try message_id lookup
          if (payload?.message_id) {
            try {
              const { data: msg } = await supabase
                .from("messages")
                .select("conversation_id")
                .eq("id", payload.message_id)
                .maybeSingle();
              if (msg?.conversation_id) {
                router.push({ pathname: "/message/chat/[id]", params: { id: msg.conversation_id } });
                return;
              }
            } catch {}
          }
          break;
          
        case "timecut_story":
        case "story":
          if (payload?.story_id) {
            router.push({ pathname: "/story/preview", params: { storyId: payload.story_id } });
            return;
          }
          // If no story_id but has actor, go to their profile to see stories
          if (n.actor) {
            router.push({ pathname: "/explore/user_stories/[userId]", params: { userId: n.actor } });
            return;
          }
          break;
          
        case "market_post":
        case "product":
          if (payload?.post_id || payload?.product_id) {
            router.push({ pathname: "/market/product-details", params: { id: payload.post_id || payload.product_id } });
            return;
          }
          break;
          
        case "post_gift":
          if (payload?.post_id) {
            router.push({ pathname: "/market/product-details", params: { id: payload.post_id } });
            return;
          }
          break;
          
        case "like":
        case "comment":
        case "reply":
        case "mention":
          // Route to the post/content that was interacted with
          // Story takes priority as most likes/comments are on stories
          if (payload?.story_id) {
            router.push({ pathname: "/story/preview", params: { storyId: payload.story_id } });
            return;
          }
          if (payload?.post_id) {
            // Posts in this app are typically stories
            router.push({ pathname: "/story/preview", params: { storyId: payload.post_id } });
            return;
          }
          if (payload?.comment_id && payload?.parent_story_id) {
            router.push({ pathname: "/story/preview", params: { storyId: payload.parent_story_id } });
            return;
          }
          break;
          
        case "follow":
          if (n.actor) {
            router.push({ pathname: "/profile/view/[id]", params: { id: n.actor } });
            return;
          }
          break;
          
        case "share":
        case "repost":
          if (payload?.story_id) {
            router.push({ pathname: "/story/preview", params: { storyId: payload.story_id } });
            return;
          }
          if (payload?.post_id) {
            router.push({ pathname: "/story/preview", params: { storyId: payload.post_id } });
            return;
          }
          break;
          
        case "invite":
          if (payload?.conversation_id) {
            router.push({ pathname: "/message/chat/[id]", params: { id: payload.conversation_id } });
            return;
          }
          if (payload?.group_id) {
            router.push({ pathname: "/message/chat/[id]", params: { id: payload.group_id } });
            return;
          }
          break;
          
        case "explore_post":
        case "post":
          if (payload?.story_id) {
            router.push({ pathname: "/story/preview", params: { storyId: payload.story_id } });
            return;
          }
          if (payload?.post_id) {
            router.push({ pathname: "/story/preview", params: { storyId: payload.post_id } });
            return;
          }
          break;
      }
      
      // Fallback: If we have an actor, go to their profile
      if (n.actor) {
        router.push({ pathname: "/profile/view/[id]", params: { id: n.actor } });
        return;
      }
      
      // Last resort: just go to notifications (already here)
      console.warn("Could not determine route for notification", n);
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

  /* ----------------- Swipe Actions ----------------- */
  const renderRightActions = (item: NotificationItem) => {
    return (
      <View style={styles.swipeActionsRight}>
        <Pressable
          style={({ pressed }) => [styles.swipeAction, { backgroundColor: VELT_ACCENT, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          onPress={() => {
            swipeableRefs.current.get(item.id)?.close();
            if (!item.read) markNotificationRead(item.id);
          }}
        >
          <Ionicons name="checkmark" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Read</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.swipeAction, { backgroundColor: "#EF4444", transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          onPress={() => deleteNotification(item.id)}
        >
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );
  };

  /* ----------------- Renderers ----------------- */
  const renderRow = ({ item }: { item: NotificationItem }) => {
    // Prefer full_name, fallback to username, then "Someone" or "System"
    const actorName = item.actor_profile?.full_name || item.actor_profile?.username || (item.actor ? "Someone" : "System");
    // Use custom title or fallback to notification helper
    const title = item.title || getNotificationTitle(item.type, actorName);
    // Use custom body or fallback to notification helper
    const subtitle = item.body || getNotificationBody(item.type, actorName);
    const media = (item.data?.image as string) ?? (Array.isArray(item.data?.media_urls) ? item.data.media_urls[0] : null);
    const iconInfo = getNotificationIcon(item.type);

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
        }}
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
        friction={2}
      >
        <Pressable
          onPress={() => openNotification(item)}
          style={({ pressed }) => [
            styles.row,
            {
              borderBottomColor: colors.border,
              backgroundColor: item.read ? colors.bg : `${VELT_ACCENT}10`,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {/* Avatar with type indicator */}
          <View style={styles.avatarContainer}>
            <Pressable
              onPress={() => {
                const actorId = item.actor;
                if (typeof actorId === "string" && actorId.length > 0) {
                  router.push({ pathname: "/profile/view/[id]", params: { id: actorId } });
                }
              }}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <Image
                source={{ uri: (item.actor_profile?.avatar_url ?? AVATAR_FALLBACK) as string }}
                style={[styles.avatar, { borderColor: colors.border }]}
              />
            </Pressable>
            <View style={[styles.typeIndicator, { backgroundColor: iconInfo.color }]}>
              <Ionicons name={iconInfo.name} size={12} color="#fff" />
            </View>
          </View>

          {/* Content */}
          <View style={styles.centerCol}>
            <View style={styles.titleRow}>
              <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {!item.read && <View style={[styles.unreadDot, { backgroundColor: VELT_ACCENT }]} />}
            </View>

            {!!subtitle && (
              <Text style={[styles.snippet, { color: colors.subtext }]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}

            <Text style={[styles.timeLabel, { color: colors.subtext }]}>{timeAgoLabel(item.created_at)}</Text>
          </View>

          {/* Media thumbnail or chevron */}
          <View style={styles.rightCol}>
            {media ? (
              <Image source={{ uri: media }} style={styles.thumb} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
            )}
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>{section.title}</Text>
      <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: `${VELT_ACCENT}15` }]}>
        <Ionicons name="notifications-off-outline" size={48} color={VELT_ACCENT} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications</Text>
      <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>
        When you get notifications, they'll show up here
      </Text>
    </View>
  );

  /* ---------- Main render ---------- */
  return (
    <SwipeBackContainer>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Banner sits here (absolute). NotificationBanner handles animation and auto-close */}
      <NotificationBanner
        visible={bannerState.visible}
        title={bannerState.title}
        body={bannerState.body}
        avatarUrl={bannerState.avatarUrl}
        onClose={() => setBannerState((s) => ({ ...s, visible: false }))}
        onPress={() => {
          bannerState.onPress?.();
          setBannerState((s) => ({ ...s, visible: false }));
        }}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable 
              onPress={() => router.back()} 
              style={({ pressed }) => [{ marginRight: 12, transform: [{ scale: pressed ? 0.9 : 1 }] }]}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {unreadCount > 0 && (
              <Pressable 
                onPress={markAllAsRead} 
                style={({ pressed }) => [{ 
                  paddingHorizontal: 12, 
                  paddingVertical: 6, 
                  backgroundColor: `${VELT_ACCENT}20`,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                }]}
              >
                <Ionicons name="checkmark-done" size={16} color={VELT_ACCENT} />
                <Text style={{ color: VELT_ACCENT, fontSize: 12, fontWeight: "600" }}>Mark all read</Text>
              </Pressable>
            )}
            <View style={{ 
              backgroundColor: unreadCount > 0 ? VELT_ACCENT : colors.card,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
            }}>
              <Text style={{ 
                color: unreadCount > 0 ? "#fff" : colors.subtext, 
                fontSize: 12, 
                fontWeight: "600" 
              }}>
                {unreadCount > 0 ? unreadCount : "✓"}
              </Text>
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
            <Pressable 
              onPress={() => setQuery("")} 
              style={({ pressed }) => [{ padding: 8, transform: [{ scale: pressed ? 0.9 : 1 }] }]}
            >
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </Pressable>
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
    </SwipeBackContainer>
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
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.3,
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
  sectionDivider: {
    height: 1,
    marginTop: 8,
    opacity: 0.3,
  },

  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#222",
  },
  typeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  centerCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  rightCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },

  rowText: {
    fontSize: 14,
    lineHeight: 20,
  },
  username: {
    fontWeight: "700",
  },
  snippet: {
    marginTop: 2,
    fontSize: 13,
    opacity: 0.8,
  },
  timeLabel: {
    fontSize: 12,
    opacity: 0.6,
  },

  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#ddd",
    marginTop: 4,
  },

  unreadDot: {
    marginTop: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Swipe action styles
  swipeActionsRight: {
    flexDirection: "row",
  },
  swipeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
  swipeActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },

  // Row item styles
  typeIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  empty: {
    padding: 48,
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
});
