import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'app/themes';
import SwipeBackContainer from '@/components/SwipeBackContainer';

type TabKey = 'followers' | 'following' | 'likes';

type ConnectionUser = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'likes', label: 'Likes' },
];

export default function ConnectionsScreen() {
  const params = useLocalSearchParams<{ id?: string; section?: string }>();
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();
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
  const statusBarStyle = theme.isDark ? 'light' : 'dark';

  const [profileId, setProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('followers');
  const [followers, setFollowers] = useState<ConnectionUser[]>([]);
  const [following, setFollowing] = useState<ConnectionUser[]>([]);
  const [likes, setLikes] = useState<ConnectionUser[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<TabKey, boolean>>({ followers: false, following: false, likes: false });
  const [loadedMap, setLoadedMap] = useState<Record<TabKey, boolean>>({ followers: false, following: false, likes: false });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storyIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const requested = typeof params.section === 'string' ? (params.section as TabKey) : null;
    if (requested && (['followers', 'following', 'likes'] as TabKey[]).includes(requested)) {
      setActiveTab(requested);
    }
  }, [params.section]);

  useEffect(() => {
    if (typeof params.id === 'string' && params.id.length) {
      setProfileId(params.id);
      return;
    }
    (async () => {
      const { data } = await supabase.auth.getUser();
      setProfileId(data?.user?.id ?? null);
    })();
  }, [params.id]);

  useEffect(() => {
    storyIdsRef.current = [];
    setFollowers([]);
    setFollowing([]);
    setLikes([]);
    setLoadedMap({ followers: false, following: false, likes: false });
  }, [profileId]);

  const fetchProfilesByIds = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return [] as ConnectionUser[];
    const { data, error } = await supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', unique);
    if (error || !data) return [] as ConnectionUser[];
    const order = new Map(unique.map((id, idx) => [id, idx]));
    return [...data].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) as ConnectionUser[];
  }, []);

  const getStoryIds = useCallback(async () => {
    if (!profileId) return [];
    if (storyIdsRef.current.length) return storyIdsRef.current;
    const { data } = await supabase.from('stories').select('id').eq('user_id', profileId).limit(500);
    const ids = (data ?? []).map((row: any) => row.id).filter(Boolean);
    storyIdsRef.current = ids;
    return ids;
  }, [profileId]);

  const fetchTab = useCallback(async (key: TabKey, force?: boolean) => {
    if (!profileId) return;
    setLoadingMap((prev) => ({ ...prev, [key]: true }));
    if (force) {
      setLoadedMap((prev) => ({ ...prev, [key]: false }));
    }
    try {
      setError(null);
      let list: ConnectionUser[] = [];
      if (key === 'followers') {
        const { data, error } = await supabase.from('follows').select('follower_id').eq('following_id', profileId).limit(500);
        if (!error && data) {
          const ids = data.map((row: any) => row.follower_id).filter(Boolean);
          list = await fetchProfilesByIds(ids);
        }
      } else if (key === 'following') {
        const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', profileId).limit(500);
        if (!error && data) {
          const ids = data.map((row: any) => row.following_id).filter(Boolean);
          list = await fetchProfilesByIds(ids);
        }
      } else {
        const storyIds = await getStoryIds();
        if (storyIds.length) {
          const { data, error } = await supabase.from('story_likes').select('user_id').in('story_id', storyIds).limit(1000);
          if (!error && data) {
            const ids = data.map((row: any) => row.user_id).filter(Boolean);
            list = await fetchProfilesByIds(ids);
          }
        }
      }

      if (key === 'followers') setFollowers(list);
      if (key === 'following') setFollowing(list);
      if (key === 'likes') setLikes(list);
      setLoadedMap((prev) => ({ ...prev, [key]: true }));
    } catch (err) {
      setError('Unable to load connections right now.');
    } finally {
      setLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  }, [profileId, fetchProfilesByIds, getStoryIds]);

  useEffect(() => {
    if (!profileId) return;
    if (loadedMap[activeTab]) return;
    fetchTab(activeTab);
  }, [profileId, activeTab, loadedMap, fetchTab]);

  const handleRefresh = useCallback(async () => {
    if (!profileId) return;
    setRefreshing(true);
    await fetchTab(activeTab, true);
    setRefreshing(false);
  }, [activeTab, fetchTab, profileId]);

  const currentData = activeTab === 'followers' ? followers : activeTab === 'following' ? following : likes;
  const emptyCopy: Record<TabKey, string> = {
    followers: 'No followers yet',
    following: 'Not following anyone yet',
    likes: 'No likes yet',
  };

  const renderItem = useCallback(({ item }: { item: ConnectionUser }) => {
    const initials = (item.full_name || item.username || 'U')
      .split(' ')
      .map((chunk) => chunk.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: theme.card, borderColor: theme.hair }]}
        onPress={() => item.id && router.push(`/profile/view/${item.id}`)}
      >
        {item.avatar_url ? (
          <ExpoImage source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" cachePolicy="disk" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.hair, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {item.full_name || item.username || 'User'}
          </Text>
          {item.username ? (
            <Text style={[styles.rowSubtitle, { color: theme.sub }]} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.sub} />
      </TouchableOpacity>
    );
  }, [router, theme.card, theme.hair, theme.sub, theme.text]);

  return (
    <SwipeBackContainer>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}> 
      <StatusBar style={statusBarStyle} translucent />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { borderColor: theme.hair }]}> 
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Connections</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.tabRow, { backgroundColor: theme.card, borderColor: theme.hair }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabBtn, isActive && { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.tabText, { color: isActive ? '#fff' : theme.text }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={[styles.errorText, { color: '#ff6b6b' }]}>{error}</Text> : null}

      <FlatList
        data={currentData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContainer, currentData.length === 0 && { flex: 1 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loadingMap[activeTab] ? <ActivityIndicator color={theme.accent} /> : <Text style={{ color: theme.sub }}>{emptyCopy[activeTab]}</Text>}
          </View>
        }
      />
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 40 },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 8,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '700' },
  errorText: { textAlign: 'center', marginTop: 6, fontSize: 12 },
  listContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 68,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  rowTitle: { fontSize: 16, fontWeight: '800' },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
