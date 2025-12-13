// lib/store/prefetchStore.ts
// Pre-fetches and caches data for screens before navigation
// so they appear instantly loaded when opened

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// Types for cached data
type ProfileShort = {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  is_online?: boolean | null;
};

type StoryItem = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration?: number;
  created_at: string;
  profiles?: ProfileShort | null;
  expire_at?: string | null;
  caption?: string | null;
};

type StoryGroup = {
  userId: string;
  profile: ProfileShort;
  stories: StoryItem[];
};

type LocationPost = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  location_name?: string | null;
  created_at: string;
  profile?: ProfileShort | null;
  stars?: number;
};

type ContentItem = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  created_at: string;
  profile?: ProfileShort | null;
};

type ChatSettingsData = {
  isGroup: boolean;
  otherUser: ProfileShort | null;
  wallpaperUrl: string | null;
  isBlocked: boolean;
};

interface PrefetchState {
  // User stories cache
  userStoriesCache: Record<string, { groups: StoryGroup[]; timestamp: number }>;
  userStoriesLoading: Record<string, boolean>;
  
  // Location posts cache
  locationPostsCache: Record<string, { posts: LocationPost[]; timestamp: number }>;
  locationPostsLoading: Record<string, boolean>;
  
  // Content/commercials cache
  commercialsCache: Record<string, { items: ContentItem[]; timestamp: number }>;
  commercialsLoading: Record<string, boolean>;
  
  // Generic profile cache
  profileCache: Record<string, { profile: ProfileShort; timestamp: number }>;
  
  // Chat settings cache
  chatSettingsCache: Record<string, { data: ChatSettingsData; timestamp: number }>;
  chatSettingsLoading: Record<string, boolean>;
  
  // Cache duration (5 minutes)
  CACHE_TTL: number;
  
  // Actions
  prefetchUserStories: (userId?: string) => Promise<StoryGroup[] | null>;
  prefetchLocationPosts: (locationId?: string) => Promise<LocationPost[] | null>;
  prefetchCommercials: (userId?: string) => Promise<ContentItem[] | null>;
  prefetchProfile: (userId: string) => Promise<ProfileShort | null>;
  prefetchChatSettings: (conversationId: string, currentUserId: string) => Promise<ChatSettingsData | null>;
  
  // Get cached data
  getCachedUserStories: (userId?: string) => StoryGroup[] | null;
  getCachedLocationPosts: (locationId?: string) => LocationPost[] | null;
  getCachedCommercials: (userId?: string) => ContentItem[] | null;
  getCachedProfile: (userId: string) => ProfileShort | null;
  getCachedChatSettings: (conversationId: string) => ChatSettingsData | null;
  
  // Clear cache
  clearCache: () => void;
  clearUserStoriesCache: (userId?: string) => void;
}

const CLOUDINARY_CLOUD = 'dpejjmjxg';

function buildCloudinaryUrl(publicIdOrUrl: string | null | undefined, mediaType: 'image' | 'video') {
  if (!publicIdOrUrl) return null;
  const s = String(publicIdOrUrl).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  const resource = mediaType === 'video' ? 'video' : 'image';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/${resource}/upload/f_auto,q_auto/${s}`;
}

export const usePrefetchStore = create<PrefetchState>((set, get) => ({
  userStoriesCache: {},
  userStoriesLoading: {},
  locationPostsCache: {},
  locationPostsLoading: {},
  commercialsCache: {},
  commercialsLoading: {},
  profileCache: {},
  chatSettingsCache: {},
  chatSettingsLoading: {},
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  
  prefetchUserStories: async (userId?: string) => {
    const cacheKey = userId || '__all__';
    const state = get();
    
    // Check if already loading
    if (state.userStoriesLoading[cacheKey]) {
      return null;
    }
    
    // Check cache validity
    const cached = state.userStoriesCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < state.CACHE_TTL) {
      return cached.groups;
    }
    
    // Set loading
    set(s => ({ userStoriesLoading: { ...s.userStoriesLoading, [cacheKey]: true } }));
    
    try {
      const now = new Date().toISOString();
      const selectQuery = `id, user_id, media_url, media_type, duration, created_at, is_deleted, expire_at, is_hd,
        profiles:profiles!stories_user_id_fkey(id, username, full_name, avatar_url),
        caption`;
      
      let query = supabase.from('stories').select(selectQuery).eq('is_deleted', false);
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
      
      if (error) {
        console.warn('prefetchUserStories error', error);
        return null;
      }
      
      const active = (data || []).filter((r: any) => {
        if (r.expire_at && new Date(r.expire_at).toISOString() <= now) return false;
        return true;
      });
      
      const items: StoryItem[] = active.map((r: any) => {
        const mediaType: 'image' | 'video' = r.media_type === 'video' ? 'video' : 'image';
        const built = buildCloudinaryUrl(r.media_url, mediaType) ?? '';
        return {
          id: r.id,
          user_id: r.user_id,
          media_url: built,
          media_type: mediaType,
          duration: r.duration,
          created_at: r.created_at,
          profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles ?? null,
          expire_at: r.expire_at ?? null,
          caption: typeof r.caption !== 'undefined' ? r.caption : null,
        };
      });
      
      // Group by user
      const map: Record<string, { profile: ProfileShort; stories: StoryItem[] }> = {};
      for (const s of items) {
        const uid = s.user_id;
        const prof = (s.profiles as ProfileShort) ?? ({ id: uid } as ProfileShort);
        if (!map[uid]) map[uid] = { profile: prof, stories: [] };
        if (s.media_url) map[uid].stories.push(s);
      }
      
      const groups = Object.entries(map)
        .map(([uid, v]) => {
          v.stories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return { userId: uid, profile: v.profile, stories: v.stories };
        })
        .sort((a, b) => {
          const aLast = a.stories[a.stories.length - 1]?.created_at ?? '';
          const bLast = b.stories[b.stories.length - 1]?.created_at ?? '';
          return new Date(bLast).getTime() - new Date(aLast).getTime();
        });
      
      // Update cache
      set(s => ({
        userStoriesCache: { ...s.userStoriesCache, [cacheKey]: { groups, timestamp: Date.now() } },
        userStoriesLoading: { ...s.userStoriesLoading, [cacheKey]: false },
      }));
      
      return groups;
    } catch (err) {
      console.warn('prefetchUserStories error', err);
      set(s => ({ userStoriesLoading: { ...s.userStoriesLoading, [cacheKey]: false } }));
      return null;
    }
  },
  
  prefetchLocationPosts: async (locationId?: string) => {
    const cacheKey = locationId || '__all__';
    const state = get();
    
    if (state.locationPostsLoading[cacheKey]) return null;
    
    const cached = state.locationPostsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < state.CACHE_TTL) {
      return cached.posts;
    }
    
    set(s => ({ locationPostsLoading: { ...s.locationPostsLoading, [cacheKey]: true } }));
    
    try {
      let query = supabase.from('location_posts').select(`
        id, user_id, media_url, media_type, caption, location_name, created_at,
        profiles:profiles!location_posts_user_id_fkey(id, username, full_name, avatar_url)
      `);
      
      if (locationId) {
        query = query.eq('location_id', locationId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(30);
      
      if (error) {
        console.warn('prefetchLocationPosts error', error);
        return null;
      }
      
      const posts: LocationPost[] = (data || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        media_url: buildCloudinaryUrl(r.media_url, r.media_type === 'video' ? 'video' : 'image') ?? r.media_url,
        media_type: r.media_type === 'video' ? 'video' : 'image',
        caption: r.caption,
        location_name: r.location_name,
        created_at: r.created_at,
        profile: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles ?? null,
        stars: 0,
      }));
      
      set(s => ({
        locationPostsCache: { ...s.locationPostsCache, [cacheKey]: { posts, timestamp: Date.now() } },
        locationPostsLoading: { ...s.locationPostsLoading, [cacheKey]: false },
      }));
      
      return posts;
    } catch (err) {
      console.warn('prefetchLocationPosts error', err);
      set(s => ({ locationPostsLoading: { ...s.locationPostsLoading, [cacheKey]: false } }));
      return null;
    }
  },
  
  prefetchCommercials: async (userId?: string) => {
    const cacheKey = userId || '__all__';
    const state = get();
    
    if (state.commercialsLoading[cacheKey]) return null;
    
    const cached = state.commercialsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < state.CACHE_TTL) {
      return cached.items;
    }
    
    set(s => ({ commercialsLoading: { ...s.commercialsLoading, [cacheKey]: true } }));
    
    try {
      let query = supabase.from('commercials').select(`
        id, user_id, media_url, media_type, caption, created_at,
        profiles:profiles!commercials_user_id_fkey(id, username, full_name, avatar_url)
      `);
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(30);
      
      if (error) {
        console.warn('prefetchCommercials error', error);
        return null;
      }
      
      const items: ContentItem[] = (data || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        media_url: buildCloudinaryUrl(r.media_url, r.media_type === 'video' ? 'video' : 'image') ?? r.media_url,
        media_type: r.media_type === 'video' ? 'video' : 'image',
        caption: r.caption,
        created_at: r.created_at,
        profile: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles ?? null,
      }));
      
      set(s => ({
        commercialsCache: { ...s.commercialsCache, [cacheKey]: { items, timestamp: Date.now() } },
        commercialsLoading: { ...s.commercialsLoading, [cacheKey]: false },
      }));
      
      return items;
    } catch (err) {
      console.warn('prefetchCommercials error', err);
      set(s => ({ commercialsLoading: { ...s.commercialsLoading, [cacheKey]: false } }));
      return null;
    }
  },
  
  prefetchProfile: async (userId: string) => {
    const state = get();
    
    const cached = state.profileCache[userId];
    if (cached && Date.now() - cached.timestamp < state.CACHE_TTL) {
      return cached.profile;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_online')
        .eq('id', userId)
        .maybeSingle();
      
      if (error || !data) return null;
      
      const profile: ProfileShort = {
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        is_online: data.is_online,
      };
      
      set(s => ({
        profileCache: { ...s.profileCache, [userId]: { profile, timestamp: Date.now() } },
      }));
      
      return profile;
    } catch (err) {
      console.warn('prefetchProfile error', err);
      return null;
    }
  },
  
  prefetchChatSettings: async (conversationId: string, currentUserId: string) => {
    const state = get();
    
    // Check if already loading
    if (state.chatSettingsLoading[conversationId]) {
      return null;
    }
    
    // Check cache validity
    const cached = state.chatSettingsCache[conversationId];
    if (cached && Date.now() - cached.timestamp < state.CACHE_TTL) {
      return cached.data;
    }
    
    // Set loading
    set(s => ({ chatSettingsLoading: { ...s.chatSettingsLoading, [conversationId]: true } }));
    
    try {
      // Load conversation details
      const { data: convoData, error: convoError } = await supabase
        .from('conversations')
        .select('id, is_group, title, avatar_url')
        .eq('id', conversationId)
        .single();
      
      if (convoError) throw convoError;
      
      const isGroup = convoData?.is_group === true;
      let otherUser: ProfileShort | null = null;
      let isBlocked = false;
      let wallpaperUrl: string | null = null;
      
      // Load wallpaper from user_settings
      try {
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('chat_wallpaper_url')
          .eq('user_id', currentUserId)
          .single();
        wallpaperUrl = (settingsData as any)?.chat_wallpaper_url || null;
      } catch {}
      
      // Load participants for 1:1 chats
      if (!isGroup) {
        const { data: participantsData } = await supabase
          .from('conversation_participants')
          .select('user_id, profiles:user_id(id, full_name, username, avatar_url)')
          .eq('conversation_id', conversationId);
        
        if (participantsData) {
          const other = participantsData.find((p: any) => p.user_id !== currentUserId);
          if (other?.profiles) {
            const otherProfile = Array.isArray(other.profiles) ? other.profiles[0] : other.profiles;
            otherUser = {
              id: otherProfile.id,
              full_name: otherProfile.full_name,
              username: otherProfile.username,
              avatar_url: otherProfile.avatar_url,
            };
            
            // Check if blocked
            try {
              const { data: blockData } = await supabase.rpc('is_user_blocked', {
                p_other_id: otherProfile.id,
              });
              isBlocked = blockData === true;
            } catch {}
          }
        }
      }
      
      const settingsData: ChatSettingsData = {
        isGroup,
        otherUser,
        wallpaperUrl,
        isBlocked,
      };
      
      // Update cache
      set(s => ({
        chatSettingsCache: { ...s.chatSettingsCache, [conversationId]: { data: settingsData, timestamp: Date.now() } },
        chatSettingsLoading: { ...s.chatSettingsLoading, [conversationId]: false },
      }));
      
      return settingsData;
    } catch (err) {
      console.warn('prefetchChatSettings error', err);
      set(s => ({ chatSettingsLoading: { ...s.chatSettingsLoading, [conversationId]: false } }));
      return null;
    }
  },
  
  getCachedUserStories: (userId?: string) => {
    const cacheKey = userId || '__all__';
    const cached = get().userStoriesCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < get().CACHE_TTL) {
      return cached.groups;
    }
    return null;
  },
  
  getCachedLocationPosts: (locationId?: string) => {
    const cacheKey = locationId || '__all__';
    const cached = get().locationPostsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < get().CACHE_TTL) {
      return cached.posts;
    }
    return null;
  },
  
  getCachedCommercials: (userId?: string) => {
    const cacheKey = userId || '__all__';
    const cached = get().commercialsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < get().CACHE_TTL) {
      return cached.items;
    }
    return null;
  },
  
  getCachedProfile: (userId: string) => {
    const cached = get().profileCache[userId];
    if (cached && Date.now() - cached.timestamp < get().CACHE_TTL) {
      return cached.profile;
    }
    return null;
  },
  
  getCachedChatSettings: (conversationId: string) => {
    const cached = get().chatSettingsCache[conversationId];
    if (cached && Date.now() - cached.timestamp < get().CACHE_TTL) {
      return cached.data;
    }
    return null;
  },
  
  clearCache: () => {
    set({
      userStoriesCache: {},
      locationPostsCache: {},
      commercialsCache: {},
      profileCache: {},
      chatSettingsCache: {},
    });
  },
  
  clearUserStoriesCache: (userId?: string) => {
    const cacheKey = userId || '__all__';
    set(s => {
      const newCache = { ...s.userStoriesCache };
      delete newCache[cacheKey];
      return { userStoriesCache: newCache };
    });
  },
}));

// Export prefetch functions for easy use
export const prefetchUserStories = (userId?: string) => usePrefetchStore.getState().prefetchUserStories(userId);
export const prefetchLocationPosts = (locationId?: string) => usePrefetchStore.getState().prefetchLocationPosts(locationId);
export const prefetchCommercials = (userId?: string) => usePrefetchStore.getState().prefetchCommercials(userId);
export const prefetchProfile = (userId: string) => usePrefetchStore.getState().prefetchProfile(userId);
export const prefetchChatSettings = (conversationId: string, currentUserId: string) => usePrefetchStore.getState().prefetchChatSettings(conversationId, currentUserId);
export const getCachedUserStories = (userId?: string) => usePrefetchStore.getState().getCachedUserStories(userId);
export const getCachedLocationPosts = (locationId?: string) => usePrefetchStore.getState().getCachedLocationPosts(locationId);
export const getCachedCommercials = (userId?: string) => usePrefetchStore.getState().getCachedCommercials(userId);
export const getCachedChatSettings = (conversationId: string) => usePrefetchStore.getState().getCachedChatSettings(conversationId);
