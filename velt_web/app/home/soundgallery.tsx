// app/sound-galleries.tsx
// Updated with: preload caching, play-button loading indicator, header scrollable, cover-art strip, go-to-top button

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
  TouchableWithoutFeedback,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { openImagePickerAsync } from '@/utils/imagepicker';
import * as FileSystem from 'expo-file-system';
import { downloadAsync as downloadAsyncHelper } from '@/utils/filesystem';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase'; // adjust to your supabase client
import { useTheme } from 'app/themes';
import SwipeBackContainer from '@/components/SwipeBackContainer';
// UnifiedBottomSheet removed — reverting to RN Modal usage

/* ---------------- Config ---------------- */
const { width } = Dimensions.get('window');
const TWO_COL_WIDTH = (width - 24) / 2;
const AUDIO_PRELOAD_COUNT = 8; // number of top tracks to preload on open

// Cloudinary config (use your cloud name)
const CLOUDINARY_CLOUD = 'dpejjmjxg'; // keep your cloud name here
const CLOUDINARY_BASE = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`;
const CLOUDINARY_PRESET_SOUNDTRACK = 'soundtrack'; // unsigned preset
const CLOUDINARY_PRESET_GALLERIES = 'galleries';

/* ---------------- Types ---------------- */
type Soundtrack = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  audio_url: string;
  audio_mime?: string;
  artwork_url?: string;
  duration_ms?: number;
  tags?: string[]; // text[]
  artist_name?: string;
  created_at?: string;
};

type GalleryImage = {
  id: string;
  user_id: string;
  image_url: string;
  width?: number;
  height?: number;
  caption?: string;
  tags?: string[]; // text[]
  created_at?: string;
};

type ExpoSoundInstance = Awaited<ReturnType<typeof Audio.Sound.createAsync>>['sound'];


/* ---------------- Robust Cloudinary uploader ---------------- */
async function cloudinaryUploadWithFallback(localUri: string, preset: string, folder?: string, fileName?: string, mimeType?: string) {
  const CLOUDINARY_BASE = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`;
  const tryXHR = () => new Promise<any>((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CLOUDINARY_BASE);
      const formData = new FormData();
      formData.append('file', { uri: localUri, name: fileName || 'upload', type: mimeType || 'application/octet-stream' } as any);
      formData.append('upload_preset', preset);
      if (folder) formData.append('folder', folder);
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try { resolve(JSON.parse(xhr.response)); } catch (e) { reject({ message: 'Invalid JSON' }); }
        } else {
          try { const parsed = JSON.parse(xhr.response); reject(parsed); } catch { reject({ message: 'Upload failed', status: xhr.status }); }
        }
      };
      xhr.onerror = () => reject({ message: 'Network request failed' });
      xhr.send(formData);
    } catch (e) { reject(e); }
  });

  const tryFetch = async () => {
    const fetched = await fetch(localUri);
    const blob = await fetched.blob();
    const formData = new FormData();
    formData.append('file', blob as any);
    formData.append('upload_preset', preset);
    if (folder) formData.append('folder', folder);
    const res = await fetch(CLOUDINARY_BASE, { method: 'POST', body: formData });
    const json = await res.json();
    if (!res.ok) throw json;
    return json;
  };

  try {
    return await tryXHR();
  } catch (e) {
    return await tryFetch();
  }
}

/* ---------------- Main Screen ---------------- */
export default function SoundGalleries({ navigation, route }: any) {
  const { colors: themeColors } = useTheme();
  const colors = useMemo(() => {
    const hair = themeColors.border || (themeColors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)');
    return {
      bg: themeColors.bg,
      text: themeColors.text,
      subtext: themeColors.subtext,
      card: themeColors.card,
      accent: themeColors.accent,
      border: hair,
      faint: themeColors.faint || hair,
      isDark: themeColors.isDark ?? false,
    };
  }, [themeColors]);
  const router = withSafeRouter(useRouter());

  const [tab, setTab] = useState<'music' | 'gallery'>(route?.params?.mode === 'saves' ? 'gallery' : 'music');
  const [query, setQuery] = useState('');

  const [soundtracks, setSoundtracks] = useState<Soundtrack[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // playback
  const soundRef = useRef<ExpoSoundInstance | null>(null);
  const playbackRequestId = useRef(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  // local cache map: track id -> local file uri
  const [cachedUris, setCachedUris] = useState<Record<string, string>>({});
  const [preloadStatus, setPreloadStatus] = useState<Record<string, 'idle'|'loading'|'ready'|'failed'>>({});
  const [playLoadingId, setPlayLoadingId] = useState<string | null>(null);

  // modal states
  const [imageSheetOpen, setImageSheetOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  const [uploadMediaSheetOpen, setUploadMediaSheetOpen] = useState(false);
  const [stagedMediaUri, setStagedMediaUri] = useState<string | null>(null);
  const [stagedMediaIsImage, setStagedMediaIsImage] = useState<boolean>(false);
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaTagsInput, setMediaTagsInput] = useState('');
  const [stagedMediaMeta, setStagedMediaMeta] = useState<{ width?: number; height?: number } | null>(null);

  // track upload
  const [uploadTrackSheetOpen, setUploadTrackSheetOpen] = useState(false);
  const [stagedTrack, setStagedTrack] = useState<{ uri: string; name: string; mime?: string; durationMs?: number } | null>(null);
  const [stagedTrackCover, setStagedTrackCover] = useState<{ uri: string; width?: number; height?: number } | null>(null);
  const [artistName, setArtistName] = useState<string | null>(null);
  const [isUploadingTrack, setIsUploadingTrack] = useState(false);
  const [trackTitle, setTrackTitle] = useState<string>(''); // NEW: allow user to set title before upload

  // go-to-top
  const flatRef = useRef<FlatList<any> | null>(null);
  const [showGoTop, setShowGoTop] = useState(false);

  useEffect(() => {
    loadAll();
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id ?? null;
        if (uid) {
          const { data: profData, error } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', uid).maybeSingle();
          if (!error && profData) {
            setArtistName(profData.full_name ?? null);
            setUserAvatar(profData.avatar_url ?? null);
          }
        }
      } catch (e) {
        console.warn('profile fetch', e);
      }
    })();

    const unsub = navigation?.addListener?.('focus', () => {
      loadAll();
    });
    return () => {
      try { unsub && unsub(); } catch {}
      (async () => { try { await soundRef.current?.unloadAsync(); } catch {} })();
    };
  }, []);

  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const getUserId = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id ?? null;
    } catch { return null; }
  }, []);

  /* ---------------- Fetch functions (returning data) ---------------- */
  const fetchSoundtracks = useCallback(async (search = ''): Promise<Soundtrack[]> => {
    try {
      let q = supabase.from('soundtracks').select('*').order('created_at', { ascending: false }).limit(300);
      if (search && search.trim()) {
        const partial = `%${search}%`;
        q = supabase.from('soundtracks').select('*')
          .or(`title.ilike.${partial},description.ilike.${partial}`)
          .order('created_at', { ascending: false }).limit(300);
      }
      const { data, error } = await q;
      if (error) {
        console.warn('fetchSoundtracks error', error);
        setSoundtracks([]);
        return [];
      }
      setSoundtracks(data || []);
      return data || [];
    } catch (e) {
      console.warn('fetchSoundtracks exception', e);
      setSoundtracks([]);
      return [];
    }
  }, []);

  const fetchGalleryImages = useCallback(async (search = ''): Promise<GalleryImage[]> => {
    try {
      let q = supabase.from('gallery').select('*').order('created_at', { ascending: false }).limit(300);
      if (search && search.trim()) {
        const partial = `%${search}%`;
        q = supabase.from('gallery').select('*')
          .or(`caption.ilike.${partial},tags::text.ilike.${partial}`)
          .order('created_at', { ascending: false }).limit(300);
      }
      const { data, error } = await q;
      if (error) {
        console.warn('fetchGalleryImages error', error);
        setImages([]);
        return [];
      }
      setImages(data || []);
      return data || [];
    } catch (e) {
      console.warn('fetchGalleryImages exception', e);
      setImages([]);
      return [];
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // fetch both, then trigger audio preloads for top items
      const [tracks, imgs] = await Promise.all([fetchSoundtracks(''), fetchGalleryImages('')]);
      // trigger preloading for the top N tracks
      if (tracks && tracks.length > 0) {
        preloadAudioForList(tracks.slice(0, AUDIO_PRELOAD_COUNT));
      }
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, [fetchSoundtracks, fetchGalleryImages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  /* ---------------- Audio caching helpers ---------------- */
  const getCachedFilePathFor = (track: Soundtrack) => {
    // generate a consistent cache filename by id + extension
    try {
      const url = track.audio_url || '';
      // try to extract extension
      const clean = url.split('?')[0];
      const extMatch = clean.match(/\.([a-z0-9]+)$/i);
      const ext = extMatch ? extMatch[1] : 'mp3';
      return `${FileSystem.cacheDirectory}sound_${track.id}.${ext}`;
    } catch {
      return `${FileSystem.cacheDirectory}sound_${track.id}.mp3`;
    }
  };

  const ensureCachedAudio = useCallback(async (track: Soundtrack) => {
    if (!track || !track.audio_url) throw new Error('No audio url');
    // if already cached in state map, verify file exists
    const existing = cachedUris[track.id];
    if (existing) {
      // ensure file is present
      try {
        const info = await FileSystem.getInfoAsync(existing);
        if (info.exists) return existing;
      } catch { /* fallthrough to redownload */ }
    }

    // mark loading
    setPreloadStatus((s) => ({ ...s, [track.id]: 'loading' }));
    const dest = getCachedFilePathFor(track);
    try {
      // check if already exists at dest
      const stat = await FileSystem.getInfoAsync(dest);
      if (!stat.exists) {
        // download
        const resp = await downloadAsyncHelper(track.audio_url, dest);
        if (!resp || !resp.uri) throw new Error('Download failed');
      }
      // success
      setCachedUris((m) => ({ ...m, [track.id]: dest }));
      setPreloadStatus((s) => ({ ...s, [track.id]: 'ready' }));
      return dest;
    } catch (e) {
      console.warn('ensureCachedAudio error', e);
      setPreloadStatus((s) => ({ ...s, [track.id]: 'failed' }));
      throw e;
    }
  }, [cachedUris]);

  const preloadAudioForList = useCallback(async (list: Soundtrack[]) => {
    if (!list || list.length === 0) return;
    // preload serially to avoid flooding
    (async () => {
      for (const t of list) {
        try {
          // skip if already ready
          const status = preloadStatus[t.id];
          if (status === 'ready') continue;
          await ensureCachedAudio(t);
        } catch (e) {
          // ignore individual failures; they will be handled when user plays
        }
      }
    })();
  }, [ensureCachedAudio, preloadStatus]);

  const cleanupSound = useCallback(async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
    } catch {}
    soundRef.current = null;
  }, []);

  /* ---------------- Playback controls (now using cached files when possible) ---------------- */
  const stopAudio = useCallback(async () => {
    playbackRequestId.current += 1;
    await cleanupSound();
    setPlayingId(null);
    setPositionMillis(0);
    setDurationMillis(0);
  }, [cleanupSound]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const playAudio = useCallback(async (item: Soundtrack) => {
    try {
      if (playingId === item.id) {
        if (!soundRef.current) return;
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          await soundRef.current.pauseAsync();
        } else if (st.isLoaded) {
          await soundRef.current.playAsync();
        }
        return;
      }

      const requestId = ++playbackRequestId.current;
      setPlayLoadingId(item.id);
      await cleanupSound();

      let uriToPlay = cachedUris[item.id] ?? null;
      if (!uriToPlay) {
        try {
          uriToPlay = await ensureCachedAudio(item);
        } catch (e) {
          uriToPlay = item.audio_url;
        }
      }

      const { sound } = await Audio.Sound.createAsync({ uri: uriToPlay }, { shouldPlay: true });
      if (requestId !== playbackRequestId.current) {
        try { await sound.unloadAsync(); } catch {}
        return;
      }

      soundRef.current = sound;
      setPlayingId(item.id);
      setPlayLoadingId(null);

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status || !('isLoaded' in status) || !status.isLoaded) return;
        setPositionMillis(status.positionMillis ?? 0);
        setDurationMillis(status.durationMillis ?? 0);
        if (status.didJustFinish) {
          stopAudio();
        }
      });
    } catch (e) {
      console.warn('playAudio', e);
      setPlayLoadingId(null);
      Alert.alert('Playback error', 'Unable to play this track.');
      stopAudio();
    }
  }, [playingId, cachedUris, ensureCachedAudio, cleanupSound, stopAudio]);

  const safeGoBack = useCallback(() => {
    try {
      if (navigation && navigation.canGoBack && navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
    } catch {}
    try { router.back(); return; } catch {}
    try { router.replace('/'); } catch {}
  }, [navigation, router]);

  const onImagePress = useCallback((img: GalleryImage) => {
    setSelectedImage(img);
    setImageSheetOpen(true);
  }, []);

  const openUploadMediaSheet = useCallback(() => {
    setStagedMediaUri(null);
    setStagedMediaIsImage(false);
    setMediaCaption('');
    setMediaTagsInput('');
    setUploadMediaSheetOpen(true);
  }, []);

  /* ---------------- Upload-related functions (unchanged logic) ---------------- */
  const pickMediaForStaging = useCallback(async (asImage = true) => {
    try {
      if (asImage) {
        const uri = await openImagePickerAsync();
        if (!uri) return;
        setStagedMediaUri(uri);
        setStagedMediaIsImage(true);
        // get dimensions for the selected image uri
        Image.getSize(uri, (w, h) => setStagedMediaMeta({ width: w, height: h }), (err) => { console.warn('Image.getSize failed', err); setStagedMediaMeta(null); });
      } else {
        Alert.alert('Not implemented', 'Currently only images are supported for media+caption upload.');
      }
    } catch (e) {
      console.warn('pickMediaForStaging', e);
      Alert.alert('Error', 'Could not pick media.');
    }
  }, []);

  const confirmUploadMedia = useCallback(async () => {
    try {
      if (!stagedMediaUri) { Alert.alert('No media', 'Please choose a photo to upload.'); return; }
      setUploading(true);
      const uid = await getUserId();
      if (!uid) { setUploading(false); Alert.alert('Sign in', 'Please sign in to upload.'); return; }
      const name = `media_${Date.now()}.jpg`;
      const json = await cloudinaryUploadWithFallback(stagedMediaUri, CLOUDINARY_PRESET_GALLERIES, 'gallery', name, 'image/jpeg');
      const imageUrl = json.secure_url || json.url;
      const widthN = json.width ? parseInt(json.width) : stagedMediaMeta?.width ?? null;
      const heightN = json.height ? parseInt(json.height) : stagedMediaMeta?.height ?? null;
      const tags = (mediaTagsInput || '').split(/[,\s]+/).map(t => t.trim()).filter(Boolean).map(t => (t.startsWith('#') ? t.slice(1) : t));
      const caption = mediaCaption.trim();
      const { error } = await supabase.from('gallery').insert({
        user_id: uid,
        image_url: imageUrl,
        width: widthN,
        height: heightN,
        caption,
        tags,
      } as any);
      if (error) throw error;
      await fetchGalleryImages('');
      setUploadMediaSheetOpen(false);
      setStagedMediaUri(null);
      setMediaCaption('');
      setMediaTagsInput('');
      Alert.alert('Uploaded', 'Media uploaded and caption saved.');
    } catch (err: any) {
      console.warn('confirmUploadMedia', err);
      Alert.alert('Upload failed', err?.message || 'Could not upload media');
    } finally {
      setUploading(false);
    }
  }, [stagedMediaUri, stagedMediaMeta, mediaCaption, mediaTagsInput]);

  const openUploadTrackSheet = useCallback(async () => {
    setStagedTrack(null);
    setStagedTrackCover(null);
    setTrackTitle('');
    if (!artistName) {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id ?? null;
        if (uid) {
          const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle();
          setArtistName(prof?.full_name ?? null);
        }
      } catch {}
    }
    setUploadTrackSheetOpen(true);
  }, [artistName]);

  const pickTrackFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const assetName = asset.name || `audio_${Date.now()}`;
      const assetMime = asset.mimeType || 'audio/mpeg';
      let localUri = asset.uri;
      if (Platform.OS === 'android' && !localUri.startsWith('file://')) {
        const dest = `${FileSystem.cacheDirectory}${assetName}`;
        await FileSystem.copyAsync({ from: localUri, to: dest });
        localUri = dest;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: localUri }, { shouldPlay: false });
      const status = await sound.getStatusAsync();
      const dur = status.durationMillis ?? null;
      try { await sound.unloadAsync(); } catch {}
      if (dur && dur > 5 * 60 * 1000) {
        Alert.alert('Too long', 'Audio longer than 5 minutes is not allowed.');
        return;
      }
      setStagedTrack({ uri: localUri, name: assetName, mime: assetMime, durationMs: dur ?? undefined });
    } catch (e) {
      console.warn('pickTrackFile', e);
      Alert.alert('Error', 'Could not pick audio.');
    }
  }, []);

  const pickTrackCover = useCallback(async () => {
    try {
      const uri = await openImagePickerAsync();
      if (!uri) return;
      // We don't have metadata when using the lightweight helper; the upload flow will still work.
      setStagedTrackCover({ uri, width: null, height: null } as any);
    } catch (e) {
      console.warn('pickTrackCover', e);
      Alert.alert('Error', 'Could not pick cover.');
    }
  }, []);

  const uploadStagedTrack = useCallback(async () => {
    try {
      if (!stagedTrack) { Alert.alert('No track', 'Please select an audio file.'); return; }
      setIsUploadingTrack(true);
      const uid = await getUserId();
      if (!uid) { setIsUploadingTrack(false); Alert.alert('Sign in', 'Sign in to upload'); return; }

      let artworkUrl: string | null = null;
      if (stagedTrackCover) {
        const coverName = `cover_${Date.now()}.jpg`;
        const coverResp = await cloudinaryUploadWithFallback(stagedTrackCover.uri, CLOUDINARY_PRESET_GALLERIES, 'soundtrack_covers', coverName, 'image/jpeg');
        artworkUrl = coverResp.secure_url || coverResp.url || null;
      }

      const audioName = stagedTrack.name || `audio_${Date.now()}`;
      const audioResp = await cloudinaryUploadWithFallback(stagedTrack.uri, CLOUDINARY_PRESET_SOUNDTRACK, 'soundtracks', audioName, stagedTrack.mime || 'audio/mpeg');
      const audioUrl = audioResp.secure_url || audioResp.url;
      const duration = stagedTrack.durationMs ?? (audioResp?.duration ? Math.round(parseFloat(audioResp.duration) * 1000) : null);

      const titleFromFile = (stagedTrack.name || '').split('.').slice(0, -1).join('.') || `Track ${Date.now()}`;

      // IMPORTANT: respect your request to not alter file/audio logic — only add optional title input
      const finalTitle = trackTitle && trackTitle.trim().length > 0 ? trackTitle.trim() : titleFromFile;

      const payload: any = {
        user_id: uid,
        title: finalTitle,
        audio_url: audioUrl,
        audio_mime: stagedTrack.mime || 'audio/mpeg',
        duration_ms: duration,
        artwork_url: artworkUrl,
      };
      if (artistName) payload.artist_name = artistName;
      const { error } = await supabase.from('soundtracks').insert(payload);
      if (error) throw error;

      await fetchSoundtracks('');
      setUploadTrackSheetOpen(false);
      setStagedTrack(null);
      setStagedTrackCover(null);
      setTrackTitle('');
      Alert.alert('Uploaded', 'Track uploaded successfully.');
    } catch (err: any) {
      console.warn('uploadStagedTrack', err);
      Alert.alert('Upload failed', err?.message || 'Could not upload track.');
    } finally {
      setIsUploadingTrack(false);
    }
  }, [stagedTrack, stagedTrackCover, artistName, fetchSoundtracks, trackTitle]);

  /* ---------------- layout helpers ---------------- */
  const [leftCol, rightCol] = useMemo(() => {
    const left: GalleryImage[] = [];
    const right: GalleryImage[] = [];
    let lh = 0, rh = 0;
    images.forEach((img) => {
      const h = img.width && img.height ? (img.height / img.width) * TWO_COL_WIDTH : TWO_COL_WIDTH * 1.2;
      if (lh <= rh) { left.push(img); lh += h; } else { right.push(img); rh += h; }
    });
    return [left, right];
  }, [images]);

  /* ---------------- Header component to be used as ListHeaderComponent (so header scrolls) ---------------- */
  const HeaderComponent = useCallback(() => {
    // choose a few artworks to display in the decorative strip (fallback to userAvatar or placeholder)
    const covers = soundtracks.slice(0, 8).map(s => s.artwork_url || userAvatar || 'https://via.placeholder.com/300');

    return (
      <View>
        {/* Single header and tabs block */}
        <View style={[styles.header, { borderBottomColor: colors.border, marginTop: 0 }]}> 
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={safeGoBack} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Sound Galleries</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={openUploadMediaSheet} style={{ padding: 8 }}>
              <Ionicons name="images-outline" size={22} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openUploadTrackSheet} style={{ padding: 8 }}>
              <Ionicons name="musical-notes-outline" size={22} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setTab('music')}
            style={[styles.tabBtn, tab === 'music' && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.tabText, { color: tab === 'music' ? colors.card : colors.subtext }]}>Music</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('gallery')}
            style={[styles.tabBtn, tab === 'gallery' && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.tabText, { color: tab === 'gallery' ? colors.card : colors.subtext }]}>Gallery</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => { Alert.alert('Search tip', 'Use captions and hashtags when uploading to make your media discoverable. Example: #chill #piano'); }} style={{ padding: 8 }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.subtext} />
            <TextInput
              placeholder={tab === 'music' ? 'Search music (title, description, tags)...' : 'Search gallery (caption, tags)...'}
              placeholderTextColor={colors.subtext}
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                if (tab === 'music') fetchSoundtracks(t);
                else fetchGalleryImages(t);
              }}
              style={[styles.searchInput, { color: colors.text }]}
            />
            <TouchableOpacity onPress={() => { setQuery(''); fetchSoundtracks(''); fetchGalleryImages(''); }} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={16} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Decorative cover art strip */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          <Text style={{ color: colors.subtext, marginBottom: 8, fontWeight: '700' }}>Featured</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            {covers.map((c, idx) => (
              <View key={`${c}-${idx}`} style={{ marginRight: 10 }}>
                <Image source={{ uri: c }} style={{ width: 110, height: 110, borderRadius: 10, backgroundColor: '#222' }} />
                <View style={{ position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: 20 }}>
                  <Ionicons name="play" size={14} color="#fff" />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }, [colors, tab, query, soundtracks, userAvatar]);

  /* ---------------- Renderers ---------------- */
  const renderTrack = ({ item }: { item: Soundtrack }) => {
    const isPlaying = playingId === item.id;
    const isLoading = playLoadingId === item.id || preloadStatus[item.id] === 'loading';
    return (
      <View style={[styles.trackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Apple Music-like row: artwork | title/artist | play */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: item.artwork_url || userAvatar || 'https://via.placeholder.com/150' }} style={styles.artworkSmall} />

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 2 }}>{item.artist_name ?? item.description ?? ''}</Text>
          </View>

          <TouchableOpacity onPress={() => playAudio(item)} style={styles.playBtn}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderImageTile = ({ item }: { item: GalleryImage }) => {
    const size = Math.floor((width - 48) / 3);
    return (
      <TouchableOpacity key={item.id} onPress={() => onImagePress(item)} style={{ marginBottom: 8, marginRight: 8 }}>
        <Image source={{ uri: item.image_url }} style={{ width: size, height: size, borderRadius: 6, backgroundColor: '#ddd' }} />
      </TouchableOpacity>
    );
  };

  const currentlyPlaying = soundtracks.find(s => s.id === playingId) ?? null;

  /* ---------------- scroll handlers for go-to-top ---------------- */
  const onScrollHandler = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setShowGoTop(y > 300);
  }, []);

  const accentGlow = useMemo(() => ({
    shadowColor: colors.accent,
    shadowOpacity: colors.isDark ? 0.8 : 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  }), [colors]);

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {loading ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', padding: 36 }}>
          <ActivityIndicator />
        </View>
      ) : tab === 'music' ? (
        <FlatList
          ref={(r) => { flatRef.current = r; }}
          data={soundtracks}
          keyExtractor={(i) => i.id}
          renderItem={renderTrack}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingBottom: 200 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.subtext} />}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Text style={{ color: colors.subtext }}>No tracks yet. Upload or invite creators to add music.</Text>
            </View>
          )}
          ListHeaderComponent={<HeaderComponent />}
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
          key={tab === 'music' ? 'music' : 'gallery'}
        />
      ) : (
        <FlatList
          ref={(r) => { flatRef.current = r; }}
          data={images}
          keyExtractor={(i) => i.id}
          renderItem={renderImageTile}
          numColumns={3}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.subtext} />}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Text style={{ color: colors.subtext }}>No images yet — upload using the + button and add captions & tags.</Text>
            </View>
          )}
          ListHeaderComponent={<HeaderComponent />}
          onScroll={onScrollHandler}
          scrollEventThrottle={16}
          key={tab === 'gallery' ? 'gallery' : 'music'}
        />
      )}

      {/* Player Bottom Sheet: appears when playingId is set */}
      <Modal visible={!!playingId} transparent animationType="none" onRequestClose={() => { stopAudio(); }}>
        <TouchableWithoutFeedback onPress={() => { stopAudio(); }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}> 
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {/* Artwork */}
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <Image
                  source={{ uri: currentlyPlaying?.artwork_url || userAvatar || 'https://via.placeholder.com/600' }}
                  style={{ width: width - 48, height: width - 48, borderRadius: 12, backgroundColor: '#222' }}
                />
              </View>

              {/* Title & Artist */}
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }} numberOfLines={2}>{currentlyPlaying?.title ?? ''}</Text>
              <Text style={{ color: colors.subtext, marginTop: 6 }}>{currentlyPlaying?.artist_name ?? currentlyPlaying?.description ?? ''}</Text>

              {/* Playback info */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, alignItems: 'center' }}>
                <Text style={{ color: colors.subtext, fontSize: 13 }}>{positionMillis === 0 ? 'Loading...' : `${Math.round((positionMillis || 0)/1000)}s`}</Text>
                <Text style={{ color: colors.subtext, fontSize: 13 }}>{durationMillis ? `${Math.round((durationMillis || 0)/1000)}s` : ''}</Text>
              </View>

              {/* Controls */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <TouchableOpacity onPress={() => {
                  // toggle play/pause for current track
                  if (currentlyPlaying) playAudio(currentlyPlaying);
                }} style={[styles.sheetAction, { borderColor: colors.border, flex: 0.48, justifyContent: 'center' }]}>
                  <Ionicons name={positionMillis === 0 ? 'musical-notes' : 'play'} size={20} color={colors.accent} />
                  <Text style={{ color: colors.accent, marginLeft: 8, fontWeight: '700' }}>{positionMillis && positionMillis > 0 ? 'Play/Pause' : 'Play'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { stopAudio(); }} style={[styles.sheetAction, { borderColor: colors.border, flex: 0.48, justifyContent: 'center' }]}>
                  <Ionicons name="close" size={20} color={colors.subtext} />
                  <Text style={{ color: colors.subtext, marginLeft: 8, fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </View>

              {/* Additional small actions row (optional placeholders) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                <TouchableOpacity onPress={() => { Alert.alert('Share', 'Share not implemented'); }} style={[styles.sheetAction, { borderColor: colors.border, flex: 0.48 }]}>
                  <Ionicons name="share-outline" size={20} color={colors.accent} />
                  <Text style={{ color: colors.accent, marginLeft: 8 }}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Alert.alert('Add to playlist', 'Not implemented'); }} style={[styles.sheetAction, { borderColor: colors.border, flex: 0.48 }]}>
                  <Ionicons name="add" size={20} color={colors.accent} />
                  <Text style={{ color: colors.accent, marginLeft: 8 }}>Add</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>

            <TouchableOpacity style={styles.sheetClose} onPress={() => { stopAudio(); }}>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>Close player</Text>
            </TouchableOpacity>
        </View>
      </Modal>

      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 8 }}>Uploading…</Text>
        </View>
      )}

      <Modal visible={imageSheetOpen} transparent animationType="none" onRequestClose={() => setImageSheetOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setImageSheetOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}> 
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              <Image source={{ uri: selectedImage?.image_url }} style={{ width: width - 48, height: (selectedImage?.height && selectedImage?.width) ? ((selectedImage.height / selectedImage.width) * (width - 48)) : 300, borderRadius: 12 }} />
              <Text style={{ color: colors.text, fontWeight: '800', marginTop: 12 }}>{selectedImage?.caption ?? ''}</Text>
              <Text style={{ color: colors.subtext, marginTop: 6 }}>{selectedImage?.created_at ? new Date(selectedImage.created_at).toLocaleString() : ''}</Text>
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <TouchableOpacity onPress={() => { Alert.alert('Share', 'Share not implemented yet'); }} style={[styles.sheetAction, { borderColor: colors.border }]}>
                  <Ionicons name="share-outline" size={20} color={colors.accent} />
                  <Text style={{ color: colors.accent, marginLeft: 8 }}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Alert.alert('Delete', 'Delete needs server side implementation.'); }} style={[styles.sheetAction, { borderColor: colors.border, marginLeft: 12 }]}>
                  <Ionicons name="trash-outline" size={20} color={'#f55'} />
                  <Text style={{ color: '#f55', marginLeft: 8 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setImageSheetOpen(false)}>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={uploadMediaSheetOpen} transparent animationType="none" onRequestClose={() => setUploadMediaSheetOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setUploadMediaSheetOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}> 
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 8 }}>Upload Media</Text>

              <Text style={{ color: colors.subtext, marginBottom: 6 }}>Caption</Text>
              <TextInput value={mediaCaption} onChangeText={setMediaCaption} placeholder="Add a caption (explain this image) — include hashtags" placeholderTextColor={colors.subtext} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />

              <Text style={{ color: colors.subtext, marginTop: 10, marginBottom: 6 }}>Tags (space or comma separated) — use hashtags like #chill</Text>
              <TextInput value={mediaTagsInput} onChangeText={setMediaTagsInput} placeholder="#tag1 #tag2 or tag1,tag2" placeholderTextColor={colors.subtext} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />

              <View style={{ marginTop: 12 }}>
                <TouchableOpacity onPress={() => pickMediaForStaging(true)} style={[styles.fileBtn, { borderColor: colors.border, backgroundColor: colors.faint }]}>
                  <Text style={{ color: colors.accent }}>{stagedMediaUri ? 'Change selected image' : 'Pick image'}</Text>
                </TouchableOpacity>
                {stagedMediaUri ? <Image source={{ uri: stagedMediaUri }} style={{ marginTop: 8, width: 140, height: 140, borderRadius: 10 }} /> : null}
              </View>

              <View style={{ marginTop: 16 }}>
                <TouchableOpacity onPress={confirmUploadMedia} style={[styles.uploadBtn, { backgroundColor: stagedMediaUri ? colors.accent : '#888' }]} disabled={!stagedMediaUri}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Upload media</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setUploadMediaSheetOpen(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ color: colors.subtext }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
        </View>
      </Modal>

      <Modal visible={uploadTrackSheetOpen} transparent animationType="none" onRequestClose={() => setUploadTrackSheetOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setUploadTrackSheetOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}> 
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 8 }}>Upload Track</Text>

              <Text style={{ color: colors.subtext }}>Artist (readonly)</Text>
              <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.faint, marginTop: 6 }}>
                <Text style={{ color: colors.text }}>{artistName ?? 'Unknown'}</Text>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.subtext }}>Title (optional)</Text>
                <TextInput value={trackTitle} onChangeText={setTrackTitle} placeholder="Track title (leave empty to use filename)" placeholderTextColor={colors.subtext} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.subtext }}>Audio file (max 5 minutes)</Text>
                <TouchableOpacity onPress={pickTrackFile} style={[styles.fileBtn, { borderColor: colors.border, backgroundColor: colors.faint }]}>
                  <Text style={{ color: colors.accent }}>{stagedTrack ? `Selected: ${stagedTrack.name} (${Math.round((stagedTrack.durationMs ?? 0)/1000)}s)` : 'Pick audio'}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.subtext }}>Cover (optional)</Text>
                <TouchableOpacity onPress={pickTrackCover} style={[styles.fileBtn, { borderColor: colors.border, backgroundColor: colors.faint }]}>
                  <Text style={{ color: colors.accent }}>{stagedTrackCover ? 'Cover selected' : 'Pick cover image (optional)'}</Text>
                </TouchableOpacity>
                {stagedTrackCover ? <Image source={{ uri: stagedTrackCover.uri }} style={{ marginTop: 8, width: 120, height: 120, borderRadius: 8 }} /> : null}
              </View>

              <View style={{ marginTop: 20 }}>
                <TouchableOpacity onPress={uploadStagedTrack} style={[styles.uploadBtn, { backgroundColor: stagedTrack ? colors.accent : '#888' }]} disabled={!stagedTrack || isUploadingTrack}>
                  {isUploadingTrack ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Upload track</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setUploadTrackSheetOpen(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ color: colors.subtext }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
        </View>
      </Modal>

      {/* Go to top floating button */}
      {showGoTop && (
        <TouchableOpacity
          onPress={() => {
            try { flatRef.current?.scrollToOffset({ offset: 0, animated: true }); } catch {}
          }}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 36,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="arrow-up" size={22} color={colors.card} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  headerSpacer: { height: 120 },
  header: {
    marginTop: Platform.OS === 'ios' ? 12 : 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', marginLeft: 8 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 8, marginBottom: 2, alignItems: 'center' },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'transparent', marginRight: 8 },
  tabText: { fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 10 : 6, borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  trackCard: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  artworkSmall: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  trackTitle: { fontSize: 16, fontWeight: '900' },
  playBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  playerBar: { position: 'absolute', right: 12, left: 12, bottom: 20, borderTopWidth: 1, padding: 12, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 6 },
  uploadOverlay: { position: 'absolute', left: 12, right: 12, top: '40%', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },

  /* sheet */
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '94%',
    minHeight: '65%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#ddd', alignSelf: 'center', marginTop: 8 },
  sheetAction: { padding: 12, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  sheetClose: { padding: 12, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 44 },
  fileBtn: { padding: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  uploadBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
});




