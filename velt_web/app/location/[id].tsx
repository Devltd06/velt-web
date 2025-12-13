import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Image, FlatList, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, Animated, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { useTheme, VELT_ACCENT } from 'app/themes';
import { supabase } from '@/lib/supabase';
import { getCurrentUserIdAsync } from '@/lib/currentuser';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Type for related posts
type RelatedPost = {
  id: string;
  place: string;
  images: string[];
  videos: string[];
  media_type: string;
  avatar: string | null;
  authorName: string | null;
  stars: number;
  caption: string | null;
  created_at: string | null;
};

export default function LocationPostViewer() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const id = String(params.id ?? '');
  const { colors } = useTheme();

  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [starred, setStarred] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Related posts state
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [relatedPostsLoading, setRelatedPostsLoading] = useState(false);
  const [relatedStarred, setRelatedStarred] = useState<Record<string, boolean>>({});

  const insets = useSafeAreaInsets();
  
  // Fetch current user ID on mount
  useEffect(() => {
    getCurrentUserIdAsync().then((id) => setCurrentUserId(id)).catch(() => {});
  }, []);

  // Check if this is the user's own post
  const isOwnPost = currentUserId && post?.user_id && currentUserId === post.user_id;

  // helper: toggle star (extracted so header & content can use it)
  const handleToggleStar = async () => {
    if (isOwnPost) return; // Can't star own post
    Haptics.selectionAsync().catch(() => {});
    const was = starred;
    setStarred(!was);
    setStarCount((c) => (c ?? 0) + (was ? -1 : 1));
    try {
      const me = await getCurrentUserIdAsync();
      if (!me) throw new Error('not-signed-in');
      const { data: rpcData, error } = await supabase.rpc('toggle_location_post_star', { p_post_id: post.id, p_user_id: me });
      if (error) throw error;
      // try to extract numeric count
      let next: number | null = null;
      if (rpcData != null) {
        if (typeof rpcData === 'number' || typeof rpcData === 'string') next = Number(rpcData);
        else if (Array.isArray(rpcData)) {
          const first = rpcData[0];
          if (typeof first === 'number' || typeof first === 'string') next = Number(first);
          else if (first && typeof first === 'object' && 'star_count' in first) next = Number(first.star_count ?? null);
        } else if (rpcData && typeof rpcData === 'object' && 'star_count' in rpcData) next = Number(rpcData.star_count ?? null);
      }
      if (next != null) setStarCount(next);
      // refresh starred membership
      const { data: meStars } = await supabase.from('location_post_stars').select('location_post_id').eq('user_id', me).eq('location_post_id', post.id).limit(1);
      setStarred(((meStars ?? []).length ?? 0) > 0);
    } catch (err) {
      console.warn('viewer star toggle error', err);
      // rollback
      setStarred((s) => s);
      // refetch counts
      try {
        const { data: sc } = await supabase.from('location_post_star_counts').select('star_count').eq('location_post_id', post.id).single();
        if (sc) setStarCount(Number(sc.star_count ?? 0));
      } catch (e) {}
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('location_posts')
          .select('id, place, caption, country, images, videos, media_type, avatar_url, author_display_name, user_id, position, latitude, longitude, created_at, profiles(id, username, full_name, avatar_url)')
          .eq('id', id)
          .limit(1)
          .single();
        if (!cancelled) {
          if (error) throw error;
          // Merge profile data into post - prefer author_display_name, fallback to profile full_name/username
          // profiles can be an array or single object depending on Supabase relationship
          const profile = Array.isArray(data?.profiles) ? data.profiles[0] : data?.profiles;
          const enrichedPost = data ? {
            ...data,
            videos: Array.isArray(data.videos) ? data.videos : [],
            media_type: data.media_type ?? 'image',
            author_display_name: data.author_display_name ?? profile?.full_name ?? profile?.username ?? 'Anonymous',
            avatar_url: data.avatar_url ?? profile?.avatar_url ?? null,
          } : null;
          setPost(enrichedPost);
          // fetch counts & comments + whether current user starred
          try {
            const ids = data?.id ? [String(data.id)] : [];
            if (ids.length) {
              (async () => {
                const { data: sc } = await supabase.from('location_post_star_counts').select('location_post_id, star_count').in('location_post_id', ids as string[]);
                const scMap: Record<string, number> = {};
                (sc ?? []).forEach((row: any) => (scMap[String(row.location_post_id)] = Number(row.star_count ?? 0)));
                setStarCount(scMap[String(data.id)] ?? null);

                const me = await getCurrentUserIdAsync();
                if (me) {
                  const { data: meStars } = await supabase.from('location_post_stars').select('location_post_id').eq('user_id', me).eq('location_post_id', data.id).limit(1);
                  setStarred(((meStars ?? []).length ?? 0) > 0);
                }

                // load comments
                const { data: coms } = await supabase
                  .from('location_post_comments')
                  .select('id, location_post_id, user_id, content, created_at, profiles(id, username, full_name, avatar_url)')
                  .eq('location_post_id', data.id)
                  .order('created_at', { ascending: true });
                const mapped = (coms ?? []).map((r: any) => ({ 
                  id: r.id, 
                  user: r.profiles?.full_name ?? r.profiles?.username ?? r.profiles?.[0]?.full_name ?? r.profiles?.[0]?.username ?? 'Anonymous', 
                  avatar_url: r.profiles?.avatar_url ?? r.profiles?.[0]?.avatar_url ?? null,
                  text: r.content, 
                  created_at: r.created_at 
                }));
                setComments(mapped);
              })();
            }
          } catch (e) {
            console.warn('viewer extras fetch error', e);
          }
        }
      } catch (err) {
        console.warn('viewer load error', err);
        Alert.alert('Error', 'Could not load post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => { cancelled = true; };
  }, [id]);

  // Fetch related posts at the same location (by place name)
  const fetchRelatedPosts = useCallback(async () => {
    if (!post?.place) return;
    setRelatedPostsLoading(true);
    try {
      // Fetch other posts with the same place name, excluding current post
      const { data, error } = await supabase
        .from('location_posts')
        .select('id, place, caption, country, images, videos, media_type, avatar_url, author_display_name, user_id, created_at, profiles(id, username, full_name)')
        .ilike('place', post.place)
        .neq('id', post.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('[location] fetchRelatedPosts err', error);
        setRelatedPosts([]);
        return;
      }

      const rows = (data ?? []) as any[];
      const mapped: RelatedPost[] = rows.map((r) => ({
        id: String(r.id),
        place: r.place ?? '—',
        caption: r.caption ?? null,
        images: Array.isArray(r.images) ? r.images : r.images ? [r.images] : [],
        videos: Array.isArray(r.videos) ? r.videos : [],
        media_type: r.media_type ?? 'image',
        avatar: r.avatar_url ?? null,
        authorName: (r.author_display_name ?? r.profiles?.[0]?.full_name ?? r.profiles?.[0]?.username ?? null) ?? null,
        created_at: r.created_at ?? null,
        stars: 0,
      }));

      setRelatedPosts(mapped);

      // Fetch star counts for related posts
      const ids = mapped.map((p) => p.id);
      if (ids.length) {
        const { data: sc } = await supabase.from('location_post_star_counts').select('location_post_id, star_count').in('location_post_id', ids as string[]);
        const scMap: Record<string, number> = {};
        (sc ?? []).forEach((row: any) => (scMap[String(row.location_post_id)] = Number(row.star_count ?? 0)));
        setRelatedPosts((cur) => cur.map((p) => ({ ...p, stars: scMap[p.id] ?? 0 })));

        // Fetch user's starred posts
        const me = await getCurrentUserIdAsync();
        if (me) {
          const { data: meStars } = await supabase.from('location_post_stars').select('location_post_id').eq('user_id', me).in('location_post_id', ids as string[]);
          const starredMap: Record<string, boolean> = {};
          (meStars ?? []).forEach((r: any) => (starredMap[String(r.location_post_id)] = true));
          setRelatedStarred(starredMap);
        }
      }
    } catch (err) {
      console.warn('[location] fetchRelatedPosts exception', err);
      setRelatedPosts([]);
    } finally {
      setRelatedPostsLoading(false);
    }
  }, [post?.place, post?.id]);

  // Load related posts when main post is loaded
  useEffect(() => {
    if (post?.place) {
      fetchRelatedPosts();
    }
  }, [post?.place, fetchRelatedPosts]);

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={VELT_ACCENT} />
        <Text style={{ color: colors.subtext, marginTop: 12, fontSize: 14 }}>Loading location...</Text>
      </View>
    </SafeAreaView>
  );

  if (!post) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="location-outline" size={64} color={colors.subtext} />
        <ThemedText style={{ fontSize: 18, fontWeight: '700', marginTop: 16 }}>Location Not Found</ThemedText>
        <ThemedText style={{ color: colors.subtext, marginTop: 8, textAlign: 'center' }}>This location may have been removed or is unavailable.</ThemedText>
        <Pressable 
          onPress={() => router.back()} 
          style={{ 
            marginTop: 24, 
            paddingHorizontal: 32, 
            paddingVertical: 14, 
            backgroundColor: VELT_ACCENT, 
            borderRadius: 999,
            shadowColor: VELT_ACCENT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>Go Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  const lat = typeof post.latitude === 'number' ? post.latitude : (post.position?.y ? (post.position.y * 180) - 90 : 0);
  const lng = typeof post.longitude === 'number' ? post.longitude : (post.position?.x ? (post.position.x * 360) - 180 : 0);

  // Combine media for display - videos first, then images
  const allMedia = [
    ...(post.videos || []).map((url: string) => ({ url, type: 'video' })),
    ...(post.images || []).map((url: string) => ({ url, type: 'image' })),
  ];
  const hasMultipleMedia = allMedia.length > 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: Math.max(140, insets.bottom + 100) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Media Section */}
        <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.52, position: 'relative' }}>
          {hasMultipleMedia ? (
            <FlatList
              data={allMedia}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(it, i) => `${post.id}-${i}`}
              renderItem={({ item }) => (
                item.type === 'video' ? (
                  <Video
                    source={{ uri: item.url }}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.52 }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted
                  />
                ) : (
                  <Image 
                    source={{ uri: item.url }} 
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.52 }}
                    resizeMode="cover"
                  />
                )
              )}
              onMomentumScrollEnd={(ev) => setViewerIndex(Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            />
          ) : allMedia.length > 0 ? (
            allMedia[0].type === 'video' ? (
              <Video
                source={{ uri: allMedia[0].url }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.52 }}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
              />
            ) : (
              <Image 
                source={{ uri: allMedia[0].url }} 
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.52 }}
                resizeMode="cover"
              />
            )
          ) : (
            <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.52, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={48} color={colors.subtext} />
            </View>
          )}

          {/* Gradient overlay for better text readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.25, 0.7, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Media pagination dots */}
          {hasMultipleMedia && (
            <View style={{ position: 'absolute', top: insets.top + 60, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
              {allMedia.map((_: any, idx: number) => (
                <View 
                  key={idx} 
                  style={{ 
                    width: idx === viewerIndex ? 24 : 8, 
                    height: 8, 
                    borderRadius: 4, 
                    backgroundColor: idx === viewerIndex ? VELT_ACCENT : 'rgba(255,255,255,0.5)',
                  }} 
                />
              ))}
            </View>
          )}

          {/* Enhanced header overlay with glassmorphism */}
          <View style={{ 
            position: 'absolute', 
            left: 16, 
            right: 16, 
            top: insets.top + 8, 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            {/* Back button with blur */}
            <Pressable 
              onPress={() => { Haptics.selectionAsync().catch(() => {}); router.back(); }} 
              hitSlop={16}
              style={({ pressed }) => [
                styles.headerButton,
                { transform: [{ scale: pressed ? 0.92 : 1 }] }
              ]}
            >
              <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </BlurView>
            </Pressable>

            {/* Star count display - only show star button if not own post */}
            {isOwnPost ? (
              // For own posts, show star count without button
              <View style={[styles.headerButtonBlur, styles.starButton, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 6 }}>
                  {starCount ?? post.stars ?? 0}
                </Text>
              </View>
            ) : (
              // Star button with glow effect when active
              <Pressable 
                onPress={handleToggleStar} 
                hitSlop={16}
                style={({ pressed }) => [
                  styles.headerButton,
                  starred && styles.starButtonActive,
                  { transform: [{ scale: pressed ? 0.92 : 1 }] }
                ]}
              >
                <BlurView intensity={40} tint={starred ? "light" : "dark"} style={[styles.headerButtonBlur, styles.starButton]}>
                  <Ionicons 
                    name={starred ? "star" : "star-outline"} 
                    size={20} 
                    color={starred ? '#FFD700' : '#fff'} 
                  />
                  <Text style={{ 
                    color: starred ? '#FFD700' : '#fff', 
                    fontWeight: '800', 
                    fontSize: 15, 
                    marginLeft: 6 
                  }}>
                    {starCount ?? post.stars ?? 0}
                  </Text>
                </BlurView>
              </Pressable>
            )}
          </View>

          {/* Enhanced bottom overlay card */}
          <View style={{ 
            position: 'absolute', 
            left: 16, 
            right: 16, 
            bottom: -40,
            zIndex: 10,
          }}>
            <BlurView 
              intensity={80} 
              tint={colors.isDark ? "dark" : "light"} 
              style={styles.bottomCard}
            >
              <View style={styles.bottomCardContent}>
                {/* Avatar with accent ring */}
                <View style={styles.avatarContainer}>
                  <View style={styles.avatarRing}>
                    {post.avatar_url ? (
                      <Image source={{ uri: post.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: colors.border }]}>
                        <Ionicons name="person" size={24} color={colors.subtext} />
                      </View>
                    )}
                  </View>
                </View>
                
                {/* Location info */}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="location" size={16} color={VELT_ACCENT} />
                    <Text style={{ 
                      color: colors.text, 
                      fontWeight: '800', 
                      fontSize: 17, 
                      marginLeft: 4,
                      letterSpacing: -0.3,
                    }}>
                      {post.place}
                    </Text>
                  </View>
                  <Text style={{ 
                    color: colors.subtext, 
                    marginTop: 4, 
                    fontSize: 13,
                    fontWeight: '500',
                  }}>
                    {post.author_display_name ?? 'Anonymous'} • {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </Text>
                </View>

                {/* Country badge */}
                {post.country && (
                  <View style={[styles.countryBadge, { backgroundColor: colors.faint }]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{post.country}</Text>
                  </View>
                )}
              </View>
            </BlurView>
          </View>
        </View>

        {/* Content Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 56, gap: 20 }}>

          {/* Map Card */}
          {(post.latitude != null || post.longitude != null || post.position) && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="map" size={20} color={VELT_ACCENT} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
              </View>
              <View style={styles.mapContainer}>
                <MapView 
                  provider={PROVIDER_GOOGLE} 
                  mapType="hybrid" 
                  style={styles.map} 
                  initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker coordinate={{ latitude: lat, longitude: lng }}>
                    <View style={styles.customMarker}>
                      <View style={styles.markerDot} />
                    </View>
                  </Marker>
                </MapView>
                {/* Map overlay button */}
                <Pressable 
                  style={styles.mapExpandButton}
                  onPress={() => { /* Open full map */ }}
                >
                  <Ionicons name="expand" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}

          {/* Description Card */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={VELT_ACCENT} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About this place</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '400' }}>
              {post.caption || (
                <Text style={{ color: colors.subtext, fontStyle: 'italic' }}>No description provided for this location.</Text>
              )}
            </Text>
          </View>

          {/* Comments Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubbles-outline" size={20} color={VELT_ACCENT} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Comments</Text>
              <View style={[styles.commentCount, { backgroundColor: VELT_ACCENT + '20' }]}>
                <Text style={{ color: VELT_ACCENT, fontSize: 12, fontWeight: '700' }}>{comments.length}</Text>
              </View>
            </View>

            {comments.length ? (
              <View style={{ gap: 12 }}>
                {comments.map((c, idx) => (
                  <View 
                    key={c.id} 
                    style={[
                      styles.commentItem,
                      { backgroundColor: colors.faint },
                      idx === 0 && { borderLeftColor: VELT_ACCENT, borderLeftWidth: 3 }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={[styles.commentAvatar, { backgroundColor: colors.border }]}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
                          {(c.user?.[0] || 'U').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginLeft: 8 }}>{c.user}</Text>
                      {c.created_at && (
                        <Text style={{ color: colors.subtext, fontSize: 11, marginLeft: 'auto' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{c.text}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubble-outline" size={32} color={colors.subtext} />
                <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 14 }}>No comments yet</Text>
                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>Be the first to share your thoughts!</Text>
              </View>
            )}
          </View>

          {/* Other Posts at This Location - Zigzag Layout */}
          {relatedPosts.length > 0 && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="images-outline" size={20} color={VELT_ACCENT} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Other posts at this location</Text>
                <View style={[styles.commentCount, { backgroundColor: VELT_ACCENT + '20' }]}>
                  <Text style={{ color: VELT_ACCENT, fontSize: 12, fontWeight: '700' }}>{relatedPosts.length}</Text>
                </View>
              </View>

              {/* Zigzag layout for related posts */}
              <View style={{ gap: 20 }}>
                {relatedPosts.map((relPost, idx) => {
                  // Zigzag: even rows = card LEFT, caption RIGHT; odd rows = caption LEFT, card RIGHT
                  const cardOnLeft = idx % 2 === 0;
                  const isStarred = !!relatedStarred[relPost.id];
                  const cardWidth = Math.min(140, (SCREEN_WIDTH - 80) * 0.45);
                  const cardHeight = 170;
                  const infoWidth = Math.min(140, (SCREEN_WIDTH - 80) * 0.45);

                  return (
                    <View
                      key={relPost.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      {/* Card on LEFT for even rows */}
                      {cardOnLeft && (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            router.push(`/location/${relPost.id}`);
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
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.5,
                            shadowRadius: 16,
                            elevation: 12,
                          }}>
                            {/* Full-bleed image */}
                            {relPost.images.length > 0 ? (
                              <Image
                                source={{ uri: relPost.images[0] }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.faint }}>
                                <Ionicons name="image-outline" size={32} color={colors.subtext} />
                              </View>
                            )}
                            {/* Stack indicator (multiple images) */}
                            {relPost.images.length > 1 && (
                              <View style={{ 
                                position: 'absolute', top: 8, left: 8,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
                                flexDirection: 'row', alignItems: 'center',
                              }}>
                                <Ionicons name="layers" size={12} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginLeft: 3 }}>{relPost.images.length}</Text>
                              </View>
                            )}
                            {/* Gradient overlay at bottom */}
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.85)']}
                              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 }}
                            />
                            {/* Avatar at bottom center */}
                            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' }}>
                              {relPost.avatar ? (
                                <Image source={{ uri: relPost.avatar }} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff' }} />
                              ) : (
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                                  <Ionicons name="person" size={12} color="#fff" />
                                </View>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      )}

                      {/* Info box */}
                      <View style={{ width: infoWidth, justifyContent: 'center', paddingHorizontal: 6 }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 4 }} numberOfLines={2}>
                          {relPost.place}
                        </Text>
                        {relPost.caption ? (
                          <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 6, lineHeight: 16 }} numberOfLines={2}>
                            {relPost.caption}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="time-outline" size={10} color={colors.subtext} style={{ marginRight: 3 }} />
                          <Text style={{ color: colors.subtext, fontSize: 10 }}>
                            {relPost.created_at ? new Date(relPost.created_at).toLocaleDateString() : ''}
                          </Text>
                        </View>
                        {relPost.authorName && (
                          <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                            by {relPost.authorName}
                          </Text>
                        )}
                      </View>

                      {/* Card on RIGHT for odd rows */}
                      {!cardOnLeft && (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            router.push(`/location/${relPost.id}`);
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
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.5,
                            shadowRadius: 16,
                            elevation: 12,
                          }}>
                            {/* Full-bleed image */}
                            {relPost.images.length > 0 ? (
                              <Image
                                source={{ uri: relPost.images[0] }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.faint }}>
                                <Ionicons name="image-outline" size={32} color={colors.subtext} />
                              </View>
                            )}
                            {/* Stack indicator (multiple images) */}
                            {relPost.images.length > 1 && (
                              <View style={{ 
                                position: 'absolute', top: 8, left: 8,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
                                flexDirection: 'row', alignItems: 'center',
                              }}>
                                <Ionicons name="layers" size={12} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginLeft: 3 }}>{relPost.images.length}</Text>
                              </View>
                            )}
                            {/* Gradient overlay at bottom */}
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.85)']}
                              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 }}
                            />
                            {/* Avatar at bottom center */}
                            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' }}>
                              {relPost.avatar ? (
                                <Image source={{ uri: relPost.avatar }} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff' }} />
                              ) : (
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                                  <Ionicons name="person" size={12} color="#fff" />
                                </View>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Loading indicator for related posts */}
              {relatedPostsLoading && (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={VELT_ACCENT} />
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Enhanced floating comment input */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        style={[styles.commentInputContainer, { bottom: insets.bottom + 8 }]}
      >
        <BlurView intensity={90} tint={colors.isDark ? "dark" : "light"} style={styles.commentInputBlur}>
          <View style={styles.commentInputRow}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.subtext}
              style={[styles.commentInput, { backgroundColor: colors.faint, color: colors.text, borderColor: colors.border }]}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={async () => {
                const text = (commentText || '').trim();
                if (!text) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                try {
                  const me = await getCurrentUserIdAsync();
                  if (!me) throw new Error('not-signed-in');
                  const payload: Record<string, any> = { location_post_id: post.id, user_id: me, content: text };
                  const insertRes = await supabase.from('location_post_comments').insert(payload).select('id').single();
                  if ((insertRes as any).error) throw (insertRes as any).error;
                  const newId = (insertRes as any).data?.id;
                  if (!newId) throw new Error('Insert failed');

                  const { data: row, error } = await supabase
                    .from('location_post_comments')
                    .select('id, location_post_id, user_id, content, created_at, profiles(id, username, full_name, avatar_url)')
                    .eq('id', newId)
                    .single();
                  if (error) throw error;
                  let profileObj: any = row.profiles;
                  if (Array.isArray(profileObj)) profileObj = profileObj?.[0];
                  const username = profileObj?.username ?? 'You';
                  const newComment = { id: row.id, user: username, text: row.content, created_at: row.created_at };

                  setComments((cur) => [...cur, newComment]);
                  setCommentText('');
                } catch (err) {
                  console.warn('add comment error', err);
                  Alert.alert('Error', 'Could not add comment');
                }
              }}
              disabled={!commentText.trim()}
              style={({ pressed }) => [
                styles.sendButton,
                { 
                  backgroundColor: commentText.trim() ? VELT_ACCENT : colors.border,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                  shadowColor: commentText.trim() ? VELT_ACCENT : 'transparent',
                },
              ]}
            >
              <Ionicons name="send" size={20} color={commentText.trim() ? '#000' : colors.subtext} />
            </Pressable>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  starButton: {
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: 16,
    gap: 2,
  },
  starButtonActive: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  bottomCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  bottomCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: VELT_ACCENT,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  mapContainer: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: VELT_ACCENT + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: VELT_ACCENT,
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapExpandButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  commentItem: {
    padding: 14,
    borderRadius: 14,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  commentInputContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  commentInputBlur: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
