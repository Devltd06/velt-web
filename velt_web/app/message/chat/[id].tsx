import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ImageBackground,
  Pressable,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  Linking,
  Dimensions,
  AccessibilityInfo,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TextInputFocusEventData,
  GestureResponderEvent,
  PanResponder,
  Animated,
  Easing,
  ViewToken,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { useProfileStore, Profile } from '@/lib/store/profile';
import { useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Video, ResizeMode } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
// use the in-app media importer instead of the system picker
import MediaImporter from '@/components/MediaImporter';
import { prefetchChatSettings } from '@/lib/store/prefetchStore';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from 'app/themes';
// UnifiedBottomSheet removed — using RN Modal for these sheets

// Minimal local type definitions used in this screen to keep the file self-contained
// and avoid missing-type diagnostics while the screen is developed.
type ChatMessage = {
  id: string;
  local_id?: string;
  conversation_id?: string;
  sender_id?: string;
  content?: string;
  created_at?: string;
  sender?: Partial<Profile> | null;
  reply_to_message_id?: string | null;
  replied_to?: any | null;
  reply_to?: any | null;
  readers?: Partial<Profile>[];
  attachments?: any[];
  media_url?: string | null;
  local_media_uri?: string | null;
  media_type?: string | null;
  pending?: boolean;
  error?: boolean;
  meta?: any;
  [k: string]: any;
};
const THEME_WHITE = {
  label: "Light",
  bg: "#FFFFFF",
  tint: "light" as const,
  overlay: 0.06,
  inputBg: "rgba(0,0,0,0.04)",
  text: "#000000",
  subtext: "rgba(0,0,0,0.6)",
};

type ConversationRow = {
  id: string;
  is_group?: boolean;
  title?: string | null;
  avatar_url?: string | null;
  name?: string | null;
  last_message?: string | null;
  created_at?: string | null;
  participants?: Profile[] | string[];
};

type StoryShot = {
  id: string;
  story_id: string | null;
  sender_id: string;
  recipient_id: string;
  media_index?: number | null;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
  caption?: string | null;
  created_at: string;
  viewed_at?: string | null;
  expires_at?: string | null;
  sender_profile?: Partial<Profile> | null;
  recipient_profile?: Partial<Profile> | null;
  isOutgoing?: boolean;
  story?: any | null;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
// Default callout sheet sizing (can be adjusted per-device)
const DEFAULT_CALLOUTS_MIN = 420;
const DEFAULT_CALLOUTS_MAX = Math.min(Math.round(SCREEN_H * 0.9), Math.round(SCREEN_W * 0.96), 900);
const HOLD_CANCEL_DISTANCE = 60;
const HOLD_CANCEL_VERTICAL = 100;
const RECORDER_CONFIG = {
  maxDurationMs: 90000,
  cancelThreshold: 60,
  lockThreshold: 48,
  autoSendOnRelease: true,
  showPreviewAfterAutoSend: false,
  bitrate: 32000,
  waveformPoints: 160,
};


  const CUSTOM_RECORDING_OPTIONS = {
  android: {
    extension: ".m4a",
    outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
    audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
    sampleRate: 44100,
    bitRate: RECORDER_CONFIG.bitrate,
    numberOfChannels: 1,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
    audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM,
    bitRate: RECORDER_CONFIG.bitrate,
    sampleRate: 44100,
    numberOfChannels: 1,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    meteringEnabled: true,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: RECORDER_CONFIG.bitrate * 1000,
  },
};

  // A conservative minimal options object to use as a fallback when createAsync
  // refuses attempts that do not include both android & ios keys.
  const MINIMAL_RECORDING_OPTIONS = {
    android: {
      extension: ".m4a",
      outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
      audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
      sampleRate: 44100,
      bitRate: 16000,
      numberOfChannels: 1,
    },
    ios: {
      extension: ".m4a",
      outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
      audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW,
      sampleRate: 44100,
      bitRate: 16000,
      numberOfChannels: 1,
    },
  };
const WAVE_TEMPLATE = [10, 18, 26, 32, 28, 22, 16, 12, 18, 26, 30, 24, 18, 12, 20, 28, 22, 16, 12, 18];
const FILE_SYSTEM_BINARY_UPLOAD_TYPE = (FileSystem as any)?.FileSystemUploadType?.BINARY_CONTENT ?? undefined;
// Relax types to avoid cross-version TS issues with expo-av
type AudioSoundInstance = any;
type AudioRecordingInstance = any;
type RecordingStatus = any;
type VoiceRetryPayload = {
  uri: string;
  waveform: number[];
  durationMs: number;
  replyToId?: string | null;
  repliedTo?: ChatMessage["replied_to"] | null;
};

const DEFAULT_FUNC_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1` : "";
const VOICE_API_BASE =
  (Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL as string) ||
  (Constants?.manifest?.extra?.EXPO_PUBLIC_API_BASE_URL as string) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  DEFAULT_FUNC_BASE;

const buildVoiceApiUrl = (path: string) => {
  if (!VOICE_API_BASE) {
    throw new Error("Voice API base URL is not configured");
  }
  const base = VOICE_API_BASE.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

/* ---------------- Theme (using centralized app theme) ---------------- */
// useAppTheme wrapper for backward compatibility
const useAppTheme = () => {
  const { colors, selectedKey, applyTheme, clearTheme } = useTheme();
  return { 
    colors, 
    selectedKey, 
    applyTheme, 
    clearTheme, 
    isDark: colors.isDark 
  };
};

// Animated wrapper for virtualized lists (FlatList/SectionList/VirtualizedList)
// to enable native driven scroll events when using Animated.event({ useNativeDriver: true })
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as any;

// small app-wide fallbacks (kept local to this file)
const AVATAR_FALLBACK = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

// Cloudinary config (fall back to values in app.config.extra)
// Prefer project config / env; default to the chat upload cloud configured for the app
const CLOUDINARY_CLOUD_NAME =
  (Constants?.expoConfig?.extra?.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME as string) ||
  (Constants?.manifest?.extra?.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME as string) ||
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ||
  "dpejjmjxg";
const CLOUDINARY_UPLOAD_PRESET =
  (Constants?.expoConfig?.extra?.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET as string) ||
  (Constants?.manifest?.extra?.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET as string) ||
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
  "chatsuploads";

/* --------------------------- small utils --------------------------- */
const isVideoUrl = (u?: string | null) => {
  if (!u) return false;
  try {
    const low = u.split('?')[0].toLowerCase();
    return low.endsWith('.mp4') || low.endsWith('.mov') || low.endsWith('.m4v') || low.endsWith('.webm');
  } catch {
    return false;
  }
};

const isAudioUrl = (u?: string | null) => {
  if (!u) return false;
  try {
    const low = u.split('?')[0].toLowerCase();
    return low.endsWith('.m4a') || low.endsWith('.mp3') || low.endsWith('.aac') || low.endsWith('.wav') || low.endsWith('.ogg') || low.endsWith('.flac') || low.endsWith('.caf');
  } catch {
    return false;
  }
};

const formatTimeMs = (ms: number | null | undefined) => {
  if (!ms && ms !== 0) return "00:00";
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const sameDay = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false;
  try {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  } catch {
    return false;
  }
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso || "";
  }
};

// Format online/offline status with last seen time
const formatOnlineStatus = (isOnline?: boolean | null, lastSeen?: string | null): string => {
  if (isOnline === true) return "Online";
  if (!lastSeen) return "Offline";
  try {
    const d = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Last seen just now";
    if (diffMins < 60) return `Last seen ${diffMins}m ago`;
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    if (diffDays === 1) return "Last seen yesterday";
    if (diffDays < 7) return `Last seen ${diffDays}d ago`;
    // For older dates, show the date
    return `Last seen ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return "Offline";
  }
};

// Return a short-friendly day label: Today / Yesterday / 3d / a week / 2 weeks / 'Aug 17'
const friendlyDayLabel = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const startOf = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const days = Math.floor((startOf(now).getTime() - startOf(d).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d`;
    if (days < 14) return `a week`;
    if (days < 60) return `${Math.floor(days / 7)} weeks`;
    // older - use short date (e.g., Aug 26)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso || "";
  }
};

const formatTimeOnly = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso || "";
  }
};

// pick white/black text depending on background brightness (simple luminance)
const readableTextColor = (hex?: string | null) => {
  if (!hex) return "#000";
  try {
    const h = hex.replace('#', '').trim();
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.7 ? '#000' : '#fff';
  } catch {
    return '#fff';
  }
};

/* ---------------------- ExportGlass (SDK54 Glass + fallback) ---------------------- */
const ExportGlassWrapper: React.FC<
  React.PropsWithChildren<{
    style?: any;
    intensity?: number;
    radius?: number;
    tint?: "dark" | "light";
    fallbackGradient?: string[];
    glassProps?: any;
  }>
> = ({ children, style, intensity = 40, radius = 16, tint = "dark", fallbackGradient, glassProps }) => {
  const GlassView = (globalThis as any).__ExpoGlassView || null;

  if (GlassView) {
    return (
      <GlassView
        {...glassProps}
        style={[
          {
            borderRadius: radius,
            overflow: "hidden",
          },
          style,
        ]}
      >
        <View style={{ padding: 0 }}>{children}</View>
      </GlassView>
    );
  }

  const gradColors = fallbackGradient ?? (tint === "dark" ? ["rgba(255,255,255,0.03)", "rgba(255,255,255,0.01)"] : ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.2)"]);
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, style]}>
      <BlurView intensity={intensity} tint={tint as any} style={StyleSheet.absoluteFill} />
  <LinearGradient colors={gradColors as any} start={[0, 0]} end={[1, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 0 }}>{children}</View>
    </View>
  );
};

/* ------------------------------- START SCREEN ------------------------------- */
export default function ChatScreen() {
  // ...existing state and helper declarations...

  // ...existing state and helper declarations...


  // ...existing state and helper declarations...

  
  // --- try to dynamically import expo-glass-effect once (SDK 54) ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("expo-glass-effect");
        if (!mounted) return;
        (globalThis as any).__ExpoGlassView = mod?.GlassView || mod?.default || null;
      } catch (e) {
        (globalThis as any).__ExpoGlassView = null;
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const insets = useSafeAreaInsets();
  const router = withSafeRouter(useRouter());
  const { profile } = useProfileStore();
  const { id, otherName, otherAvatar } = useLocalSearchParams<{ id: string; otherName?: string; otherAvatar?: string }>();
  const convoId = Array.isArray(id) ? id[0] : id;

  const systemScheme = useColorScheme();
  const { colors: themeColors, selectedKey, isDark: appIsDark } = useAppTheme();
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [userThemePref, setUserThemePref] = useState<string | null>(null);
  // derive dark/light from selected theme (safe fallback to system)
  const isDark = appIsDark;
  const themeIsLight = !isDark;
  const THEME = useMemo(
    () => ({ bg: themeColors.bg, tint: (isDark ? "dark" : "light") as "dark" | "light", text: themeColors.text, subtext: themeColors.subtext, inputBg: themeColors.card }),
    [themeColors, isDark]
  );

  // Invite handlers: declared after loadMessages so pendingInvite and loadMessages exist
  async function acceptInvite() {
    if (!convoId || !profile?.id || !pendingInvite) return;
    try {
      await supabase.from('conversation_participants').update({ accepted: true }).match({ conversation_id: convoId, user_id: profile.id });
    } catch (e) {}
    try { setParticipants((prev) => (prev || []).map((p: any) => (p.id === profile.id ? { ...(p || {}), accepted: true } : p))); } catch {}
    // After accepting, update participant state only. Do NOT post an invite_accepted system message
    setPendingInvite(null);
  }

  async function abortInvite() {
    if (!convoId) return;
    try {
      // Do not insert an invite_aborted message — keep abort/accept flows as prompts only.
      try { await supabase.from('conversation_participants').delete().match({ conversation_id: convoId, user_id: profile?.id }); } catch (e) {}
      setPendingInvite(null);
      router.back();
    } catch (e) {
      console.warn('abortInvite err', e);
      Alert.alert('Unable to abort', 'There was a problem cancelling this conversation.');
    }
  }

  // invite handlers defined lower (after loadMessages)

  // invite handlers are defined below (after loadMessages)

  /* invite handlers will be declared after loadMessages */

  /* invite handlers are defined below (after loadMessages) */

  const ui = useMemo(() => ({ text: THEME.text, subtext: THEME.subtext, inputBg: THEME.inputBg }), [THEME]);
  // solid input bg to avoid transparency (use theme card color)
  const inputBgSolid = THEME.inputBg;
  const SENDER_LABEL_COLOR = "#0b93f6"; // blue
  const RECEIVER_LABEL_COLOR = "#077bffff"; // green

  /* refs + audio */
  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  // track whether the user is currently scrolled near the bottom so we don't force-scroll
  const isNearBottomRef = useRef(true);
  // suppress onScroll side-effects during programmatic scrolls
  const isProgrammaticScrollRef = useRef(false);
  // used to temporarily highlight a message when jumping to a reply
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);
  const sendSoundRef = useRef<AudioSoundInstance | null>(null);
  const receiveSoundRef = useRef<AudioSoundInstance | null>(null);
  const sendSoundPlayedRef = useRef(false);
  const animatedMessagesRef = useRef<Set<string>>(new Set());
  const keyboardShowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const micLongPressActiveRef = useRef(false);
  const skipNextMicPressRef = useRef(false);
  const cancelArmedRef = useRef(false);
  const holdStartCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [holdHintVisible, setHoldHintVisible] = useState(false);
  const holdHintAnim = useRef(new Animated.Value(0)).current;
  // Recording UI animations
  const recordingPulse = useRef(new Animated.Value(1)).current;
  const recordingDotOpacity = useRef(new Animated.Value(1)).current;
  const recordingBannerScale = useRef(new Animated.Value(0.95)).current;
  const recordingBannerOpacity = useRef(new Animated.Value(0)).current;
  const audioPreviewSlide = useRef(new Animated.Value(20)).current;
  const audioPreviewOpacity = useRef(new Animated.Value(0)).current;
  const micButtonScale = useRef(new Animated.Value(1)).current;
  const playButtonPulse = useRef(new Animated.Value(1)).current;
  // Header loading gradient pulse animation
  const headerLoadingPulse = useRef(new Animated.Value(0)).current;
  const voiceMetaRef = useRef<Record<string, { waveform: number[]; durationMs: number; uri: string }>>({});
  // currently uploading optimistic local id for audio (used to mark cancel -> error)
  const uploadingAudioLocalRef = useRef<string | null>(null);

  /* store */
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [participants, setParticipants] = useState<(Profile & { accepted?: boolean; follower_count?: number; is_online?: boolean | null; last_seen?: string | null })[]>([]);
  const [prefetchOther, setPrefetchOther] = useState<(Partial<Profile> & { follower_count?: number }) | null>(null);
  const [serverMessages, setServerMessages] = useState<ChatMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // merged: server + optimistic
  // For display we pass a reversed copy (newest-first) into an inverted FlatList so
  // the list opens at the latest message without needing any programmatic scroll.
  const visibleMessages = useMemo(() => (messages ? [...messages].slice().reverse() : []), [messages]);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<AudioRecordingInstance | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [audioPlayback, setAudioPlayback] = useState<AudioSoundInstance | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [loadingAudioUri, setLoadingAudioUri] = useState<string | null>(null); // Track which audio is loading
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 1.5x, 2x
  // Audio cache - stores loaded Sound objects by URI for instant replay
  const audioCacheRef = useRef<Map<string, { sound: AudioSoundInstance; durationMs: number }>>(new Map());
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0); // seconds
  const [playingPositionMs, setPlayingPositionMs] = useState<number>(0);
  const [playingDurationMs, setPlayingDurationMs] = useState<number>(0);
  const [proxNear, setProxNear] = useState<boolean>(false);
  const [lastVoiceDurationMs, setLastVoiceDurationMs] = useState<number>(0);
  const [recorderState, setRecorderState] = useState<"idle" | "recording" | "locked" | "preview" | "uploading">("idle");
  const [waveformSamples, setWaveformSamples] = useState<number[]>([]);
  const waveformRef = useRef<number[]>([]);
  const [showCancelAffordance, setShowCancelAffordance] = useState(false);
  const [showLockAffordance, setShowLockAffordance] = useState(false);
  const micLockActiveRef = useRef(false);
  const isRecordingRef = useRef(false); // Ref to track recording state for cleanup functions (avoids stale closure issues)
  const [hasShownPrivacyNote, setHasShownPrivacyNote] = useState(false);
  // microphone permission status tracked at runtime: 'unknown' -> try request, 'granted' -> ok, 'denied' -> user must enable
  const [micPerm, setMicPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const ensureMicPermission = useCallback(async () => {
    try {
      const cur = await Audio.getPermissionsAsync();
      if (cur && cur.granted) {
        setMicPerm('granted');
        return true;
      }
      const r = await Audio.requestPermissionsAsync();
      setMicPerm(r && r.granted ? 'granted' : 'denied');
      return !!(r && r.granted);
    } catch (err) {
      console.warn('[chat] ensureMicPermission err', err);
      setMicPerm('denied');
      return false;
    }
  }, []);

  const openAppSettings = useCallback(() => {
    try {
      // Open app settings — works on both iOS & Android
      Linking.openSettings?.();
    } catch (e) {
      try { Alert.alert('Settings', 'Please open app settings and enable Microphone permission.'); } catch {}
    }
  }, []);
  const uploadAndSendVoiceRef = useRef<null | ((uri: string, waveform: number[], durationMs: number, opts?: { reuseLocalId?: string; skipCreate?: boolean; replyToId?: string | null; repliedTo?: ChatMessage["replied_to"] | null }) => Promise<void>)>(null);
  const voiceRetryQueueRef = useRef<Record<string, VoiceRetryPayload & { attempt: number }>>({});
  const voiceRetryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  // retry tracking for failed media sends
  const [resendCounts, setResendCounts] = useState<Record<string, number>>({});
  const [resendingIds, setResendingIds] = useState<Record<string, boolean>>({});
  const [uploadProgressMap, setUploadProgressMap] = useState<Record<string, number>>({});
  // replies expand/collapse state per parent message id
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [fullExpandedReplies, setFullExpandedReplies] = useState<Record<string, boolean>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // slightly lower default so input area isn't oversized before layout measures
  const [inputBaseHeight, setInputBaseHeight] = useState(110);
  const [inputFocused, setInputFocused] = useState(false);
  const bottomSpacer = useMemo(() => inputBaseHeight + (keyboardHeight > 0 ? keyboardHeight : 0) + 64, [inputBaseHeight, keyboardHeight]);
  const bottomSpacerWithExtra = useMemo(() => bottomSpacer + 60, [bottomSpacer]);
  const scrollPersistKey = useMemo(() => (convoId ? `chatScroll:${convoId}` : null), [convoId]);
  const [savedScrollState, setSavedScrollState] = useState<{ offset?: number; lastMessageId?: string | null } | null>(null);
  const [scrollStateReady, setScrollStateReady] = useState<boolean>(!scrollPersistKey);
  const scrollOffsetRef = useRef(0);
  const lastVisibleMessageRef = useRef<string | null>(null);
  const scrollPersistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialScrollAppliedRef = useRef(false);
  const isGroup = conversation?.is_group === true;
  const otherUser = !isGroup && participants.length > 0 && profile?.id ? participants.find((p) => p.id !== profile.id) || null : null;
  const otherParticipantIds = useMemo(() => {
    if (!participants?.length) return [] as string[];
    return participants.map((p) => p.id).filter((id) => !!id && id !== profile?.id);
  }, [participants, profile?.id]);
  const otherParticipantKey = useMemo(() => {
    if (!otherParticipantIds.length) return "";
    return [...otherParticipantIds].sort().join(",");
  }, [otherParticipantIds]);
  const participantProfileMap = useMemo(() => {
    const map: Record<string, Partial<Profile>> = {};
    participants.forEach((p) => {
      if (p?.id) {
        map[p.id] = {
          id: p.id,
          full_name: p.full_name || "Someone",
          avatar_url: p.avatar_url ?? undefined,
        };
      }
    });
    if (profile?.id) {
      map[profile.id] = {
        id: profile.id,
        full_name: profile.full_name || profile.username || "You",
        avatar_url: profile.avatar_url ?? undefined,
      };
    }
    return map;
  }, [participants, profile?.id, profile?.full_name, profile?.avatar_url, profile?.username]);
  const headerAnim = useRef(new Animated.Value(1)).current;
  // scroll-driven parallax for background
  const scrollY = useRef(new Animated.Value(0)).current;

  // Recording UI animations - pulsing dot and smooth transitions
  useEffect(() => {
    // Sync the ref with the state (for use in cleanup functions that need current value)
    isRecordingRef.current = isRecording;
    
    let dotPulseLoop: Animated.CompositeAnimation | null = null;
    let micPulseLoop: Animated.CompositeAnimation | null = null;
    
    if (isRecording || recorderState === 'recording' || recorderState === 'locked') {
      // Animate recording banner entrance
      Animated.parallel([
        Animated.spring(recordingBannerScale, { toValue: 1, stiffness: 280, damping: 18, mass: 0.8, useNativeDriver: true }),
        Animated.timing(recordingBannerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      
      // Pulsing red dot animation
      dotPulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingDotOpacity, { toValue: 0.3, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(recordingDotOpacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      dotPulseLoop.start();
      
      // Mic button pulse while recording
      micPulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(micButtonScale, { toValue: 1.15, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(micButtonScale, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      micPulseLoop.start();
    } else {
      // Reset recording banner
      recordingBannerScale.setValue(0.95);
      recordingBannerOpacity.setValue(0);
      recordingDotOpacity.setValue(1);
      micButtonScale.setValue(1);
    }
    
    return () => {
      dotPulseLoop?.stop();
      micPulseLoop?.stop();
    };
  }, [isRecording, recorderState, recordingBannerScale, recordingBannerOpacity, recordingDotOpacity, micButtonScale]);

  // Audio preview slide-in animation
  useEffect(() => {
    if (recordedUri && recorderState === 'preview') {
      audioPreviewSlide.setValue(20);
      audioPreviewOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(audioPreviewSlide, { toValue: 0, stiffness: 260, damping: 20, mass: 0.9, useNativeDriver: true }),
        Animated.timing(audioPreviewOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [recordedUri, recorderState, audioPreviewSlide, audioPreviewOpacity]);

  // animated wrapper for LinearGradient so we can animate the stripe
  const AnimatedLinearGradient = useMemo(() => Animated.createAnimatedComponent(LinearGradient), []);

  useEffect(() => {
    let isActive = true;
    if (!scrollPersistKey) {
      setSavedScrollState(null);
      setScrollStateReady(true);
      return;
    }
    setScrollStateReady(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(scrollPersistKey);
        if (!isActive) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setSavedScrollState(parsed);
            if (typeof parsed?.offset === "number") {
              scrollOffsetRef.current = parsed.offset;
            }
            if (parsed?.lastMessageId) {
              lastVisibleMessageRef.current = parsed.lastMessageId;
            }
          } catch {
            setSavedScrollState(null);
          }
        } else {
          setSavedScrollState(null);
        }
      } catch (err) {
        console.warn("chat scroll state load failed", err);
        if (isActive) {
          setSavedScrollState(null);
        }
      } finally {
        if (isActive) {
          setScrollStateReady(true);
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, [scrollPersistKey]);

  useEffect(() => {
    initialScrollAppliedRef.current = false;
  }, [scrollPersistKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const flag = await AsyncStorage.getItem("chat:micPrivacyShown");
        if (mounted) {
          setHasShownPrivacyNote(!!flag);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Request microphone permission proactively on mount so the mic UI will be responsive
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Check existing status
        const perm = await Audio.getPermissionsAsync();
        if (!mounted) return;
        if (perm && perm.granted) {
          setMicPerm('granted');
          return;
        }

        // Not granted yet: request it now so we can capture errors earlier
        try {
          const r = await Audio.requestPermissionsAsync();
          if (!mounted) return;
          setMicPerm(r && r.granted ? 'granted' : 'denied');
        } catch (reqErr) {
          console.warn('[chat] requestPermissionsAsync failed', reqErr);
          if (mounted) setMicPerm('denied');
        }
      } catch (err) {
        console.warn('[chat] mic permission check failed', err);
        if (mounted) setMicPerm('denied');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // (Keyboard listeners exist later in file; avoid duplicate setup here.)
  const scrollLastMessageIntoView = useCallback(
    (animated = true, force = false) => {
      // Only programmatic scroll when explicitly forced (manual actions). This prevents
      // automatic jumps while the user is reading older messages.
      if (!force || !messages.length) return;
      const execute = () => {
        try {
          isProgrammaticScrollRef.current = true;
          // For an inverted list (we pass newest-first and inverted=true) the
          // newest message is at index 0. Use scrollToOffset(0) to jump there.
          try {
            listRef.current?.scrollToOffset({ offset: 0, animated });
          } catch (e) {
            // fallback to scrollToEnd if scrollToOffset isn't supported
            listRef.current?.scrollToEnd({ animated });
          }
          if (animated) {
            setTimeout(() => {
              try { listRef.current?.scrollToEnd({ animated }); } catch {}
              isProgrammaticScrollRef.current = false;
            }, 220);
          } else {
            isProgrammaticScrollRef.current = false;
          }
        } catch {
          isProgrammaticScrollRef.current = false;
        }
      };
      if (animated) {
        requestAnimationFrame(execute);
        setTimeout(execute, 100);
      } else {
        execute();
      }
    },
    [messages]
  );

  const fileSizeAsync = useCallback(async (uri: string | null | undefined) => {
    if (!uri) return 0;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? info.size || 0 : 0;
    } catch {
      return 0;
    }
  }, []);

  const [conversationShots, setConversationShots] = useState<StoryShot[]>([]);
  const [shotsLoading, setShotsLoading] = useState(false);
  const [shotViewerVisible, setShotViewerVisible] = useState(false);
  const [activeShot, setActiveShot] = useState<StoryShot | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const describeShotExpiry = useCallback((iso?: string | null) => {
    if (!iso) return "Expires soon";
    try {
      const diffMs = new Date(iso).getTime() - Date.now();
      if (diffMs <= 0) return "Expired";
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      if (hours >= 1) return `Expires in ${hours}h`;
      const mins = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
      return `Expires in ${mins}m`;
    } catch {
      return "Expires soon";
    }
  }, []);

  const formatShotTimestamp = useCallback((iso?: string | null) => {
    if (!iso) return "";
    try {
      const date = new Date(iso);
      const diffMs = Date.now() - date.getTime();
      if (diffMs < 0) return "Just now";
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d`;
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  }, []);

  const fetchConversationShots = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!profile?.id || otherParticipantIds.length === 0) {
        setConversationShots([]);
        return;
      }
      if (!opts?.silent) setShotsLoading(true);
      try {
        const baseSelect = `id, story_id, sender_id, recipient_id, media_index, media_url, media_type, caption, created_at, expires_at, viewed_at`;

        const incomingPromise = supabase
          .from("story_shots")
          .select(baseSelect)
          .eq("recipient_id", profile.id)
          .in("sender_id", otherParticipantIds)
          .order("created_at", { ascending: false })
          .limit(60);

        const outgoingPromise = supabase
          .from("story_shots")
          .select(baseSelect)
          .eq("sender_id", profile.id)
          .in("recipient_id", otherParticipantIds)
          .order("created_at", { ascending: false })
          .limit(60);

        const [{ data: incoming, error: incomingError }, { data: outgoing, error: outgoingError }] = await Promise.all([incomingPromise, outgoingPromise]);
        if (incomingError) throw incomingError;
        if (outgoingError) throw outgoingError;

        const combinedRows = [...(incoming || []), ...(outgoing || [])];
        combinedRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const now = Date.now();
        const mapped: StoryShot[] = combinedRows.map((row: any) => {
          const senderProfile = participantProfileMap[row.sender_id] ?? null;
          const recipientProfile = participantProfileMap[row.recipient_id] ?? null;
          const isOutgoing = row.sender_id === profile.id;
          return {
            id: row.id,
            sender_id: row.sender_id,
            recipient_id: row.recipient_id,
            story_id: row.story_id ?? null,
            media_index: typeof row.media_index === "number" ? row.media_index : null,
            media_url: row.media_url ?? null,
            media_type: row.media_type ?? null,
            caption: row.caption ?? null,
            created_at: row.created_at,
            expires_at: row.expires_at ?? null,
            viewed_at: row.viewed_at ?? null,
            sender_profile: senderProfile,
            recipient_profile: recipientProfile,
            isOutgoing,
          };
        });

        const filtered = mapped.filter((shot) => {
          if (shot.isOutgoing) {
            if (!shot.expires_at) return true;
            try {
              return new Date(shot.expires_at).getTime() > now;
            } catch {
              return true;
            }
          }
          if (shot.viewed_at) return false;
          if (!shot.expires_at) return true;
          try {
            return new Date(shot.expires_at).getTime() > now;
          } catch {
            return true;
          }
        });
        setConversationShots(filtered);
      } catch (err) {
        console.warn("fetchConversationShots err", err);
      } finally {
        if (!opts?.silent) setShotsLoading(false);
      }
    },
    [profile?.id, otherParticipantIds, otherParticipantKey, participantProfileMap]
  );

  useEffect(() => {
    fetchConversationShots();
  }, [fetchConversationShots]);

  useEffect(() => {
    if (!profile?.id) {
      setFollowingMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", profile.id);
        if (cancelled) return;
        if (error) throw error;
        const nextMap: Record<string, boolean> = {};
        (data || []).forEach((row: any) => {
          const fid = row?.following_id;
          if (fid) nextMap[fid] = true;
        });
        setFollowingMap(nextMap);
      } catch (err) {
        if (!cancelled) setFollowingMap({});
        console.warn("load following map err", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const markShotViewed = useCallback(async (shotId: string) => {
    setConversationShots((prev) => prev.filter((shot) => shot.id !== shotId));
    try {
      await supabase.from("story_shots").update({ viewed_at: new Date().toISOString() }).eq("id", shotId);
    } catch (err) {
      console.warn("markShotViewed err", err);
    }
  }, []);

  const handleShotPress = useCallback(
    (shot: StoryShot) => {
      if (!shot.media_url) {
        Alert.alert("Shot", "This shot is no longer available.");
        if (!(shot.sender_id === profile?.id)) {
          markShotViewed(shot.id).catch(() => {});
        }
        return;
      }
      setActiveShot(shot);
      setShotViewerVisible(true);
      if (!(shot.sender_id === profile?.id)) {
        markShotViewed(shot.id).catch(() => {});
      }
    },
    [markShotViewed, profile?.id]
  );

  const closeShotViewer = useCallback(() => {
    setShotViewerVisible(false);
    setActiveShot(null);
  }, []);

  const canRestoreActiveShot = useMemo(() => {
    if (!activeShot || !activeShot.story_id) return false;
    if (activeShot.sender_id && profile?.id && activeShot.sender_id === profile.id) return true;
    if (!activeShot.sender_id) return false;
    return !!followingMap[activeShot.sender_id];
  }, [activeShot, followingMap, profile?.id]);

  const handleRestoreShot = useCallback(() => {
    if (!activeShot?.story_id) return;
    closeShotViewer();
    requestAnimationFrame(() => {
      try {
        router.push({ pathname: "/(tabs)/Contents", params: { storyId: activeShot.story_id } } as any);
      } catch (err) {
        console.warn("restore shot navigation err", err);
      }
    });
  }, [activeShot?.story_id, closeShotViewer, router]);

  const getVoiceAuthHeaders = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        return { Authorization: `Bearer ${token}` } as Record<string, string>;
      }
    } catch {}
    return {} as Record<string, string>;
  }, []);

  const initiateVoiceUpload = useCallback(
    async ({ localId, durationMs, waveform, size }: { localId: string; durationMs: number; waveform: number[]; size?: number }) => {
      const endpoint = buildVoiceApiUrl("/api/messages/voice/initiate");
      const headers = await getVoiceAuthHeaders();
      const payload = {
        conversationId: convoId,
        durationMs,
        sizeHint: typeof size === "number" ? size : await fileSizeAsync(voiceMetaRef.current[localId]?.uri),
        waveformPreview: waveform,
        localMessageId: localId,
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Unable to initiate voice upload");
      }
      return json as { uploadUrl: string; messageId: string };
    },
    [convoId, fileSizeAsync, getVoiceAuthHeaders]
  );

  const uploadVoiceData = useCallback(
    async (uploadUrl: string, uri: string, localId: string) => {
      const task = FileSystem.createUploadTask(
        uploadUrl,
        uri,
        {
          httpMethod: "PUT",
          uploadType: FILE_SYSTEM_BINARY_UPLOAD_TYPE,
          headers: { "Content-Type": "audio/m4a" },
        },
        (progress) => {
          if (!progress || !progress.totalBytesExpectedToSend) return;
          const ratio = Math.min(1, Math.max(0, progress.totalBytesSent / progress.totalBytesExpectedToSend));
          setUploadProgressMap((prev) => ({ ...(prev || {}), [localId]: ratio }));
        }
      );
      try {
        const result = await task.uploadAsync();
        setUploadProgressMap((prev) => {
          if (!prev) return {};
          const next = { ...prev };
          delete next[localId];
          return next;
        });
        if ((result as any)?.status && (result as any).status >= 400) {
          throw new Error(`Upload failed with status ${(result as any).status}`);
        }
        return result;
      } catch (err) {
        setUploadProgressMap((prev) => {
          if (!prev) return {};
          const next = { ...prev };
          delete next[localId];
          return next;
        });
        throw err;
      }
    },
    []
  );

  const completeVoiceUpload = useCallback(
    async ({ messageId, durationMs, size, waveform }: { messageId: string; durationMs: number; size: number; waveform: number[] }) => {
      const endpoint = buildVoiceApiUrl("/api/messages/voice/complete");
      const headers = await getVoiceAuthHeaders();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ messageId, durationMs, size, waveform }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Unable to finalize voice upload");
      }
      return json;
    },
    [getVoiceAuthHeaders]
  );

  const persistScrollSnapshot = useCallback(async () => {
    if (!scrollPersistKey || !scrollStateReady || !initialScrollAppliedRef.current) return;
    try {
      const payload = JSON.stringify({
        offset: Math.max(0, scrollOffsetRef.current || 0),
        lastMessageId: lastVisibleMessageRef.current,
      });
      await AsyncStorage.setItem(scrollPersistKey, payload);
    } catch (err) {
      console.warn("chat scroll state persist failed", err);
    }
  }, [scrollPersistKey, scrollStateReady]);

  const scheduleScrollPersist = useCallback(() => {
    if (!scrollPersistKey || !scrollStateReady || !initialScrollAppliedRef.current) return;
    if (scrollPersistTimeoutRef.current) {
      clearTimeout(scrollPersistTimeoutRef.current);
    }
    scrollPersistTimeoutRef.current = setTimeout(() => {
      scrollPersistTimeoutRef.current = null;
      persistScrollSnapshot();
    }, 350);
  }, [persistScrollSnapshot, scrollPersistKey, scrollStateReady]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (scrollPersistTimeoutRef.current) {
          clearTimeout(scrollPersistTimeoutRef.current);
          scrollPersistTimeoutRef.current = null;
        }
        persistScrollSnapshot();
        
        // Stop any ACTIVE recording when page loses focus (only if currently recording)
        // Use isRecordingRef.current to get the CURRENT value (avoids stale closure from state)
        // This prevents incorrectly stopping a recording that already finished and transitioned to preview
        if (recording && isRecordingRef.current) {
          try {
            recording.stopAndUnloadAsync().catch(() => {});
            setRecording(null);
            setIsRecording(false);
            setRecorderState('idle');
            // Don't clear recordedUri here - only clear if we're cancelling mid-recording
          } catch (e) {
            console.warn('[chat] Failed to stop recording on blur:', e);
          }
        }
        
        // Stop any playing audio when page loses focus
        if (audioPlayback && isAudioPlaying) {
          try {
            audioPlayback.pauseAsync().catch(() => {});
            setIsAudioPlaying(false);
          } catch (e) {
            console.warn('[chat] Failed to pause audio on blur:', e);
          }
        }
      };
    }, [persistScrollSnapshot, recording, audioPlayback, isAudioPlaying])
  );

  useEffect(() => {
    return () => {
      if (scrollPersistTimeoutRef.current) {
        clearTimeout(scrollPersistTimeoutRef.current);
        scrollPersistTimeoutRef.current = null;
      }
      persistScrollSnapshot();
    };
  }, [persistScrollSnapshot]);

  useEffect(() => {
    // Do not perform any programmatic initial scrolling — the inverted list + reversed
    // data will already render the latest message at the bottom. Mark initial
    // scroll work as done so other view handlers can proceed.
    if (initialScrollAppliedRef.current) return;
    if (!messages.length) return;
    initialScrollAppliedRef.current = true;
  }, [messages]);
  // Audio recording logic
  const stopRecording = useCallback(
    async (options?: { suppressPreview?: boolean; autoSend?: boolean; reason?: "cancel" | "finished" }) => {
      try {
        if (!recording) return null;
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const uri = recording.getURI();
        let persisted = uri || null;
        try {
          if (uri && FileSystem && (FileSystem as any).cacheDirectory) {
            const parts = (uri || "").split(".");
            const ext = parts.length > 1 ? parts.pop() : "m4a";
            const dest = `${(FileSystem as any).cacheDirectory}chat_rec_${Date.now()}.${ext}`;
            await FileSystem.copyAsync({ from: uri, to: dest }).catch(() => {});
            persisted = dest;
          }
        } catch (e) {
          persisted = uri || null;
        }
        setRecorderState(options?.reason === "cancel" ? "idle" : options?.autoSend ? "uploading" : "preview");
        if (options?.suppressPreview) {
          setRecordedUri(null);
        } else {
          setRecordedUri(persisted);
        }
        setRecording(null);
        setIsRecording(false);
        isRecordingRef.current = false; // Immediately update ref so cleanup functions see the new value
        setShowCancelAffordance(false);
        setShowLockAffordance(false);
        micLockActiveRef.current = false;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current as any);
          recordingTimerRef.current = null;
        }
        return persisted;
      } catch (e) {
        setIsRecording(false);
        isRecordingRef.current = false; // Immediately update ref so cleanup functions see the new value
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current as any);
          recordingTimerRef.current = null;
        }
        Alert.alert("Recording Error", "Could not stop recording.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return null;
      }
    },
    [recording]
  );

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (isRecording || recorderState === "recording" || recorderState === "locked") return false;
    try {
      const permission = await Audio.getPermissionsAsync();
      try { console.debug('[chat] getPermissionsAsync ->', permission); } catch {}
      if (!permission.granted) {
        try { console.debug('[chat] requesting microphone permission'); } catch {}
        const req = await Audio.requestPermissionsAsync();
        try { console.debug('[chat] requestPermissionsAsync ->', req); } catch {}
        if (!req.granted) {
          Alert.alert("Microphone permission needed", "Enable microphone access in settings to send voice notes.");
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          return false;
        }
      }
      if (!hasShownPrivacyNote) {
        Alert.alert("Voice Notes", "We only record while you hold the mic. Audio stays encrypted until sent.", [
          { text: "OK", onPress: () => AsyncStorage.setItem("chat:micPrivacyShown", "1").catch(() => {}) },
        ]);
        setHasShownPrivacyNote(true);
      }
      try {
        if (audioPlayback) {
          await audioPlayback.unloadAsync();
          setAudioPlayback(null);
          setPlayingUri(null);
        }
      } catch {}
      try {
        console.debug('[chat] calling Audio.setAudioModeAsync for recording');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.debug('[chat] Audio.setAudioModeAsync success');
      } catch (e) {
        console.error('[chat] Audio.setAudioModeAsync failed', String(e));
        // continue — we'll still attempt recording but log failure
      }
      let freshRecording: any = null;
      // Try a series of recording creation attempts with descriptive logging
      let lastErr: any = null;
      const attemptCreate = async (opts: any, label: string) => {
        try {
          console.debug('[chat] startRecording attempt:', label);
          const created: any = await Audio.Recording.createAsync(opts);
          console.debug('[chat] startRecording success:', label);
          return created.recording;
        } catch (e) {
          console.error('[chat] startRecording failed:', label, String(e), e);
          lastErr = e;
          return null;
        }
      };

      // Attempt 1: primary customized options (preferred)
      freshRecording = await attemptCreate(CUSTOM_RECORDING_OPTIONS, 'CUSTOM_RECORDING_OPTIONS');
      // Attempt 2: minimal explicit android+ios options (required by expo-av)
      if (!freshRecording) freshRecording = await attemptCreate(MINIMAL_RECORDING_OPTIONS, 'MINIMAL_RECORDING_OPTIONS');
      // If still missing and there are system presets available that include proper platform keys, try them
      if (!freshRecording && (Audio as any).RECORDING_OPTIONS_PRESET_HIGH_QUALITY) {
        freshRecording = await attemptCreate((Audio as any).RECORDING_OPTIONS_PRESET_HIGH_QUALITY, 'PRESET_HIGH_QUALITY');
      }
      if (!freshRecording && (Audio as any).RECORDING_OPTIONS_PRESET_LOW_QUALITY) {
        freshRecording = await attemptCreate((Audio as any).RECORDING_OPTIONS_PRESET_LOW_QUALITY, 'PRESET_LOW_QUALITY');
      }

      if (!freshRecording) {
        // All attempts failed — log last error and return false so UI remains responsive
        console.error('[chat] all startRecording attempts failed, lastErr:', String(lastErr), lastErr);
        // Optionally send this error to analytics / remote logging for diagnosis
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return false;
      }
      waveformRef.current = [];
      setWaveformSamples([]);
      setRecorderState("recording");
      setShowCancelAffordance(true);
      setShowLockAffordance(true);
      setRecording(freshRecording as AudioRecordingInstance);
      setIsRecording(true);
      isRecordingRef.current = true; // Immediately update ref so cleanup functions see the new value
      setRecordingDuration(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current as any);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((sec) => sec + 1), 1000) as any;
      freshRecording.setProgressUpdateInterval?.(120);
      freshRecording.setOnRecordingStatusUpdate?.((status: RecordingStatus) => {
        if (status?.durationMillis != null) {
          setRecordingDuration(Math.max(0, Math.floor(status.durationMillis / 1000)));
          if (status.durationMillis >= RECORDER_CONFIG.maxDurationMs - 1500) {
            setShowCancelAffordance(false);
          }
          if (status.durationMillis >= RECORDER_CONFIG.maxDurationMs) {
            stopRecording({ suppressPreview: !RECORDER_CONFIG.showPreviewAfterAutoSend, autoSend: true }).catch(() => {});
          }
        }
        if (typeof (status as any)?.metering === "number") {
          const dbValue = (status as any).metering as number;
          const normalized = Math.min(1, Math.max(0, Math.pow(10, dbValue / 20)));
          waveformRef.current = [...waveformRef.current, normalized].slice(-RECORDER_CONFIG.waveformPoints);
          setWaveformSamples(waveformRef.current);
        }
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return true;
    } catch (err) {
      setIsRecording(false);
      isRecordingRef.current = false; // Immediately update ref so cleanup functions see the new value
      setRecorderState("idle");
      setRecording(null);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current as any);
        recordingTimerRef.current = null;
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {}
      // Informational only: don't instruct the user to close other apps.
      // Some device-level failures can occur; log for diagnostics and fail silently so the user isn't misdirected.
      console.warn('Could not start recording — check microphone permission and device audio state');
      return false;
    }
  }, [audioPlayback, hasShownPrivacyNote, isRecording, recorderState, stopRecording]);

  const cancelRecorded = useCallback(async () => {
    try {
      setRecordedUri(null);
      setRecordingDuration(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current as any);
        recordingTimerRef.current = null;
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {}
    } catch {}
  }, []);

  const playPauseAudio = async (uri: string) => {
    if (!uri) return;
    
    // Prevent starting another audio if one is currently loading
    if (audioLoading && loadingAudioUri && loadingAudioUri !== uri) {
      // Another audio is loading, ignore this request
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    
    try {
      // Haptic feedback for play/pause action
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      
      // Ensure audio routing matches proximity (best-effort).
      try {
        const routeToEarpiece = proxNear && Platform.OS === "ios";
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: routeToEarpiece,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: routeToEarpiece,
        });
      } catch (e) {
        // ignore if platform-specific options not supported
      }
      
      // If toggling the same uri that's currently playing
      if (playingUri === uri && audioPlayback) {
        try {
          const status = await audioPlayback.getStatusAsync();
          if ((status as any).isPlaying) {
            await audioPlayback.pauseAsync();
            setIsAudioPlaying(false);
            // Haptic for pause
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          } else {
            await audioPlayback.playAsync();
            setIsAudioPlaying(true);
            // Haptic for play
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        } catch (e) {
          // fallback: unload and restart
          await audioPlayback.unloadAsync().catch(() => {});
          setAudioPlayback(null);
          setPlayingUri(null);
        }
        return;
      }

      // Stop previous playback
      if (audioPlayback) {
        try {
          await audioPlayback.pauseAsync();
        } catch {}
        setAudioPlayback(null);
        setPlayingUri(null);
        setIsAudioPlaying(false);
      }

      // Check if audio is cached
      const cached = audioCacheRef.current.get(uri);
      if (cached) {
        // Use cached sound - instant playback!
        const { sound, durationMs } = cached;
        try {
          await sound.setPositionAsync(0); // Reset to start
          await sound.setRateAsync(playbackSpeed, true);
          // Set state BEFORE playing so UI shows playing state immediately
          setAudioPlayback(sound);
          setPlayingUri(uri);
          setPlayingDurationMs(durationMs);
          setPlayingPositionMs(0);
          setIsAudioPlaying(true);
          await sound.playAsync();
          return;
        } catch (e) {
          // Cache might be stale, remove and reload
          audioCacheRef.current.delete(uri);
        }
      }

      // Not cached - load fresh (show loading indicator)
      setAudioLoading(true);
      setLoadingAudioUri(uri);
      
      // Pre-set the playing state so UI shows playing immediately after load
      // This prevents the pause->play flicker when loading completes
      setPlayingUri(uri);
      setIsAudioPlaying(true);

      const { sound, status: initialStatus } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true }
      );
      
      const durationMs = (initialStatus as any).durationMillis || 0;
      
      // Cache the loaded sound for future instant replay
      audioCacheRef.current.set(uri, { sound, durationMs });
      
      setAudioPlayback(sound);
      setPlayingUri(uri);
      setIsAudioPlaying(true);
      if (durationMs) {
        setPlayingDurationMs(durationMs);
      }
      
      // attach status update to track position & duration
      sound.setOnPlaybackStatusUpdate((status: any) => {
        try {
          if (status.isLoaded) {
            setPlayingPositionMs(status.positionMillis ?? 0);
            if (status.durationMillis) {
              setPlayingDurationMs(status.durationMillis);
            }
            setIsAudioPlaying(!!status.isPlaying);
            if (status.didJustFinish) {
              // Don't unload - keep in cache, just reset state
              setPlayingUri(null);
              setIsAudioPlaying(false);
              setPlayingPositionMs(0);
              setAudioPlayback(null);
            }
          }
        } catch (e) {}
      });
    } catch (e) {
      Alert.alert("Playback Error", "Could not play audio.");
    } finally {
      setAudioLoading(false);
      setLoadingAudioUri(null);
    }
  };

  // Try to attach proximity sensor if available (optional dependency).
  useEffect(() => {
    let mounted = true;
    let proxModule: any = null;
    try {
      // try dynamic require of common proximity modules
      proxModule = require('react-native-proximity');
    } catch (e) {
      try {
        proxModule = require('expo-proximity');
      } catch (err) {
        proxModule = null;
      }
    }

    if (!proxModule || !mounted) return () => {};

    const handle = (data: any) => {
      // different libs emit different payloads
      const near = typeof data === 'object' ? !!data.proximity || !!data.near : !!data;
      setProxNear(near);
      // when proximity changes, update audio mode so future playback uses correct route
      (async () => {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: near,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: near,
          });
        } catch (e) {}
      })();
    };

    try {
      if (proxModule.addListener) {
        proxModule.addListener(handle);
      } else if (proxModule.addEventListener) {
        proxModule.addEventListener('proximity', handle);
      }
    } catch (e) {}

    return () => {
      mounted = false;
      try {
        if (proxModule && proxModule.removeListener) proxModule.removeListener(handle);
        if (proxModule && proxModule.removeEventListener) proxModule.removeEventListener('proximity', handle);
      } catch (e) {}
    };
  }, []);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; isVideo: boolean; picked?: boolean } | null>(null);
  // viewer playback refs / states used for picked preview flow
  const viewerVideoRef = useRef<any>(null);
  const [viewerIsPlaying, setViewerIsPlaying] = useState(false);
  const [viewerBuffering, setViewerBuffering] = useState(false);
  const [viewerAutoPlay, setViewerAutoPlay] = useState(true);
  const [viewerMuted, setViewerMuted] = useState(false);
  const [viewerShowControls, setViewerShowControls] = useState(true);
  const [viewerSaving, setViewerSaving] = useState(false);
  const viewerControlsTimeout = useRef<NodeJS.Timeout | null>(null);
  // spinner shown while preparing/copying selected media (eg Android content:// -> cache)
  const [mediaImporting, setMediaImporting] = useState(false);
  // pan/gesture state for modal viewer (swipe to dismiss)
  const viewerPanY = useRef(new Animated.Value(0)).current;
  const viewerTranslateY = viewerPanY;
  const viewerBgOpacity = viewerPanY.interpolate({ inputRange: [-300, 0, 300], outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });
  const viewerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        try {
          viewerPanY.setOffset((viewerPanY as any).__getValue ? (viewerPanY as any).__getValue() : 0);
        } catch {}
      },
      onPanResponderMove: (_, gs) => {
        try {
          viewerPanY.setValue(gs.dy);
        } catch {}
      },
      onPanResponderRelease: (_, gs) => {
        try {
          viewerPanY.flattenOffset?.();
        } catch {}
        const dy = gs.dy || 0;
        const vy = Math.abs(gs.vy || 0);
        // if dragged quickly or far enough, dismiss
        if (dy > 160 || vy > 1.2) {
          Animated.timing(viewerPanY, { toValue: SCREEN_H, duration: 200, useNativeDriver: true }).start(() => {
            try { viewerPanY.setValue(0); } catch {}
            setViewer(null);
          });
        } else {
          Animated.spring(viewerPanY, { toValue: 0, stiffness: 220, damping: 22, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  const [previewCaption, setPreviewCaption] = useState<string>("");
  const [viewerProgress, setViewerProgress] = useState<{ position: number; duration: number } | null>(null);
  const currentPreviewLocalRef = useRef<string | null>(null);
  const [fullMap, setFullMap] = useState<{ latitude: number; longitude: number; title?: string } | null>(null);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMessage, setSheetMessage] = useState<ChatMessage | null>(null);
  const [previewMessage, setPreviewMessage] = useState<ChatMessage | null>(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  // header popover for three-dots
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);

  // plus popover near input
  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const [plusSheetVisible, setPlusSheetVisible] = useState(false);
  const [sharePollsVisible, setSharePollsVisible] = useState(false);
  // Callouts (story selections) bottom sheet
  const [calloutsVisible, setCalloutsVisible] = useState(false);
  const [calloutsLoading, setCalloutsLoading] = useState(false);
  // bottom-sheet animated height for callouts (draggable)
  const CALLOUTS_MIN = DEFAULT_CALLOUTS_MIN; // increased default minimum to make the bottom sheet taller
  const CALLOUTS_MAX = DEFAULT_CALLOUTS_MAX; // bigger expanded sheet, constrained by screen size
  const calloutsHeight = useRef(new Animated.Value(CALLOUTS_MIN)).current;
  const calloutsPan = useRef<any>(null);
  const calloutsExpandedRef = useRef(false);
  const [calloutOptions, setCalloutOptions] = useState<any[]>([]);
  const [calloutSearch, setCalloutSearch] = useState<string>("");
  const [storyCallout, setStoryCallout] = useState<any | null>(null);
  const filteredCalloutOptions = useMemo(() => {
    const q = (calloutSearch || '').trim().toLowerCase();
    if (!q) return calloutOptions;
    return calloutOptions.filter((s) => (s.title || '').toLowerCase().includes(q) || (s.author_name || '').toLowerCase().includes(q));
  }, [calloutOptions, calloutSearch]);

  // pan responder for callouts sheet dragging
  useEffect(() => {
    calloutsPan.current = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        // stop any running animation
        try { calloutsHeight.stopAnimation?.(); } catch {}
      },
      onPanResponderMove: (_, g) => {
        const dy = g.dy || 0;
        const current = (calloutsHeight as any).__getValue ? (calloutsHeight as any).__getValue() : CALLOUTS_MIN;
        // dragging down reduces height, dragging up increases height
        const next = Math.max(CALLOUTS_MIN, Math.min(CALLOUTS_MAX, current - dy));
        calloutsHeight.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const vy = g.vy || 0;
        const current = (calloutsHeight as any).__getValue ? (calloutsHeight as any).__getValue() : CALLOUTS_MIN;
        // snap threshold
        const mid = (CALLOUTS_MIN + CALLOUTS_MAX) / 2;
        const target = current > mid || vy < -0.4 ? CALLOUTS_MAX : CALLOUTS_MIN;
        calloutsExpandedRef.current = target === CALLOUTS_MAX;
        Animated.timing(calloutsHeight, { toValue: target, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
      },
    });
  }, [calloutsHeight]);

  // When opening the callouts sheet, expand it to the max default height for better visibility
  useEffect(() => {
    try {
      const target = calloutsVisible ? CALLOUTS_MAX : CALLOUTS_MIN;
      Animated.timing(calloutsHeight, { toValue: target, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    } catch {}
  }, [calloutsVisible, calloutsHeight, CALLOUTS_MAX, CALLOUTS_MIN]);

  // Header loading gradient pulse animation - triggers when any loading state is active
  const isAnyLoading = loading || audioLoading || recorderState === 'uploading' || shotsLoading || calloutsLoading || mediaImporting;
  useEffect(() => {
    let loadingLoop: Animated.CompositeAnimation | null = null;
    
    if (isAnyLoading) {
      // Start the gradient pulse animation
      loadingLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(headerLoadingPulse, { 
            toValue: 1, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false 
          }),
          Animated.timing(headerLoadingPulse, { 
            toValue: 0, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false 
          }),
        ])
      );
      loadingLoop.start();
    } else {
      // Fade out when loading completes
      Animated.timing(headerLoadingPulse, { 
        toValue: 0, 
        duration: 300, 
        useNativeDriver: false 
      }).start();
    }
    
    return () => {
      loadingLoop?.stop();
    };
  }, [isAnyLoading, headerLoadingPulse]);

  // animation: flying/splash message
  const [flyingMessage, setFlyingMessage] = useState<ChatMessage | null>(null);
  const flyAnim = useRef(new Animated.Value(0)).current;

  /* AsyncStorage cache key */
  const CACHE_KEY = `chat_cache_${convoId}`;

  /* --------------------- message caching: load cached messages first --------------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!convoId) return;
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: ChatMessage[] = JSON.parse(raw);
          if (mounted) {
            setMessages(cached);
            setLoading(false);
          }
        } else {
          if (mounted) setLoading(true);
        }
      } catch (err) {
        if (mounted) setLoading(true);
      }
      if (mounted) {
        loadMessages().catch(() => {});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [convoId]);

  /* persist cache whenever 'messages' change (debounce small) */
  useEffect(() => {
    const t = setTimeout(() => {
      if (!convoId) return;
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(messages)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [messages, convoId, CACHE_KEY]);

  /* preload audio (optional) */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s1 = await Audio.Sound.createAsync(require("@/assets/sounds/send.mp3"));
        const s2 = await Audio.Sound.createAsync(require("@/assets/sounds/receive.mp3"));
        if (!mounted) {
          await s1.sound.unloadAsync().catch(() => {});
          await s2.sound.unloadAsync().catch(() => {});
          return;
        }
        sendSoundRef.current = s1.sound;
        receiveSoundRef.current = s2.sound;
      } catch (e) {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
      sendSoundRef.current?.unloadAsync().catch(() => {});
      receiveSoundRef.current?.unloadAsync().catch(() => {});
      sendSoundRef.current = null;
      receiveSoundRef.current = null;
    };
  }, []);

  /* load conversation meta */
  useEffect(() => {
    if (!convoId) return;
    const loadMeta = async () => {
      setLoading(true);
      const { data: convo, error: ce } = await supabase.from("conversations").select("id, is_group, title, avatar_url").eq("id", convoId).single();
      if (ce) {
        console.error(ce);
        Alert.alert("Error", "Conversation not found.");
        setLoading(false);
        return;
      }
      setConversation(convo as ConversationRow);
      const { data: parts, error: pe } = await supabase
        .from("conversation_participants")
        .select("user_id, accepted, profiles(id, full_name, avatar_url, username, bio, follower_count, is_online, last_seen)")
        .eq("conversation_id", convoId);
      if (pe) {
        setParticipants([]);
      } else {
        const list: (Profile & { accepted?: boolean; follower_count?: number; is_online?: boolean | null; last_seen?: string | null })[] = (parts || [])
          .map((r: any) =>
            r.profiles
              ? {
                  id: r.profiles.id,
                  full_name: r.profiles.full_name,
                  avatar_url: r.profiles.avatar_url,
                  username: r.profiles.username,
                  bio: r.profiles.bio,
                  follower_count: (r.profiles.follower_count as number) ?? 0,
                  is_online: r.profiles.is_online ?? null,
                  last_seen: r.profiles.last_seen ?? null,
                  // include acceptance state from conversation_participants
                  accepted: r.accepted === false ? false : true,
                }
              : null,
          )
          .filter(Boolean) as (Profile & { accepted?: boolean; follower_count?: number; is_online?: boolean | null; last_seen?: string | null })[];
        setParticipants(list);
      }
      setLoading(false);
    };
    loadMeta();
    // If participants haven't been loaded yet, proactively fetch the other participant
    // so we can show their avatar/name immediately when possible.
    (async () => {
      try {
        if (!profile?.id || !convoId) return;
        // If participants already have the other user, no need to prefetch.
        if (participants && participants.length > 0) return;
        const { data: partsQuick } = await supabase
          .from('conversation_participants')
          .select('user_id, profiles(id, full_name, avatar_url, username, bio, follower_count)')
          .eq('conversation_id', convoId)
          .not('user_id', 'eq', profile.id)
          .limit(1);
        const row = (partsQuick && partsQuick[0]) as any;
        if (row && row.profiles) {
          setPrefetchOther({
            id: row.profiles.id,
            full_name: row.profiles.full_name,
            avatar_url: row.profiles.avatar_url,
            username: row.profiles.username,
            bio: row.profiles.bio,
            follower_count: row.profiles.follower_count ?? 0,
          });
        }
      } catch {}
    })();
  }, [convoId]);

  useEffect(() => {
    if (!profile?.id || !convoId || otherParticipantIds.length === 0) {
      if (!otherParticipantIds.length) setConversationShots([]);
      return;
    }
    const channel = supabase
      .channel(`chat-shots:${convoId}:${profile.id}`)
      .on(
        "postgres_changes",
        { schema: "public", table: "story_shots", event: "INSERT", filter: `recipient_id=eq.${profile.id}` },
        (payload: any) => {
          const senderId = payload.new?.sender_id;
          if (senderId && otherParticipantIds.includes(senderId)) {
            fetchConversationShots({ silent: true });
          }
        }
      )
      .on(
        "postgres_changes",
        { schema: "public", table: "story_shots", event: "UPDATE", filter: `recipient_id=eq.${profile.id}` },
        (payload: any) => {
          const senderId = payload.new?.sender_id;
          if (senderId && otherParticipantIds.includes(senderId)) {
            fetchConversationShots({ silent: true });
          }
        }
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel?.(channel);
      } catch {}
    };
  }, [profile?.id, convoId, otherParticipantIds, fetchConversationShots]);

  /* load wallpaper + theme from user_settings (subscribe) */
  useEffect(() => {
    let sub: any;
    const run = async () => {
      if (!profile?.id) return;
      try {
        const { data } = await supabase.from("user_settings").select("chat_wallpaper_url, chat_theme").eq("user_id", profile.id).single();
        setWallpaperUrl((data as any)?.chat_wallpaper_url || null);
        setUserThemePref((data as any)?.chat_theme ?? null);
        sub = supabase
          .channel(`user_settings:${profile.id}`)
          .on(
            "postgres_changes",
            { schema: "public", table: "user_settings", event: "UPDATE", filter: `user_id=eq.${profile.id}` },
            (payload: any) => {
              const row = payload.new || {};
              setWallpaperUrl(row.chat_wallpaper_url || null);
              setUserThemePref(row.chat_theme ?? null);
            }
          )
          .subscribe();
      } catch (e) {
        /* ignore */
      }
    };
    run();
    return () => {
      if (sub)
        try {
          supabase.removeChannel?.(sub);
        } catch {}
    };
  }, [profile?.id]);

  /* Subscribe to other user's online status changes */
  useEffect(() => {
    if (isGroup || !otherUser?.id) return;
    
    const otherUserId = otherUser.id;
    const channel = supabase
      .channel(`profile_status:${otherUserId}`)
      .on(
        "postgres_changes",
        { schema: "public", table: "profiles", event: "UPDATE", filter: `id=eq.${otherUserId}` },
        (payload: any) => {
          const row = payload.new || {};
          // Update the participant's online status in state
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === otherUserId
                ? { ...p, is_online: row.is_online ?? p.is_online, last_seen: row.last_seen ?? p.last_seen }
                : p
            )
          );
        }
      )
      .subscribe();
    
    return () => {
      try {
        supabase.removeChannel?.(channel);
      } catch {}
    };
  }, [isGroup, otherUser?.id]);

  // -------------------- INVITE HANDLING --------------------
  // Detect pending invite system messages (json content with {sys:'invite', from, name, avatar})
  const [pendingInvite, setPendingInvite] = useState<ChatMessage | null>(null);

  /* Accept/abort handlers are defined after loadMessages to ensure loadMessages is available */

  useEffect(() => {
    // Show pending invite prompt based on the conversation_participants.accepted flag.
    // The conversation is created with creator accepted=true and recipient accepted=false.
    // This approach ensures invites are prompts only (not stored as messages) and
    // will show on the chat screen when the current user's participant row is still pending.
    try {
      if (!profile?.id) return setPendingInvite(null);
      if (!participants?.length) return setPendingInvite(null);

      const myPart = participants.find((p) => p.id === profile.id);
      // If I'm a participant and already accepted (or accepted is missing/true), nothing to show
      // Only show the prompt when accepted === false
      if (!myPart || myPart.accepted !== false) return setPendingInvite(null);

      // Find inviter (someone in participants who is not me)
      const inviter = participants.find((p) => p.id !== profile.id) || null;
      if (!inviter) return setPendingInvite(null);

      // Build a lightweight synthetic invite message shape so the existing modal UI can render uniformly
      const synthetic: ChatMessage = {
        id: `invite:${convoId}`,
        conversation_id: convoId,
        sender_id: inviter.id,
        content: JSON.stringify({ sys: 'invite', from: inviter.id, name: inviter.full_name || '', avatar: inviter.avatar_url || '' }),
        created_at: new Date().toISOString(),
      };
      setPendingInvite(synthetic);
    } catch (e) {
      setPendingInvite(null);
    }
  }, [participants, profile?.id, convoId]);

  /* -------------------- server messages & enrichment -------------------- */
  const loadMessages = useCallback(async () => {
    if (!convoId) return;
    try {
      const { data: baseMsgs, error: me } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, media_url, media_type, story_id, latitude, longitude, created_at, reply_to_message_id")
        .eq("conversation_id", convoId)
        .order("created_at", { ascending: true });
      if (me) {
        console.error(me);
        setServerMessages([]);
        return;
      }
      const msgs = (baseMsgs || []) as ChatMessage[];
      const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
      const { data: senders } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds.length ? senderIds : ["00000000-0000-0000-0000-000000000000"]);
      const senderMap = new Map<string, Profile>();
      (senders || []).forEach((p) => senderMap.set((p as any).id, p as Profile));

      // fetch reads & readers
      const ids = msgs.map((m) => m.id);
      const { data: reads } = await supabase.from("message_reads").select("message_id, user_id").in("message_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const readerIds = Array.from(new Set((reads || []).map((r) => r.user_id)));
      const { data: readers } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", readerIds.length ? readerIds : ["00000000-0000-0000-0000-000000000000"]);
      const readerMap = new Map<string, Profile>();
      (readers || []).forEach((p) => readerMap.set((p as any).id, p as Profile));
      const readsByMsg = new Map<string, Profile[]>();
      (reads || []).forEach((r: any) => {
        const arr = readsByMsg.get(r.message_id) || [];
        const prof = readerMap.get(r.user_id);
        if (prof) arr.push(prof);
        readsByMsg.set(r.message_id, arr);
      });

      // reply mapping
      const contentMap = new Map<string, ChatMessage>();
      msgs.forEach((m) => contentMap.set(m.id, m));
      // Fetch any story metadata referenced by messages (support both story_id and callout_story_id)
      const storyIds = Array.from(new Set(msgs.map((m: any) => m.story_id || m.callout_story_id).filter(Boolean)));
      let storyMap = new Map<string, any>();
      if (storyIds.length) {
        try {
          const { data: stories } = await supabase
            .from('stories')
            .select('id, caption, cover_url, media_url, created_at, user_id, profiles(full_name)')
            .in('id', storyIds);
          (stories || []).forEach((s: any) => {
            storyMap.set(String(s.id), {
              id: String(s.id),
              title: s.caption ?? 'Untitled',
              cover_url: s.cover_url ?? s.media_url ?? null,
              author_name: s.profiles?.full_name ?? null,
              created_at: s.created_at ?? null,
            });
          });
        } catch (e) {
          /* ignore story enrichment failures */
        }
      }

      const enriched = msgs.map((m) => {
        const replied = m.reply_to_message_id ? contentMap.get(m.reply_to_message_id) : null;
        return {
          ...m,
          sender: senderMap.get(m.sender_id ?? "") || null,
          readers: readsByMsg.get(m.id) || [],
          replied_to: replied ? { id: replied.id, content: replied.content, sender_name: senderMap.get(replied.sender_id ?? "")?.full_name } : null,
          // support both story_id and callout_story_id on message rows
          story: (m.story_id || m.callout_story_id) ? storyMap.get(String(m.story_id ?? m.callout_story_id)) ?? null : null,
        };
      });
      setServerMessages(enriched);
    } catch (e) {
      console.error("loadMessages err", e);
      setServerMessages([]);
    }
  }, [convoId]);

  /* merge server + optimistic messages */
  useEffect(() => {
    const serverById = new Map(serverMessages.map((m) => [m.id, m]));
    const stillOptimistic = optimisticMessages.filter((om) => !serverById.has(om.id || ""));
    // filter out system messages (invites / invite_accepted / invite_aborted) so they do not appear
    // inline with chat messages — invites are shown via the invite prompt only.
    const isSystemMsg = (m: ChatMessage | undefined | null) => {
      if (!m || !m.content) return false;
      try {
        const parsed = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
        if (parsed && typeof parsed === 'object' && parsed.sys) {
          const s = String(parsed.sys);
          return s === 'invite' || s === 'invite_accepted' || s === 'invite_aborted';
        }
      } catch {}
      return false;
    };

    const merged = [...serverMessages.filter((m) => !isSystemMsg(m)), ...stillOptimistic].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    if (initialLoadRef.current) {
      animatedMessagesRef.current = new Set(merged.map((m) => m.id));
    }
    setMessages(merged);
  }, [serverMessages, optimisticMessages]);

  // We avoid automatic scrolling here — initial layout should place newest message at the bottom
  // by rendering the list inverted with reversed data. This prevents unexpected programmatic
  // jumps while keeping the latest message visible on open.

  /* -------------------- realtime: subscribe for updates & typing -------------------- */
  useEffect(() => {
    if (!convoId) return;
    (async () => {
      await loadMessages();
      initialLoadRef.current = false;
      const ch = supabase
        .channel(`chat:${convoId}`, { config: { broadcast: { self: false } } })
        .on(
          "postgres_changes",
          { schema: "public", table: "messages", event: "INSERT", filter: `conversation_id=eq.${convoId}` },
          async (payload: any) => {
            try {
              const m = payload.new as { sender_id: string };
              if (m?.sender_id && m.sender_id !== profile?.id) {
                if (!initialLoadRef.current && receiveSoundRef.current) {
                  try {
                    await receiveSoundRef.current.replayAsync();
                  } catch {}
                }
              }
            } catch {}
            loadMessages();
          }
        )
        .on("postgres_changes", { schema: "public", table: "messages", event: "UPDATE", filter: `conversation_id=eq.${convoId}` }, () => loadMessages())
        .on("postgres_changes", { schema: "public", table: "message_reads", event: "INSERT" }, () => loadMessages())
        .on("broadcast", { event: "typing" }, (payload: any) => {
          const { userId, fullName, isTyping } = payload.payload || {};
          if (!userId || userId === profile?.id) return;
          setTypingUsers((prev) => {
            const next = { ...prev };
            if (isTyping) next[userId] = fullName || "Someone";
            else delete next[userId];
            return next;
          });
        })
        .subscribe();
      channelRef.current = ch;
    })();
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (channelRef.current)
        try {
          supabase.removeChannel?.(channelRef.current);
        } catch {}
      channelRef.current = null;
    };
  }, [convoId, profile?.id, loadMessages]);

  /* mark visible as read (server) */
  useEffect(() => {
    const run = async () => {
      if (!profile?.id || messages.length === 0) return;
      const unseen = messages.filter((m) => !m.pending && m.sender_id !== profile.id && !(m.readers || []).some((r) => r.id === profile.id));
      if (unseen.length === 0) return;
      const rows = unseen.map((m) => ({ message_id: m.id, user_id: profile.id }));
      await supabase.from("message_reads").upsert(rows, { onConflict: "message_id,user_id", ignoreDuplicates: true });
    };
    run();
  }, [messages, profile?.id]);

  /* typing broadcast */
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current) return;
      channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: profile?.id, fullName: profile?.full_name, isTyping } });
    },
    [profile?.id, profile?.full_name]
  );

  // onInputFocus is defined later with proper typing; avoid duplicate

  const onChangeText = (val: string) => {
    setText(val);
    if (!profile?.id) return;
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1200);
  };

  /* ------------------ helpers: sheet, jump, edit, delete ------------------ */
  const jumpToMessage = useCallback(
    (mid: string) => {
      try {
        // find index within the visible (reversed) data set
        const idx = visibleMessages.findIndex((m) => m.id === mid);
        if (idx >= 0) {
          // try to position a little above the target for context
          const to = Math.max(0, idx - 1);
          listRef.current?.scrollToIndex({ index: to, animated: true, viewPosition: 0.2 } as any);
          setHighlightedMessageId(mid);
          setTimeout(() => setHighlightedMessageId(null), 1400);
        }
      } catch (e) {
        scrollLastMessageIntoView(true, true);
      }
    },
    [messages, scrollLastMessageIntoView]
  );

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setSheetMessage(null);
    setPreviewMessage(null);
  }, []);

  const handleEdit = useCallback(() => {
    if (!sheetMessage) return;
    setEditingId(sheetMessage.id);
    setText(sheetMessage.content || "");
    closeSheet();
  }, [sheetMessage, closeSheet]);

  const handleDelete = useCallback(() => {
    if (!sheetMessage) return;
    Alert.alert("Delete message", "Delete this message? This cannot be undone.", [
      { text: "Cancel", style: "cancel" as const },
      {
        text: "Delete",
        style: "destructive" as const,
        onPress: async () => {
          try {
            const msgId = sheetMessage.id;
            const mediaUrl = sheetMessage.media_url;
            const localMediaUri = sheetMessage.local_media_uri;
            
            // Delete from database
            const { error } = await supabase.from("messages").delete().eq("id", msgId);
            if (error) {
              Alert.alert("Error", "Could not delete message.");
              return;
            }
            
            // Remove from local state (both server and optimistic)
            setServerMessages((prev) => prev.filter((m) => m.id !== msgId));
            setOptimisticMessages((prev) => prev.filter((m) => m.id !== msgId && m.local_id !== msgId));
            
            // Clean up audio cache if this was an audio message
            if (mediaUrl && audioCacheRef.current.has(mediaUrl)) {
              const cached = audioCacheRef.current.get(mediaUrl);
              if (cached) {
                try { await cached.sound.unloadAsync(); } catch {}
              }
              audioCacheRef.current.delete(mediaUrl);
            }
            
            // Stop playback if this message's audio was playing
            if (playingUri === mediaUrl) {
              if (audioPlayback) {
                try { await audioPlayback.stopAsync(); } catch {}
              }
              setAudioPlayback(null);
              setPlayingUri(null);
              setIsAudioPlaying(false);
              setPlayingPositionMs(0);
            }
            
            // Delete local file if exists
            if (localMediaUri && FileSystem) {
              try {
                const info = await FileSystem.getInfoAsync(localMediaUri);
                if (info.exists) {
                  await FileSystem.deleteAsync(localMediaUri, { idempotent: true });
                }
              } catch {}
            }
            
            // Try to delete from Cloudinary (best effort - won't fail if it doesn't work)
            if (mediaUrl && mediaUrl.includes('cloudinary.com')) {
              try {
                // Extract public_id from Cloudinary URL
                // URL format: https://res.cloudinary.com/{cloud}/video/upload/v{version}/{public_id}.m4a
                const match = mediaUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
                if (match && match[1]) {
                  const publicId = match[1];
                  // Note: Cloudinary delete requires server-side API with signature
                  // For now, we just remove locally. Full Cloudinary deletion would need a backend endpoint.
                  console.log('[chat] Would delete from Cloudinary:', publicId);
                }
              } catch {}
            }
            
            setSheetMessage(null);
            setSheetVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch (e) {
            Alert.alert("Error", "Could not delete message.");
          }
        },
      },
    ]);
  }, [sheetMessage, playingUri, audioPlayback]);

  /* ---------------------------- optimistic helpers ---------------------------- */
  const createOptimistic = useCallback((data: Partial<ChatMessage>) => {
    const local_id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
  const msg = {
      id: local_id,
      local_id,
      conversation_id: convoId!,
      sender_id: profile!.id,
      content: data.content || "",
      media_url: data.media_url ?? null,
      local_media_uri: (data as any).local_media_uri ?? null,
      media_type: data.media_type ?? undefined,
      created_at: nowIso,
      reply_to_message_id: data.reply_to_message_id || null,
  sender: { id: profile!.id, full_name: profile!.full_name, avatar_url: (profile?.avatar_url ?? "") as string },
      readers: [],
      replied_to: (data as any).replied_to || null,
      pending: true,
      error: false,
  } as ChatMessage;
    setOptimisticMessages((prev) => [...prev, msg]);
    // intentionally NOT auto-scrolling here so the user stays where they were
    setShowScrollButton(false);
    isNearBottomRef.current = true;
    return msg;
  }, [convoId, profile?.id, profile?.full_name, scrollLastMessageIntoView]);

  const patchOptimistic = useCallback((local_id: string, patch: Partial<ChatMessage>) => {
    setOptimisticMessages((prev) => prev.map((m) => (m.local_id === local_id ? { ...m, ...patch } : m)));
  }, []);
  const dropOptimistic = useCallback((local_id: string) => setOptimisticMessages((prev) => prev.filter((m) => m.local_id !== local_id)), []);
  const confirmOptimisticWithServerId = useCallback((local_id: string, realId: string) => patchOptimistic(local_id, { id: realId, pending: false }), [patchOptimistic]);

  const MAX_VOICE_RETRY_ATTEMPTS = 3;
  const scheduleVoiceRetry = useCallback(
    (localId: string, payload: VoiceRetryPayload) => {
      const prevAttempt = voiceRetryQueueRef.current[localId]?.attempt || 0;
      const attempt = prevAttempt + 1;
      // Stop retrying after max attempts to prevent infinite loop
      if (attempt > MAX_VOICE_RETRY_ATTEMPTS) {
        console.warn(`[voice] Max retry attempts (${MAX_VOICE_RETRY_ATTEMPTS}) exceeded for ${localId}`);
        delete voiceRetryQueueRef.current[localId];
        if (voiceRetryTimersRef.current[localId]) {
          clearTimeout(voiceRetryTimersRef.current[localId]!);
          voiceRetryTimersRef.current[localId] = null;
        }
        patchOptimistic(localId, { pending: false, error: true });
        return;
      }
      voiceRetryQueueRef.current[localId] = { ...payload, attempt };
      const delay = Math.min(15000, Math.pow(2, attempt - 1) * 1000);
      if (voiceRetryTimersRef.current[localId]) {
        clearTimeout(voiceRetryTimersRef.current[localId]!);
      }
      voiceRetryTimersRef.current[localId] = setTimeout(() => {
        voiceRetryTimersRef.current[localId] = null;
        const entry = voiceRetryQueueRef.current[localId];
        if (!entry) return;
        patchOptimistic(localId, { pending: true, error: false });
        if (uploadAndSendVoiceRef.current) {
          uploadAndSendVoiceRef.current(entry.uri, entry.waveform, entry.durationMs, {
            reuseLocalId: localId,
            skipCreate: true,
            replyToId: entry.replyToId || null,
            repliedTo: entry.repliedTo || null,
          });
        }
      }, delay) as any;
    },
    [patchOptimistic]
  );

  /* send message (optimistic) */
  const sendScale = useRef(new Animated.Value(1)).current;
  const sendColorAnim = useRef(new Animated.Value(0)).current;
  // reply preview pan animation
  const replyTranslate = useRef(new Animated.Value(0)).current;
  const replyPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderGrant: () => {
        replyTranslate.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        // allow horizontal drag only
        replyTranslate.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        const threshold = 80;
        const abs = Math.abs(g.dx || 0);
        if (abs > threshold) {
          // haptic and dismiss
          Haptics.selectionAsync().catch(() => {});
          Animated.timing(replyTranslate, { toValue: g.dx > 0 ? SCREEN_W : -SCREEN_W, duration: 180, useNativeDriver: false }).start(() => {
            setReplyTo(null);
            replyTranslate.setValue(0);
          });
        } else {
          Animated.spring(replyTranslate, { toValue: 0, stiffness: 200, damping: 18, useNativeDriver: false }).start();
        }
      },
    })
  ).current;
  const animateSend = () => {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(sendColorAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
        Animated.spring(sendScale, { toValue: 1, stiffness: 220, damping: 12, mass: 0.6, useNativeDriver: false }),
      ]),
      Animated.timing(sendColorAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  const sendMessage = useCallback(
    async (overrideContent?: string) => {
      const content = (overrideContent ?? text).trim();
      // Prevent sending if the current participant hasn't accepted the invite yet
      try {
        const myParticipant = participants.find((p: any) => p.id === profile?.id);
        if (myParticipant && myParticipant.accepted === false) {
          Alert.alert("Invite pending", "You must accept the invite before you can send messages in this conversation.");
          return;
        }
      } catch (e) {}
      if ((!content && !replyTo && !storyCallout) || !profile?.id || !convoId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      animateSend();

      // if a story callout is selected, capture it and clear the UI immediately
      const chosenCallout = storyCallout;
      const isCallout = !!chosenCallout;
      const local = createOptimistic({
        // For callouts we want a media-only message (no caption/text) so leave content empty
        content: isCallout ? '' : content,
        media_type: isCallout ? 'callout' : undefined,
        media_url: isCallout ? chosenCallout?.cover_url ?? chosenCallout?.media_url ?? null : undefined,
        // attach story metadata locally for optimistic rendering
        story: isCallout ? { id: chosenCallout?.id, title: chosenCallout?.title, cover_url: chosenCallout?.cover_url ?? chosenCallout?.media_url ?? null, author_name: chosenCallout?.author_name } : undefined,
        reply_to_message_id: replyTo?.id || null,
        replied_to: replyTo ? { id: replyTo.id, content: replyTo.content, sender_name: replyTo.sender?.full_name } : null,
      });
      setText("");
      setReplyTo(null);

      // Start flying animation (input -> chat)
      setFlyingMessage(local);
      flyAnim.setValue(0);
      Animated.timing(flyAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }).start(async () => {
        // play send sound once at animation end (prefer UX that matches animation)
        try {
          if (sendSoundRef.current) {
            await sendSoundRef.current.replayAsync().catch(() => {});
            sendSoundPlayedRef.current = true;
          }
        } catch {}
        // clear flying visuals
        setTimeout(() => setFlyingMessage(null), 60);
      });

      // clear the composer preview right away (optimistic)
      if (isCallout) setStoryCallout(null);

      try {
        const insertObj: any = { conversation_id: convoId, sender_id: profile.id, content, reply_to_message_id: local.reply_to_message_id };
        if (isCallout && chosenCallout) {
          // attach callout metadata so it can be rendered as a shared story
          // NOTE: messages.media_type has a DB check constraint that forbids custom values like 'callout'.
          // Use a supported media_type (image|video) inferred from the URL so the insert succeeds.
          const calloutUrl = chosenCallout.cover_url ?? chosenCallout.media_url ?? null;
          insertObj.media_url = calloutUrl;
          if (calloutUrl && isVideoUrl(calloutUrl)) insertObj.media_type = 'video';
          else if (calloutUrl) insertObj.media_type = 'image';
          // ensure content is empty (no caption) so it renders as media-only
          insertObj.content = "";
          // use story_id on messages table (messages historically use story_id for story references)
          insertObj.story_id = chosenCallout.id;
        }
        // debug: log payload so we can inspect server-side failures
        try {
          console.debug('messages.insert payload:', insertObj);
          const { data: inserted, error } = await supabase.from("messages").insert(insertObj).select("id, latitude, longitude, media_url").single();
          if (error || !inserted?.id) throw error || new Error("No id");
          console.log('Inserted message:', inserted);
          confirmOptimisticWithServerId(local.local_id!, inserted.id);
          await supabase.from("message_reads").upsert([{ message_id: inserted.id, user_id: profile.id }], { onConflict: "message_id,user_id", ignoreDuplicates: true });
        } catch (serverErr) {
          console.error('Failed to insert message:', serverErr, 'payload:', insertObj);
          // Surface to the user for debugging during development — hide details in production
          try {
            const msg = (serverErr && (serverErr as any).message) || JSON.stringify(serverErr);
            Alert.alert('Send failed', msg);
          } catch {}
          throw serverErr;
        }

        // Only play server send sound if animation didn't already play it
        try {
          if (sendSoundRef.current && !sendSoundPlayedRef.current) {
            await sendSoundRef.current.replayAsync().catch(() => {});
          }
        } catch {}
        sendSoundPlayedRef.current = false;

        // intentionally NOT auto-scrolling here so the user stays where they were
        sendTyping(false);
      } catch (e) {
        console.error('sendMessage error final catch', e);
        patchOptimistic(local.local_id!, { pending: false, error: true });
      }
    },
    [createOptimistic, confirmOptimisticWithServerId, convoId, patchOptimistic, profile?.id, sendTyping, text, replyTo, storyCallout, flyAnim, scrollLastMessageIntoView]
  );

  /* -------------------------- Cloudinary upload helpers -------------------------- */
  const inferMime = (uri: string) => {
    const l = uri.split(".").pop()?.toLowerCase() ?? "";
    // Images
    if (["jpg", "jpeg"].includes(l)) return "image/jpeg";
    if (l === "png") return "image/png";
    if (l === "gif") return "image/gif";
    if (l === "webp") return "image/webp";
    // Video
    if (["mp4", "m4v"].includes(l)) return "video/mp4";
    if (l === "mov") return "video/quicktime";
    if (l === "webm") return "video/webm";
    // Audio (important for voice recordings)
    if (["m4a", "aac"].includes(l)) return "audio/mp4";
    if (l === "mp3") return "audio/mpeg";
    if (l === "wav") return "audio/wav";
    if (l === "caf") return "audio/x-caf";
    if (l === "ogg") return "audio/ogg";
    if (l === "flac") return "audio/flac";
    return "application/octet-stream";
  };

  const uploadToCloudinaryAuto = async (uri: string, preset = CLOUDINARY_UPLOAD_PRESET) => {
    if (!CLOUDINARY_CLOUD_NAME || !preset) {
      Alert.alert("Cloudinary not configured", "Set CLOUDINARY_CLOUD_NAME & upload preset.");
      throw new Error("Cloudinary not configured");
    }
    const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const form = new FormData();
    const filename = uri.split("/").pop() ?? `upload`;
    const mime = inferMime(filename);
    // @ts-ignore
    form.append("file", { uri, name: filename, type: mime });
    form.append("upload_preset", preset);
    const res = await fetch(apiUrl, { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
    return json.secure_url as string;
  };

  // XHR-based upload with progress callback (used for chat upload UX)
  // stores the last active xhr so we can cancel during preview uploads
  const lastUploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadToCloudinaryWithProgress = (uri: string, preset = CLOUDINARY_UPLOAD_PRESET, onProgress?: (pct: number) => void) => {
    return new Promise<string>((resolve, reject) => {
      try {
        if (!CLOUDINARY_CLOUD_NAME || !preset) return reject(new Error('Cloudinary not configured'));
        const xhr = new XMLHttpRequest();
        const filename = uri.split('/').pop() ?? `upload`;
        const mime = inferMime(filename);
        // Use 'video' resource type for audio files (Cloudinary treats audio as video)
        // Use 'auto' for everything else
        const isAudio = mime.startsWith('audio/');
        const resourceType = isAudio ? 'video' : 'auto';
        const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
        xhr.open('POST', apiUrl);
        xhr.timeout = 60000; // 60 second timeout
        const form = new FormData();
        console.debug('[upload] preparing', { uri, filename, mime, preset, apiUrl, resourceType });
        // @ts-ignore
        form.append('file', { uri, name: filename, type: mime });
        form.append('upload_preset', preset);

        // attach progress and remember xhr for cancellation
        lastUploadXhrRef.current = xhr;
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const pct = Math.round((ev.loaded / ev.total) * 100);
          try { if (onProgress) onProgress(pct); } catch {}
        };
        xhr.onerror = (e) => {
          console.warn('[upload] xhr.onerror', e);
          reject(new Error('Network error during upload'));
        };
        xhr.ontimeout = () => {
          console.warn('[upload] xhr.ontimeout');
          reject(new Error('Upload timed out'));
        };
        xhr.onreadystatechange = () => {
          if (xhr.readyState !== 4) return;
          console.debug('[upload] response', { status: xhr.status, response: xhr.responseText?.slice(0, 200) });
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const parsed = JSON.parse(xhr.responseText);
              resolve(parsed.secure_url ?? parsed.url);
            } else if (xhr.status === 0) {
              // Status 0 usually means network failure or CORS issue
              reject(new Error('Network error - check connectivity'));
            } else {
              const parsed = (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
              const errMsg = parsed?.error?.message || `Upload failed (HTTP ${xhr.status})`;
              reject(new Error(errMsg));
            }
          } catch (err) { reject(err); }
        };
        xhr.send(form);
      } catch (err) { reject(err); }
    });
  };

  const cancelPreviewUpload = () => {
    try {
      if (lastUploadXhrRef.current) {
        try { lastUploadXhrRef.current.abort(); } catch {}
        lastUploadXhrRef.current = null;
      }
    } catch (e) {}
  };

  /* -------------------- Media viewer helpers: save & share -------------------- */
  const saveMediaToDevice = useCallback(async (url: string) => {
    if (!url) return;
    setViewerSaving(true);
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant media library access to save files.');
        return;
      }
      
      // Download to cache first
      const filename = url.split('/').pop()?.split('?')[0] || `media_${Date.now()}`;
      const localPath = `${FileSystem.cacheDirectory}${filename}`;
      console.debug('[viewer] downloading media for save', { url, localPath });
      
      const downloadResult = await FileSystem.downloadAsync(url, localPath);
      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }
      
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      console.debug('[viewer] saved to media library', { id: asset.id });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Saved', 'Media saved to your device.');
    } catch (err) {
      console.warn('[viewer] save error', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Save failed', 'Could not save media to device.');
    } finally {
      setViewerSaving(false);
    }
  }, []);

  const shareMedia = useCallback(async (url: string) => {
    if (!url) return;
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available', 'Sharing is not available on this device.');
        return;
      }
      
      // Download to cache first
      const filename = url.split('/').pop()?.split('?')[0] || `media_${Date.now()}`;
      const localPath = `${FileSystem.cacheDirectory}share_${filename}`;
      console.debug('[viewer] downloading media for share', { url, localPath });
      
      const downloadResult = await FileSystem.downloadAsync(url, localPath);
      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }
      
      await Sharing.shareAsync(downloadResult.uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err) {
      console.warn('[viewer] share error', err);
      Alert.alert('Share failed', 'Could not share media.');
    }
  }, []);

  const toggleViewerControls = useCallback(() => {
    setViewerShowControls((prev) => {
      const next = !prev;
      // Auto-hide controls after 3 seconds when showing
      if (next) {
        if (viewerControlsTimeout.current) clearTimeout(viewerControlsTimeout.current);
        viewerControlsTimeout.current = setTimeout(() => {
          setViewerShowControls(false);
        }, 4000);
      }
      return next;
    });
    Haptics.selectionAsync().catch(() => {});
  }, []);

  /* -------------------- pick & upload media (images & video) -------------------- */
  const [mediaImporterVisible, setMediaImporterVisible] = useState(false);

  const pickAndUploadMedia = useCallback(async () => {
    console.debug('[chat] pickAndUploadMedia invoked (via custom importer)');
    // Show our in-app MediaImporter instead of the system picker to avoid
    // platform picker gesture issues and to use our richer gallery UI.
    setMediaImporterVisible(true);
  }, []);

  const handleMediaImporterSelect = useCallback(async (asset: any) => {
    try {
      // prefer localUri if available (more likely to be a usable file:// path)
      let uri = (asset && (asset.localUri || asset.uri)) as string | undefined | null;
      console.debug('[chat] media selected from importer', { id: asset?.id, mediaType: asset?.mediaType, mime: asset?.mimeType, uri });
      if (!uri) return setMediaImporterVisible(false);

      // Detect video using explicit asset metadata where possible
      const isVideoExplicit = !!(asset?.mediaType === 'video' || (asset?.mimeType && String(asset.mimeType).startsWith('video')));

      // If the uri has no extension (eg. content:// URIs on Android) rely on the explicit flag
      const maybeVideo = isVideoExplicit || isVideoUrl(uri);

      // Handle platform-specific URI issues
      if (Platform.OS === 'android') {
        // If we have an Android content:// URI, try to copy it to cache to produce a file:// path
        // This improves compatibility for expo-av Video and upload code which expect file-like URIs.
        if (String(uri).startsWith('content://')) {
          try {
            // show 'preparing' spinner while we copy a content:// to a file:// cache path
            setMediaImporting(true);
            const ext = maybeVideo 
              ? ((asset?.mimeType || '').split('/').pop() || 'mp4')
              : ((asset?.mimeType || '').split('/').pop() || 'jpg');
            const dest = `${FileSystem.cacheDirectory}velt_media_${Date.now()}.${ext}`;
            console.debug('[chat] copying content:// media to cache', { src: uri, dest, isVideo: maybeVideo });
            await FileSystem.copyAsync({ from: uri, to: dest });
            // Verify the file exists and has content
            const fileInfo = await FileSystem.getInfoAsync(dest);
            if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 0) {
              uri = dest;
              console.debug('[chat] media copied successfully, size:', fileInfo.size);
            } else {
              console.warn('[chat] copied file is empty or missing, using original URI');
            }
          } catch (copyErr) {
            console.warn('[chat] failed to copy content:// media to cache, will continue with original uri', copyErr);
          } finally {
            setMediaImporting(false);
          }
        }
      } else if (Platform.OS === 'ios') {
        // On iOS, ph:// URIs from the photo library might need special handling
        // localUri from MediaLibrary.getAssetInfoAsync should already be a file:// path
        if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
          console.warn('[chat] iOS received ph:// or assets-library:// URI, localUri should have been used instead');
          // The MediaImporter component should have already converted this via getAssetInfoAsync
          // If we still got here, the file might not be accessible directly
        }
        // Ensure file:// prefix for bare paths
        if (uri.startsWith('/') && !uri.startsWith('file://')) {
          uri = `file://${uri}`;
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setMediaImporterVisible(false);
      setViewer({ url: uri, isVideo: maybeVideo, picked: true } as any);
    } catch (e) {
      console.warn('media importer select err', e);
      setMediaImporterVisible(false);
      Alert.alert('Error', 'Unable to pick media. Please try again.');
    }
  }, []);

  /* -------------------- pick & upload any file (documents) -------------------- */
  const pickAndUploadFile = useCallback(async () => {
    console.debug('[chat] pickAndUploadFile invoked');
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      // New DocumentPicker API returns { canceled, assets } or { type: 'cancel' } for older versions
      // Handle both old and new API formats
      const isCanceled = (res as any).canceled === true || (res as any).type === 'cancel';
      if (isCanceled) return;
      
      // Get the asset from the new API format or fall back to old format
      const asset = (res as any).assets?.[0] || res;
      const uri = asset?.uri;
      const name = asset?.name || (uri ? uri.split("/").pop() : null) || "file";
      const mimeType = asset?.mimeType || 'application/octet-stream';
      
      if (!uri) {
        Alert.alert('Error', 'Could not get file path.');
        return;
      }
      
      console.debug('[chat] file picked', { uri, name, mimeType });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const local = createOptimistic({
        content: name,
        local_media_uri: uri,
        media_type: 'file',
        reply_to_message_id: replyTo?.id || null,
        replied_to: replyTo ? { id: replyTo.id, content: replyTo.content, sender_name: replyTo.sender?.full_name } : null,
      });

      let uploadedUrl = "";
      try {
        uploadedUrl = await uploadToCloudinaryAuto(uri);
      } catch (e) {
        patchOptimistic(local.local_id!, { pending: false, error: true });
        return;
      }

      try {
        const insertObj: any = { conversation_id: convoId, sender_id: profile!.id, content: name, media_url: uploadedUrl, media_type: 'file', reply_to_message_id: local.reply_to_message_id || null };
        const { data: inserted, error } = await supabase.from("messages").insert(insertObj).select("id, latitude, longitude, media_url").single();
        if (error || !inserted?.id) throw error || new Error("No id");
        console.log('Inserted file message:', inserted);
        confirmOptimisticWithServerId(local.local_id!, inserted.id);
      } catch (e) {
        patchOptimistic(local.local_id!, { pending: false, error: true, media_url: uploadedUrl });
      }
    } catch (e) {
      Alert.alert("Upload failed", "Could not upload file.");
    }
  }, [createOptimistic, confirmOptimisticWithServerId, patchOptimistic, profile?.id, replyTo]);

    // state for in-chat preview uploads
    const [previewUploading, setPreviewUploading] = useState(false);
    const [previewUploadProgress, setPreviewUploadProgress] = useState<number | null>(null);
    const [audioUploadProgress, setAudioUploadProgress] = useState<number | null>(null);
    const [previewUploadError, setPreviewUploadError] = useState<string | null>(null);

  const loadCalloutOptions = useCallback(async () => {
    if (!profile?.id) return;
    setCalloutsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('id, caption, media_url, cover_url, created_at, profiles(full_name)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) {
        console.warn('loadCalloutOptions err', error);
        setCalloutsLoading(false);
        return;
      }
      const normalized = (data ?? []).map((story: any) => ({
        id: String(story.id),
        title: story.caption ?? 'Untitled',
        cover_url: story.cover_url ?? story.media_url ?? null,
        author_name: story.profiles?.full_name ?? profile.full_name ?? 'You',
        created_at: story.created_at ?? null,
      }));
      setCalloutOptions(normalized);
    } catch (e) {
      console.warn('loadCalloutOptions err', e);
    } finally {
      setCalloutsLoading(false);
    }
  }, [profile?.id, profile?.full_name]);

  // Upload recorded audio using initiate/upload/complete flow
  const uploadAndSendVoice = useCallback(
    async (
      uri: string | null,
      waveform: number[],
      durationMs: number,
      opts?: { reuseLocalId?: string; skipCreate?: boolean; replyToId?: string | null; repliedTo?: ChatMessage["replied_to"] | null }
    ) => {
      if (!uri || !profile?.id || !convoId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setAudioLoading(true);
      setRecorderState("uploading");
      const replyMeta = {
        reply_to_message_id: opts?.replyToId ?? replyTo?.id ?? null,
        replied_to: opts?.repliedTo ?? (replyTo ? { id: replyTo.id, content: replyTo.content, sender_name: replyTo.sender?.full_name } : null),
      };
      let localId = opts?.reuseLocalId;
      if (!localId || !opts?.skipCreate) {
        const local = createOptimistic({
          content: "Voice message",
          local_media_uri: uri,
          media_type: "video",
          reply_to_message_id: replyMeta.reply_to_message_id,
          replied_to: replyMeta.replied_to,
        });
        localId = local.local_id!;
      } else {
        patchOptimistic(localId, {
          pending: true,
          error: false,
          local_media_uri: uri,
          reply_to_message_id: replyMeta.reply_to_message_id,
          replied_to: replyMeta.replied_to,
        });
      }
      const payload: VoiceRetryPayload = {
        uri,
        waveform,
        durationMs: Math.max(500, durationMs),
        replyToId: replyMeta.reply_to_message_id,
        repliedTo: replyMeta.replied_to || null,
      };
      voiceMetaRef.current[localId] = payload;
      setReplyTo(null);
      setRecordedUri(null);
      setWaveformSamples([]);
      const size = await fileSizeAsync(uri);
      console.debug('[voice] starting upload', { uri, size, preset: CLOUDINARY_UPLOAD_PRESET, cloud: CLOUDINARY_CLOUD_NAME });
      try {
        // Upload directly to Cloudinary using the same preset as other chat uploads
        // (use CLOUDINARY_UPLOAD_PRESET which defaults to 'chatsuploads')
        let uploadedUrl: string | null = null;
        try {
            // mark uploading id so cancel can refer to this optimistic local
            uploadingAudioLocalRef.current = localId || null;
            uploadedUrl = await uploadToCloudinaryWithProgress(uri, CLOUDINARY_UPLOAD_PRESET, (pct) => {
              try { setAudioUploadProgress?.(pct as any); } catch {}
            });
            console.debug('[voice] upload success', { uploadedUrl });
        } catch (upErr: any) {
          console.warn('[voice] cloudinary upload failed', upErr?.message || upErr);
          throw upErr;
        }

        if (!uploadedUrl) throw new Error('Upload failed');

        const insertObj: any = {
          conversation_id: convoId,
          sender_id: profile.id,
          content: localId ? 'Voice message' : 'Voice message',
          media_url: uploadedUrl,
          media_type: 'video',
          reply_to_message_id: (opts?.replyToId ?? replyTo?.id) || null,
        };

        const { data: inserted, error } = await supabase.from('messages').insert(insertObj).select('id').single();
        if (error || !inserted?.id) throw error || new Error('No id');
        confirmOptimisticWithServerId(localId, inserted.id);
        delete voiceRetryQueueRef.current[localId];
        if (voiceRetryTimersRef.current[localId]) {
          clearTimeout(voiceRetryTimersRef.current[localId]!);
          voiceRetryTimersRef.current[localId] = null;
        }
        if (sendSoundRef.current) await sendSoundRef.current.replayAsync().catch(() => {});
        // intentionally NOT auto-scrolling here so the user stays where they were
      } catch (err: any) {
        console.warn("voice upload failed", err);
        patchOptimistic(localId, { pending: false, error: true });
        // Don't retry on database constraint errors - they will never succeed
        const isDbError = err?.code?.startsWith?.('2') || err?.message?.includes?.('constraint') || err?.message?.includes?.('violates');
        if (!isDbError) {
          scheduleVoiceRetry(localId, payload);
        } else {
          console.warn('[voice] Database constraint error - not scheduling retry');
          // Clean up retry queue for this localId
          delete voiceRetryQueueRef.current[localId];
          if (voiceRetryTimersRef.current[localId]) {
            clearTimeout(voiceRetryTimersRef.current[localId]!);
            voiceRetryTimersRef.current[localId] = null;
          }
        }
      } finally {
        setAudioLoading(false);
        setRecorderState("idle");
        try { setAudioUploadProgress(null); } catch {}
        // clear uploading id
        uploadingAudioLocalRef.current = null;
      }
    },
    [completeVoiceUpload, confirmOptimisticWithServerId, convoId, createOptimistic, fileSizeAsync, initiateVoiceUpload, patchOptimistic, profile?.id, replyTo, scheduleVoiceRetry, scrollLastMessageIntoView, uploadVoiceData]
  );

  useEffect(() => {
    uploadAndSendVoiceRef.current = uploadAndSendVoice;
    return () => {
      uploadAndSendVoiceRef.current = null;
    };
  }, [uploadAndSendVoice]);

  // Resend a failed audio message (re-upload + insert). Keeps optimistic UX.
  // Fixed: reuse the existing localId instead of creating duplicates on retry
  const resendAudioMessage = useCallback(
    async (item: ChatMessage) => {
      if (!item || (!item.local_media_uri && !item.media_url)) {
        // fallback to text retry
        try {
          setText(item?.content || "");
          dropOptimistic(item?.local_id || "");
          sendMessage(item?.content || "");
        } catch (e) {}
        return;
      }

      const localUri = item.local_media_uri || item.media_url!;
      const existingLocalId = item.local_id;
      
      // Check retry count BEFORE doing anything - prevent infinite retries
      const currentCount = existingLocalId ? (resendCounts[existingLocalId] || 0) : 0;
      if (currentCount >= 3) {
        console.warn('[voice] Manual resend max attempts reached');
        if (existingLocalId) {
          patchOptimistic(existingLocalId, { pending: false, error: true });
          setResendingIds((p) => ({ ...(p || {}), [existingLocalId]: false }));
        }
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setAudioLoading(true);

      // Reuse existing optimistic entry instead of creating a new one
      const localId = existingLocalId || createOptimistic({
        content: item.content || "Voice message",
        local_media_uri: localUri,
        media_type: "video",
        reply_to_message_id: item.reply_to_message_id || null,
        replied_to: item.replied_to || null,
      }).local_id!;

      // Update existing entry to show pending state
      patchOptimistic(localId, { pending: true, error: false });

      // mark as resending
      setResendCounts((p) => ({ ...(p || {}), [localId]: currentCount + 1 }));
      setResendingIds((p) => ({ ...(p || {}), [localId]: true }));

      try {
        const uploadedUrl = await uploadToCloudinaryAuto(localUri, CLOUDINARY_UPLOAD_PRESET);
        const insertObj: any = {
          conversation_id: convoId ?? "",
          sender_id: profile!.id,
          content: item.content || "Voice message",
          media_url: uploadedUrl,
          media_type: "video",
          reply_to_message_id: item.reply_to_message_id,
        };
        const { data: inserted, error } = await supabase.from("messages").insert(insertObj).select("id, latitude, longitude, media_url").single();
        if (error || !inserted?.id) throw error || new Error("No id");
        confirmOptimisticWithServerId(localId, inserted.id);
        // clear resending flag
        setResendingIds((p) => ({ ...(p || {}), [localId]: false }));
        setResendCounts((p) => { const c = { ...p }; delete c[localId]; return c; });
        if (sendSoundRef.current) await sendSoundRef.current.replayAsync().catch(() => {});
      } catch (e: any) {
        console.warn('[voice] resendAudioMessage failed', e);
        // Don't retry on database constraint errors - they will never succeed
        const isDbError = e?.code?.startsWith?.('2') || e?.message?.includes?.('constraint') || e?.message?.includes?.('violates');
        if (isDbError) {
          console.warn('[voice] Database error - not retrying');
          patchOptimistic(localId, { pending: false, error: true });
          setResendingIds((p) => ({ ...(p || {}), [localId]: false }));
          return;
        }
        // Only auto-retry network errors, and only if under limit
        const newCount = currentCount + 1;
        if (newCount < 3) {
          const delay = 1000 * Math.pow(2, newCount);
          setTimeout(() => {
            // Pass the updated item with existing localId to avoid duplicates
            resendAudioMessage({ ...item, local_id: localId }).catch(() => {});
          }, delay);
        } else {
          patchOptimistic(localId, { pending: false, error: true });
          setResendingIds((p) => ({ ...(p || {}), [localId]: false }));
        }
      } finally {
        setAudioLoading(false);
      }
    },
    [createOptimistic, dropOptimistic, uploadToCloudinaryAuto, convoId, profile?.id, confirmOptimisticWithServerId, patchOptimistic, resendCounts]
  );

    // Resend generic media (images, video, files)
    const resendMediaMessage = useCallback(
      async (item: ChatMessage) => {
        if (!item || (!item.local_media_uri && !item.media_url)) {
          // fallback
          setText(item?.content || "");
          dropOptimistic(item?.local_id || "");
          sendMessage(item?.content || "");
          return;
        }
        const localUri = item.local_media_uri || item.media_url!;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setAudioLoading(true);

        const local = createOptimistic({
          content: item.content || (item.media_type ? `[${item.media_type}]` : "Attachment"),
          local_media_uri: localUri,
          media_type: item.media_type || "file",
          reply_to_message_id: item.reply_to_message_id || null,
          replied_to: item.replied_to || null,
        });

        // mark resending
        if (local.local_id) {
          setResendCounts((p) => ({ ...(p || {}), [local.local_id!]: ((p || {})[local.local_id!] || 0) + 1 }));
          setResendingIds((p) => ({ ...(p || {}), [local.local_id!]: true }));
        }

        try {
          if (item.local_id) dropOptimistic(item.local_id);
        } catch (e) {}

        try {
          // use default preset for images/files (uploadToCloudinaryAuto uses CLOUDINARY_UPLOAD_PRESET)
          const uploadedUrl = await uploadToCloudinaryAuto(localUri);
          const insertObj: any = {
            conversation_id: convoId ?? "",
            sender_id: profile!.id,
            content: local.content || "",
            media_url: uploadedUrl,
            media_type: item.media_type || "file",
            reply_to_message_id: local.reply_to_message_id,
          };
          const { data: inserted, error } = await supabase.from("messages").insert(insertObj).select("id, latitude, longitude, media_url").single();
          if (error || !inserted?.id) throw error || new Error("No id");
          confirmOptimisticWithServerId(local.local_id!, inserted.id);
          // clear resending flag for this local
          if (local.local_id) setResendingIds((p) => ({ ...(p || {}), [local.local_id!]: false }));
          if (sendSoundRef.current) await sendSoundRef.current.replayAsync().catch(() => {});
          // intentionally NOT auto-scrolling here so the user stays where they were
        } catch (e) {
          const count = local.local_id ? (resendCounts[local.local_id] || 0) : 0;
          if ((local.local_id && count < 3)) {
            const next = (count || 0) + 1;
            setResendCounts((p) => ({ ...(p || {}), [local.local_id!]: next }));
            const delay = 1000 * Math.pow(2, next - 1);
            setTimeout(() => {
              resendMediaMessage(item).catch(() => {});
            }, delay);
          } else {
            patchOptimistic(local.local_id!, { pending: false, error: true });
            if (local.local_id) setResendingIds((p) => ({ ...(p || {}), [local.local_id!]: false }));
          }
        } finally {
          setAudioLoading(false);
        }
      },
      [createOptimistic, dropOptimistic, uploadToCloudinaryAuto, convoId, profile?.id, confirmOptimisticWithServerId, patchOptimistic, scrollLastMessageIntoView]
    );

  /* ----- reaction helper ----- */
  const handleReact = useCallback(
    async (emoji: string, message: ChatMessage | null) => {
      if (!message || !profile?.id) return;
      Haptics.selectionAsync().catch(() => {});
      try {
        await supabase.from("message_reactions").upsert({ message_id: message.id, user_id: profile.id, reaction: emoji }, { onConflict: "message_id,user_id" });
      } catch {}
      const mutateReactions = (arr: ChatMessage[]) =>
        arr.map((m) => {
          if (m.id !== message.id) return m;
          const copy = { ...m } as ChatMessage;
          copy.reactions = { ...(copy.reactions || {}) };
          copy.reactions[emoji] = Array.from(new Set([...(copy.reactions[emoji] || []), profile.id]));
          return copy;
        });
      setServerMessages((prev) => mutateReactions(prev));
      setOptimisticMessages((prev) => mutateReactions(prev));
      setEmojiPickerVisible(false);
      setSheetVisible(false);
    },
    [profile?.id]
  );

  /* -------------------- message bubble (memoized) -------------------- */
  const _MessageBubble: React.FC<{ 
    item: ChatMessage; 
    index?: number; 
    highlightedId?: string | null; 
    repliesCount?: number;
    // Audio playback props for re-rendering
    audioPlayingUri?: string | null;
    audioIsPlaying?: boolean;
    audioPositionMs?: number;
    audioDurationMs?: number;
    audioLoadingUri?: string | null;
    audioSpeed?: number;
  }> = React.memo(
    function _MessageBubble({ 
      item, 
      index, 
      highlightedId, 
      repliesCount = 0,
      audioPlayingUri,
      audioIsPlaying,
      audioPositionMs,
      audioDurationMs,
      audioLoadingUri,
      audioSpeed,
    }: { 
      item: ChatMessage; 
      index?: number; 
      highlightedId?: string | null; 
      repliesCount?: number;
      audioPlayingUri?: string | null;
      audioIsPlaying?: boolean;
      audioPositionMs?: number;
      audioDurationMs?: number;
      audioLoadingUri?: string | null;
      audioSpeed?: number;
    }) {
      const mine = item.sender_id === profile?.id;
      const showName = isGroup && !mine;

      // grouping: determine whether this message is the first/last in a consecutive group
      const prevMsg = typeof index === "number" ? messages[index - 1] : undefined;
      const nextMsg = typeof index === "number" ? messages[index + 1] : undefined;
      const withinWindow = (a?: ChatMessage, b?: ChatMessage) => {
        if (!a || !b) return false;
        try {
          return Math.abs(new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()) < 1000 * 60 * 5; // 5min
        } catch {
          return false;
        }
      };
      const sameSenderPrev = prevMsg && prevMsg.sender_id === item.sender_id && withinWindow(prevMsg, item);
      const sameSenderNext = nextMsg && nextMsg.sender_id === item.sender_id && withinWindow(item, nextMsg);
      const isFirstInGroup = !sameSenderPrev;
      const isLastInGroup = !sameSenderNext;
      const readersExcludingMe = (item.readers || []).filter((r: Partial<Profile>) => r.id !== profile?.id);

      // drag/interact animations (stable refs so they are not recreated on every render)
      const dragX = useRef(new Animated.Value(0)).current;
      // subtle scale while swiping for a premium feel
      const dragScale = useRef(new Animated.Value(1)).current;
      const triggeredHapticRef = useRef(false);
      const lastTapRef = useRef<number>(0);

      const onBubblePress = () => {
        const now = Date.now();
        if (now - lastTapRef.current < 240) {
          Haptics.selectionAsync().catch(() => {});
          setReplyTo(item);
        }
        lastTapRef.current = now;
      };

      const responderRef = useRef(
        PanResponder.create({
          // only consider horizontal swipes (we'll accept left swipe only)
          onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
          onPanResponderGrant: () => {
            triggeredHapticRef.current = false;
          },
          onPanResponderMove: (_, g) => {
            const dx = typeof g.dx === 'number' ? g.dx : 0;
            // allow swiping based on bubble side: right-side messages (mine) accept right-swipe, others accept left-swipe
            const allowRight = mine;
            const allowLeft = !mine;
            let next = 0;
            if (dx < 0 && allowLeft) {
              // allow a bit more range for smoother feel
              next = Math.max(dx, -120);
            } else if (dx > 0 && allowRight) {
              next = Math.min(dx, 120);
            } else {
              next = 0;
            }
            dragX.setValue(next);
            // subtle scaling while dragging
            const s = 1 - Math.min(0.03, Math.abs(next) / 2000);
            dragScale.setValue(s);
            if (Math.abs(next) > 18 && !triggeredHapticRef.current) {
              triggeredHapticRef.current = true;
              Haptics.selectionAsync().catch(() => {});
            }
          },
            onPanResponderRelease: (_, g) => {
            const dx = typeof g.dx === 'number' ? g.dx : 0;
              const vx = typeof g.vx === 'number' ? g.vx : 0;
            const threshold = 28; // gentler threshold for easier reply
              // also consider fast flicks (velocity) or if we've reached the clamp
              const currentDrag = (dragX as any)?.__getValue ? (dragX as any).__getValue() : dx;
              const atClamp = Math.abs(currentDrag) >= 110; // near our clamp of 120
              const distanceTrigger = (dx < -threshold && !mine) || (dx > threshold && mine);
              const velocityTrigger = (Math.abs(vx) > 0.5);
              const shouldReply = distanceTrigger || velocityTrigger || atClamp;
            if (shouldReply) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const flyTarget = mine ? SCREEN_W * 0.12 : -SCREEN_W * 0.12;
              Animated.parallel([
                Animated.timing(dragX, { toValue: flyTarget, duration: 160, easing: Easing.out(Easing.exp), useNativeDriver: true }),
                Animated.timing(dragScale, { toValue: 0.985, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              ]).start(() => {
                // ensure we always return to our original location
                setReplyTo(item);
                Animated.parallel([
                  Animated.spring(dragX, { toValue: 0, useNativeDriver: true, stiffness: 260, damping: 22 }),
                  Animated.spring(dragScale, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 18 }),
                ]).start(() => {
                  try { dragX.setValue(0); } catch {};
                  try { dragScale.setValue(1); } catch {};
                });
              });
            } else {
              Animated.parallel([
                Animated.spring(dragX, { toValue: 0, useNativeDriver: true, stiffness: 260, damping: 22, mass: 0.9 }),
                Animated.spring(dragScale, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 18 }),
              ]).start();
              // defensively set values in case animation didn't complete
              setTimeout(() => {
                try { dragX.setValue(0); } catch {};
                try { dragScale.setValue(1); } catch {};
              }, 260);
            }
          },
          onPanResponderTerminate: (_, g) => {
            // mirror release behavior so cancelled gestures still snap back
            const dx = typeof g.dx === 'number' ? g.dx : 0;
            const vx = typeof g.vx === 'number' ? g.vx : 0;
            const currentDrag = (dragX as any)?.__getValue ? (dragX as any).__getValue() : dx;
            const atClamp = Math.abs(currentDrag) >= 110;
            const threshold = 28;
            const distanceTrigger = (dx < -threshold && !mine) || (dx > threshold && mine);
            const velocityTrigger = (Math.abs(vx) > 0.5);
            const shouldReplyT = distanceTrigger || velocityTrigger || atClamp;
            if (shouldReplyT) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const flyTarget = mine ? SCREEN_W * 0.12 : -SCREEN_W * 0.12;
              Animated.parallel([
                Animated.timing(dragX, { toValue: flyTarget, duration: 160, easing: Easing.out(Easing.exp), useNativeDriver: true }),
                Animated.timing(dragScale, { toValue: 0.985, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              ]).start(() => {
                setReplyTo(item);
                Animated.parallel([
                  Animated.spring(dragX, { toValue: 0, useNativeDriver: true, stiffness: 260, damping: 22 }),
                  Animated.spring(dragScale, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 18 }),
                ]).start(() => {
                  try { dragX.setValue(0); } catch {};
                  try { dragScale.setValue(1); } catch {};
                });
              });
            } else {
              Animated.parallel([
                Animated.spring(dragX, { toValue: 0, useNativeDriver: true, stiffness: 260, damping: 22, mass: 0.9 }),
                Animated.spring(dragScale, { toValue: 1, useNativeDriver: true, stiffness: 220, damping: 18 }),
              ]).start();
              setTimeout(() => {
                try { dragX.setValue(0); } catch {};
                try { dragScale.setValue(1); } catch {};
              }, 260);
            }
          },
        })
      ).current;

      // arrow opacity (show when dragging left) and bubble shift derived from dragX
      // Arrow visibility & bubble shift adapt based on bubble side (mine vs other)
      const arrowOpacity = dragX.interpolate({ inputRange: mine ? [0, 18, 44, 80] : [-80, -44, -12, 0], outputRange: mine ? [0, 0.25, 1, 1] : [1, 1, 0.25, 0], extrapolate: "clamp" });
      const arrowShift = dragX.interpolate({ inputRange: mine ? [0, 80] : [-80, 0], outputRange: mine ? [8, 36] : [-36, -8], extrapolate: 'clamp' });
      const arrowScale = dragX.interpolate({ inputRange: mine ? [0, 18, 44, 80] : [-80, -44, -12, 0], outputRange: mine ? [0.8, 0.96, 1.02, 1.02] : [1.02, 1.02, 0.96, 0.8], extrapolate: 'clamp' });
      const bubbleShift = dragX.interpolate({ inputRange: mine ? [0, 80] : [-80, 0], outputRange: mine ? [0, 22] : [-22, 0], extrapolate: "clamp" });
      // combinedScale will be defined after bubbleScale is created

      const pending = !!item.pending;
      // helper: determine if this message has media and whether it is media-only
      const hasAnyMedia = !!item.media_url || !!item.local_media_uri || !!item.media_type || !!item.story;
      const isMediaOnly = hasAnyMedia && !(item.content && String(item.content).trim().length > 0);

      // Compute bubble background and readable text color so bubbles respect theme
      const bubbleBg = mine ? themeColors.accent : themeColors.card;
      const messageTextColor = mine ? readableTextColor(bubbleBg) : THEME.text;
      const mediaBorderColor = themeIsLight ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)";
      const mediaFill = themeIsLight ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.35)";
      const bubbleScale = useRef(new Animated.Value(animatedMessagesRef.current.has(item.id) ? 1 : 0.9)).current;
      // combine the per-message entrance scale with the drag scale for live swipes
      const combinedScale = Animated.multiply(bubbleScale, dragScale);
      const bubbleOpacity = useMemo(() => bubbleScale.interpolate({ inputRange: [0.9, 1], outputRange: [0.6, 1], extrapolate: "clamp" }), [bubbleScale]);

      useEffect(() => {
        if (!animatedMessagesRef.current.has(item.id)) {
          animatedMessagesRef.current.add(item.id);
          Animated.spring(bubbleScale, {
            toValue: 1,
            damping: 12,
            stiffness: 220,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        } else {
          bubbleScale.setValue(1);
        }
      }, [item.id, bubbleScale]);

      function openViewer(url: string | null | undefined): void {
        if (!url) return;
        // Open both images & videos inline in the in-chat viewer modal.
        // Avoid routing away to the external Contents page when tapping media
        // so media is previewed consistently inside the chat UI.
        try {
          const isVideo = !!isVideoUrl(url);
          console.debug('[chat] opening inline viewer', { url, isVideo });
          setViewer({ url, isVideo });
        } catch (e) {
          // defensive fallback to plain string viewer for unexpected cases
          setViewer({ url, isVideo: isVideoUrl(url) });
        }
      }

      // Render reactions as small chips above bubble
      const reactions = Object.keys(item.reactions || {});

        // helper: parse coords from media_url if present (supports coords=, ll=, q=)
        const parseCoordsFromUrl = (u?: string | null) => {
          if (!u) return null;
          try {
            const url = u;
            const coordsMatch = url.match(/[?&]coords=([-0-9.]+),([-0-9.]+)/);
            if (coordsMatch) return { lat: Number(coordsMatch[1]), lng: Number(coordsMatch[2]) };
            const llMatch = url.match(/[?&]ll=([-0-9.]+),([-0-9.]+)/);
            if (llMatch) return { lat: Number(llMatch[1]), lng: Number(llMatch[2]) };
            const qMatch = url.match(/[?&]q=([-0-9.]+),([-0-9.]+)/);
            if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
            return null;
          } catch {
            return null;
          }
        };

        const parsed = parseCoordsFromUrl(item.media_url || null);
        const previewLat = Number(item.latitude) || (parsed ? parsed.lat : 0);
        const previewLng = Number(item.longitude) || (parsed ? parsed.lng : 0);

      // adjust spacing so grouped messages are visually connected (tighter)
      const outerMargin = isFirstInGroup ? 4 : 1;

      // corner shaping for grouped bubbles
      const R = 18;
      const rSmall = 8;
      const bubbleCornerStyle: any = {};
      if (isFirstInGroup && isLastInGroup) {
        bubbleCornerStyle.borderRadius = R;
      } else if (isFirstInGroup && !isLastInGroup) {
        bubbleCornerStyle.borderTopLeftRadius = R;
        bubbleCornerStyle.borderTopRightRadius = R;
        bubbleCornerStyle.borderBottomLeftRadius = R;
        bubbleCornerStyle.borderBottomRightRadius = rSmall;
      } else if (!isFirstInGroup && !isLastInGroup) {
        bubbleCornerStyle.borderRadius = rSmall;
      } else if (!isFirstInGroup && isLastInGroup) {
        bubbleCornerStyle.borderTopLeftRadius = rSmall;
        bubbleCornerStyle.borderTopRightRadius = rSmall;
        bubbleCornerStyle.borderBottomLeftRadius = R;
        bubbleCornerStyle.borderBottomRightRadius = R;
      }

      const renderMedia = () => {
        if (item.media_type === 'callout' || item.story) {
          // Render callouts as media-only story-card (no bubble borders) so they match stories on the home page
          const story = (item.story ?? null) as any;
          const cover = story?.cover_url || item.media_url || item.local_media_uri || null;
          const title = story?.title || item.content || '';
          const author = story?.author_name || item.sender?.full_name || 'You';
          const cardW = Math.min(420, SCREEN_W * 0.66);
          const cardH = Math.round(cardW * 0.62);
          return (
            <View style={{ marginTop: 12 }}>
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}>
                <Pressable
                  onPress={() => {
                    try {
                      // route to the story preview (same as conversation index)
                      if (item.story?.id) router.push({ pathname: '/story/preview', params: { storyId: item.story.id } });
                      else if (item.story_id || item.callout_story_id) router.push({ pathname: '/story/preview', params: { storyId: item.story_id ?? item.callout_story_id } });
                    } catch {
                      /* ignore */
                    }
                  }}
                  style={[styles.mediaOnlyPressable]}
                >
                  <View style={[styles.storyMessageCard, { width: cardW, height: cardH }] }>
                    {cover ? (
                      <ImageBackground source={{ uri: cover }} style={styles.storyMessageImage} imageStyle={{ borderRadius: 12 }}>
                        <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]} style={{ ...StyleSheet.absoluteFillObject, borderRadius: 12 }} />
                        <View style={styles.storyMessageMeta}>
                          <Text numberOfLines={2} style={[styles.calloutTitle, { color: '#fff' }]}>{title}</Text>
                          <Text numberOfLines={1} style={[styles.calloutAuthor, { color: 'rgba(255,255,255,0.85)' }]}>{author}</Text>
                        </View>
                      </ImageBackground>
                    ) : (
                      <View style={[styles.storyMessageImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1724' }]}>
                        <Ionicons name="image-outline" size={36} color={ui.subtext} />
                      </View>
                    )}
                  </View>
                </Pressable>
              </View>
            </View>
          );
        }
        // Detect audio by media_type OR by URL extension (for messages stored as 'video' in DB)
        const mediaUrl = item.media_url || item.local_media_uri;
        const isAudioMessage = item.media_type === "audio" || isAudioUrl(mediaUrl);
        if (isAudioMessage && mediaUrl) {
          const audioUri = mediaUrl as string;
          const isThisAudio = audioPlayingUri === audioUri;
          const isPlayingThis = isThisAudio && audioIsPlaying;
          const isLoadingThis = audioLoadingUri === audioUri;
          const totalMs = isThisAudio && (audioDurationMs || 0) > 0 ? audioDurationMs! : 0;
          const progress = totalMs > 0 ? Math.min(1, (audioPositionMs || 0) / totalMs) : 0;
          const currentSpeed = isThisAudio ? (audioSpeed || 1) : 1;
          const accent = themeColors.accent || '#0b93f6';
          
          // WhatsApp/Snapchat style slim voice note bubble
          const bubbleBg = mine ? accent : (themeIsLight ? '#e8f5e9' : '#1a2e1a');
          const textColor = mine ? '#fff' : (themeIsLight ? '#1b5e20' : '#81c784');
          const waveActiveColor = mine ? 'rgba(255,255,255,0.95)' : (themeIsLight ? '#43a047' : '#66bb6a');
          const waveInactiveColor = mine ? 'rgba(255,255,255,0.35)' : (themeIsLight ? 'rgba(27,94,32,0.25)' : 'rgba(129,199,132,0.25)');
          
          // Cycle through speeds: 1 -> 1.5 -> 2 -> 1
          const toggleSpeed = async () => {
            // Add haptic feedback when changing speed
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            
            // Get the actual current speed from the passed prop, not closure
            const current = currentSpeed;
            const newSpeed = current === 1 ? 1.5 : current === 1.5 ? 2 : 1;
            setPlaybackSpeed(newSpeed);
            
            // Apply rate change to currently playing audio
            if (audioPlayback && isThisAudio) {
              try {
                await audioPlayback.setRateAsync(newSpeed, true);
                // Additional haptic on success
                Haptics.selectionAsync().catch(() => {});
              } catch (e) {
                console.warn('[chat] Failed to set playback rate:', e);
              }
            }
          };

          // Enhanced voice message bubble UI - modern, sleek design
          const playBtnBg = mine 
            ? 'rgba(255,255,255,0.28)' 
            : (themeIsLight ? 'linear-gradient(135deg, #43a047, #66bb6a)' : 'rgba(102,187,106,0.35)');
          const playBtnColor = '#fff';
          const speedBtnBg = mine 
            ? 'rgba(255,255,255,0.18)' 
            : (themeIsLight ? 'rgba(67,160,71,0.12)' : 'rgba(102,187,106,0.18)');

          return (
            <View style={{ 
              backgroundColor: bubbleBg,
              borderRadius: 24,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              width: SCREEN_W * 0.78,
              minWidth: 260,
              maxWidth: 340,
              // Subtle shadow for depth
              shadowColor: mine ? themeColors.accent : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: mine ? 0.15 : 0.08,
              shadowRadius: 6,
              elevation: 3,
            }}>
              {/* Play/Pause Button - Enhanced with gradient feel */}
              <Pressable 
                onPress={() => playPauseAudio(audioUri)} 
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: mine ? 'rgba(255,255,255,0.28)' : (themeIsLight ? '#43a047' : '#4caf50'),
                  justifyContent: 'center',
                  alignItems: 'center',
                  // Inner glow effect
                  shadowColor: playBtnColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isPlayingThis ? 0.4 : 0.2,
                  shadowRadius: isPlayingThis ? 8 : 4,
                }}
              >
                {/* Loading state shown via header gradient pulse - always show play/pause icon */}
                <Ionicons 
                  name={isLoadingThis ? 'hourglass-outline' : (isPlayingThis ? 'pause' : 'play')} 
                  size={22} 
                  color={playBtnColor} 
                  style={!isPlayingThis && !isLoadingThis ? { marginLeft: 2 } : {}} 
                />
              </Pressable>

              {/* Waveform with progress - Enhanced visualization */}
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 32, justifyContent: 'space-between' }}>
                  {Array.from({ length: 32 }).map((_, idx) => {
                    const waveProgress = idx / 32;
                    const isActive = isThisAudio && waveProgress <= progress;
                    // More natural waveform pattern
                    const heights = [6, 12, 8, 18, 10, 24, 14, 20, 8, 26, 12, 18, 8, 14, 22, 10, 20, 16, 8, 18, 26, 12, 20, 10, 18, 8, 14, 22, 10, 18, 8, 6];
                    const h = heights[idx % heights.length];
                    return (
                      <View
                        key={idx}
                        style={{
                          width: 3.5,
                          height: h,
                          borderRadius: 2,
                          backgroundColor: isActive ? waveActiveColor : waveInactiveColor,
                          // Subtle transition feel
                          transform: [{ scaleY: isPlayingThis && isActive ? 1.1 : 1 }],
                        }}
                      />
                    );
                  })}
                </View>
                {/* Time display below waveform - Enhanced layout */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 }}>
                  <Text style={{ 
                    fontSize: 12, 
                    color: textColor, 
                    opacity: 0.85, 
                    fontVariant: ['tabular-nums'],
                    fontWeight: '500',
                  }}>
                    {isThisAudio && (audioPositionMs || 0) > 0 ? formatTimeMs(audioPositionMs || 0) : '0:00'}
                  </Text>
                  <Text style={{ 
                    fontSize: 12, 
                    color: textColor, 
                    opacity: 0.65, 
                    fontVariant: ['tabular-nums'],
                    fontWeight: '400',
                  }}>
                    {totalMs > 0 ? formatTimeMs(totalMs) : item.pending ? '...' : '--:--'}
                  </Text>
                </View>
              </View>

              {/* Speed control button - Enhanced pill style */}
              <Pressable 
                onPress={toggleSpeed}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: speedBtnBg,
                  minWidth: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  // Border for better visibility
                  borderWidth: 1,
                  borderColor: mine ? 'rgba(255,255,255,0.15)' : (themeIsLight ? 'rgba(67,160,71,0.2)' : 'rgba(102,187,106,0.25)'),
                }}
              >
                <Text style={{ 
                  fontSize: 12, 
                  fontWeight: '700', 
                  color: textColor,
                  letterSpacing: 0.3,
                }}>
                  {`${currentSpeed}x`}
                </Text>
              </Pressable>
            </View>
          );
        }
        if (item.media_type === 'location') {
          return (
            <View style={{ marginTop: 12 }}>
              <Pressable
                onPress={() => setFullMap({ latitude: previewLat, longitude: previewLng, title: item.content || item.sender?.full_name })}
                style={{ width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 0.75, borderColor: mediaBorderColor, backgroundColor: mediaFill }}
              >
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{
                    latitude: previewLat || 0,
                    longitude: previewLng || 0,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker coordinate={{ latitude: previewLat || 0, longitude: previewLng || 0 }} />
                </MapView>
              </Pressable>
            </View>
          );
        }
        // fallback image/video/file render
        return (
          <View style={{ marginTop: 12 }}>
            {(() => {
              const sourceUri = item.media_url || item.local_media_uri || null;
              // nothing to render if there's no real media URL
              if (!sourceUri) return null;
              const isMediaOnly = !(item.content && String(item.content).trim().length > 0);
              const isVideo = isVideoUrl(sourceUri);
              // If this message contains only media (no text), render an iMessage-style compact card
              if (isMediaOnly) {
                const cardW = Math.min(360, SCREEN_W * 0.62);
                const cardH = Math.round(cardW * 0.6);
                return (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}>
                      <Pressable
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        onLongPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setPreviewMessage(item);
                          setSheetMessage(item);
                          setSheetVisible(true);
                        }}
                        onPress={() => openViewer(sourceUri)}
                        style={[styles.mediaOnlyPressable]}
                      >
                        <View style={[styles.mediaOnlyCard, { width: cardW, height: cardH }] }>
                          {isVideo ? (
                            <Video source={{ uri: sourceUri }} style={[styles.mediaOnlyImage]} useNativeControls={false} resizeMode={ResizeMode.COVER} shouldPlay={true} isLooping={true} isMuted />
                          ) : (
                            <Image source={{ uri: sourceUri }} style={[styles.mediaOnlyImage]} resizeMode="cover" />
                          )}
                        </View>
                      </Pressable>
                    </View>
                  </View>
                );
              }

              // When the message includes both text and media, render a compact inline media thumbnail
              const inlineW = Math.min(220, SCREEN_W * 0.45);
              const inlineH = Math.round(inlineW * 0.66);

              return (
                <Pressable
                  onLongPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setPreviewMessage(item);
                    setSheetMessage(item);
                    setSheetVisible(true);
                  }}
                  onPress={() => openViewer(sourceUri)}
                  style={styles.mediaBubblePressable}
                >
                  <LinearGradient
                    colors={mine ? [themeColors.accent, themeColors.accent] : themeIsLight ? ['#f2f6ff', '#dfe7ff'] : ['#131b2a', '#0f1623']}
                    start={[0, 0]}
                    end={[1, 1]}
                    style={[styles.mediaBubbleCard, { borderColor: 'transparent', borderWidth: 0 }]}
                  >
                    <View style={[styles.mediaBubbleInner, item.content ? { width: inlineW, height: inlineH } : undefined]}>
                      {isVideo ? (
                        <Video
                          source={{ uri: sourceUri }}
                          style={item.content ? { width: inlineW, height: inlineH } : styles.mediaBubbleVideo}
                          useNativeControls={false}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={true}
                          isLooping={true}
                          isMuted
                        />
                      ) : (
                        <Image
                          source={{ uri: sourceUri }}
                          style={item.content ? { width: inlineW, height: inlineH } : styles.mediaBubbleImage}
                          resizeMode="cover"
                        />
                      )}
                      <LinearGradient
                        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.45)']}
                        style={styles.mediaBubbleOverlay}
                      />
                      <View style={styles.mediaBubbleLabelRow}>
                        <Ionicons name={isVideo ? 'play-circle' : 'image'} size={22} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.mediaBubbleLabel}>{isVideo ? 'Tap to play video' : 'Tap to view photo'}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })()}
          </View>
        );
      };

      return (
        <View style={{ paddingHorizontal: 0, marginVertical: outerMargin }}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-end" }}>

              <View style={{ maxWidth: "92%" }}>
                <Animated.View {...responderRef.panHandlers} style={{ transform: [{ translateX: bubbleShift }] }}>
                  <Animated.View style={{ transform: [{ scale: combinedScale }], opacity: bubbleOpacity }}>
                  <Pressable
                    onLongPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSheetMessage(item);
                      setPreviewMessage(item);
                      setSheetVisible(true);
                    }}
                    delayLongPress={260}
                    onPress={onBubblePress}
                  >
                    <View style={{ position: "relative" }}>
                      {/* Reactions container (above bubble) */}
                      {reactions.length > 0 && (
                        <View style={{ position: "absolute", top: -18, right: 8, zIndex: 20 }}>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.06)" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              {reactions.map((r) => (
                                <View key={r} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: "transparent" }}>
                                  <Text style={{ fontSize: 16, color: messageTextColor }}>{r} {((item.reactions || {})[r] || []).length > 1 ? ` ${((item.reactions || {})[r] || []).length}` : ""}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Simplified bubble styled like chat bubbles (right-aligned) */}
                      {/* If this message is a reply, show the quoted original as a full-width block above the bubble
                          so it isn't constrained by the width of the reply text below. Render it OUTSIDE the horizontal row
                          so it occupies the full width and stacks vertically above the bubble. */}
                      {item.replied_to ? (
                        <Pressable
                          onPress={() => item.replied_to && jumpToMessage(item.replied_to.id)}
                          style={{ paddingHorizontal: 14, marginBottom: 8, width: '100%' }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)', padding: 8, borderRadius: 12 }}>
                            <View style={[styles.replyQuoteBar, { backgroundColor: mine ? styles.bubbleAccentMine.backgroundColor : styles.bubbleAccentOther.backgroundColor, height: 42, marginRight: 10 }]} />
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={[styles.replyQuotedSender, { color: ui.text }]}>{item.replied_to.sender_name || 'Reply'}</Text>
                              <Text style={[styles.replyQuotedText, { color: ui.subtext, flexWrap: 'wrap' }]}>{item.replied_to.content}</Text>
                            </View>
                          </View>
                        </Pressable>
                      ) : null}
                      <View style={{ flexDirection: mine ? 'row' : 'row-reverse', alignItems: 'flex-start', alignSelf: 'stretch' }}>
                        {!mine && <View style={{ width: 3, borderRadius: 3, alignSelf: 'stretch', backgroundColor: themeColors.accent }} />}

                        <View
                          style={[
                            mine ? styles.bubbleMineSimple : styles.bubbleOtherSimple,
                            // if this message is media-only we render a borderless container so the media appears independently
                            isMediaOnly ? { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 } : { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: bubbleBg },
                            bubbleCornerStyle,
                          ]}
                        >
                          {/* Sender label: show once per group */}
                          {isFirstInGroup && (
                            <View style={{ marginBottom: 4, alignItems: mine ? "flex-end" : "flex-start" }}>
                              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: mine ? SENDER_LABEL_COLOR : RECEIVER_LABEL_COLOR, backgroundColor: themeIsLight ? "#fff" : "#071016" }}>
                                <Text style={{ color: mine ? SENDER_LABEL_COLOR : RECEIVER_LABEL_COLOR, fontWeight: "800", fontSize: 12 }}>{mine ? "You" : item.sender?.full_name || "User"}</Text>
                              </View>
                            </View>
                          )}
                          {/* replied_to preview moved above the bubble so it can use the full message width */}

                          {!!item.content && (
                            <Text style={{ color: messageTextColor, fontSize: 18, lineHeight: 24 }}>{item.content}</Text>
                          )}

                          {/* Reply count badge inside bubble */}
                          {repliesCount > 0 && (
                            <Pressable onPress={() => setExpandedReplies((p) => ({ ...(p || {}), [item.id]: !(p || {})[item.id] }))} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: themeColors.accent, backgroundColor: 'transparent' }}>
                                <Text style={{ color: themeColors.accent, fontSize: 12, fontWeight: '700' }}>{repliesCount} repl{repliesCount>1?'ies':'y'}</Text>
                              </View>
                            </Pressable>
                          )}

                          {renderMedia()}
                        </View>

                        {mine && <View style={{ width: 3, borderRadius: 3, alignSelf: 'stretch', backgroundColor: themeColors.accent }} />}
                      </View>
                    </View>
                  </Pressable>

                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: "40%",
                      left: mine ? undefined : -56,
                      right: mine ? -56 : undefined,
                      opacity: arrowOpacity,
                      transform: [{ translateX: arrowShift }, { translateY: -10 }, { scale: arrowScale }],
                      zIndex: 20,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: themeColors.accent }}>
                      <Ionicons name="arrow-undo" size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={{ color: "#fff", fontWeight: "700" }}>Reply</Text>
                    </View>
                  </Animated.View>
                  </Animated.View>
                </Animated.View>

                {mine ? (
                  <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
                    {item.error ? (
                      // if this message is currently being resent, show progress
                      resendingIds[item.local_id!] ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="hourglass-outline" size={14} color={ui.subtext} />
                          <Text style={{ color: ui.subtext, marginLeft: 6, fontSize: 12 }}>{`Retrying (${resendCounts[item.local_id!] || 1})…`}</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Pressable
                            onPress={async () => {
                              Haptics.selectionAsync().catch(() => {});
                              try {
                                // If this failed message was an audio blob, attempt to re-upload and resend
                                const failedMediaUrl = item.local_media_uri || item.media_url;
                                const isFailedAudio = item.media_type === 'audio' || isAudioUrl(failedMediaUrl);
                                if (isFailedAudio && failedMediaUrl) {
                                  await resendAudioMessage(item);
                                  return;
                                }
                                // images / video / file
                                if ((item.media_type === 'image' || item.media_type === 'video' || item.media_type === 'file') && failedMediaUrl) {
                                  await resendMediaMessage(item);
                                  return;
                                }
                              } catch (e) {}
                              // Fallback: retry as plain message
                              setText(String(item.content || ""));
                              dropOptimistic(item.local_id!);
                              sendMessage(item.content);
                            }}
                            style={{ backgroundColor: '#FF4D4D', padding: 8, borderRadius: 999 }}
                          >
                            <Ionicons name="refresh" size={14} color="#fff" />
                          </Pressable>

                          <Text style={{ color: '#FF4D4D', marginLeft: 8, fontSize: 12, fontWeight: '700' }}>Failed to send</Text>

                          <Pressable
                            onPress={() => {
                              Haptics.selectionAsync().catch(() => {});
                              Alert.alert('Remove message', 'Remove this failed message from the chat?', [
                                { text: 'Cancel', style: 'cancel' as const },
                                {
                                  text: 'Remove',
                                  style: 'destructive' as const,
                                  onPress: () => {
                                    try {
                                      if (item.local_id) dropOptimistic(item.local_id);
                                    } catch {}
                                  },
                                },
                              ]);
                            }}
                            style={{ marginLeft: 10, padding: 6 }}
                          >
                            <Ionicons name="trash-outline" size={14} color={ui.subtext} />
                          </Pressable>
                        </View>
                      )
                    ) : item.pending ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons name="hourglass-outline" size={14} color={ui.subtext} />
                        <Text style={{ color: ui.subtext, marginLeft: 6, fontSize: 12 }}>Sending…</Text>
                      </View>
                    ) : isGroup ? (
                      (readersExcludingMe.length > 0 && <View style={{ flexDirection: "row" }}>{readersExcludingMe.slice(0, 6).map((r: Partial<Profile>) => <Image key={r.id} source={{ uri: r.avatar_url || AVATAR_FALLBACK }} style={styles.readTiny} />)}</View>) ||
                      null
                    ) : readersExcludingMe.length > 0 ? (
                      <Text style={{ color: ui.subtext, fontSize: 12 }}>Seen</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
      );
    },
    (a: any, b: any) =>
      a.item.id === b.item.id &&
      a.item.content === b.item.content &&
      a.item.media_url === b.item.media_url &&
      a.item.pending === b.item.pending &&
      JSON.stringify(a.item.reactions || {}) === JSON.stringify(b.item.reactions || {}) &&
      a.highlightedId === b.highlightedId &&
      (a.repliesCount || 0) === (b.repliesCount || 0) &&
      a.audioPlayingUri === b.audioPlayingUri &&
      a.audioIsPlaying === b.audioIsPlaying &&
      a.audioPositionMs === b.audioPositionMs &&
      a.audioDurationMs === b.audioDurationMs &&
      a.audioLoadingUri === b.audioLoadingUri &&
      a.audioSpeed === b.audioSpeed
  );

  const handleCopy = useCallback(async () => {
    if (!sheetMessage) return;
    await Clipboard.setStringAsync(sheetMessage.content || "");
    Haptics.selectionAsync().catch(() => {});
    Alert.alert("Copied", "Message copied to clipboard.");
    closeSheet();
  }, [sheetMessage, closeSheet]);

  /* INPUT swipe-down to dismiss */
  const inputTranslateY = useRef(new Animated.Value(0)).current;
  const keyboardTranslateY = useRef(new Animated.Value(0)).current;
  // Add a small baseline offset so the bottom input card sits a little lower on the screen
  const inputBaseOffset = useRef(new Animated.Value(12)).current;
  const combinedInputTranslate = useMemo(
    () => Animated.add(inputTranslateY, Animated.add(keyboardTranslateY, inputBaseOffset)),
    [inputTranslateY, keyboardTranslateY, inputBaseOffset]
  );
  const inputPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        inputTranslateY.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          const clamped = Math.min(g.dy, 160);
          inputTranslateY.setValue(clamped);
        }
      },
      onPanResponderRelease: (_, g) => {
        const shouldDismiss = g.dy > 28;
        if (shouldDismiss) {
          Haptics.selectionAsync().catch(() => {});
          Keyboard.dismiss();
        }
        Animated.spring(inputTranslateY, {
          toValue: 0,
          useNativeDriver: false,
          stiffness: 220,
          damping: 24,
          mass: 0.9,
        }).start();
      },
    })
  ).current;

  const onInputFocus = useCallback((e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    // track focus so placeholder can be centered only when not focused
    setInputFocused(true);
  }, []);

  const onInputBlur = useCallback(() => {
    setInputFocused(false);
  }, []);

  const armCancelGesture = useCallback((armed: boolean) => {
    cancelArmedRef.current = armed;
    setShowCancelAffordance(armed);
  }, []);

  const engageLockGesture = useCallback(() => {
    if (micLockActiveRef.current) return;
    micLockActiveRef.current = true;
    setRecorderState("locked");
    setShowLockAffordance(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const cancelActiveRecording = useCallback(async () => {
    armCancelGesture(false);
    setRecorderState("idle");
    try {
      const uri = await stopRecording({ suppressPreview: true, reason: "cancel" });
      if (uri && FileSystem && typeof (FileSystem as any).deleteAsync === "function") {
        await (FileSystem as any).deleteAsync(uri).catch(() => {});
      }
    } catch {}
    setRecordedUri(null);
    waveformRef.current = [];
    setWaveformSamples([]);
    setRecordingDuration(0);
    setIsRecording(false);
    micLongPressActiveRef.current = false;
  }, [armCancelGesture, stopRecording]);

  const finalizeRecording = useCallback(
    async ({ autoSend }: { autoSend: boolean }) => {
      const capturedDurationMs = Math.max(500, lastVoiceDurationMs || recordingDuration * 1000);
      setLastVoiceDurationMs(capturedDurationMs);
      const uri = await stopRecording({
        suppressPreview: !RECORDER_CONFIG.showPreviewAfterAutoSend && autoSend,
        autoSend,
        reason: "finished",
      });
      if (!uri) return null;
      setRecordedUri(uri);
      setRecorderState(autoSend && !RECORDER_CONFIG.showPreviewAfterAutoSend ? "uploading" : "preview");
      waveformRef.current = [...waveformRef.current];
      setWaveformSamples(waveformRef.current);
      setHoldHintVisible(false);
      micLongPressActiveRef.current = false;
      armCancelGesture(false);
      if (autoSend && RECORDER_CONFIG.autoSendOnRelease && !RECORDER_CONFIG.showPreviewAfterAutoSend) {
        uploadAndSendVoice(uri, waveformRef.current, capturedDurationMs).catch(() => {});
      }
      return uri;
    },
    [armCancelGesture, lastVoiceDurationMs, recordingDuration, stopRecording, uploadAndSendVoice]
  );

  const openInMaps = useCallback((lat: number, lng: number, title?: string) => {
    if (!lat || !lng) return;
    const label = title ? encodeURIComponent(title) : '';
    if (Platform.OS === 'ios') {
      const apple = `http://maps.apple.com/?ll=${lat},${lng}${label ? `&q=${label}` : ''}`;
      Linking.openURL(apple).catch(() => {
        const web = `https://www.google.com/maps?q=${lat},${lng}`;
        Linking.openURL(web).catch(() => {});
      });
    } else {
      // Android: try geo: scheme first, fallback to google maps web
      const geo = `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${label})` : ''}`;
      Linking.openURL(geo).catch(() => {
        const web = `https://www.google.com/maps?q=${lat},${lng}`;
        Linking.openURL(web).catch(() => {});
      });
    }
  }, []);

  /* keyboard listeners for height & auto scroll last message into view near top when keyboard opens */
  useEffect(() => {
    const animateKeyboard = (height: number, duration: number) => {
      Animated.timing(keyboardTranslateY, {
        toValue: -height,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };

    const onShow = (e: any) => {
      const h = e.endCoordinates?.height || 0;
      setKeyboardHeight(h);
      animateKeyboard(h, 260);
      if (keyboardShowTimeoutRef.current) clearTimeout(keyboardShowTimeoutRef.current);
      keyboardShowTimeoutRef.current = setTimeout(() => {
        // intentionally do not auto-scroll when keyboard opens — user controls scrolling
        requestAnimationFrame(() => {});
      }, Platform.OS === "ios" ? 60 : 90);
    };
    const onHide = () => {
      if (keyboardShowTimeoutRef.current) {
        clearTimeout(keyboardShowTimeoutRef.current);
        keyboardShowTimeoutRef.current = null;
      }
      animateKeyboard(0, Platform.OS === "ios" ? 220 : 180);
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      if (keyboardShowTimeoutRef.current) {
        clearTimeout(keyboardShowTimeoutRef.current);
        keyboardShowTimeoutRef.current = null;
      }
    };
  }, [keyboardTranslateY, scrollLastMessageIntoView]);

  if (!convoId) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: THEME.bg }}>
        <Text style={{ color: ui.text }}>No conversation id</Text>
      </SafeAreaView>
    );
  }

  const headerName = conversation?.title || otherUser?.full_name || otherName || "Chat";
  const headerAvatar = conversation?.avatar_url || otherUser?.avatar_url || otherAvatar || AVATAR_FALLBACK;
  // Display user: prefer otherUser if available, otherwise fall back to route params so
  // we can show receiver info before messages or participants load.
  const displayUser: (Partial<Profile> & { follower_count?: number }) | null = !isGroup
    ? (otherUser || prefetchOther || ((otherName || otherAvatar || otherParticipantIds.length > 0) ? { id: otherParticipantIds[0] || '', full_name: otherName || '', avatar_url: otherAvatar || undefined, username: undefined, bio: '', follower_count: 0 } : null))
    : null;
  const typingText = Object.values(typingUsers).slice(0, 3).join(", ").concat(Object.keys(typingUsers).length > 3 ? " + others" : "");

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 80 });

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (!viewableItems?.length || !scrollStateReady || !initialScrollAppliedRef.current) return;
      let latest: ViewToken | null = null;
      for (const token of viewableItems) {
        if (!token.isViewable) continue;
        if (!latest || (token.index ?? 0) > (latest.index ?? 0)) {
          latest = token;
        }
      }
      const lastVisibleId = (latest?.item as ChatMessage | undefined)?.id;
      if (lastVisibleId && lastVisibleMessageRef.current !== lastVisibleId) {
        lastVisibleMessageRef.current = lastVisibleId;
        scheduleScrollPersist();
      }
    },
    [scheduleScrollPersist, scrollStateReady]
  );

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      try {
        if (!scrollStateReady || !initialScrollAppliedRef.current) return;
        const nativeEvent = event?.nativeEvent;
        if (!nativeEvent) return;
        const offsetY = Math.max(0, nativeEvent.contentOffset?.y || 0);
        scrollOffsetRef.current = offsetY;
        if (isProgrammaticScrollRef.current) return;
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        const paddingToBottom = 160;
        const isNear = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
        isNearBottomRef.current = !!isNear;
        setShowScrollButton((prev) => {
          const next = !isNear;
          return prev === next ? prev : next;
        });
        scheduleScrollPersist();
      } catch {}
    },
    [scheduleScrollPersist, scrollStateReady]
  );

  const renderShotsList = useCallback(() => {
    const hasShots = conversationShots.length > 0;
    return (
      <View
        style={[
          styles.shotsListContainer,
          { backgroundColor: themeIsLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.03)", borderColor: themeIsLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.06)" },
        ]}
      >
        <View style={styles.shotsListHeader}>
          <Text style={[styles.shotsHeaderTitle, { color: ui.text }]}>Shots</Text>
          {shotsLoading ? (
            <Ionicons name="hourglass-outline" size={16} color={ui.subtext} />
          ) : hasShots ? (
            <Text style={[styles.shotsHeaderHint, { color: ui.subtext }]}>{`${conversationShots.length} new`}</Text>
          ) : null}
        </View>
        {hasShots ? (
          conversationShots.map((shot, index) => {
            const isOutgoing = shot.sender_id === profile?.id;
            const counterpartProfile = isOutgoing ? shot.recipient_profile : shot.sender_profile;
            const displayName = counterpartProfile?.full_name || (isOutgoing ? "Recipient" : "Someone");
            const avatarUrl = counterpartProfile?.avatar_url || AVATAR_FALLBACK;
            const subtitle = shot.caption || (isOutgoing ? "You sent a shot" : "Sent you a shot");
            const expiresText = describeShotExpiry(shot.expires_at);
            const timestamp = formatShotTimestamp(shot.created_at);
            return (
              <TouchableOpacity
                key={shot.id}
                style={[styles.shotRow, index > 0 ? styles.shotRowDivider : null]}
                onPress={() => handleShotPress(shot)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: avatarUrl }} style={styles.shotAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={styles.shotRowTop}>
                    <Text numberOfLines={1} style={[styles.shotRowName, { color: ui.text }]}>
                      {displayName}
                    </Text>
                    <Text style={[styles.shotRowTime, { color: ui.subtext }]}>{timestamp}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.shotRowSubtitle, { color: ui.subtext }]}>{subtitle}</Text>
                  <Text numberOfLines={1} style={[styles.shotRowMeta, { color: ui.subtext }]}>
                    {isOutgoing ? "Sent" : "Received"} • {expiresText}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
              </TouchableOpacity>
            );
          })
        ) : !shotsLoading ? (
          <Text style={[styles.shotsHeaderHint, { color: ui.subtext }]}>Viewed shots show up here</Text>
        ) : (
          <Text style={[styles.shotsHeaderHint, { color: ui.subtext }]}>Loading shots…</Text>
        )}
      </View>
    );
  }, [conversationShots, shotsLoading, themeIsLight, ui.text, ui.subtext, handleShotPress, describeShotExpiry, profile?.id, formatShotTimestamp]);

  /* render item that includes centered time separators between messages */
  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const prev = messages[index - 1];
    const prevDate = prev?.created_at;
    const currDate = item.created_at;
    const timeDiff = prev ? Math.abs(new Date(currDate ?? 0).getTime() - new Date(prevDate ?? 0).getTime()) : Infinity;
    const needTimeSeparator = !prev || !sameDay(prevDate, currDate) || timeDiff > 1000 * 60 * 5; // show if different day or gap > 5min

    const timePillBg = themeColors.accent;
    const timePillColor = readableTextColor(timePillBg);
    const rowBg = themeColors.faint ?? (themeColors.accent ? `${themeColors.accent}10` : 'transparent');

    return (
      <View key={item.id}>
        {needTimeSeparator && (
          <View style={{ alignItems: "center", marginVertical: 6 }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: timePillBg }}>
              {/* If the separator is crossing days (not sameDay) show friendly day label; otherwise show time-only */}
              <Text style={{ color: timePillColor, fontSize: 12 }}>
                {!prev || !sameDay(prevDate, currDate) ? friendlyDayLabel(item.created_at) : formatTimeOnly(item.created_at)}
              </Text>
            </View>
          </View>
        )}

        {/* Full-width highlighted row using theme's faint color. The inner bubble keeps its original alignment. */}
        <View style={{ width: '100%', backgroundColor: rowBg, paddingVertical: 2 }}>
          {(() => {
            const repliesCount = messages.filter((m) => m.reply_to_message_id === item.id).length;
            return <_MessageBubble 
              item={item} 
              index={index} 
              highlightedId={highlightedMessageId} 
              repliesCount={repliesCount}
              audioPlayingUri={playingUri}
              audioIsPlaying={isAudioPlaying}
              audioPositionMs={playingPositionMs}
              audioDurationMs={playingDurationMs}
              audioLoadingUri={loadingAudioUri}
              audioSpeed={playbackSpeed}
            />;
          })()}

          {/* Threaded replies (one-level): show direct replies under the parent message */}
          {(() => {
            const replies = messages.filter((m) => m.reply_to_message_id === item.id).sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
            if (!replies || replies.length === 0) return null;
            const isExpanded = !!expandedReplies[item.id];
            const isFull = !!fullExpandedReplies[item.id];
            const maxShow = 5;
            const shown = isExpanded ? (isFull ? replies : replies.slice(0, maxShow)) : [];

            return (
              <View style={{ paddingHorizontal: 10, paddingTop: 6 }}>
                <Pressable onPress={() => setExpandedReplies((p) => ({ ...(p || {}), [item.id]: !isExpanded }))} style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: themeColors.accent, backgroundColor: 'transparent' }}>
                    <Text style={{ color: themeColors.accent, fontSize: 13, fontWeight: '700' }}>{isExpanded ? `Hide ${replies.length} repl${replies.length>1?'ies':'y'}` : `Show ${Math.min(replies.length, maxShow)} repl${replies.length>1?'ies':'y'}`}</Text>
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={{ marginTop: 4 }}>
                    {shown.map((r: ChatMessage) => (
                      <Pressable key={r.id} onPress={() => jumpToMessage(r.id)} style={{ flexDirection: 'row', paddingVertical: 6, alignItems: 'flex-start' }}>
                        <View style={{ width: 6 }} />
                        <View style={{ flex: 1 }}>
                          <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)' }}>
                            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: ui.text }}>{r.sender?.full_name || (r.sender_id === profile?.id ? 'You' : 'User')}</Text>
                            {r.content ? <Text numberOfLines={2} style={{ color: ui.subtext, marginTop: 4 }}>{r.content}</Text> : null}
                            {r.media_url && (
                              <Text style={{ color: ui.subtext, marginTop: 6, fontSize: 12 }}>{`[${r.media_type || 'media'}]`}</Text>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    ))}

                    {/* show more / show all control when there are more replies */}
                    {replies.length > maxShow && !isFull && (
                      <Pressable onPress={() => setFullExpandedReplies((p) => ({ ...(p || {}), [item.id]: true }))} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: themeColors.accent, backgroundColor: 'transparent' }}>
                          <Text style={{ color: themeColors.accent, fontSize: 13, fontWeight: '700' }}>{`Show all ${replies.length} replies`}</Text>
                        </View>
                      </Pressable>
                    )}

                    {isFull && replies.length > maxShow && (
                      <Pressable onPress={() => setFullExpandedReplies((p) => ({ ...(p || {}), [item.id]: false }))} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: themeColors.accent, backgroundColor: 'transparent' }}>
                          <Text style={{ color: themeColors.accent, fontSize: 13, fontWeight: '700' }}>{`Show less`}</Text>
                        </View>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })()}
        </View>
      </View>
    );
  }, [expandedReplies, fullExpandedReplies, highlightedMessageId, jumpToMessage, messages, profile?.id, themeColors, ui, playingUri, isAudioPlaying, playingPositionMs, playingDurationMs, loadingAudioUri, playbackSpeed]);

  /* ---------- Header + content (keeps header fixed) ---------- */
  
  // Animated gradient colors for loading pulse - vibrant, visible colors
  const loadingGradientOpacity = headerLoadingPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.7, 0.4],
  });
  
  const content = (
    <>
      {/* Header: fixed at top */}
      <View
        style={{
          position: "absolute",
          top: -10,
          left: 0,
          right: 0,
          paddingTop: insets.top + 0,
          paddingHorizontal: 10,
          zIndex: 30,
          backgroundColor: THEME.bg,
          borderBottomWidth: 1,
          borderBottomColor: themeIsLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
          shadowColor: THEME.tint === "dark" ? "#000" : "#000",
          shadowOpacity: THEME.tint === "dark" ? 0.2 : 0.06,
          shadowRadius: 8,
          elevation: 8,
          overflow: 'hidden',
        }}
      >
        {/* Loading gradient pulse overlay - calm, dim colors */}
        {isAnyLoading && (
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              opacity: loadingGradientOpacity,
              zIndex: 1,
            }}
            pointerEvents="none"
          >
            <AnimatedLinearGradient
              colors={
                isDark 
                  ? ['rgba(100,180,255,0.6)', 'rgba(180,100,255,0.5)', 'rgba(100,255,200,0.6)', 'rgba(255,160,100,0.5)'] 
                  : ['rgba(60,140,255,0.45)', 'rgba(160,80,220,0.4)', 'rgba(60,200,140,0.45)', 'rgba(220,140,60,0.4)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
        
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, zIndex: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AnimatedPressable onPress={() => router.back()} style={[{ padding: 8 }, styles.shadowIconContainer]}>
              <Ionicons name="chevron-back" size={24} color={ui.text} />
            </AnimatedPressable>
          </View>

          <AnimatedPressable onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            // Prefetch settings data before navigation
            if (convoId && profile?.id) {
              prefetchChatSettings(convoId, profile.id).catch(() => {});
            }
            try {
              router.push({ pathname: "/message/chat/settings", params: { id: convoId } });
            } catch {
              Alert.alert("Settings", "Open settings screen here.");
            }
          }} style={{ alignItems: "center" }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: THEME.tint === "dark" ? "transparent" : "transparent" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.avatarWrapShadow}>
                  <Image source={{ uri: headerAvatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                </View>
                <View style={{ maxWidth: SCREEN_W * 0.45 }}>
                  <Text numberOfLines={1} style={{ color: ui.text, fontSize: 16, fontWeight: "800" }}>{headerName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!isGroup && otherUser?.is_online && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759', marginRight: 4 }} />
                    )}
                    <Text numberOfLines={1} style={{ color: otherUser?.is_online ? '#34C759' : ui.subtext, fontSize: 12 }}>
                      {isGroup ? `${participants.length} members` : formatOnlineStatus(otherUser?.is_online, otherUser?.last_seen)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </AnimatedPressable>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* TODO: Implement startCall logic for audio */}
            <AnimatedPressable onPress={() => {}} style={[{ padding: 8, marginRight: 4 }, styles.shadowIconContainer]}>
              <Ionicons name="call-outline" size={22} color={ui.text} />
            </AnimatedPressable>

            {/* header three-dots menu */}
            <AnimatedPressable onPress={() => setHeaderMenuVisible(true)} style={[{ padding: 8 }, styles.shadowIconContainer]}>
              <Ionicons name="ellipsis-vertical" size={22} color={ui.text} />
            </AnimatedPressable>
          </View>
        </View>

        {Object.keys(typingUsers).length > 0 && (
          <Text numberOfLines={1} style={{ color: ui.subtext, fontSize: 12, textAlign: "center", marginBottom: 6 }}>
            {typingText} {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing…
          </Text>
          )}

        {/* Note: Header-attached profile banner removed — other user's info will be shown at the beginning of chat messages (ListFooterComponent). */}
      </View>

      {/* Invite prompt (recipient only) */}
      {pendingInvite ? (() => {
        // Try to pull inviter metadata from participants or message content
        let inviterProfile: (Profile & { accepted?: boolean; follower_count?: number }) | undefined = undefined;
        try {
          inviterProfile = participants.find((p) => p.id === pendingInvite.sender_id) as (Profile & { accepted?: boolean; follower_count?: number }) | undefined;
        } catch {}
        let parsed: any = null;
        try { parsed = pendingInvite.content ? JSON.parse(pendingInvite.content) : null; } catch {}
        // Avoid showing backend IDs (parsed.from can contain raw user id) — prefer full name / username
        const inviterName = inviterProfile?.full_name || parsed?.name || 'Someone';
        const inviterAvatar = inviterProfile?.avatar_url || parsed?.avatar || AVATAR_FALLBACK;
        const inviterUser = inviterProfile?.username ? `@${inviterProfile.username}` : (parsed?.username || '');
        const inviterBio = inviterProfile?.bio || parsed?.bio || '';
        const followerCount = inviterProfile?.follower_count ?? 0;
        return (
          <Modal visible={true} transparent animationType="fade" onRequestClose={() => {}}>
            <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
              <View style={{ width: Math.min(SCREEN_W - 64, 520), borderRadius: 16, padding: 18, backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                  <Image source={{ uri: inviterAvatar }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 8 }} />
                  <Text style={{ fontSize: 18, fontWeight: '800', color: ui.text }}>{inviterName}</Text>
                  {inviterUser ? <Text style={{ color: ui.subtext, fontSize: 13, marginTop: 4 }}>{inviterUser} • {followerCount} followers</Text> : null}
                </View>
                {inviterBio ? <Text style={{ color: ui.text, marginBottom: 12 }}>{inviterBio}</Text> : null}
                <Text style={{ color: ui.subtext, fontSize: 13, marginBottom: 18 }}>This person started a chat with you — accept to start talking or abort to cancel the conversation.</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setPendingInvite(null); router.push({ pathname: `/profile/view/${inviterProfile?.id ?? parsed?.from }` }); }} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ color: ui.subtext }}>View profile</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row' }}>
                    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); abortInvite(); }} style={{ paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 }}>
                      <Text style={{ color: THEME.tint === 'dark' ? '#fff' : '#b00' }}>Abort</Text>
                    </Pressable>
                    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); acceptInvite(); }} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: themeColors.accent }}>
                      <Text style={{ color: '#fff', fontWeight: '800' }}>Accept</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        );
      })() : null}

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {/* Loading indicator removed - header gradient pulse shows loading state */}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* shots list intentionally removed from chat — feature not desired here */}
          <AnimatedFlatList
            ref={(r: FlatList<ChatMessage> | null) => {
              listRef.current = r;
            }}
            data={visibleMessages} // newest -> oldest, used with inverted so newest displays at the bottom by default
            keyExtractor={(item: ChatMessage) => item.id}
            renderItem={renderMessage}
            inverted // use inverted + newest-first data so initial render shows latest message at the bottom
            // Because the list is inverted, paddingTop creates the visual space above the input
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true, listener: handleListScroll }
            )}
            scrollEventThrottle={16}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: bottomSpacerWithExtra + 56 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            windowSize={11}
            removeClippedSubviews={true}
            ListFooterComponent={() => {
              if (isGroup || !displayUser) return null;
              const footerUser = otherUser || { id: otherParticipantIds[0] || '', full_name: otherName || 'Someone', avatar_url: otherAvatar || AVATAR_FALLBACK, username: undefined, follower_count: 0, bio: '' };
              const avatar = footerUser.avatar_url || otherAvatar || AVATAR_FALLBACK;
              const name = footerUser.full_name || footerUser.username || otherName || 'Someone';
              const username = footerUser.username ? `@${footerUser.username}` : '';
              const followers = footerUser.follower_count ?? 0;
              const bio = footerUser.bio || '';

              return (
                <View style={{ paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8, marginTop: Math.max(insets.top + 80, 90) }}>
                  <View style={{ borderRadius: 12, padding: 16, backgroundColor: THEME.bg, borderWidth: 1, borderColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                    {/* Center avatar above name + followers (followers beside full name) */}
                    <View style={{ alignItems: 'center' }}>
                      <Image source={{ uri: avatar }} style={{ width: 82, height: 82, borderRadius: 42, marginBottom: 10 }} />

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <Text numberOfLines={1} style={{ color: ui.text, fontSize: 18, fontWeight: '800', marginRight: 8 }}>{name}</Text>
                        <Text numberOfLines={1} style={{ color: ui.subtext, fontSize: 13 }}>{`${followers} followers`}</Text>
                      </View>

                      {bio ? <Text numberOfLines={3} style={{ color: ui.text, marginTop: 10, textAlign: 'center' }}>{bio}</Text> : null}

                      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
                        <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push({ pathname: `/profile/view/${displayUser.id || otherParticipantIds[0] || ''}` }); }} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                          <Text style={{ color: ui.subtext }}>View profile</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* reply preview is rendered inline above input (swipeable) */}

      <Modal visible={shotViewerVisible} transparent animationType="fade" onRequestClose={closeShotViewer}>
        <View style={styles.shotViewerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeShotViewer} />
          {activeShot ? (
            <View style={styles.shotViewerCard}>
              {activeShot.media_url ? (
                (() => {
                  const isVideo = (activeShot.media_type || "").toLowerCase().includes("video");
                  if (isVideo) {
                    return (
                      <Video
                        source={{ uri: activeShot.media_url }}
                        style={styles.shotViewerMedia}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay
                        isLooping
                        isMuted
                        useNativeControls={false}
                      />
                    );
                  }
                  return <Image source={{ uri: activeShot.media_url }} style={styles.shotViewerMedia} resizeMode="cover" />;
                })()
              ) : (
                <View style={[styles.shotViewerMedia, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.6)" }]}>
                  <Ionicons name="alert-circle" size={48} color="#fff" />
                  <Text style={{ color: "#fff", marginTop: 12, fontWeight: "700" }}>Shot unavailable</Text>
                </View>
              )}
              <LinearGradient colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.75)"]} style={styles.shotViewerOverlay}>
                {(() => {
                  const isOutgoing = activeShot.sender_id === profile?.id;
                  const counterpartProfile = isOutgoing ? activeShot.recipient_profile : activeShot.sender_profile;
                  const counterpartName = counterpartProfile?.full_name || "Shot";
                  const directionLabel = isOutgoing ? `Sent to ${counterpartName}` : `From ${counterpartName}`;
                  return (
                    <View style={styles.shotViewerMeta}>
                      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{directionLabel}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{describeShotExpiry(activeShot.expires_at)}</Text>
                      {activeShot.caption ? (
                        <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 8 }}>{activeShot.caption}</Text>
                      ) : null}
                      {activeShot.sender_id !== profile?.id ? (
                        <Text style={styles.shotRestoreHint}>
                          {canRestoreActiveShot ? "Restore available because you follow this creator." : "Follow this creator to restore shots after viewing."}
                        </Text>
                      ) : null}
                      {canRestoreActiveShot ? (
                        <Pressable style={styles.restoreShotBtn} onPress={handleRestoreShot}>
                          <Text style={styles.restoreShotBtnText}>Restore from Content</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })()}
                <Pressable onPress={closeShotViewer} style={styles.shotViewerClose}>
                  <Ionicons name="close" size={20} color="#fff" />
                </Pressable>
              </LinearGradient>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* flying animation overlay */}
      {flyingMessage && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 120 + keyboardHeight,
            transform: [
              {
                translateY: flyAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -220] }),
              },
              {
                scale: flyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
              },
            ],
            opacity: flyAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.0, 1, 0] }),
            zIndex: 999,
          }}
        >
          <View style={{ paddingHorizontal: 12, borderRadius: 20, backgroundColor: THEME.tint === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: ui.text, fontSize: 15 }}>{flyingMessage.content}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* input & plus popover */}
      <View pointerEvents="box-none" style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <SafeAreaView style={{ backgroundColor: "transparent" }}>
          {holdHintVisible && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: Math.max(insets.bottom, 12) + keyboardHeight + 72,
                left: 0,
                right: 0,
                alignItems: "center",
                transform: [
                  {
                    translateY: holdHintAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
                opacity: holdHintAnim,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: THEME.tint === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                  borderWidth: 1,
                  borderColor: THEME.tint === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)",
                }}
              >
                <Text style={{ color: ui.text, fontSize: 13, fontWeight: "600" }}>Release to send</Text>
              </View>
            </Animated.View>
          )}
            <Animated.View
            {...inputPanResponder.panHandlers}
            style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
              transform: [{ translateY: combinedInputTranslate }],
                  paddingVertical: 6,
                  paddingHorizontal: 10, // match header horizontal allocation
                  borderRadius: 10,
                  backgroundColor: THEME.bg,
                  borderTopWidth: 1,
                  borderTopColor: themeIsLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                  paddingBottom: insets.bottom ?? 0,
                  shadowColor: THEME.tint === "dark" ? "#000" : "#000",
                  shadowOpacity: THEME.tint === "dark" ? 0.2 : 0.06,
                  shadowRadius: 8,
                  elevation: 8,
            }}
            onLayout={(e: any) => {
              const h = e?.nativeEvent?.layout?.height ?? 140;
              setInputBaseHeight(h);
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* PLUS (opens anchored popover) */}
              <View style={{ position: "relative" }}>
                  {recorderState === 'uploading' && audioUploadProgress != null ? (
                    <Pressable
                      onPress={() => {
                        try { cancelPreviewUpload(); } catch {}
                        try { setRecorderState('idle'); } catch {}
                        try { setAudioUploadProgress(null); } catch {}
                        Alert.alert('Upload canceled', 'Audio upload was cancelled.');
                      }}
                      style={{ padding: 6, marginRight: 6 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </Pressable>
                  ) : null}

                  <AnimatedPressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    // open bottom sheet for plus actions
                    setPlusSheetVisible(true);
                  }}
                  style={[{ padding: 8, marginRight: 8 }, styles.shadowIconContainer]}
                >
                  <Ionicons name="add-circle" size={34} color={ui.text} />
                </AnimatedPressable>
              </View>

              <View style={{ flex: 1, marginRight: 8 }}>
                {/* floating reply preview (separate from the input pill, doesn't alter pill layout) */}
                {replyTo ? (
                  <Animated.View
                    {...replyPanResponder.panHandlers}
                    style={{
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      bottom: inputBaseHeight + 12, // float above the pill
                      zIndex: 60,
                      transform: [{ translateX: replyTranslate }],
                      shadowColor: '#000',
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      elevation: 8,
                    }}
                  >
                    <View style={[styles.replyPreviewContainer, { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: inputBgSolid, borderWidth: 1, borderColor: themeIsLight ? '#C0C0C0' : 'rgba(255,255,255,0.06)' }]}>
                      <View style={[styles.replyQuoteBar, { backgroundColor: replyTo.sender_id === profile?.id ? '#0b93f6' : '#12c54a', height: 36, marginRight: 10 }]} />
                      <View style={[styles.replyPreviewBody, { justifyContent: 'center' }]}>
                        <Text numberOfLines={1} style={[styles.replyPreviewSender, { color: ui.text }]}>{replyTo.sender?.full_name || 'User'}</Text>
                        <Text numberOfLines={1} style={[styles.replyPreviewText, { color: ui.subtext }]}>{replyTo.content || (replyTo.media_type ? `[${replyTo.media_type}]` : '')}</Text>
                      </View>
                      <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setReplyTo(null); }} style={styles.replyCloseBtn}>
                        <Ionicons name="close" size={18} color={ui.subtext} />
                      </Pressable>
                    </View>
                  </Animated.View>
                ) : null}

                {/* story/callout preview (shows above the input pill) */}
                {storyCallout ? (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      left: 14,
                      right: 14,
                      bottom: inputBaseHeight + 10 + (replyTo ? 64 : 0),
                      zIndex: 60,
                      shadowColor: '#000',
                      shadowOpacity: 0.12,
                      shadowRadius: 14,
                      elevation: 12,
                    }}
                  >
                    <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: inputBgSolid, borderWidth: 1, borderColor: themeIsLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)', height: 88 }}>
                      {storyCallout.cover_url ? (
                        <ImageBackground source={{ uri: storyCallout.cover_url }} style={{ flex: 1, justifyContent: 'flex-end' }} imageStyle={{ borderRadius: 12 }}>
                          <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]} style={{ ...StyleSheet.absoluteFillObject }} />
                          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={2} style={[styles.calloutTitle, { color: '#fff' }]}>{storyCallout.title}</Text>
                              <Text numberOfLines={1} style={[styles.calloutAuthor, { color: 'rgba(255,255,255,0.85)' }]}>{storyCallout.author_name}</Text>
                            </View>
                            <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                              <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setStoryCallout(null); }} style={{ padding: 8 }}>
                                <Ionicons name="close" size={18} color={'rgba(255,255,255,0.85)'} />
                              </Pressable>
                              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); sendMessage(); }} style={{ backgroundColor: themeColors.accent, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, marginLeft: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: '800' }}>Share</Text>
                              </Pressable>
                            </View>
                          </View>
                        </ImageBackground>
                      ) : (
                        <View style={{ flex: 1, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 68, height: 56, borderRadius: 10, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.06)' }}>
                              <Ionicons name="image" size={20} color={ui.subtext} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={2} style={[styles.calloutTitle, { color: ui.text }]}>{storyCallout.title}</Text>
                              <Text numberOfLines={1} style={[styles.calloutAuthor, { color: ui.subtext }]}>{storyCallout.author_name}</Text>
                            </View>
                          </View>
                          <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                            <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setStoryCallout(null); }} style={{ padding: 8 }}>
                              <Ionicons name="close" size={18} color={ui.subtext} />
                            </Pressable>
                              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); sendMessage(); }} style={{ backgroundColor: themeColors.accent, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, marginLeft: 8 }}>
                              <Text style={{ color: '#fff', fontWeight: '800' }}>Share</Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                ) : null}

                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: inputBgSolid, borderWidth: 1, borderColor: themeIsLight ? '#C0C0C0' : "rgba(255,255,255,0.06)", flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>

                  {/* Inline Recording UI - fills the input box when recording */}
                  {isRecording ? (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}>
                      {/* Recording indicator */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginRight: 8, opacity: recordingDotOpacity }} />
                        <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 13, marginRight: 8 }}>Recording</Text>
                        <Text style={{ color: ui.subtext, fontSize: 13, fontVariant: ['tabular-nums'] }}>{formatTimeMs(recordingDuration * 1000)}</Text>
                      </View>
                      {/* Stop & Discard buttons */}
                      <Pressable
                        onPress={async () => {
                          const uri = await finalizeRecording({ autoSend: false });
                          if (uri) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FF3B30', marginRight: 8 }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Stop</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          cancelRecorded();
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                        }}
                        style={{ padding: 6 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={ui.subtext} />
                      </Pressable>
                    </View>
                  ) : recordedUri ? (
                    /* Inline Audio Preview - compact within input box */
                    (() => {
                      const totalMs = playingUri === recordedUri && playingDurationMs > 0 ? playingDurationMs : recordingDuration * 1000;
                      const progress = totalMs > 0 && playingUri === recordedUri ? Math.min(1, (playingPositionMs || 0) / totalMs) : 0;
                      return (
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}>
                          {/* Play/Pause button */}
                          <Pressable 
                            onPress={() => playPauseAudio(recordedUri)} 
                            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: themeColors.accent, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Ionicons name={playingUri === recordedUri && isAudioPlaying ? 'pause' : 'play'} size={16} color="#fff" style={{ marginLeft: playingUri === recordedUri && isAudioPlaying ? 0 : 2 }} />
                          </Pressable>
                          {/* Waveform */}
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 24, marginHorizontal: 10 }}>
                            {WAVE_TEMPLATE.map((h, idx) => {
                              const waveProgress = totalMs > 0 ? idx / WAVE_TEMPLATE.length : 0;
                              const isActive = waveProgress <= progress;
                              return (
                                <View
                                  key={idx}
                                  style={{
                                    width: 2,
                                    height: Math.max(4, h * 0.8),
                                    borderRadius: 1,
                                    marginHorizontal: 1,
                                    backgroundColor: isActive 
                                      ? themeColors.accent
                                      : (themeIsLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'),
                                  }}
                                />
                              );
                            })}
                          </View>
                          {/* Duration */}
                          <Text style={{ color: ui.subtext, fontSize: 12, fontVariant: ['tabular-nums'], marginRight: 8 }}>{formatTimeMs(totalMs || recordingDuration * 1000)}</Text>
                          {/* Cancel button */}
                          <Pressable onPress={cancelRecorded} style={{ padding: 4 }}>
                            <Ionicons name="close" size={18} color={ui.subtext} />
                          </Pressable>
                          {/* Send button */}
                          <Pressable
                            onPress={async () => {
                              try {
                                const durationMs = Math.max(500, lastVoiceDurationMs || recordingDuration * 1000);
                                const waveform = (waveformSamples && waveformSamples.length ? waveformSamples : WAVE_TEMPLATE).slice();
                                await uploadAndSendVoice(recordedUri, waveform, durationMs);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                              } catch (e) {
                                console.warn('send recorded audio err', e);
                              }
                            }}
                            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: themeColors.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}
                          >
                            <Ionicons name="arrow-up" size={18} color="#fff" />
                          </Pressable>
                        </View>
                      );
                    })()
                  ) : null}

                  {/* Normal text input - only show when not recording */}
                  {!isRecording && !recordedUri && (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      value={text}
                      onChangeText={onChangeText}
                      placeholder={replyTo ? `Reply to ${replyTo.sender?.full_name || "user"}…` : editingId ? "Edit message…" : "Message…"}
                      placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)"}
                      style={[
                        styles.input,
                        {
                          flex: 1,
                          fontSize: 14,
                          color: ui.text,
                          // slim input again: smaller minHeight and padding
                          minHeight: 34,
                          maxHeight: 120,
                          paddingVertical: Platform.OS === "ios" ? 4 : 4,
                          paddingHorizontal: 8,
                          textAlignVertical: 'center',
                          textAlign: (text && text.length) || inputFocused ? 'left' : 'center',
                        },
                      ]}
                      autoCapitalize="sentences"
                      multiline
                      maxLength={2000}
                      onFocus={(e: any) => { onInputFocus(e); }}
                      onBlur={() => onInputBlur()}
                      returnKeyType="send"
                      onSubmitEditing={() => sendMessage()}
                      blurOnSubmit={false}
                    />
                    {text.trim().length === 0 && (
                      <>
                      <Pressable
                        onPress={async () => {
                          // diagnostic: log press invocations so we can trace why recording doesn't start
                          try { console.debug('[chat] mic onPress, skipNext:', skipNextMicPressRef.current, 'isRecording:', isRecording, 'recorderState:', recorderState); } catch {}
                          if (skipNextMicPressRef.current) {
                            // If a long-press just finished, skipNextMicPressRef prevents a stray tap from immediately starting
                            // recording. Clear the flag but still allow the user press to proceed — avoids a stuck/ignored button.
                            try { console.debug('[chat] skipNextMicPress was true — clearing and proceeding'); } catch {}
                            skipNextMicPressRef.current = false;
                          }
                          // Ensure permissions first
                          const allowed = await ensureMicPermission();
                          if (!allowed) {
                            try {
                              Alert.alert(
                                'Microphone permission',
                                'Microphone permission is required to record voice notes. Open settings to enable it?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Open settings', onPress: openAppSettings },
                                ]
                              );
                            } catch {}
                            return;
                          }
                          // If already recording, pressing once should stop (show preview) — otherwise start
                          if (isRecording) {
                            try {
                              await finalizeRecording({ autoSend: false });
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            } catch {}
                            return;
                          }
                          const ok = await startRecording();
                          try { console.debug('[chat] startRecording returned', ok); } catch {}
                          if (!ok) {
                            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); } catch {}
                            try { Alert.alert('Recording failed', 'Could not start recording — please try again.'); } catch {}
                          }
                          if (ok) {
                            try {
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            } catch {}
                          }
                        }}
                        onLongPress={async () => {
                          try { console.debug('[chat] mic onLongPress start'); } catch {}
                          if (skipNextMicPressRef.current) {
                            skipNextMicPressRef.current = false;
                            return;
                          }
                          const allowed = await ensureMicPermission();
                          if (!allowed) {
                            try {
                              Alert.alert('Microphone permission', 'Microphone permission is required to record voice notes. Open settings to enable it?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Open settings', onPress: openAppSettings },
                              ]);
                            } catch {}
                            return;
                          }
                          const success = await startRecording();
                          if (!success) return;
                          micLongPressActiveRef.current = true;
                          try { console.debug('[chat] mic longPress active'); } catch {}
                          holdHintVisible || setHoldHintVisible(true);
                          Animated.spring(holdHintAnim, {
                            toValue: 1,
                            useNativeDriver: true,
                            stiffness: 220,
                            damping: 18,
                            mass: 0.9,
                          }).start();
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                        }}
                        onPressOut={async () => {
                          if (micLongPressActiveRef.current) {
                            micLongPressActiveRef.current = false;
                            Animated.timing(holdHintAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
                              setHoldHintVisible(false);
                            });
                            await finalizeRecording({ autoSend: true });
                            skipNextMicPressRef.current = true;
                          }
                        }}
                        onPressIn={(e: GestureResponderEvent) => {
                          holdStartCoords.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                        }}
                        onResponderMove={async (e: GestureResponderEvent) => {
                          if (!micLongPressActiveRef.current) return;
                          const dx = e.nativeEvent.pageX - holdStartCoords.current.x;
                          const dy = e.nativeEvent.pageY - holdStartCoords.current.y;
                          if (dx < -HOLD_CANCEL_DISTANCE || Math.abs(dy) > HOLD_CANCEL_VERTICAL) {
                            micLongPressActiveRef.current = false;
                            Animated.timing(holdHintAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
                              setHoldHintVisible(false);
                            });
                            const uri = await stopRecording({ suppressPreview: true });
                            if (uri) {
                              try {
                                if (FileSystem && typeof (FileSystem as any).deleteAsync === "function") {
                                  await (FileSystem as any).deleteAsync(uri).catch(() => {});
                                }
                              } catch {}
                            }
                            setRecordingDuration(0);
                            skipNextMicPressRef.current = true;
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                          }
                        }}
                        onStartShouldSetResponder={() => true}
                        style={[styles.micButton, isRecording ? styles.micButtonRecording : null, { padding: 8, borderRadius: 18, marginLeft: 8 }]}
                      >
                        <Ionicons name={isRecording ? "mic" : "mic-outline"} size={20} color={isRecording ? '#fff' : ui.text} />
                      </Pressable>
                      {micPerm !== 'granted' && (
                        <View style={{ marginLeft: 6, justifyContent: 'center' }}>
                          <Text style={{ fontSize: 11, color: ui.subtext }}>{micPerm === 'denied' ? 'Mic disabled' : 'Mic permission...'}</Text>
                        </View>
                      )}
                      </>
                    )}
                  </View>
                  )}
                </View>
              </View>

              {recorderState === 'uploading' && audioUploadProgress != null ? (
                <Pressable
                  onPress={() => {
                    try { cancelPreviewUpload(); } catch {}
                    try { setRecorderState('idle'); } catch {}
                    try { setAudioUploadProgress(null); } catch {}
                    // mark current optimistic as failed
                    const lid = uploadingAudioLocalRef.current;
                    if (lid) {
                      try { patchOptimistic(lid, { pending: false, error: true }); } catch {}
                      uploadingAudioLocalRef.current = null;
                    }
                    Alert.alert('Upload canceled', 'Audio upload was cancelled.');
                  }}
                  style={{ padding: 6, marginRight: 6 }}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </Pressable>
              ) : null}

              <AnimatedPressable
                onPress={async () => {
                  // If we have a recorded audio ready, send it using the same blue Send button
                  if (recordedUri) {
                    try {
                      const durationMs = Math.max(500, lastVoiceDurationMs || recordingDuration * 1000);
                      const waveform = (waveformSamples && waveformSamples.length ? waveformSamples : WAVE_TEMPLATE).slice();
                      await uploadAndSendVoice(recordedUri, waveform, durationMs);
                    } catch (e) {
                      console.warn('send recorded audio err', e);
                    }
                    return;
                  }
                  sendMessage();
                }}
                disabled={!text.trim() && !storyCallout && !recordedUri}
                style={{ padding: 6 }}
              >
                <Animated.View
                  style={[
                    styles.sendBtn,
                    { width: 40, height: 40, borderRadius: 20 },
                    { transform: [{ scale: sendScale }] },
                    { backgroundColor: sendColorAnim.interpolate({ inputRange: [0, 1], outputRange: ["#0b93f6", "#12c54a"] }) },
                  ]}
                >
                    {recorderState === 'uploading' && audioUploadProgress != null ? (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{`${audioUploadProgress}%`}</Text>
                    ) : (
                      <Ionicons name={editingId ? "checkmark" : "send"} size={20} color="#fff" />
                    )}
                </Animated.View>
              </AnimatedPressable>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>

        {/* Plus bottom sheet (Share location, Upload Media, Upload File) */}
        <Modal visible={plusSheetVisible} transparent animationType="fade" onRequestClose={() => setPlusSheetVisible(false)}>
          <BlurView intensity={25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <TouchableWithoutFeedback onPress={() => setPlusSheetVisible(false)}>
              <View style={{ flex: 1, backgroundColor: THEME.tint === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }} />
            </TouchableWithoutFeedback>
          </BlurView>
          
          <Animated.View style={[
            styles.bottomSheet, 
            (styles as any).calloutsSheet, 
            { 
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            }
          ]}>
            <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20,20,25,0.88)' : 'rgba(255,255,255,0.92)' }]} />
            </BlurView>
            
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: 12 }}>
              <View style={{ width: 40, height: 4, backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', borderRadius: 2 }} />
            </View>
            
            <Text style={[styles.sheetTitle, { color: ui.text, paddingHorizontal: 16, paddingTop: 12 }]}>Share</Text>
            <Text style={[styles.sheetDesc, { color: ui.subtext, paddingHorizontal: 16, marginBottom: 12 }]}>Share your location or upload media/files.</Text>
            
            {/* Plus-sheet actions (uploads) */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPlusSheetVisible(false);
                pickAndUploadMedia().catch(() => {});
              }}
              style={({ pressed }) => ([
                styles.sheetBtn,
                { 
                  marginHorizontal: 16,
                  marginBottom: 8,
                  borderRadius: 14,
                  backgroundColor: pressed ? (THEME.tint === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : (THEME.tint === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ])}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,212,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Ionicons name="image" size={20} color={VELT_ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetText, { color: ui.text, fontWeight: '700' }]}>Upload media</Text>
                <Text style={{ color: ui.subtext, fontSize: 12, marginTop: 2 }}>Photos & videos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
            </Pressable>

            <Pressable
              onPress={() => {
                setPlusSheetVisible(false);
                Haptics.selectionAsync().catch(() => {});
                setCalloutsVisible(true);
                loadCalloutOptions().catch(() => {});
              }}
              style={({ pressed }) => ([
                styles.sheetBtn,
                { 
                  marginHorizontal: 16,
                  marginBottom: 8,
                  borderRadius: 14,
                  backgroundColor: pressed ? (THEME.tint === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : (THEME.tint === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ])}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,149,0,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Ionicons name="megaphone" size={20} color="#FF9500" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetText, { color: ui.text, fontWeight: '700' }]}>Callouts</Text>
                <Text style={{ color: ui.subtext, fontSize: 12, marginTop: 2 }}>Share stories</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPlusSheetVisible(false);
                pickAndUploadFile().catch(() => {});
              }}
              style={({ pressed }) => ([
                styles.sheetBtn,
                { 
                  marginHorizontal: 16,
                  marginBottom: 8,
                  borderRadius: 14,
                  backgroundColor: pressed ? (THEME.tint === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : (THEME.tint === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ])}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(88,86,214,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Ionicons name="document" size={20} color="#5856D6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetText, { color: ui.text, fontWeight: '700' }]}>Upload file</Text>
                <Text style={{ color: ui.subtext, fontSize: 12, marginTop: 2 }}>Documents & files</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
            </Pressable>

            <Pressable 
              onPress={() => setPlusSheetVisible(false)} 
              style={({ pressed }) => ([
                styles.sheetBtn, 
                { 
                  justifyContent: 'center', 
                  marginTop: 8,
                  marginHorizontal: 16,
                  marginBottom: 24,
                  borderRadius: 14,
                  backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ])}
            >
              <Text style={[styles.sheetText, { fontWeight: '700', color: ui.text }]}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Modal>

      {/* In-app media importer used instead of system picker */}
      <MediaImporter
        visible={mediaImporterVisible}
        onClose={() => setMediaImporterVisible(false)}
        onSelect={handleMediaImporterSelect}
        allowVideos={true}
        title="Select media"
        isBusy={mediaImporting}
      />

      {/* plus: Share Polls bottom sheet (placeholder) */}
      <Modal visible={sharePollsVisible} transparent animationType="fade" onRequestClose={() => setSharePollsVisible(false)}>
        <BlurView intensity={25} tint={THEME.tint} style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback onPress={() => setSharePollsVisible(false)}>
            <View style={{ flex: 1, backgroundColor: THEME.tint === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }} />
          </TouchableWithoutFeedback>
        </BlurView>
        
        <Animated.View style={[
          styles.bottomSheet, 
          (styles as any).calloutsSheet, 
          { 
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }
        ]}>
          <BlurView intensity={80} tint={THEME.tint} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: THEME.tint === 'dark' ? 'rgba(20,20,25,0.88)' : 'rgba(255,255,255,0.92)' }]} />
          </BlurView>
          
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', borderRadius: 2 }} />
          </View>
          
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={[styles.sheetTitle, { color: ui.text }]}>Share Polls</Text>
            <Text style={[styles.sheetDesc, { color: ui.subtext }]}>This is a placeholder bottom sheet. Hook the real poll UI here.</Text>
          </View>
          
          <Pressable 
            style={({ pressed }) => ([
              styles.sheetClose, 
              { 
                backgroundColor: VELT_ACCENT,
                marginHorizontal: 16,
                marginTop: 16,
                marginBottom: 24,
                borderRadius: 14,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              }
            ])} 
            onPress={() => setSharePollsVisible(false)}
          >
            <Text style={{ color: "#fff", fontWeight: '700' }}>Close</Text>
          </Pressable>
        </Animated.View>
      </Modal>

      {/* Callouts bottom sheet (select a story to attach/share) */}
      <Modal visible={calloutsVisible} transparent animationType="fade" onRequestClose={() => setCalloutsVisible(false)}>
        <BlurView intensity={25} tint={THEME.tint} style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback onPress={() => setCalloutsVisible(false)}>
            <View style={{ flex: 1, backgroundColor: THEME.tint === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }} />
          </TouchableWithoutFeedback>
        </BlurView>
        
        <Animated.View style={[
          styles.bottomSheet, 
          (styles as any).calloutsSheet, 
          { 
            height: calloutsHeight as any,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }
        ]}>
          <BlurView intensity={80} tint={THEME.tint} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: THEME.tint === 'dark' ? 'rgba(20,20,25,0.88)' : 'rgba(255,255,255,0.92)' }]} />
          </BlurView>
          
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ width: 40, height: 4, backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', borderRadius: 2 }} />
          </View>
          
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.sheetTitle, { color: ui.text }]}>Callouts</Text>
              <Pressable 
                onPress={() => { Haptics.selectionAsync().catch(() =>{}); setCalloutsVisible(false); router.push('/explore'); }} 
                style={({ pressed }) => ({ 
                  paddingHorizontal: 14, 
                  paddingVertical: 8, 
                  borderRadius: 20, 
                  backgroundColor: VELT_ACCENT,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Search stories</Text>
              </Pressable>
            </View>
            <Text style={[styles.sheetDesc, { color: ui.subtext }]}>Choose a story to share into the chat as a callout.</Text>
          </View>

          {calloutsLoading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={VELT_ACCENT} />
              <Text style={{ color: ui.subtext, marginTop: 12 }}>Loading stories...</Text>
            </View>
          ) : (calloutOptions.length === 0 || filteredCalloutOptions.length === 0) ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Ionicons name="images-outline" size={48} color={ui.subtext} />
              <Text style={{ color: ui.subtext, marginTop: 12 }}>No recent stories found to call out.</Text>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}>
                {filteredCalloutOptions.map((s, idx) => (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setCalloutsVisible(false);
                      setStoryCallout(s);
                    }}
                    style={({ pressed }) => ([
                      (styles as any).storyFlyerCardSmall, 
                      { 
                        marginRight: idx === filteredCalloutOptions.length - 1 ? 10 : 10,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      }
                    ])}
                  >
                    {s.cover_url ? (
                      <ImageBackground source={{ uri: s.cover_url }} style={(styles as any).storyFlyerImageSmall} imageStyle={{ borderRadius: 14 }}>
                        <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)"]} style={(styles as any).storyFlyerOverlay} />
                        <View style={(styles as any).storyFlyerMetaSmall}>
                          <Text numberOfLines={2} style={[styles.calloutTitleSmall, { color: '#fff' }]}>{s.title}</Text>
                          <Text numberOfLines={1} style={[styles.calloutAuthorSmall, { color: 'rgba(255,255,255,0.85)' }]}>{s.author_name}</Text>
                        </View>
                      </ImageBackground>
                    ) : (
                      <View style={[(styles as any).storyFlyerImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 14 }]}>
                        <Ionicons name="image-outline" size={36} color={ui.subtext} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <Pressable 
            onPress={() => setCalloutsVisible(false)} 
            style={({ pressed }) => ([
              styles.sheetBtn, 
              { 
                justifyContent: 'center', 
                marginTop: 16,
                marginHorizontal: 16,
                marginBottom: 24,
                borderRadius: 14,
                backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                transform: [{ scale: pressed ? 0.97 : 1 }],
              }
            ])}
          >
            <Text style={[styles.sheetText, { fontWeight: '700', color: ui.text }]}>Close</Text>
          </Pressable>
        </Animated.View>
      </Modal>

      {/* scroll to bottom button */}
      {showScrollButton && (
        <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); scrollLastMessageIntoView(true, true); setShowScrollButton(false); }} style={styles.scrollBtn}>
          <Ionicons name="arrow-down" size={26} color={"#fff"} />
        </TouchableOpacity>
      )}

      {/* action sheet */}
      <Modal transparent visible={!!sheetVisible} animationType="fade" onRequestClose={closeSheet}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheetCard, { borderRadius: 12, backgroundColor: THEME.tint === "dark" ? "rgba(15,15,20,0.92)" : "#f8faff" }]}>
            {previewMessage && (
              <View style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(12,24,48,0.05)' }}>
                {(previewMessage.media_type === 'audio' || isAudioUrl(previewMessage.media_url || previewMessage.local_media_uri)) ? (
                  <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="musical-notes" size={22} color={themeColors.accent} style={{ marginRight: 12 }} />
                    <Text style={{ color: ui.text, fontWeight: '700', fontSize: 15 }}>Voice note</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={{ color: ui.subtext, fontSize: 13 }}>{formatTimeMs(Math.max(0, (playingUri === previewMessage.media_url && playingDurationMs) || 0))}</Text>
                  </View>
                ) : previewMessage.media_type === 'video' ? (
                  <View style={{ height: 160 }}>
                    <ImageBackground source={{ uri: previewMessage.media_url || previewMessage.local_media_uri || '' }} style={{ flex: 1 }}>
                      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]} style={{ flex: 1, justifyContent: 'flex-end', padding: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="play" size={20} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={{ color: '#fff', fontWeight: '700' }}>Video</Text>
                        </View>
                      </LinearGradient>
                    </ImageBackground>
                  </View>
                ) : previewMessage.media_type === 'image' ? (
                  <Image source={{ uri: previewMessage.media_url || previewMessage.local_media_uri || '' }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
                ) : (
                  <View style={{ padding: 14 }}>
                    <Text style={{ color: ui.subtext, fontSize: 14 }}>{previewMessage.content || 'Message preview'}</Text>
                  </View>
                )}
              </View>
            )}
            <Text style={{ color: ui.text, fontSize: 16, fontWeight: "700", marginBottom: 10 }}>Message actions</Text>
            <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setReplyTo(sheetMessage); closeSheet(); }} style={styles.sheetBtn}>
              <Ionicons name="arrow-undo-outline" size={20} color={ui.text} />
              <Text style={[styles.sheetText, { color: ui.text }]}>Reply</Text>
            </Pressable>
            <Pressable onPress={handleCopy} style={styles.sheetBtn}>
              <Ionicons name="copy-outline" size={20} color={ui.text} />
              <Text style={[styles.sheetText, { color: ui.text }]}>Copy</Text>
            </Pressable>
            <Pressable onPress={() => { setSheetVisible(false); setEmojiPickerVisible(true); }} style={styles.sheetBtn}>
              <Ionicons name="happy-outline" size={20} color={ui.text} />
              <Text style={[styles.sheetText, { color: ui.text }]}>React</Text>
            </Pressable>
            <Pressable onPress={handleEdit} style={styles.sheetBtn}>
              <Ionicons name="pencil-outline" size={20} color={ui.text} />
              <Text style={[styles.sheetText, { color: ui.text }]}>Edit</Text>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.sheetBtn}>
              <Ionicons name="trash-outline" size={20} color={ui.text} />
              <Text style={[styles.sheetText, { color: ui.text }]}>Delete</Text>
            </Pressable>
            <Pressable onPress={closeSheet} style={[styles.sheetBtn, { justifyContent: "center", marginTop: 6 }]}>
              <Text style={[styles.sheetText, { fontWeight: "700", color: ui.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* emoji picker (opens after closing sheet) */}
      <Modal transparent visible={emojiPickerVisible} animationType="fade" onRequestClose={() => setEmojiPickerVisible(false)}>
        <BlurView intensity={40} tint={THEME.tint} style={StyleSheet.absoluteFill}>
          <Pressable onPress={() => setEmojiPickerVisible(false)} style={{ flex: 1, backgroundColor: THEME.tint === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center' }}>
            <Pressable onPress={() => {}} style={{ width: '85%', maxWidth: 340 }}>
              <View style={{ borderRadius: 24, overflow: 'hidden' }}>
                <BlurView intensity={80} tint={THEME.tint} style={StyleSheet.absoluteFill}>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: THEME.tint === 'dark' ? 'rgba(20,20,25,0.88)' : 'rgba(255,255,255,0.92)' }]} />
                </BlurView>
                
                <View style={{ padding: 20 }}>
                  <Text style={{ color: ui.text, fontSize: 18, fontWeight: "800", marginBottom: 16, textAlign: 'center' }}>React</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 }}>
                    {["❤️", "😂", "👍", "😮", "😢", "👏"].map((e) => (
                      <Pressable 
                        key={e} 
                        onPress={() => handleReact(e, sheetMessage)} 
                        style={({ pressed }) => ({ 
                          padding: 12,
                          borderRadius: 16,
                          backgroundColor: pressed ? (THEME.tint === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                          transform: [{ scale: pressed ? 1.15 : 1 }],
                        })}
                      >
                        <Text style={{ fontSize: 32 }}>{e}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable 
                    onPress={() => setEmojiPickerVisible(false)} 
                    style={({ pressed }) => ([
                      styles.sheetBtn, 
                      { 
                        justifyContent: "center", 
                        marginTop: 16,
                        borderRadius: 14,
                        backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      }
                    ])}
                  >
                    <Text style={[styles.sheetText, { fontWeight: "700", color: ui.text }]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </BlurView>
      </Modal>

      {/* viewer */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.98)', justifyContent: 'center', alignItems: 'center', opacity: viewerBgOpacity }}>
          {/* Close button for picked preview (non-picked viewers have their own controls) */}
          {viewer?.picked && (
            <Pressable onPress={() => { Animated.timing(viewerPanY, { toValue: SCREEN_H, duration: 180, useNativeDriver: true }).start(() => { try{ viewerPanY.setValue(0); }catch{}; setViewer(null); }); }} style={{ position: "absolute", top: 50, right: 20, padding: 8, zIndex: 20 }}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          )}

          {/* picked preview + send state */}
          {viewer?.picked ? (
            <Animated.View
              style={{
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                transform: [{ translateY: viewerTranslateY }],
              }}
              {...viewerPanResponder.panHandlers}
            >
              {/* media canvas */}
              {viewer?.isVideo ? (
                <View style={{ width: '100%', height: '78%', justifyContent: 'center', alignItems: 'center' }} {...viewerPanResponder.panHandlers}>
                  {/* custom Video playback with overlay controls */}
                  <Video
                    ref={viewerVideoRef}
                    source={{ uri: viewer.url }}
                    style={{ width: '100%', height: '100%', maxWidth: 1200, maxHeight: '100%' }}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={viewerAutoPlay}
                    isLooping={false}
                    onPlaybackStatusUpdate={(st: any) => {
                      setViewerBuffering(!!st?.isBuffering);
                      setViewerIsPlaying(!!st?.isPlaying);
                      if (st && typeof st.positionMillis === 'number' && typeof st.durationMillis === 'number') {
                        setViewerProgress({ position: st.positionMillis, duration: st.durationMillis });
                      }
                    }}
                  />
                  {viewerBuffering ? (
                    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="hourglass-outline" size={48} color="#fff" />
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      try {
                        if (viewerIsPlaying) viewerVideoRef.current?.pauseAsync?.().catch(() => {});
                        else viewerVideoRef.current?.playAsync?.().catch(() => {});
                      } catch {}
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={viewerIsPlaying ? 'pause' : 'play'} size={36} color="#fff" />
                    </View>
                  </Pressable>
                </View>
                ) : (
                <View style={{ width: '100%', height: '78%', justifyContent: 'center', alignItems: 'center' }}>
                  <Image source={{ uri: viewer?.url || '' }} style={{ width: '100%', height: '100%', maxWidth: 1200, maxHeight: '100%' }} resizeMode="contain" />
                </View>
              )}

              {/* caption + actions */}
              <View style={{ width: '100%', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'transparent', position: 'absolute', bottom: 40 }}>
                <View style={{ backgroundColor: THEME.tint === 'dark' ? 'rgba(255,255,255,0.04)' : '#0f172a', padding: 8, borderRadius: 10 }}>
                  <TextInput placeholder="Add a message (optional)" value={previewCaption} onChangeText={setPreviewCaption} placeholderTextColor={THEME.subtext ?? '#94a3b8'} style={{ color: '#fff', padding: 8 }} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
                  <Pressable onPress={() => { Animated.timing(viewerPanY, { toValue: SCREEN_H, duration: 160, useNativeDriver: true }).start(() => { try{ viewerPanY.setValue(0); }catch{}; setViewer(null); setPreviewCaption(''); setPreviewUploadProgress(null); setPreviewUploading(false); setPreviewUploadError(null); }); }} style={{ padding: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
                  </Pressable>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {previewUploading ? (
                      <View style={{ alignItems: 'center', marginRight: 12, flexDirection: 'row', gap: 8 }}>
                        {previewUploadProgress != null ? <Text style={{ color: '#fff', fontWeight: '700', marginRight: 8 }}>{previewUploadProgress}%</Text> : <Ionicons name="hourglass-outline" size={20} color="#fff" />}
                        <Pressable onPress={() => {
                          // cancel current upload
                          cancelPreviewUpload();
                          try {
                            if (currentPreviewLocalRef.current) {
                              patchOptimistic(currentPreviewLocalRef.current, { pending: false, error: true });
                            }
                          } catch {}
                          setPreviewUploading(false);
                          setPreviewUploadProgress(null);
                          setPreviewUploadError('Upload cancelled');
                        }} style={{ padding: 6 }}>
                          <Text style={{ color: '#ffb4b4', fontWeight: '700' }}>Cancel</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    <Pressable
                      onPress={async () => {
                        if (!viewer) return;
                        if (previewUploading) return;
                        setPreviewUploading(true);
                        setPreviewUploadProgress(0);
                        setPreviewUploadError(null);
                        // create optimistic message
                        const local = createOptimistic({
                          content: previewCaption?.trim() || text?.trim() || '',
                          local_media_uri: viewer.url,
                          media_type: viewer.isVideo ? 'video' : 'image',
                          reply_to_message_id: replyTo?.id || null,
                          replied_to: replyTo ? { id: replyTo.id, content: replyTo.content, sender_name: replyTo.sender?.full_name } : null,
                        });

                        // clear chat input and selected state
                        setText('');
                        setReplyTo(null);
                        setStoryCallout(null);

                        // store local optimistic id so we can cancel/patch if upload aborted
                        currentPreviewLocalRef.current = local.local_id ?? null;
                        try {
                          const uploadedUrl = await uploadToCloudinaryWithProgress(viewer.url, CLOUDINARY_UPLOAD_PRESET, (pct) => setPreviewUploadProgress(pct));
                          const insertObj: any = { conversation_id: convoId, sender_id: profile!.id, content: local.content || '', media_url: uploadedUrl, media_type: viewer.isVideo ? 'video' : 'image', reply_to_message_id: local.reply_to_message_id || null };
                          const { data: inserted, error } = await supabase.from('messages').insert(insertObj).select('id').single();
                          if (error || !inserted?.id) throw error || new Error('No id');
                          confirmOptimisticWithServerId(local.local_id!, inserted.id);
                          try { viewerPanY.setValue(0); } catch {}
                          setViewer(null);
                        } catch (err: any) {
                          console.warn('preview send err', err);
                          patchOptimistic(local.local_id!, { pending: false, error: true });
                          setPreviewUploadError(err?.message || 'Upload failed');
                        } finally {
                          setPreviewUploading(false);
                          setPreviewUploadProgress(null);
                          currentPreviewLocalRef.current = null;
                        }
                      }}
                      style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: '#0ea5e9' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800' }}>{previewUploading ? 'Uploading…' : 'Send'}</Text>
                    </Pressable>
                  </View>
                </View>

                {previewUploadError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
                    <Ionicons name="warning-outline" size={16} color="#ffb4b4" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#ffb4b4' }}>{previewUploadError}</Text>
                    <Pressable 
                      onPress={() => {
                        setPreviewUploadError(null);
                        // User can tap Send again to retry
                      }} 
                      style={{ marginLeft: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Dismiss</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ) : (
            // regular viewer (not a picked preview) — enhanced professional viewer UI
            viewer?.isVideo ? (
              <Animated.View style={{ width: '100%', height: '100%', transform: [{ translateY: viewerTranslateY }] }} {...viewerPanResponder.panHandlers}>
                <Pressable 
                  onPress={toggleViewerControls}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Video
                    ref={viewerVideoRef}
                    source={{ uri: viewer.url }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={viewerAutoPlay}
                    isLooping={false}
                    isMuted={viewerMuted}
                    onPlaybackStatusUpdate={(st: any) => {
                      setViewerBuffering(!!st?.isBuffering);
                      setViewerIsPlaying(!!st?.isPlaying);
                      if (st && typeof st.positionMillis === 'number' && typeof st.durationMillis === 'number') {
                        setViewerProgress({ position: st.positionMillis, duration: st.durationMillis });
                      }
                    }}
                  />
                </Pressable>
                
                {/* Buffering indicator */}
                {viewerBuffering ? (
                  <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                ) : null}
                
                {/* Controls overlay - shows/hides on tap */}
                {viewerShowControls && (
                  <>
                    {/* Top bar with close and actions */}
                    <View style={{ position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, zIndex: 30 }}>
                      <Pressable 
                        onPress={() => { setViewer(null); setViewerProgress(null); }}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Ionicons name="close" size={24} color="#fff" />
                      </Pressable>
                      
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable 
                          onPress={() => setViewerMuted(!viewerMuted)}
                          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name={viewerMuted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
                        </Pressable>
                        <Pressable 
                          onPress={() => shareMedia(viewer.url)}
                          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name="share-outline" size={22} color="#fff" />
                        </Pressable>
                        <Pressable 
                          onPress={() => saveMediaToDevice(viewer.url)}
                          disabled={viewerSaving}
                          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                        >
                          {viewerSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="download-outline" size={22} color="#fff" />
                          )}
                        </Pressable>
                      </View>
                    </View>
                    
                    {/* Center play/pause button */}
                    <Pressable
                      onPress={() => {
                        try {
                          if (viewerIsPlaying) viewerVideoRef.current?.pauseAsync?.().catch(() => {});
                          else viewerVideoRef.current?.playAsync?.().catch(() => {});
                        } catch {}
                      }}
                      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 20 }}
                    >
                      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={viewerIsPlaying ? 'pause' : 'play'} size={36} color="#fff" style={{ marginLeft: viewerIsPlaying ? 0 : 4 }} />
                      </View>
                    </Pressable>
                    
                    {/* Bottom progress bar and time */}
                    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 40, paddingHorizontal: 16, zIndex: 30 }}>
                      {viewerProgress && viewerProgress.duration ? (
                        <View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatTimeMs(viewerProgress.position)}</Text>
                            <Text style={{ color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatTimeMs(viewerProgress.duration)}</Text>
                          </View>
                          <Pressable 
                            onPress={async (e) => {
                              // Seek on tap
                              try {
                                const { locationX, ...rest } = e.nativeEvent;
                                const width = SCREEN_W - 32; // Accounting for padding
                                const percent = Math.max(0, Math.min(1, locationX / width));
                                const seekPos = Math.floor(percent * viewerProgress.duration);
                                await viewerVideoRef.current?.setPositionAsync?.(seekPos);
                              } catch {}
                            }}
                            style={{ height: 20, justifyContent: 'center' }}
                          >
                            <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((viewerProgress.position / Math.max(1, viewerProgress.duration)) * 100)}%`, backgroundColor: '#0ea5e9', borderRadius: 2 }} />
                            </View>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </>
                )}
              </Animated.View>
            ) : (
              // Image viewer
              <Animated.View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', transform: [{ translateY: viewerTranslateY }] }} {...viewerPanResponder.panHandlers}>
                <Pressable 
                  onPress={toggleViewerControls}
                  style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                  <Image
                    source={{ uri: viewer?.url || '' }}
                    style={{ width: '100%', height: '100%', maxWidth: 1200, maxHeight: '100%' }}
                    resizeMode="contain"
                  />
                </Pressable>
                
                {/* Controls overlay for image */}
                {viewerShowControls && (
                  <>
                    {/* Top bar with close and actions */}
                    <View style={{ position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, zIndex: 30 }}>
                      <Pressable 
                        onPress={() => { setViewer(null); }}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Ionicons name="close" size={24} color="#fff" />
                      </Pressable>
                      
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable 
                          onPress={() => shareMedia(viewer?.url || '')}
                          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Ionicons name="share-outline" size={22} color="#fff" />
                        </Pressable>
                        <Pressable 
                          onPress={() => saveMediaToDevice(viewer?.url || '')}
                          disabled={viewerSaving}
                          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                        >
                          {viewerSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="download-outline" size={22} color="#fff" />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </Animated.View>
            )
          )}
        </Animated.View>
      </Modal>

      {/* full-screen map modal when a location preview is tapped */}
      <Modal visible={!!fullMap} transparent animationType="slide" onRequestClose={() => setFullMap(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ position: 'absolute', top: 40, right: 16, zIndex: 40, flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); fullMap && openInMaps(fullMap.latitude, fullMap.longitude, fullMap.title); }} style={{ padding: 8 }}>
              <Ionicons name="open-outline" size={26} color="#fff" />
            </Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setFullMap(null); }} style={{ padding: 8 }}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>

          {fullMap && (
            <MapView
              style={{ flex: 1 }}
              initialRegion={{ latitude: fullMap.latitude, longitude: fullMap.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
            >
              <Marker coordinate={{ latitude: fullMap.latitude, longitude: fullMap.longitude }} title={fullMap.title} />
            </MapView>
          )}
        </View>
      </Modal>

      {/* Header popover */}
      <Modal transparent visible={headerMenuVisible} animationType="fade" onRequestClose={() => setHeaderMenuVisible(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setHeaderMenuVisible(false)}>
          <View style={{ position: "absolute", right: 12, top: insets.top + 56, width: 170 }}>
            <View style={{ padding: 8, borderRadius: 12, backgroundColor: THEME.tint === "dark" ? "rgba(255,255,255,0.02)" : "#fff" }}>
              {/* TODO: Implement startCall logic for audio */}
              <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); }} style={{ paddingVertical: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="call-outline" size={18} color={ui.text} style={{ marginRight: 10 }} />
                <Text style={{ color: ui.text, fontSize: 15 }}>Call</Text>
              </Pressable>
              {/* TODO: Implement startCall logic for video */}
              <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); }} style={{ paddingVertical: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="videocam-outline" size={18} color={ui.text} style={{ marginRight: 10 }} />
                <Text style={{ color: ui.text, fontSize: 15 }}>Video Call</Text>
              </Pressable>
              <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setHeaderMenuVisible(false); }} style={{ paddingVertical: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="close-outline" size={18} color={ui.text} style={{ marginRight: 10 }} />
                <Text style={{ color: ui.text, fontSize: 15 }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );

  // Main chat content to render (shared between wallpaper and non-wallpaper views)
  const chatContent = (
    <>
      {/* Subtle overlay for design, can adjust color/opacity for effect - only when no wallpaper */}
      {!wallpaperUrl && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: THEME.tint === "dark" ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.01)", pointerEvents: 'none' }} />
      )}
      <SafeAreaView style={{ flex: 1 }}>{content}</SafeAreaView>
    </>
  );

  // Render with wallpaper if set, otherwise just theme background
  if (wallpaperUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.bg }}>
        <ImageBackground
          source={{ uri: wallpaperUrl }}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          {/* Dark overlay for better text readability on wallpaper */}
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)' }} />
          {chatContent}
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      {chatContent}
    </View>
  );
}

/* ------------------------------- Styles ------------------------------- */
const styles = StyleSheet.create({
  avatarSmall: { width: 36, height: 36, borderRadius: 18, marginRight: 8, marginBottom: 0, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  avatarWrapShadow: {
    // container providing shadow so avatar remains visible over bright backgrounds
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    borderRadius: 20,
    overflow: "visible",
  },
  bubbleMine: {
    borderRadius: 16,
    minHeight: 48,
    justifyContent: "center",
  },
  bubbleOther: {
    borderRadius: 16,
    minHeight: 48,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  // new cloud-like bubble shared style
  bubbleCloud: {
    borderRadius: 22,
    minHeight: 48,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
    overflow: "visible",
  },
  // simplified bubble styles for Snapchat-like layout
  bubbleMineSimple: {
    borderRadius: 18,
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: "#2f3136",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 6,
  },
  bubbleOtherSimple: {
    borderRadius: 18,
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: "#2f3136",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  bubbleAccent: {
    width: 3,
    borderRadius: 3,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  bubbleAccentMine: {
    backgroundColor: '#0b93f6',
  },
  bubbleAccentOther: {
    backgroundColor: '#12c54a',
  },
  readTiny: { width: 18, height: 18, borderRadius: 9, marginLeft: 6 },
  input: { paddingHorizontal: 0, paddingVertical: Platform.OS === "ios" ? 8 : 10, marginBottom: 0, flex: 1 },
  replyPreviewContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10, marginBottom: 8, backgroundColor: 'transparent' },
  replyQuoteBar: { width: 3, borderRadius: 3, marginRight: 8, alignSelf: 'stretch', backgroundColor: '#12c54a' },
  replyPreviewBody: { flex: 1, minHeight: 30, justifyContent: 'center' },
  replyPreviewSender: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  replyPreviewText: { fontSize: 15, /* color intentionally applied via inline theme-aware styles */ opacity: 0.95 },
  replyCloseBtn: { padding: 6, marginLeft: 8 },

  replyQuotedContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10, marginBottom: 8, overflow: 'hidden', alignSelf: 'stretch', width: '100%' },
  replyQuotedBody: { flex: 1 },
  replyQuotedSender: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  replyQuotedText: { fontSize: 15, opacity: 0.95 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(12,12,12,0.45)", justifyContent: "flex-end", padding: 12 },
  sheetCard: { padding: 12 },
  sheetBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, gap: 10 },
  sheetText: { fontSize: 18 },
  recordingBanner: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff", marginRight: 10 },
  recordingLabel: { color: "#fff", fontWeight: "700", fontSize: 15, marginRight: 12 },
  recordingTimer: { color: "#fff", fontSize: 14, fontVariant: ["tabular-nums"] },
  recordingAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  recordingActionText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  audioPreviewCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, overflow: 'hidden', position: 'relative' },
  audioPreviewPlay: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center' },
  audioPreviewTitle: { fontSize: 15, fontWeight: '700' },
  audioPreviewDuration: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' },
  audioPreviewWave: { marginTop: 8, height: 20, flexDirection: 'row', alignItems: 'flex-end', position: 'relative' },
  audioPreviewBar: { width: 2, borderRadius: 2, marginRight: 2 },
  audioPreviewProgress: { position: 'absolute', bottom: 0, top: 0, left: 0, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  audioPreviewHint: { marginTop: 6, fontSize: 11, fontWeight: '600' },
  audioPreviewActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  audioPreviewActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(76,132,255,0.85)', justifyContent: 'center', alignItems: 'center' },
  micButton: { padding: 8, marginLeft: 8, borderRadius: 18, backgroundColor: 'transparent' },
  micButtonRecording: { backgroundColor: '#ff355e' },
  audioBubbleCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, overflow: 'hidden' },
  audioBubbleCardMine: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  audioBubbleCardOther: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  audioBubblePlay: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.88)' },
  audioBubblePlayMine: { backgroundColor: 'rgba(255,255,255,0.25)' },
  audioBubblePlayOther: { backgroundColor: 'rgba(255,255,255,0.88)' },
  audioBubbleTitle: { fontSize: 15, fontWeight: '700' },
  audioBubbleDuration: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '700' },
  audioBubbleWave: { marginTop: 10, height: 26, flexDirection: 'row', alignItems: 'flex-end', position: 'relative' },
  audioBubbleBar: { width: 3, borderRadius: 3, marginRight: 3 },
  audioBubbleProgress: { position: 'absolute', bottom: 0, top: 0, left: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  audioBubbleHint: { marginTop: 6, fontSize: 11, fontWeight: '600' },
  audioBubbleMore: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  mediaBubblePressable: { borderRadius: 18, overflow: 'hidden' },
  mediaBubbleCard: { borderRadius: 18, padding: 4, borderWidth: 1 },
  mediaBubbleInner: { position: 'relative', overflow: 'hidden', borderRadius: 14 },
  mediaBubbleVideo: { width: '100%', height: 200 },
  mediaBubbleImage: { width: '100%', height: 200 },
  mediaBubbleOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  mediaBubbleLabelRow: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' },
  mediaBubbleLabel: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  // compact media-only style (iMessage style): small edge-to-edge media card with subtle shadow
  mediaOnlyPressable: { borderRadius: 12, overflow: 'hidden' },
  mediaOnlyCard: { borderRadius: 12, overflow: 'hidden', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  mediaOnlyImage: { width: '100%', height: '100%' },
  // callout (story share) styles
  calloutBubble: { borderRadius: 12, flexDirection: 'row', padding: 6, alignItems: 'center' },
  calloutImage: { width: 44, height: 44, borderRadius: 9, marginRight: 6 },
  calloutImageFallback: { width: 44, height: 44, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  calloutLabel: { fontSize: 11, textTransform: 'uppercase', fontWeight: '700', marginBottom: 2 },
  calloutTitle: { fontSize: 13, fontWeight: '700' },
  calloutAuthor: { fontSize: 11, marginTop: 2 },
  // smaller callout text variants for callouts bottom sheet
  calloutTitleSmall: { fontSize: 10, fontWeight: '700' },
  calloutAuthorSmall: { fontSize: 8, marginTop: 1 },
  // compact callouts carousel container (used only for Callouts sheet)
  calloutsSheet: { minHeight: DEFAULT_CALLOUTS_MIN, maxHeight: DEFAULT_CALLOUTS_MAX, paddingBottom: 12 },
  // flyer-style story card (matches story cards on home/profile pages)
  storyFlyerCard: { width: Math.min(460, SCREEN_W * 0.72), aspectRatio: 9 / 16, borderRadius: 14, overflow: 'hidden', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 12 },
  storyFlyerImage: { width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end' },
  // smaller story card variant used in callouts bottom sheet (reduced slightly)
  storyFlyerCardSmall: { width: Math.min(260, SCREEN_W * 0.38), aspectRatio: 9 / 16, borderRadius: 10, overflow: 'hidden', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  storyFlyerImageSmall: { width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden', justifyContent: 'flex-end' },
  storyFlyerMetaSmall: { padding: 3, backgroundColor: 'transparent' },
  storyFlyerOverlay: { ...StyleSheet.absoluteFillObject },
  storyFlyerMeta: { padding: 12, backgroundColor: 'transparent' },
  // story-like message card for in-chat callouts (media-only story card)
  storyMessageCard: { borderRadius: 12, overflow: 'hidden', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  storyMessageImage: { width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end' },
  storyMessageMeta: { padding: 12, backgroundColor: 'transparent' },
  scrollBtn: { position: "absolute", right: 18, bottom: 180, zIndex: 99, backgroundColor: "#0b93f6", padding: 8, borderRadius: 30, shadowColor: "#0b93f6", shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  sendBtn: { backgroundColor: "#0b93f6", width: 46, height: 46, borderRadius: 24, alignItems: "center", justifyContent: "center", shadowColor: "#0b93f6", shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },

  plusPopover: {
    position: "absolute",
    width: 180,
    backgroundColor: "transparent",
    zIndex: 80,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 10,
  },
  popRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, gap: 12, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, marginBottom: 8 },
  popText: { fontSize: 15 },

  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 16,
    backgroundColor: "#0b1220",
    minHeight: 180,
    maxHeight: DEFAULT_CALLOUTS_MAX,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 8 },
  sheetDesc: { color: "rgba(255,255,255,0.8)", marginBottom: 12 },
  sheetClose: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    alignSelf: "flex-end",
  },

  // small shadow helper for icons so they don't disappear on bright backgrounds
  shadowIconContainer: {
    shadowColor: "#000",
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
    borderRadius: 32,
  },

  shotsListContainer: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  shotsListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  shotsHeaderTitle: { fontSize: 16, fontWeight: "800" },
  shotsHeaderHint: { fontSize: 13, fontWeight: "600" },
  shotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  shotRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  shotAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0f172a",
  },
  shotRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  shotRowName: { fontSize: 15, fontWeight: "700" },
  shotRowTime: { fontSize: 12, marginLeft: 8 },
  shotRowSubtitle: { fontSize: 13, fontWeight: "600" },
  shotRowMeta: { fontSize: 12, marginTop: 2 },
  shotViewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  shotViewerCard: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: 9 / 16,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  shotViewerMedia: { flex: 1, width: "100%" },
  shotViewerOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 18 },
  shotViewerMeta: { paddingRight: 48 },
  shotRestoreHint: { fontSize: 12, marginTop: 6, color: "rgba(255,255,255,0.72)" },
  restoreShotBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", alignSelf: "flex-start" },
  restoreShotBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  shotViewerClose: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

});





