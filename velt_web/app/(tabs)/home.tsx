// Home.tsx
import React, { JSX, useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
  PanResponder,
  TouchableOpacity,
  UIManager,
  findNodeHandle,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Reanimated & gesture handler for 60fps overlay interactions
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
  runOnJS,
  // useAnimatedGestureHandler may be absent from some runtime/type setups — we'll check for it at runtime
  cancelAnimation,
} from 'react-native-reanimated';
// try named import (TS might not include it in definitions — ignore types if necessary)
// @ts-ignore
import { useAnimatedGestureHandler as useAnimatedGestureHandlerImported } from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { useDoodleFeatures } from '@/lib/doodleFeatures';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { UserStoriesView } from 'app/explore/user_stories/[userId]';
import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from 'app/themes';
import NetInfo from '@react-native-community/netinfo';
import { useCustomAlert } from '@/components/CustomAlert';

import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { useUploadStore } from '@/lib/store/uploadStore';
import { prefetchUserStories, prefetchLocationPosts, prefetchCommercials, getCachedUserStories } from '@/lib/store/prefetchStore';
import NotificationBanner from 'components/NotificationsBanner';
import TabSwipeContainer from '@/components/TabSwipeContainer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SavedAccount, readSavedAccounts, upsertSavedAccount, deleteSavedAccount } from '@/lib/savedAccounts';
import Svg, { Line } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { getCurrentUserIdAsync } from '@/lib/currentuser';

const { width, height } = Dimensions.get('window');
const IMAGE_STORY_MS = 5000;

const BUSINESS_VISIBILITY_HINTS = new Set(['business', 'commercial', 'plug', 'sponsored', 'ads', 'advert', 'promoted']);
const BUSINESS_ROLE_HINTS = new Set(['business', 'merchant', 'brand', 'vendor', 'company', 'shop', 'store', 'seller', 'advertiser', 'agency', 'plug']);

const storyLooksCommercial = (story: { visibility?: string | null }, profile?: { role?: string | null }) => {
  const vis = typeof story?.visibility === 'string' ? story.visibility.trim().toLowerCase() : '';
  if (vis && BUSINESS_VISIBILITY_HINTS.has(vis)) return true;
  const role = typeof profile?.role === 'string' ? profile.role.trim().toLowerCase() : '';
  if (role && BUSINESS_ROLE_HINTS.has(role)) return true;
  return false;
};

/* -------------- App-level theme hook (selected or system) -------------- */
const LAST_WATCHED_KEY = 'velt:last_watched_story_id';

/* ---------------- Types (kept minimal) ---------------- */
type ProfileLite =
  | { id?: string | null; full_name?: string | null; avatar_url?: string | null; username?: string | null }
  | null;

type Bidding = {
  id: string;
  seller_id: string;
  title: string;
  image_url?: string | null;
  starting_price: number;
  ends_at: string;
  created_at?: string | null;
  seller?: ProfileLite;
};

type Bid = {
  id: string;
  user_id: string;
  item_id: string;
  amount: number;
  created_at?: string | null;
  user?: ProfileLite;
};

type LaunchType = 'bubble' | 'commercial';

type LaunchOverlayState = {
  mediaUrl?: string | null;
  mediaType?: string | null;
  displayName?: string;
  initial: { x: number; y: number; width: number; height: number; borderRadius: number };
  userId?: string | null;
  route: string;
};

type LaunchParams = {
  originRef: View | null;
  route: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  displayName?: string;
  hideKey: string;
  hideType: LaunchType;
  borderRadius: number;
  userId?: string | null;
};

type StoryLaunchOptions = {
  userId: string | null;
  storyId?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  originRef?: View | null;
  hideKey?: string;
  hideType?: LaunchType;
  borderRadius?: number;
  displayName?: string;
};

const isVideo = (mt?: string | null) => (mt || '').startsWith('video');

const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / (24 * 3600e3));
  const h = Math.floor((ms % (24 * 3600e3)) / 3600e3);
  const m = Math.floor((ms % 3600e3) / 60e3);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtMoney = (n?: number | null, c: string = 'GHS') =>
  typeof n === 'number'
    ? `${c.toUpperCase()} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '—';

const fmtDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

/* ---------------- BounceButton (no scale) ---------------- */
const BounceButton: React.FC<{
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  children?: any;
  disabled?: boolean;
  testID?: string;
}> = ({ onPress, onLongPress, style, children, disabled, testID }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const longPressTriggeredRef = useRef(false);

  const pressIn = () => {
    try {
      longPressTriggeredRef.current = false;
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.97, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.92, duration: 120, useNativeDriver: true }),
      ]).start();
    } catch {}
  };

  const pressOut = () => {
    try {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } catch {}
  };

  const handleLongPress = () => {
    if (!onLongPress) return;
    longPressTriggeredRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onLongPress();
  };

  const tap = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    try {
      Haptics.selectionAsync();
    } catch {}
    onPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity }, styles.bigBtn, style, disabled && { opacity: 0.6 }]}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={tap}
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={280}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );

  
};

/* ---------------- AnimatedCard (for story/commercial cards) ---------------- */
// Instagram/Snapchat-style press animation with bouncy spring
const AnimatedCard: React.FC<{
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  children?: any;
  containerStyle?: any;
}> = ({ onPress, onLongPress, style, children, containerStyle }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const longPressTriggeredRef = useRef(false);

  const pressIn = () => {
    try {
      longPressTriggeredRef.current = false;
      // Quick responsive scale - Instagram style
      Animated.spring(scale, { 
        toValue: 0.92, 
        friction: 10, 
        tension: 450, 
        useNativeDriver: true 
      }).start();
    } catch {}
  };

  const pressOut = () => {
    try {
      // Bouncy spring back with overshoot
      Animated.spring(scale, { 
        toValue: 1, 
        friction: 4, 
        tension: 350, 
        useNativeDriver: true 
      }).start();
    } catch {}
  };

  const handleLongPress = () => {
    if (!onLongPress) return;
    longPressTriggeredRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onLongPress();
  };

  const tap = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={tap}
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={350}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

/* ---------------- AllStoriesCarousel (center-focused carousel with scale effect) ---------------- */
const CAROUSEL_CARD_WIDTH = 160;
const CAROUSEL_CARD_HEIGHT = 220;
const CAROUSEL_CARD_SPACING = 14;
const CAROUSEL_SIDE_SCALE = 0.78;
const CAROUSEL_SIDE_OPACITY = 0.55;
const CAROUSEL_SNAP_INTERVAL = CAROUSEL_CARD_WIDTH + CAROUSEL_CARD_SPACING;

// HD Badge component (moved outside for reuse)
const HDBadge = ({ style }: { style?: any }) => (
  <View style={[{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }, style]} pointerEvents="none">
    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11, letterSpacing: 1 }}>HD</Text>
  </View>
);

// Individual carousel card with animated scale/opacity based on scroll position
// Uses ref-based scaling animation like story bubbles
const CarouselCard = React.memo(({ 
  story, 
  index, 
  scrollX, 
  isLastWatched, 
  onPress, 
  onLongPress, 
  timeAgoLabel,
  cardRef,
}: { 
  story: any; 
  index: number; 
  scrollX: Animated.Value; 
  isLastWatched: boolean; 
  onPress: (ref: View | null) => void; 
  onLongPress: () => void; 
  timeAgoLabel: (date: string) => string;
  cardRef?: (ref: View | null) => void;
}) => {
  const viewRef = useRef<View | null>(null);
  
  const inputRange = [
    (index - 1) * CAROUSEL_SNAP_INTERVAL,
    index * CAROUSEL_SNAP_INTERVAL,
    (index + 1) * CAROUSEL_SNAP_INTERVAL,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [CAROUSEL_SIDE_SCALE, 1, CAROUSEL_SIDE_SCALE],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [CAROUSEL_SIDE_OPACITY, 1, CAROUSEL_SIDE_OPACITY],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [12, 0, 12],
    extrapolate: 'clamp',
  });

  const displayName = story.profile?.full_name ?? story.profile?.username ?? story.userId;
  const previewUrl = story.thumbnail_url ?? story.media_url;
  const previewType = story.thumbnail_url ? (story.thumbnail_type ?? 'image') : story.media_type;

  return (
    <Animated.View
      style={{
        width: CAROUSEL_CARD_WIDTH,
        height: CAROUSEL_CARD_HEIGHT,
        marginHorizontal: CAROUSEL_CARD_SPACING / 2,
        transform: [{ scale }, { translateY }],
        opacity,
      }}
    >
      <Pressable
        onPress={() => onPress(viewRef.current)}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => ({ 
          flex: 1, 
          transform: [{ scale: pressed ? 0.96 : 1 }] 
        })}
      >
        <View 
          ref={(ref) => {
            viewRef.current = ref;
            cardRef?.(ref);
          }}
          style={{
            flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#111',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
        }}>
          {previewType === 'video' ? (
            <Video source={{ uri: previewUrl }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
          ) : (
            <Image source={{ uri: previewUrl }} style={{ width: '100%', height: '100%' }} />
          )}

          {/* Watch again badge */}
          {isLastWatched && (
            <View style={{ position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 10 }}>Watch again</Text>
            </View>
          )}

          {/* HD badge */}
          {story.isHD && (
            <View style={{ position: 'absolute', top: 8, left: 8, zIndex: 30 }} pointerEvents="none">
              <HDBadge />
            </View>
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
          />

          {/* Name and time */}
          <View style={{ position: 'absolute', left: 10, right: 10, bottom: 14, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: '#fff',
                fontWeight: '900',
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              {displayName}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4 }}>{timeAgoLabel(story.created_at)}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const AllStoriesCarousel: React.FC<{
  stories: any[];
  lastWatchedStoryId: string | null;
  onStoryPress: (story: any, ref: View | null) => void;
  onStoryLongPress: (story: any) => void;
  timeAgoLabel: (date: string) => string;
}> = ({ stories, lastWatchedStoryId, onStoryPress, onStoryLongPress, timeAgoLabel }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const SIDE_SPACE = (width - CAROUSEL_CARD_WIDTH) / 2;

  if (stories.length === 0) return null;

  return (
    <Animated.FlatList
      data={stories}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CAROUSEL_SNAP_INTERVAL}
      snapToAlignment="start"
      decelerationRate="fast"
      bounces={true}
      contentContainerStyle={{
        paddingHorizontal: SIDE_SPACE - CAROUSEL_CARD_SPACING / 2,
        paddingVertical: 20,
      }}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
      renderItem={({ item, index }) => (
        <CarouselCard
          story={item}
          index={index}
          scrollX={scrollX}
          isLastWatched={lastWatchedStoryId === item.id}
          onPress={(ref) => onStoryPress(item, ref)}
          onLongPress={() => onStoryLongPress(item)}
          timeAgoLabel={timeAgoLabel}
        />
      )}
    />
  );
};

/* ---------------- FocusableLocationRow (animates based on proximity to screen center) ---------------- */
const LOCATION_FOCUS_SCALE = 1.0;
const LOCATION_UNFOCUS_SCALE = 0.88;
const LOCATION_UNFOCUS_OPACITY = 0.6;
const SCREEN_CENTER_Y = height / 2;

const FocusableLocationRow: React.FC<{
  children: React.ReactNode;
  scrollY: Animated.Value;
  index: number;
  rowHeight: number;
  headerOffset: number;
}> = ({ children, scrollY, index, rowHeight, headerOffset }) => {
  // Calculate the approximate Y position of this row in the content
  // Each row's center position relative to content start
  const rowCenterInContent = headerOffset + (index * rowHeight) + (rowHeight / 2);
  
  // The row is "in focus" when its center aligns with screen center
  // scrollY tells us how far we've scrolled
  // When scrollY = rowCenterInContent - SCREEN_CENTER_Y, the row is centered
  const focusPoint = rowCenterInContent - SCREEN_CENTER_Y;
  
  const scale = scrollY.interpolate({
    inputRange: [
      focusPoint - rowHeight * 1.5,
      focusPoint,
      focusPoint + rowHeight * 1.5,
    ],
    outputRange: [LOCATION_UNFOCUS_SCALE, LOCATION_FOCUS_SCALE, LOCATION_UNFOCUS_SCALE],
    extrapolate: 'clamp',
  });

  const opacity = scrollY.interpolate({
    inputRange: [
      focusPoint - rowHeight * 1.5,
      focusPoint,
      focusPoint + rowHeight * 1.5,
    ],
    outputRange: [LOCATION_UNFOCUS_OPACITY, 1, LOCATION_UNFOCUS_OPACITY],
    extrapolate: 'clamp',
  });

  const translateY = scrollY.interpolate({
    inputRange: [
      focusPoint - rowHeight * 1.5,
      focusPoint,
      focusPoint + rowHeight * 1.5,
    ],
    outputRange: [8, -4, 8],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { translateY }],
        opacity,
      }}
    >
      {children}
    </Animated.View>
  );
};

/* ---------------- AnimatedListItem (for chat rows, list items) ---------------- */
const AnimatedListItem: React.FC<{
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  children?: any;
}> = ({ onPress, onLongPress, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const longPressTriggeredRef = useRef(false);

  const pressIn = () => {
    try {
      longPressTriggeredRef.current = false;
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.98, friction: 8, tension: 400, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    } catch {}
  };

  const pressOut = () => {
    try {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 400, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    } catch {}
  };

  const handleLongPress = () => {
    if (!onLongPress) return;
    longPressTriggeredRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onLongPress();
  };

  const tap = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    try {
      Haptics.selectionAsync();
    } catch {}
    onPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={tap}
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={350}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

/* ---------------- AnimatedTabButton (for filter tabs) ---------------- */
const AnimatedTabButton: React.FC<{
  onPress?: () => void;
  isActive?: boolean;
  label: string;
  colors: any;
}> = ({ onPress, isActive, label, colors }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    try {
      Animated.spring(scale, { toValue: 0.92, friction: 8, tension: 400, useNativeDriver: true }).start();
    } catch {}
  };

  const pressOut = () => {
    try {
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 400, useNativeDriver: true }).start();
    } catch {}
  };

  const tap = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    onPress?.();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={tap}
        style={{
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: isActive ? colors.accent : colors.border,
          backgroundColor: isActive ? colors.faint : 'transparent',
        }}
      >
        <Text style={{ color: isActive ? colors.accent : colors.subtext, fontWeight: '800' }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

/* ---------------- Simple Media (image/video) ---------------- */
type VideoHandle = InstanceType<typeof Video>;

const Media: React.FC<{
  uri: string;
  type?: string | null;
  paused?: boolean;
  style?: any;
  onReady?: (dur?: number) => void;
  onEnd?: () => void;
}> = ({ uri, type, paused, style, onReady, onEnd }) => {
  const ref = useRef<VideoHandle | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (isVideo(type) && ref.current) {
          if (paused) await ref.current.pauseAsync();
          else await ref.current.playAsync();
        }
      } catch {}
    })();
  }, [paused, type]);

  if (isVideo(type)) {
    // doodle flags don't belong in Media; rendering decisions happen in the parent Home component

    // doodles handled in Home scope; Media just renders media

    // (moved to Home scope)

    return (
      <Video
        ref={(node: VideoHandle | null) => {
          ref.current = node;
        }}
        source={{ uri }}
        style={style}
        resizeMode={ResizeMode.COVER}
        shouldPlay={true}
        isLooping
        isMuted
        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (typeof status.durationMillis === 'number') onReady?.(status.durationMillis);
          if (status.didJustFinish) onEnd?.();
        }}
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onLoadEnd={() => onReady?.(IMAGE_STORY_MS)}
    />
  );
};

/* ------------------------- MAIN HOME ------------------------- */
export default function Home(): JSX.Element {
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();
  const { showAlert } = useCustomAlert();
  const { profile, loadProfile, setProfile } = useProfileStore();
  const activeUploadJob = useUploadStore((state) => {
    if (state.currentJobId && state.jobs[state.currentJobId]) {
      return state.jobs[state.currentJobId];
    }
    return null;
  });
  const clearUploadJob = useUploadStore((state) => state.clearJob);

  const dismissUploadBanner = useCallback(() => {
    if (activeUploadJob?.id) {
      clearUploadJob(activeUploadJob.id);
    }
  }, [activeUploadJob, clearUploadJob]);

  const uploadBannerProgress = useMemo(() => {
    if (!activeUploadJob) return 0;
    return Math.min(100, Math.max(0, activeUploadJob.progress));
  }, [activeUploadJob]);

  const openUploadScreen = useCallback(() => {
    if (!activeUploadJob) return;
    try {
      router.push({ pathname: '/explore/upload_story', params: { jobId: activeUploadJob.id } });
    } catch {}
  }, [activeUploadJob, router]);

  // show the floating scroll-to-top button only when not at/near top

  // app-center banner from DB (dismissable)
  const [appBannerText, setAppBannerText] = useState<string | null>(null);
  const [showAppBanner, setShowAppBanner] = useState(true);

  // network status
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [showOfflineHeader, setShowOfflineHeader] = useState(false);
  const offlineHeaderTimeoutRef = useRef<any>(null);

  // Sheet pan responder
  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => {
        return Math.abs(g.dy) > 6 && g.dy > 0;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: () => {},
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || (g.vy > 1.0 && g.dy > 40)) {
          closeSheet();
        }
      },
    })
  ).current;

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.id) {
        try {
          await loadProfile(session.user.id);
        } catch {}
      } else {
        setProfile(null);
      }
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data?.session?.user?.id;
      if (uid) await loadProfile(uid);
    })();
    return () => {
      try {
        // @ts-ignore
        sub.data?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, [loadProfile, setProfile]);

  /* ---------------- Local state ----------------- */
  const [unreadCount, setUnreadCount] = useState(0);
  const [banner, setBanner] = useState<{ visible: boolean; title?: string; body?: string; onPress?: () => void }>({ visible: false });

  // sheet / quick account UI state
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(1)).current; // 1 = hidden, 0 = visible
  const SHEET_MAX = Math.min(520, height * 0.85);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [quickSwitchingId, setQuickSwitchingId] = useState<string | null>(null);
  const [savingQuickAccount, setSavingQuickAccount] = useState(false);

  // Create menu popup state
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuAnim = useRef(new Animated.Value(0)).current;
  const toggleCreateMenu = useCallback(() => {
    if (showCreateMenu) {
      Animated.timing(createMenuAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowCreateMenu(false));
    } else {
      setShowCreateMenu(true);
      Animated.spring(createMenuAnim, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
    }
  }, [showCreateMenu, createMenuAnim]);

  // Profile preview sheet state (long-press on story bubble)
  type ProfilePreviewData = {
    userId: string;
    fullName?: string | null;
    username?: string | null;
    avatar?: string | null;
    bio?: string | null;
    profession?: string | null;
  };
  const [profilePreview, setProfilePreview] = useState<ProfilePreviewData | null>(null);
  const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
  const profilePreviewAnim = useRef(new Animated.Value(0)).current;
  const [profilePreviewFollowing, setProfilePreviewFollowing] = useState(false);
  const [profilePreviewLoading, setProfilePreviewLoading] = useState(false);
  const [profilePreviewFollowLoading, setProfilePreviewFollowLoading] = useState(false);

  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const qrModalAnim = useRef(new Animated.Value(0)).current;
  const qrPulseAnim = useRef(new Animated.Value(1)).current;

  const openQRModal = useCallback(() => {
    setShowQRModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(qrModalAnim, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
    // Start pulsing animation for gold background
    Animated.loop(
      Animated.sequence([
        Animated.timing(qrPulseAnim, { toValue: 1.15, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(qrPulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [qrModalAnim, qrPulseAnim]);

  const closeQRModal = useCallback(() => {
    Animated.timing(qrModalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowQRModal(false);
      qrPulseAnim.stopAnimation();
      qrPulseAnim.setValue(1);
    });
  }, [qrModalAnim, qrPulseAnim]);

  const openProfilePreview = useCallback(async (userId: string, initialData?: Partial<ProfilePreviewData>) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    
    // Set initial data immediately for fast UI
    setProfilePreview({
      userId,
      fullName: initialData?.fullName ?? null,
      username: initialData?.username ?? null,
      avatar: initialData?.avatar ?? null,
      bio: null,
      profession: null,
    });
    setProfilePreviewVisible(true);
    setProfilePreviewLoading(true);
    
    // Animate in
    Animated.spring(profilePreviewAnim, {
      toValue: 1,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
    
    // Fetch full profile data
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio, profession')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setProfilePreview({
          userId,
          fullName: profileData.full_name,
          username: profileData.username,
          avatar: profileData.avatar_url,
          bio: profileData.bio,
          profession: profileData.profession,
        });
      }
      
      // Check follow status
      if (profile?.id && profile.id !== userId) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', profile.id)
          .eq('following_id', userId)
          .maybeSingle();
        setProfilePreviewFollowing(!!followData);
      }
    } catch (err) {
      console.warn('Failed to load profile preview:', err);
    } finally {
      setProfilePreviewLoading(false);
    }
  }, [profile?.id, profilePreviewAnim]);

  const closeProfilePreview = useCallback(() => {
    Animated.timing(profilePreviewAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setProfilePreviewVisible(false);
      setProfilePreview(null);
      setProfilePreviewFollowing(false);
    });
  }, [profilePreviewAnim]);

  const handleProfilePreviewFollow = useCallback(async () => {
    if (!profile?.id || !profilePreview?.userId || profilePreviewFollowLoading) return;
    
    setProfilePreviewFollowLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    
    try {
      if (profilePreviewFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', profile.id)
          .eq('following_id', profilePreview.userId);
        setProfilePreviewFollowing(false);
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({ follower_id: profile.id, following_id: profilePreview.userId });
        setProfilePreviewFollowing(true);
      }
    } catch (err) {
      console.warn('Follow toggle failed:', err);
    } finally {
      setProfilePreviewFollowLoading(false);
    }
  }, [profile?.id, profilePreview?.userId, profilePreviewFollowing, profilePreviewFollowLoading]);

  const handleProfilePreviewShare = useCallback(async () => {
    if (!profilePreview) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { Share } = await import('react-native');
      await Share.share({
        message: `Check out ${profilePreview.fullName ?? profilePreview.username ?? 'this user'}'s profile on VELT!`,
        url: `velt://profile/${profilePreview.userId}`,
      });
    } catch {}
  }, [profilePreview]);

  const handleProfilePreviewViewProfile = useCallback(() => {
    if (!profilePreview?.userId) return;
    closeProfilePreview();
    router.push(`/profile/view/${profilePreview.userId}`);
  }, [profilePreview?.userId, closeProfilePreview, router]);

  // refresh & header animation
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const pull = Animated.multiply(scrollY, -1);
  const headerExtra = pull.interpolate({ inputRange: [0, 120], outputRange: [0, 60], extrapolate: 'clamp' });
  const pullProgress = pull.interpolate({ inputRange: [0, 120], outputRange: [0, 1], extrapolate: 'clamp' });

  const HEADER_HEIGHT = 132;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT / 2, HEADER_HEIGHT],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const scrollRef = useRef<any>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastShowScrollTopRef = useRef<boolean>(false);
  
  // Content fade-in animation for smooth initial appearance
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const [contentReady, setContentReady] = useState(false);
  const scrollToTop = useCallback(() => {
    try {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      try {
        scrollRef.current?.getNode?.()?.scrollTo?.({ y: 0, animated: true });
      } catch {}
    }
    // hide scroll-to-top after scrolling
    try {
      lastShowScrollTopRef.current = false;
      setShowScrollTop(false);
    } catch {}
  }, []);
  const openExploreSearch = useCallback(() => {
    try {
      router.push('/explore');
    } catch {}
  }, [router]);

  // Decorative deep doodles for Home background (theme linked, no fade-out)
  const [reduceMotion, setReduceMotion] = useState(false);
  const doodleA = useRef(new Animated.Value(0)).current;
  const doodleB = useRef(new Animated.Value(0)).current;
  const doodleC = useRef(new Animated.Value(0)).current;
  const doodleAnimRef = useRef<any>(null);
  const doodleStatusRef = useRef<'idle'|'running'|'stopped'>('idle');
  const { enabled: doodlesEnabled, loaded: doodleLoaded } = useDoodleFeatures('home');

  // Cold color glow animation for tabs during loading
  const tabGlowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((isReduced) => {
        setReduceMotion(isReduced);
      })
      .catch(() => setReduceMotion(false));
  }, []);

  const startDoodleLoop = useCallback(() => {
    if (reduceMotion) return;
    if (doodleAnimRef.current) {
      try { doodleAnimRef.current.stop?.(); } catch {}
      doodleAnimRef.current = null;
    }
    try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {}

    try {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([Animated.timing(doodleA, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleA, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
          Animated.sequence([Animated.delay(400), Animated.timing(doodleB, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleB, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
          Animated.sequence([Animated.delay(900), Animated.timing(doodleC, { toValue: 1, duration: 10000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(doodleC, { toValue: 0, duration: 10000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
        ])
      );
      doodleAnimRef.current = loop;
      doodleStatusRef.current = 'running';
      loop.start();
    } catch (e) {
      doodleAnimRef.current = null;
    }
  }, [doodleA, doodleB, doodleC, reduceMotion]);

  const stopDoodleLoop = useCallback(() => {
    try { doodleAnimRef.current?.stop?.(); } catch {}
    doodleAnimRef.current = null;
    doodleStatusRef.current = 'stopped';
    try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {}
  }, [doodleA, doodleB, doodleC]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((isReduced) => {
        if (!mounted) return;
        setReduceMotion(isReduced);
        if (!isReduced && doodleLoaded && doodlesEnabled) startDoodleLoop();
      })
      .catch(() => setReduceMotion(false));

    return () => { mounted = false; stopDoodleLoop(); doodleAnimRef.current = null; };
  }, [doodleLoaded, doodlesEnabled, startDoodleLoop, stopDoodleLoop]);

  useFocusEffect(
    useCallback(() => {
      if (doodleLoaded && doodlesEnabled && !reduceMotion) startDoodleLoop();
      return () => stopDoodleLoop();
    }, [doodleLoaded, doodlesEnabled, reduceMotion, startDoodleLoop, stopDoodleLoop])
  );

  useEffect(() => {
    if (!doodleLoaded) return;
    if (!doodlesEnabled) {
      stopDoodleLoop();
    } else {
      if (!reduceMotion) startDoodleLoop();
    }
  }, [doodlesEnabled, doodleLoaded, reduceMotion, startDoodleLoop, stopDoodleLoop]);

  // derived flags for rendering doodles in the UI
  // When doodlesEnabled is false, hide doodles completely (don't show static either)
  const showAnimatedDoodles = Boolean(doodlesEnabled) && !reduceMotion;
  const showStaticDoodles = Boolean(doodlesEnabled) && reduceMotion; // Only show static if enabled AND reduce motion is on

  /* ----------------- STORIES (first on screen) ----------------- */
  const PLACEHOLDER_AVATAR = "https://api.dicebear.com/7.x/identicon/png?seed=anon&backgroundType=gradientLinear";
  const CLOUDINARY_CLOUD = "dpejjmjxg";

  const [storiesGrouped, setStoriesGrouped] = useState<any[]>([]);
  const [flatStories, setFlatStories] = useState<any[]>([]);
  const [flatBusinessStories, setFlatBusinessStories] = useState<any[]>([]);
  const [derivedBusinessStories, setDerivedBusinessStories] = useState<any[]>([]);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [businessStoriesLoading, setBusinessStoriesLoading] = useState(false);

  /* ----------------- LOCATION POSTS (replaces Commercials) ----------------- */
  type LocationPost = {
    id: string;
    place: string;
    images: string[];
    videos: string[];
    media_type: string;
    avatar: string;
    authorId?: string | null;
    stars?: number;
    country: string;
    caption?: string | null;
    created_at?: string | null;
    authorName?: string | null;
  };
  const [locationPosts, setLocationPosts] = useState<LocationPost[]>([]);
  const [locationPostsLoading, setLocationPostsLoading] = useState(false);
  const [locationStarred, setLocationStarred] = useState<Record<string, boolean>>({});

  // Toggle star on location post
  const handleToggleLocationStar = useCallback(async (postId: string) => {
    Haptics.selectionAsync().catch(() => {});
    const wasStarred = !!locationStarred[postId];
    
    // Optimistic update
    setLocationStarred((prev) => ({ ...prev, [postId]: !wasStarred }));
    setLocationPosts((prev) => 
      prev.map((p) => p.id === postId ? { ...p, stars: (p.stars ?? 0) + (wasStarred ? -1 : 1) } : p)
    );
    
    try {
      const me = await getCurrentUserIdAsync();
      if (!me) throw new Error('not-signed-in');
      
      const { data: rpcData, error } = await supabase.rpc('toggle_location_post_star', { 
        p_post_id: postId, 
        p_user_id: me 
      });
      
      if (error) throw error;
      
      // Parse star count from RPC response
      let newCount: number | null = null;
      if (rpcData != null) {
        if (typeof rpcData === 'number' || typeof rpcData === 'string') newCount = Number(rpcData);
        else if (Array.isArray(rpcData)) {
          const first = rpcData[0];
          if (typeof first === 'number' || typeof first === 'string') newCount = Number(first);
          else if (first && typeof first === 'object' && 'star_count' in first) newCount = Number(first.star_count ?? null);
        } else if (rpcData && typeof rpcData === 'object' && 'star_count' in rpcData) newCount = Number(rpcData.star_count ?? null);
      }
      
      if (newCount !== null) {
        setLocationPosts((prev) => prev.map((p) => p.id === postId ? { ...p, stars: newCount } : p));
      }
      
      // Verify starred state from DB
      const { data: meStars } = await supabase
        .from('location_post_stars')
        .select('location_post_id')
        .eq('user_id', me)
        .eq('location_post_id', postId)
        .limit(1);
      setLocationStarred((prev) => ({ ...prev, [postId]: (meStars ?? []).length > 0 }));
    } catch (err) {
      console.warn('[home] location star toggle error', err);
      // Rollback on error
      setLocationStarred((prev) => ({ ...prev, [postId]: wasStarred }));
      setLocationPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, stars: (p.stars ?? 0) + (wasStarred ? 1 : -1) } : p)
      );
    }
  }, [locationStarred]);

  // Cold glow animation for tabs during loading
  const tabGlowAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    const isLoading = storiesLoading || businessStoriesLoading || refreshing;
    if (isLoading) {
      // Start pulsing cold glow animation
      tabGlowAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(tabGlowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(tabGlowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
      tabGlowAnimRef.current.start();
    } else {
      // Stop animation and reset
      tabGlowAnimRef.current?.stop();
      tabGlowAnim.setValue(0);
    }
    return () => {
      tabGlowAnimRef.current?.stop();
    };
  }, [storiesLoading, businessStoriesLoading, refreshing, tabGlowAnim]);

  // replaced Animated.Value launch animation with reanimated portal overlay ref
  const overlayRef = useRef<PortalOverlayHandle | null>(null);
  const [activeLaunch, setActiveLaunch] = useState<{ type: LaunchType; key: string } | null>(null);
  const [launchOverlay, setLaunchOverlay] = useState<LaunchOverlayState | null>(null);
  const overlayOpenRef = useRef(false);
  const closeOverlay = useCallback(() => {
    // Request a measured close animation from parent. We compute target bubble
    // frame (if visible) and instruct the overlay to animate into that frame.
    overlayOpenRef.current = false;
    (async () => {
      try {
        const key = activeLaunch?.key;
        let node: View | null | undefined = null;
        if (activeLaunch?.type === 'bubble') node = bubbleRefs.current.get(key as string);
        else node = commercialRefs.current.get(key as string);

        const measureAndClose = (x?: number, y?: number, w?: number, h?: number) => {
          if (typeof x === 'number' && typeof y === 'number' && typeof w === 'number' && typeof h === 'number' && w > 4 && h > 4) {
            return overlayRef.current?.closeToFrame({ x, y, width: w, height: h, borderRadius: 12 }) ?? Promise.resolve();
          }
          return overlayRef.current?.closeToFrame(null) ?? Promise.resolve();
        };

        if (node) {
          const handle = findNodeHandle(node);
          if (handle) {
            await new Promise<void>((resolve) => {
              try {
                // @ts-ignore UIManager types vary between platforms
                UIManager.measureInWindow(handle, (x: number, y: number, w: number, h: number) => {
                  console.log('[home] close measure for overlay target', { x, y, w, h });
                  measureAndClose(x, y, w, h).then(() => resolve()).catch(() => resolve());
                });
              } catch (err) {
                resolve();
              }
            });
          } else {
            await overlayRef.current?.closeToFrame(null);
          }
        } else {
          await overlayRef.current?.closeToFrame(null);
        }
      } catch (e) {
        try {
          await overlayRef.current?.closeToFrame(null);
        } catch {}
      } finally {
        setLaunchOverlay(null);
        setActiveLaunch(null);
      }
    })();
  }, [activeLaunch]);
  const bubbleRefs = useRef<Map<string, View | null>>(new Map());
  const commercialRefs = useRef<Map<string, View | null>>(new Map());

  // blinking state for updated story groups: map userId -> boolean
  const [blinkMap, setBlinkMap] = useState<Record<string, boolean>>({});
  // last watched story id (persisted)
  const [lastWatchedStoryId, setLastWatchedStoryId] = useState<string | null>(null);

  // followings set (ids the current user follows)
  const [followingsSet, setFollowingsSet] = useState<Set<string>>(new Set());

  const startStoryTransition = useCallback(
    (params: LaunchParams) => {
      if (launchOverlay) return;
      const { originRef, route, mediaUrl, mediaType, displayName, hideKey, hideType, borderRadius, userId } = params;
      if (!originRef) {
        router.push(route);
        return;
      }
      const handle = findNodeHandle(originRef);
      if (!handle) {
        router.push(route);
        return;
      }
      try {
        UIManager.measureInWindow(handle, (x, y, widthVal, heightVal) => {
          if (!widthVal || !heightVal) {
            router.push(route);
            return;
          }
              setActiveLaunch({ type: hideType, key: hideKey });
              setLaunchOverlay({
            mediaUrl,
            mediaType,
            displayName,
            initial: { x, y, width: widthVal, height: heightVal, borderRadius },
            userId: userId ?? null,
                route,
          });
              // overlay component owns the open animation (UI-thread via Reanimated)
              Haptics.selectionAsync().catch(() => {});
              overlayOpenRef.current = true;
        });
      } catch (err) {
        console.warn('[home] startStoryTransition measure err', err);
        router.push(route);
      }
    },
    [launchOverlay, router]
  );

  // evaluate app_center banner on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_center').select('banner_text').maybeSingle();
        if (data && typeof data.banner_text === 'string' && data.banner_text.trim().length > 0) {
          setAppBannerText(String(data.banner_text));
        } else {
          setAppBannerText(null);
        }
      } catch (e) {
        console.warn('[home] fetch app_center banner', e);
      }
    })();
  }, []);

  

  function buildCloudinaryUrl(publicIdOrUrl: unknown, mediaType: "image" | "video"): string | null {
    if (publicIdOrUrl == null) return null;
    try {
      if (typeof publicIdOrUrl === "string" && publicIdOrUrl.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(publicIdOrUrl);
          if (Array.isArray(parsed) && parsed.length > 0) return buildCloudinaryUrl(parsed[0], mediaType);
        } catch {}
      }
      const s = String(publicIdOrUrl).trim();
      if (!s) return null;
      if (s.startsWith("http://") || s.startsWith("https://")) return s;
      const resource = mediaType === "video" ? "video" : "image";
      return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/${resource}/upload/f_auto,q_auto/${s}`;
    } catch {
      return null;
    }
  }

  /* ----------------- fetchRecentChats (moved above handleRefresh) ----------------- */
  type RecentChat = {
    id: string;
    is_group: boolean;
    title?: string | null;
    avatar_url?: string | null;
    otherUser?: { id: string; full_name?: string | null; avatar_url?: string | null; username?: string | null } | null;
    last_message?: { id: string; sender_id: string; content: string; created_at: string } | null;
  };
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const fetchRecentChats = useCallback(async (background = false) => {
    if (!profile?.id) return;
    try {
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', profile.id);

      const convoIds = (parts || []).map((p: any) => p.conversation_id).filter(Boolean);
      if (!convoIds.length) {
        setRecentChats([]);
        return;
      }

      const { data: convos } = await supabase
        .from('conversations')
        .select('id, is_group, title, avatar_url, created_at')
        .in('id', convoIds);

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false });

      const lastMap = new Map<string, RecentChat['last_message']>();
      (msgs || []).forEach((m: any) => {
        if (!lastMap.has(m.conversation_id)) {
          lastMap.set(m.conversation_id, {
            id: m.id,
            sender_id: m.sender_id,
            content: m.content,
            created_at: m.created_at,
          });
        }
      });

      const dmConvos = (convos || []).filter((c: any) => !c.is_group).map((c: any) => c.id);
      const otherUserMap = new Map<string, { id: string; full_name?: string | null; avatar_url?: string | null; username?: string | null } | null>();
      if (dmConvos.length) {
        const { data: dmParts } = await supabase
          .from('conversation_participants')
          .select('conversation_id, user_id, profiles(id, full_name, avatar_url, username)')
          .in('conversation_id', dmConvos);

        const byConvo: Record<string, any[]> = {};
        (dmParts || []).forEach((r: any) => {
          if (!byConvo[r.conversation_id]) byConvo[r.conversation_id] = [];
          byConvo[r.conversation_id].push(r);
        });

        Object.entries(byConvo).forEach(([cid, rows]) => {
          const other = (rows as any[]).find((r) => r.user_id !== profile.id);
          otherUserMap.set(
            cid,
            other?.profiles
              ? { id: other.profiles.id, full_name: other.profiles.full_name, avatar_url: other.profiles.avatar_url, username: other.profiles.username }
              : null
          );
        });
      }

      const assembled: RecentChat[] = (convos || []).map((c: any) => ({
        id: c.id,
        is_group: c.is_group,
        title: c.title,
        avatar_url: c.avatar_url,
        otherUser: c.is_group ? null : otherUserMap.get(c.id) ?? null,
        last_message: lastMap.get(c.id) || null,
      }));

      assembled.sort((a, b) => {
        const aT = a.last_message?.created_at ?? (a as any).created_at ?? '';
        const bT = b.last_message?.created_at ?? (b as any).created_at ?? '';
        return new Date(bT).getTime() - new Date(aT).getTime();
      });

      setRecentChats(assembled.slice(0, 5));
    } catch (err) {
      console.warn('[home] fetchRecentChats err', err);
      setRecentChats([]);
    }
  }, [profile?.id]);

  // background refresh recent chats every 10s while user is signed in
  useEffect(() => {
    let timer: any = null;
    if (profile?.id) {
      // initial fetch (silently) then poll
      fetchRecentChats(true).catch(() => {});
      timer = setInterval(() => {
        fetchRecentChats(true).catch(() => {});
      }, 10_000);
    }
    return () => {
      try {
        if (timer) clearInterval(timer);
      } catch {}
    };
  }, [profile?.id, fetchRecentChats]);

  /* ----------------- Biddings & helper (move above handleRefresh) ----------------- */
  const [showBiddings, setShowBiddings] = useState(false);
  const [biddings, setBiddings] = useState<Bidding[]>([]);
  const [loadingBiddings, setLoadingBiddings] = useState(false);
  const [topBidMap, setTopBidMap] = useState<Record<string, Bid | null>>({});
  const [bidLists, setBidLists] = useState<Record<string, Bid[]>>({});
  const [bidInput, setBidInput] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!showBiddings) return;
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, [showBiddings]);

  const fetchBidsForItems = useCallback(async (itemIds: string[]) => {
    if (!itemIds.length) {
      setTopBidMap({});
      setBidLists({});
      return;
    }
    try {
      const { data: bids, error } = await supabase
        .from('bids')
        .select('id, user_id, item_id, amount, created_at')
        .in('item_id', itemIds)
        .order('amount', { ascending: false });

      if (error) {
        setTopBidMap({});
        setBidLists({});
        return;
      }

      const top: Record<string, Bid | null> = {};
      const lists: Record<string, Bid[]> = {};
      (bids || []).forEach((b: any) => {
        const it = b.item_id as string;
        if (!top[it] || b.amount > (top[it] as any).amount) top[it] = b as Bid;
        const arr = (lists[it] || []) as Bid[];
        arr.push(b as Bid);
        lists[it] = arr;
      });
      Object.keys(lists).forEach((k) => {
        lists[k] = lists[k]
          .sort(
            (a, z) =>
              z.amount - a.amount ||
              new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime()
          )
          .slice(0, 5);
      });

      setTopBidMap(top);
      setBidLists(lists);
    } catch (e) {
      setTopBidMap({});
      setBidLists({});
    }
  }, []);

  const loadBiddings = useCallback(async () => {
    setLoadingBiddings(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('auction_items')
        .select('id, seller_id, title, image_url, starting_price, ends_at, created_at')
        .gt('ends_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        setBiddings([]);
        setTopBidMap({});
        setBidLists({});
        return;
      }
      const items = (data || []) as Bidding[];

      const sellerIds = Array.from(new Set(items.map((i) => i.seller_id)));
      if (sellerIds.length) {
        const { data: p } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', sellerIds);
        const map: Record<string, ProfileLite> = {};
        (p || []).forEach((pr: any) => (map[pr.id] = { id: pr.id, full_name: pr.full_name, avatar_url: pr.avatar_url }));
        items.forEach((it) => (it.seller = map[it.seller_id] || null));
      }
      setBiddings(items);

      await fetchBidsForItems(items.map((i) => i.id));
    } catch (e) {
      setBiddings([]);
      setTopBidMap({});
      setBidLists({});
    } finally {
      setLoadingBiddings(false);
    }
  }, [fetchBidsForItems]);

  /* ---------------- data fetchers (stories & business stories) ----------------- */
  const fetchStories = useCallback(async (background = false) => {
    if (!background) setStoriesLoading(true);
    try {
      const nowMs = Date.now();
      const { data: storyRows, error: storyErr } = await supabase
        .from("stories")
        .select("id, user_id, media_url, media_type, duration, created_at, expire_at, visibility, is_deleted, thumbnail_url, thumbnail_type, is_hd")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (storyErr) {
        setStoriesGrouped([]);
        setFlatStories([]);
        setDerivedBusinessStories([]);
        return;
      }

      const activeRows = (storyRows || []).filter((r: any) => {
        if (!r.expire_at) return true;
        try {
          return new Date(r.expire_at).getTime() > nowMs;
        } catch { return true; }
      });

      const items = (activeRows || []).map((r: any) => {
        const mediaType: "image" | "video" = r.media_type === "video" ? "video" : "image";
        const built = buildCloudinaryUrl(r.media_url, mediaType) ?? (typeof r.media_url === "string" ? r.media_url : "");
        // Process thumbnail URL if present
        const thumbnailType = r.thumbnail_type ?? null;
        const thumbnailUrl = r.thumbnail_url 
          ? (buildCloudinaryUrl(r.thumbnail_url, thumbnailType === "video" ? "video" : "image") ?? r.thumbnail_url)
          : null;
        return {
          id: r.id,
          user_id: r.user_id,
          media_url: built,
          raw_media_url: r.media_url,
          media_type: mediaType,
          duration: r.duration ?? null,
          created_at: r.created_at,
          expire_at: r.expire_at ?? null,
          is_deleted: r.is_deleted,
          visibility: r.visibility ?? null,
          thumbnail_url: thumbnailUrl,
          thumbnail_type: thumbnailType,
          isHD: Boolean(r.is_hd),
        };
      });

      const userIds = Array.from(new Set(items.map((it) => it.user_id).filter(Boolean)));
      if (userIds.length === 0) {
        setStoriesGrouped([]);
        setFlatStories([]);
        setDerivedBusinessStories([]);
        return;
      }

      const { data: profRows } = await supabase.from("profiles").select("id, username, full_name, avatar_url, role").in("id", userIds);
      const profilesMap: Record<string, any> = {};
      (profRows || []).forEach((p: any) => (profilesMap[p.id] = { ...p, avatar_url: p.avatar_url ?? PLACEHOLDER_AVATAR }));
      const groupsMap: Record<string, { profile: any; stories: any[] }> = {};
      const businessMirror: any[] = [];

      for (const it of items) {
        const uid = it.user_id;
        const prof = profilesMap[uid] ?? { id: uid, username: undefined, full_name: undefined, avatar_url: PLACEHOLDER_AVATAR, role: null };
        const normalizedMedia = it.media_url && it.media_url.length > 0 ? it.media_url : typeof it.raw_media_url === "string" && it.raw_media_url.length > 0 ? String(it.raw_media_url) : null;
        if (!normalizedMedia) continue;
        const decorated = { ...it, media_url: normalizedMedia, userId: uid, profile: prof };

        if (storyLooksCommercial(it, prof)) {
          businessMirror.push(decorated);
          continue;
        }

        if (!groupsMap[uid]) {
          groupsMap[uid] = { profile: prof, stories: [] };
        }
        groupsMap[uid].stories.push(decorated);
      }

      let arr = Object.entries(groupsMap).map(([userId, v]) => {
        v.stories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const prof = { ...v.profile, avatar_url: v.profile.avatar_url ?? PLACEHOLDER_AVATAR };
        return { userId, profile: prof, stories: v.stories, hasUnseen: false };
      }).filter((g) => g.stories.length > 0)
        .sort((a, b) => {
          const aLast = a.stories[a.stories.length - 1]?.created_at ?? "";
          const bLast = b.stories[b.stories.length - 1]?.created_at ?? "";
          return new Date(bLast).getTime() - new Date(aLast).getTime();
        });

      // blink detection: compare incoming group ids to previous -> blink newly added or updated groups subtly
      setStoriesGrouped((prev) => {
        try {
          const prevIds = new Set(prev.map((p) => p.userId));
          const newIds = arr.map((a2) => a2.userId);
          const newOnes: string[] = [];
          for (const id of newIds) {
            if (!prevIds.has(id)) newOnes.push(id);
          }
          // set blink true for each new id briefly
          if (newOnes.length) {
            setBlinkMap((bm) => {
              const next = { ...bm };
              newOnes.forEach((nid) => (next[nid] = true));
              return next;
            });
            // clear after 900ms
            setTimeout(() => {
              setBlinkMap((bm) => {
                const next = { ...bm };
                newOnes.forEach((nid) => delete next[nid]);
                return next;
              });
            }, 900);
          }
        } catch {}
        return arr;
      });

      setFlatStories(arr.flatMap((g: any) => g.stories.map((s: any) => ({ ...s, userId: g.userId, profile: g.profile }))));
      setDerivedBusinessStories(businessMirror.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()));

    } catch (err) {
      console.warn('[home] fetchStories err', err);
    } finally {
      if (!background) setStoriesLoading(false);
    }
  }, []);

  const fetchBusinessStories = useCallback(async (background = false) => {
    if (!background) setBusinessStoriesLoading(true);
    try {
      const nowMs = Date.now();
      const { data: rows, error } = await supabase
        .from("business_stories")
        .select(
          `id, user_id, caption, media_url, media_urls, media_type, duration, created_at, expire_at, visibility, is_deleted, label, location, music_title, thumbnail_url, thumbnail_type, is_hd`
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) {
        setFlatBusinessStories([]);
        return;
      }

      const activeRows = (rows || []).filter((r: any) => {
        if (!r.expire_at) return true;
        try {
          return new Date(r.expire_at).getTime() > nowMs;
        } catch { return true; }
      });

      const items = (activeRows || []).map((r: any) => {
        const mediaType: "image" | "video" = r.media_type === "video" ? "video" : "image";
        // Prefer explicit media_url (uploader stores the first media_url into media_url),
        // but keep the raw media_urls field available so components can access multiple-media uploads.
        const built = buildCloudinaryUrl(r.media_url, mediaType) ?? (typeof r.media_url === "string" ? r.media_url : "");
        // Process thumbnail URL if present
        const thumbnailType = r.thumbnail_type ?? null;
        const thumbnailUrl = r.thumbnail_url 
          ? (buildCloudinaryUrl(r.thumbnail_url, thumbnailType === "video" ? "video" : "image") ?? r.thumbnail_url)
          : null;
        return {
          id: r.id,
          user_id: r.user_id,
          caption: r.caption ?? null,
          media_urls: r.media_urls ?? null,
          media_url: built,
          raw_media_url: r.media_url,
          media_type: mediaType,
          duration: r.duration ?? null,
          created_at: r.created_at,
          expire_at: r.expire_at ?? null,
          is_deleted: r.is_deleted,
          visibility: r.visibility ?? null,
          label: r.label ?? null,
          location: r.location ?? null,
          music_title: r.music_title ?? null,
          thumbnail_url: thumbnailUrl,
          thumbnail_type: thumbnailType,
          isHD: Boolean(r.is_hd),
        };
      });

      // fetch profiles for business story owners
      const userIds = Array.from(new Set(items.map((it) => it.user_id).filter(Boolean)));
      const profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profRows } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", userIds);
        (profRows || []).forEach((p: any) => (profilesMap[p.id] = p));
      }

      const flat = items.map((s) => ({ ...s, userId: s.user_id, profile: profilesMap[s.user_id] ? { ...profilesMap[s.user_id], avatar_url: profilesMap[s.user_id].avatar_url ?? PLACEHOLDER_AVATAR } : null }));
      setFlatBusinessStories(flat);
    } catch (err) {
      console.warn('[home] fetchBusinessStories err', err);
      setFlatBusinessStories([]);
    } finally {
      if (!background) setBusinessStoriesLoading(false);
    }
  }, []);

  /* ----------------- fetchLocationPosts (for Location section) ----------------- */
  const fetchLocationPosts = useCallback(async (background = false) => {
    if (!background) setLocationPostsLoading(true);
    try {
      const { data, error } = await supabase
        .from('location_posts')
        .select('id, place, caption, country, images, videos, media_type, avatar_url, author_display_name, user_id, created_at, profiles(id, username, full_name)')
        .order('created_at', { ascending: false })
        .limit(12); // limit for home page display

      if (error) {
        console.warn('[home] fetchLocationPosts err', error);
        setLocationPosts([]);
        return;
      }

      const rows = (data ?? []) as any[];
      const mapped: LocationPost[] = rows.map((r) => ({
        id: String(r.id),
        place: r.place ?? '—',
        caption: r.caption ?? null,
        images: Array.isArray(r.images) ? r.images : r.images ? [r.images] : [],
        videos: Array.isArray(r.videos) ? r.videos : [],
        media_type: r.media_type ?? 'image',
        avatar: r.avatar_url ?? null,
        authorId: r.user_id ?? null,
        authorName: (r.author_display_name ?? r.profiles?.[0]?.full_name ?? r.profiles?.[0]?.username ?? null) ?? null,
        created_at: r.created_at ?? null,
        stars: 0,
        country: r.country ?? 'Unknown',
      }));

      setLocationPosts(mapped);

      // Fetch star counts
      const ids = mapped.map((p) => p.id);
      if (ids.length) {
        const { data: sc } = await supabase.from('location_post_star_counts').select('location_post_id, star_count').in('location_post_id', ids as string[]);
        const scMap: Record<string, number> = {};
        (sc ?? []).forEach((row: any) => (scMap[String(row.location_post_id)] = Number(row.star_count ?? 0)));
        setLocationPosts((cur) => cur.map((p) => ({ ...p, stars: scMap[p.id] ?? 0 })));

        // Fetch user's starred posts
        const me = await getCurrentUserIdAsync();
        if (me) {
          const { data: meStars } = await supabase.from('location_post_stars').select('location_post_id').eq('user_id', me).in('location_post_id', ids as string[]);
          const starredMap: Record<string, boolean> = {};
          (meStars ?? []).forEach((r: any) => (starredMap[String(r.location_post_id)] = true));
          setLocationStarred(starredMap);
        }
      }
    } catch (err) {
      console.warn('[home] fetchLocationPosts exception', err);
      setLocationPosts([]);
    } finally {
      if (!background) setLocationPostsLoading(false);
    }
  }, []);

  /* ---------------- unread messages count ---------------- */
  const fetchUnreadMessages = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', profile.id);
      const convoIds = (parts || []).map((p: any) => p.conversation_id).filter(Boolean);
      if (!convoIds.length) {
        setUnreadCount(0);
        return;
      }
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convoIds)
        .neq('sender_id', profile.id)
        .eq('is_read', false);
      if (error) {
        // supabase error objects can be objects with empty message — log structured info
        try {
          console.warn('[unread messages] error', {
            message: error?.message ?? null,
            status: (error as any)?.status ?? null,
            details: JSON.stringify(error).slice(0, 1000),
          });
        } catch (_e) {
          console.warn('[unread messages] error', error);
        }
        return;
      }
      setUnreadCount(typeof count === 'number' ? count : 0);
    } catch (e) {
      console.warn('[unread messages] exception', (e as any)?.message ?? JSON.stringify(e));
    }
  }, [profile?.id]);

  /* ----------------- handleRefresh ----------------- */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchUnreadMessages(),
        (async () => fetchStories(true))(),
        (async () => fetchBusinessStories(true))(),
        (async () => fetchRecentChats(true))(),
        (async () => loadBiddings())(),
        (async () => fetchLocationPosts(true))(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchUnreadMessages, fetchStories, fetchBusinessStories, fetchRecentChats, loadBiddings, fetchLocationPosts]);

  // Background refresh ALL home data every 30 seconds (silent, no loading indicators)
  useEffect(() => {
    let timer: any = null;
    if (profile?.id) {
      timer = setInterval(() => {
        // Silent background refresh - all fetches use background=true to avoid loading states
        Promise.all([
          fetchStories(true),
          fetchBusinessStories(true),
          fetchUnreadMessages(),
          loadBiddings(),
          fetchLocationPosts(true),
        ]).catch(() => {});
      }, 30_000); // 30 seconds
    }
    return () => {
      try {
        if (timer) clearInterval(timer);
      } catch {}
    };
  }, [profile?.id, fetchStories, fetchBusinessStories, fetchUnreadMessages, loadBiddings]);

  /* ---------------- initial fetches ----------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const cu = data?.user?.id ?? null;
        setCurrentUserId(cu);
        if (cu) {
          const { data: me } = await supabase.from('profiles').select('avatar_url').eq('id', cu).maybeSingle();
          setMyAvatar(me?.avatar_url ?? null);
        }

        // load persisted last watched story id
        try {
          const lw = await AsyncStorage.getItem(LAST_WATCHED_KEY);
          if (lw) setLastWatchedStoryId(lw);
        } catch {}

        // fetch followings for the current user so we can show following tabs
        if (cu) {
          try {
            const { data: f } = await supabase.from('follows').select('following_id').eq('follower_id', cu);
            const set = new Set<string>((f || []).map((r: any) => String(r.following_id)));
            setFollowingsSet(set);
          } catch (e) {
            setFollowingsSet(new Set());
          }
        }

        await Promise.all([fetchStories(true), fetchBusinessStories(true), fetchRecentChats(true), fetchUnreadMessages(), fetchLocationPosts(true)]);
        
        // Trigger content fade-in animation after data loads
        setContentReady(true);
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } catch {}
    })();
  }, [fetchStories, fetchBusinessStories, fetchRecentChats, fetchUnreadMessages, fetchLocationPosts]);

  const loadSavedAccounts = useCallback(async () => {
    try {
      const stored = await readSavedAccounts();
      setSavedAccounts(stored);
    } catch (err) {
      console.warn('[home] load saved accounts', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedAccounts();
    }, [loadSavedAccounts])
  );

  const isCurrentAccountSaved = useMemo(() => {
    if (!profile?.id) return false;
    return savedAccounts.some((acc) => acc.id === profile.id);
  }, [profile?.id, savedAccounts]);

  /* ----------------- sheet open/close ----------------- */
  const openSheet = useCallback(() => {
    loadSavedAccounts();
    setSheetVisible(true);
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [loadSavedAccounts, sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start(() =>
      setSheetVisible(false)
    );
  }, [sheetAnim]);

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height],
    extrapolate: 'clamp',
  });

  const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 12);

  const handleQuickSaveAccount = useCallback(async () => {
    if (!profile?.id) {
      showAlert({ title: 'Save account', message: 'Sign in to save this profile for quick switching.' });
      return;
    }
    if (isCurrentAccountSaved) {
      showAlert({ title: 'Already saved', message: 'This profile is already available for instant switching.' });
      return;
    }
    setSavingQuickAccount(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const refreshToken = data.session?.refresh_token;
      if (!refreshToken) {
        throw new Error('Refresh token missing. Please sign out and sign back in, then try again.');
      }
      const entry: SavedAccount = {
        id: profile.id,
        name: profile.full_name || profile.username || 'Account',
        avatar: profile.avatar_url,
        email: profile.email,
        refreshToken,
        savedAt: Date.now(),
      };
      const updated = await upsertSavedAccount(entry);
      setSavedAccounts(updated);
      showAlert({ title: 'Saved', message: 'Account stored. Use the chevron to switch without entering your password.' });
    } catch (err: any) {
      showAlert({ title: 'Save account failed', message: err?.message ?? 'Unable to save this account right now.' });
    } finally {
      setSavingQuickAccount(false);
    }
  }, [isCurrentAccountSaved, profile]);

  const handleQuickSwitch = useCallback(
    async (account: SavedAccount) => {
      if (!account.refreshToken) {
        showAlert({ title: 'Switch account', message: 'Refresh token missing. Save this account again from Settings.' });
        return;
      }
      setQuickSwitchingId(account.id);
      try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: account.refreshToken });
        if (error || !data.session?.user) throw error ?? new Error('Unable to restore that session.');
        const newToken = data.session.refresh_token ?? account.refreshToken;
        try {
          const updated = await upsertSavedAccount({ ...account, refreshToken: newToken, savedAt: Date.now() });
          setSavedAccounts(updated);
        } catch (persistErr) {
          console.warn('[home] persist refreshed token', persistErr);
        }
        await loadProfile(data.session.user.id);
        closeSheet();
        router.replace('/');
      } catch (err: any) {
        showAlert({ title: 'Switch account failed', message: err?.message ?? 'Unable to switch accounts right now.' });
        try {
          const updated = await deleteSavedAccount(account.id);
          setSavedAccounts(updated);
        } catch (cleanupErr) {
          console.warn('[home] cleanup saved account', cleanupErr);
        }
      } finally {
        setQuickSwitchingId(null);
      }
    },
    [closeSheet, loadProfile, router]
  );

  const handleQuickRemoveAccount = useCallback(async (accountId: string) => {
    try {
      const updated = await deleteSavedAccount(accountId);
      setSavedAccounts(updated);
    } catch (err) {
      console.warn('[home] remove saved account', err);
    }
  }, []);

  const handleAddAccount = useCallback(async () => {
    if (!isCurrentAccountSaved) {
      showAlert({ title: 'Save account first', message: 'Save this profile so you can come back without entering your password.' });
      return;
    }
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('[home] sign out before add account', err);
    }
    closeSheet();
    router.replace('/auth/login');
  }, [closeSheet, isCurrentAccountSaved, router]);

  /* ---------------- Notification banner (per-page) ---------------- */
  useEffect(() => {
    if (!profile?.id) return;
    let mounted = true;
    const ch = supabase
      .channel(`home-notifs:${profile.id}`)
      .on(
        'postgres_changes',
        { schema: 'public', table: 'notifications', event: 'INSERT', filter: `recipient=eq.${profile.id}` },
        (payload: any) => {
          if (!mounted) return;
          const n = payload?.new;
          if (!n) return;
          setUnreadCount((c) => c + 1);
          setBanner({
            visible: true,
            title: n.title ?? (n.type === 'message_received' ? 'New message' : 'Notification'),
            body: n.body ?? '',
            onPress: () => {
              setBanner((s) => ({ ...s, visible: false }));
              const p = n.data ?? {};
              if (p?.conversation_id) router.push(`/message/chat/${p.conversation_id}`);
              else if (p?.screen && p?.params) router.push({ pathname: p.screen, params: p.params });
            },
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      try {
        ch.unsubscribe();
      } catch {}
    };
  }, [profile?.id]);

  /* ---------------- Story small helpers & AvatarRing ---------------- */
  // Unified ring colors - using VELT_ACCENT for consistency
  const RING_COLOR_UNSEEN = VELT_ACCENT; // Cyan accent when has unseen story
  const RING_COLOR_VIEWED = '#6EE7B7'; // Soft green when story viewed
  const RING_COLOR_DEFAULT = '#374151'; // Gray when no story
  const AVATAR_HEADER_BORDER = '#FFFFFF'; // white ring for header avatar

  const AvatarRing: React.FC<{ 
    userId?: string | null; 
    avatar?: string | null; 
    size?: number; 
    onPress?: () => void; 
    onLongPress?: () => void;
    hasUnseen?: boolean; 
    isViewed?: boolean; 
    blink?: boolean; 
    storyCount?: number; 
    isHD?: boolean;
  }> = ({
    userId,
    avatar,
    size = 92,
    onPress,
    onLongPress,
    hasUnseen = false,
    isViewed = false,
    blink = false,
    storyCount = 0,
    isHD = false,
  }) => {
    // Professional scale animation refs
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const longPressTriggered = useRef(false);
    
    const handlePressIn = () => {
      longPressTriggered.current = false;
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        friction: 8,
        tension: 300,
        useNativeDriver: true,
      }).start();
    };
    
    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 400,
        useNativeDriver: true,
      }).start();
    };

    const handleLongPress = () => {
      longPressTriggered.current = true;
      onLongPress?.();
    };

    const handlePress = () => {
      if (longPressTriggered.current) {
        longPressTriggered.current = false;
        return;
      }
      onPress?.();
    };
    
    let status: "unseen" | "viewed" | "default" = "default";
    if (typeof isViewed === "boolean") {
      status = isViewed ? "viewed" : hasUnseen ? "unseen" : "default";
    } else {
      status = hasUnseen ? "unseen" : "default";
    }
    const ringSize = size + 12;
    const ringStyle =
      status === "unseen"
        ? { borderColor: RING_COLOR_UNSEEN, borderWidth: 3 }
        : status === "viewed"
        ? { borderColor: RING_COLOR_VIEWED, borderWidth: 3 }
        : { borderColor: RING_COLOR_DEFAULT, borderWidth: 2 };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable 
          onPress={handlePress} 
          onLongPress={handleLongPress}
          delayLongPress={400}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{ alignItems: 'center', marginTop: blink ? -2 : -6 }} 
          android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        >
          <View style={{ width: ringSize, height: ringSize, borderRadius: ringSize / 2, alignItems: 'center', justifyContent: 'center', ...ringStyle }}>
            <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#fff' }}>
              <Image source={{ uri: avatar ?? PLACEHOLDER_AVATAR }} style={{ width: size, height: size }} />
            </View>
            {/* story count badge */}
            {storyCount > 1 ? (
              <View style={{ position: 'absolute', right: -6, bottom: -6, backgroundColor: '#101214', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{storyCount}</Text>
              </View>
            ) : null}
            {isHD ? (
              <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }} pointerEvents="none">
                <HDBadge />
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  // header display name truncated to 8 chars with ellipsis (prevents pushing UI)
  const headerDisplayName = useMemo(() => {
    const raw = profile?.username ?? profile?.full_name ?? '';
    if (!raw) return '';
    return raw.length > 8 ? raw.slice(0, 8) + '...' : raw;
  }, [profile?.username, profile?.full_name]);

  function timeAgoLabel(iso: string) {
    try {
      const t = Date.now() - new Date(iso).getTime();
      const s = Math.floor(t / 1000);
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      return `${d}d ago`;
    } catch {
      return "";
    }
  }

  /* ---------------- Network listener for offline header transformation ---------------- */
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      setIsConnected(connected);
      
      // When going offline, show orange header for 5 seconds
      if (!connected) {
        // Clear any existing timeout
        if (offlineHeaderTimeoutRef.current) {
          clearTimeout(offlineHeaderTimeoutRef.current);
        }
        setShowOfflineHeader(true);
        offlineHeaderTimeoutRef.current = setTimeout(() => {
          setShowOfflineHeader(false);
        }, 5000);
      } else {
        // When back online, hide immediately
        if (offlineHeaderTimeoutRef.current) {
          clearTimeout(offlineHeaderTimeoutRef.current);
        }
        setShowOfflineHeader(false);
      }
    });
    return () => {
      sub();
      if (offlineHeaderTimeoutRef.current) {
        clearTimeout(offlineHeaderTimeoutRef.current);
      }
    };
  }, []);

  /* ----------------- helper: detect likely video by extension ----------------- */
  const isLikelyVideo = (uri?: string | null) => {
    if (!uri) return false;
    const u = uri.toLowerCase();
    return u.endsWith('.mp4') || u.endsWith('.mov') || u.endsWith('.m4v') || u.endsWith('.webm') || u.endsWith('.ogg');
  };

  const mergedBusinessStories = useMemo(() => {
    const combined = [...(flatBusinessStories || []), ...(derivedBusinessStories || [])];
    if (!combined.length) return [] as any[];
    const map = new Map<string, any>();
    combined.forEach((story) => {
      if (!story || !story.id) return;
      const prev = map.get(story.id);
      if (!prev) {
        map.set(story.id, story);
        return;
      }
      const prevTime = new Date(prev.created_at ?? prev.expire_at ?? 0).getTime();
      const nextTime = new Date(story.created_at ?? story.expire_at ?? 0).getTime();
      if (nextTime > prevTime) map.set(story.id, story);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aTime = new Date(a.created_at ?? a.expire_at ?? 0).getTime();
      const bTime = new Date(b.created_at ?? b.expire_at ?? 0).getTime();
      return bTime - aTime;
    });
  }, [flatBusinessStories, derivedBusinessStories]);

  // Track IDs belonging to commercial stories so we can exclude them from regular story rails.
  const businessStoryIds = useMemo(() => new Set((mergedBusinessStories || []).map((b) => b.id)), [mergedBusinessStories]);

  const filteredStoriesGrouped = useMemo(() => {
    if (!storiesGrouped || !storiesGrouped.length) return [];
    return storiesGrouped
      .map((g) => ({ ...g, stories: (g.stories || []).filter((s: any) => !businessStoryIds.has(s.id)) }))
      .filter((g) => (g.stories || []).length > 0);
  }, [storiesGrouped, businessStoryIds]);

  const filteredFlatStories = useMemo(() => (flatStories || []).filter((s) => !businessStoryIds.has(s.id)), [flatStories, businessStoryIds]);

  const storyUserIdSet = useMemo(() => new Set(filteredStoriesGrouped.map((s) => s.userId)), [filteredStoriesGrouped]);

  // sequence helpers: when overlay targets a single media item (preview), build
  // a sequence so horizontal paging can show next/prev media in the feed.
  const [overlaySequence, setOverlaySequence] = useState<{ list: any[]; index: number } | null>(null);

  useEffect(() => {
    if (!launchOverlay) {
      setOverlaySequence(null);
      return;
    }
    if (launchOverlay.userId) {
      setOverlaySequence(null);
      return;
    }
    try {
      const combined = [...(filteredFlatStories || []), ...(mergedBusinessStories || [])];
      const idx = combined.findIndex((it: any) => it.media_url === launchOverlay.mediaUrl || it.raw_media_url === launchOverlay.mediaUrl);
      if (idx >= 0) setOverlaySequence({ list: combined, index: idx });
      else setOverlaySequence(null);
    } catch (e) {
      setOverlaySequence(null);
    }
  }, [launchOverlay, filteredFlatStories, mergedBusinessStories]);

  const overlayNext = useCallback(() => {
    if (!overlaySequence) return;
    const { list, index } = overlaySequence;
    if (index >= list.length - 1) return;
    const next = list[index + 1];
    setOverlaySequence({ list, index: index + 1 });
    setLaunchOverlay((prev) => (prev ? { ...prev, mediaUrl: next.media_url ?? next.raw_media_url, mediaType: next.media_type ?? prev.mediaType, displayName: next.profile?.full_name ?? next.userId ?? prev.displayName } : prev));
  }, [overlaySequence]);

  const overlayPrev = useCallback(() => {
    if (!overlaySequence) return;
    const { list, index } = overlaySequence;
    if (index <= 0) return;
    const prev = list[index - 1];
    setOverlaySequence({ list, index: index - 1 });
    setLaunchOverlay((old) => (old ? { ...old, mediaUrl: prev.media_url ?? prev.raw_media_url, mediaType: prev.media_type ?? old.mediaType, displayName: prev.profile?.full_name ?? prev.userId ?? old.displayName } : old));
  }, [overlaySequence]);

  /* ---------------- topRail computed (unchanged) ---------------- */
  const topRail = useMemo(() => {
    if (!biddings.length) return [] as { item: Bidding; topAmount: number }[];
    return [...biddings]
      .map((it) => {
        const top = (topBidMap[it.id]?.amount ?? it.starting_price) as number;
        return { item: it, topAmount: top };
      })
      .sort((a, z) => z.topAmount - a.topAmount)
      .slice(0, 8);
  }, [biddings, topBidMap, tick]);

  /* ----------------------- RENDER ----------------------- */

  // Offline skeleton
  const showOfflineSkeleton =
    !isConnected && !storiesLoading && !businessStoriesLoading && filteredStoriesGrouped.length === 0 && recentChats.length === 0 && mergedBusinessStories.length === 0;

  // initial loading skeleton: when we are fetching the main page data and nothing is yet available
  const showInitialSkeleton =
    (storiesLoading || businessStoriesLoading || refreshing) &&
    flatStories.length === 0 &&
    mergedBusinessStories.length === 0 &&
    recentChats.length === 0 &&
    biddings.length === 0;

  // Titles
  const showStoriesRow = filteredStoriesGrouped.length > 0; // only other users
  const showAllStories = filteredFlatStories.length > 0;
  const showChats = recentChats.length > 0;
  const showPlugStories = mergedBusinessStories.length > 0;

  /* ---------------- placeBid (keeps previous logic) ---------------- */
  function placeBid(it: Bidding): void {
    (async () => {
      const raw = (bidInput[it.id] ?? '').toString().trim();
      const amt = parseFloat(raw.replace(/,/g, ''));
      if (!profile?.id) {
        console.warn('[placeBid] no auth user');
        return;
      }
      if (Number.isNaN(amt) || amt <= 0) {
        console.warn('[placeBid] invalid amount', raw);
        return;
      }

      const currentTop = (topBidMap[it.id]?.amount ?? it.starting_price ?? 0) as number;
      if (amt <= currentTop) {
        console.warn('[placeBid] bid must be greater than current top', { amt, currentTop });
        return;
      }

      setPlacing((p) => ({ ...p, [it.id]: true }));
      try {
        const { data, error } = await supabase
          .from('bids')
          .insert([{ user_id: profile.id, item_id: it.id, amount: amt }])
          .select();

        if (error) {
          console.warn('[placeBid] supabase insert error', error);
        } else {
          try {
            await fetchBidsForItems([it.id]);
          } catch (e) {
            console.warn('[placeBid] fetchBidsForItems error', e);
          }
          setBidInput((p) => ({ ...p, [it.id]: '' }));
        }
      } catch (e) {
        console.warn('[placeBid] exception', e);
      } finally {
        setPlacing((p) => ({ ...p, [it.id]: false }));
      }
    })();
  }

  // helper: set last watched story externally (e.g., when user finishes watching)
  const setLastWatched = useCallback(async (storyId: string | null) => {
    try {
      if (!storyId) {
        await AsyncStorage.removeItem(LAST_WATCHED_KEY);
        setLastWatchedStoryId(null);
      } else {
        await AsyncStorage.setItem(LAST_WATCHED_KEY, storyId);
        setLastWatchedStoryId(storyId);
      }
    } catch {}
  }, [setLastWatchedStoryId]);

  const handleStoryPress = useCallback(
    async (options: StoryLaunchOptions) => {
      const { userId, storyId, mediaUrl, mediaType, originRef, hideKey, hideType, borderRadius = 12, displayName } = options;
      if (!userId) {
        router.push('/explore/create_story');
        return;
      }
      if (storyId) setLastWatched(storyId).catch(() => {});
      
      // Prefetch stories before navigation for instant load
      prefetchUserStories(userId).catch(() => {});
      
      const route = `explore/user_stories/${userId}`;
      if (originRef && hideKey && hideType) {
        startStoryTransition({
          originRef,
          route,
          mediaUrl,
          mediaType,
          displayName,
          hideKey,
          hideType,
          borderRadius,
          userId,
        });
      } else {
        router.push(route);
      }
    },
    [router, setLastWatched, startStoryTransition]
  );

  // Handler for All Stories carousel cards - uses scaling transition like bubbles
  const handleAllStoriesCardPress = useCallback(
    (story: any, originRef: View | null) => {
      if (!story?.userId) return;
      const storyId = story.id;
      if (storyId) setLastWatched(storyId).catch(() => {});
      
      // Prefetch stories before navigation for instant load
      prefetchUserStories(story.userId).catch(() => {});
      
      const displayName = story.profile?.full_name ?? story.profile?.username ?? 'User';
      const mediaUrl = story.thumbnail_url ?? story.media_url;
      const mediaType = story.media_type;
      const cardKey = `card-${story.id}`;
      
      if (originRef) {
        startStoryTransition({
          originRef,
          route: `explore/user_stories/${story.userId}`,
          mediaUrl,
          mediaType,
          displayName,
          hideKey: cardKey,
          hideType: 'bubble', // Use bubble type for same animation
          borderRadius: 18, // Match card border radius
          userId: story.userId,
        });
      } else {
        // Fallback to direct navigation
        router.push(`/explore/user_stories/${story.userId}`);
      }
    },
    [router, setLastWatched, startStoryTransition]
  );

  const navigateToStoryPreview = useCallback(
    (story?: { id?: string | null }) => {
      if (!story?.id) return;
      setLastWatched(story.id).catch(() => {});
      try {
        router.push({ pathname: '/story/preview', params: { storyId: story.id } });
      } catch (err) {
        console.warn('[home] preview navigation failed', err);
      }
    },
    [router, setLastWatched]
  );

  // UI states for tabs on All Stories and Commercials
  const [allStoriesTab, setAllStoriesTab] = useState<'all' | 'following'>('all');
  const [commercialsTab, setCommercialsTab] = useState<'all' | 'following'>('all');

  // helper to determine "active" for recent chat based on last message timestamp (within 5 minutes)
  const isChatActive = (lastMessageCreatedAt?: string | null) => {
    if (!lastMessageCreatedAt) return false;
    try {
      const diff = Date.now() - new Date(lastMessageCreatedAt).getTime();
      return diff <= 5 * 60 * 1000; // 5 minutes
    } catch {
      return false;
    }
  };

  // small helper to render verification badge icon (always show as requested)
  const VerifiedBadge = ({ size = 14 }: { size?: number }) => <Ionicons name="checkmark-circle" size={size} color="#4AA3FF" style={{ marginLeft: 6 }} />;

  // Use transforms instead of animating top/left/width/height directly. This avoids
  // native-driver validation errors when Animated tries to promote styles to native
  // while some props (width/height/top/left) are unsupported by the native driver.
  // We keep these JS-driven (useNativeDriver: false) so borderRadius and layout
  // interpolation also work correctly. gesture-driven interactions are handled by
  // the embedded viewer component; this transform only performs the entry/exit
  // animation from/to the origin bubble.
  // Overlay now powered by PortalStoryOverlay (Reanimated) which owns its
  // transform/progress/gesture interactions on the UI thread.

    return (
    <TabSwipeContainer swipeEnabled={false} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Decorative, deep doodles that sit under the home content. Colors are linked to current theme. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {showAnimatedDoodles ? (
          <>
            <Animated.View style={[styles.homeDoodleLarge, { borderColor: colors.accent, opacity: 0.72, transform: [{ translateX: doodleA.interpolate({ inputRange: [0, 1], outputRange: [-28, 48] }) }, { translateY: doodleA.interpolate({ inputRange: [0, 1], outputRange: [-40, 80] }) }, { rotate: doodleA.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '6deg'] }) }] }]} />
            <Animated.View style={[styles.homeDoodleRight, { borderColor: colors.subtext, opacity: 0.58, transform: [{ translateX: doodleB.interpolate({ inputRange: [0, 1], outputRange: [40, -40] }) }, { translateY: doodleB.interpolate({ inputRange: [0, 1], outputRange: [6, -36] }) }, { rotate: doodleB.interpolate({ inputRange: [0, 1], outputRange: ['4deg', '-12deg'] }) }] }]} />
            <Animated.View style={[styles.homeDoodleLower, { borderColor: colors.faint || colors.accent, opacity: 0.62, transform: [{ translateX: doodleC.interpolate({ inputRange: [0, 1], outputRange: [-32, 26] }) }, { translateY: doodleC.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }, { rotate: doodleC.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) }] }]} />
          </>
        ) : showStaticDoodles ? (
          // reduced-motion or disabled: static shapes
          <>
            <View style={[styles.homeDoodleLarge, { borderColor: colors.accent, opacity: 0.64 }]} />
            <View style={[styles.homeDoodleRight, { borderColor: colors.subtext, opacity: 0.5 }]} />
            <View style={[styles.homeDoodleLower, { borderColor: colors.faint || colors.accent, opacity: 0.6 }]} />
          </>
        ) : null}
      </View>

      <NotificationBanner
        visible={banner.visible}
        title={banner.title}
        body={banner.body}
        onClose={() => setBanner((s) => ({ ...s, visible: false }))}
        onPress={() => {
          banner.onPress?.();
          setBanner((s) => ({ ...s, visible: false }));
        }}
        topOffset={TOP_INSET + 8}
      />

      {/* HEADER - Static */}
      <View
        style={[styles.headerWrap, { backgroundColor: showOfflineHeader ? '#FF8C00' : colors.card }]}
      >
        <SafeAreaView>
          {showOfflineHeader ? (
            <View style={[styles.headerRow, { justifyContent: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cloud-offline-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Offline</Text>
              </View>
            </View>
          ) : (
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* header avatar with white ring */}
              <Pressable onPress={() => router.push('home/profile')} style={{ marginRight: 10 }}>
                <View style={{ borderRadius: 22 + 4, padding: 2, backgroundColor: AVATAR_HEADER_BORDER }}>
                  <Image source={{ uri: profile?.avatar_url ?? PLACEHOLDER_AVATAR }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                </View>
              </Pressable>

              <Pressable onPress={openQRModal} accessibilityLabel="Open QR code modal">
                <Text style={[styles.brand, { color: colors.accent }]}> HELLO</Text>
              </Pressable>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                <Text numberOfLines={1} style={[styles.headerName, { color: colors.subtext, marginRight: 6, maxWidth: 180 }]}>
                  {headerDisplayName}
                </Text>

                <Pressable onPress={openSheet} style={{ padding: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Open profile menu">
                  <Ionicons name="chevron-down" size={18} color={colors.accent} />
                </Pressable>
              </View>
            </View>

            {/* header action buttons separated - each its own pill */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Create/Plus pill with popup menu */}
              <View style={{ position: 'relative' }}>
                <View style={[styles.actionPill, { backgroundColor: colors.faint, borderColor: colors.border }]}>
                  <BounceButton onPress={toggleCreateMenu} style={{ padding: 8 }}>
                    <Animated.View style={{ transform: [{ rotate: createMenuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                      <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                    </Animated.View>
                  </BounceButton>
                </View>
                {/* Create Menu Popup */}
                {showCreateMenu && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 48,
                      right: 0,
                      backgroundColor: colors.card,
                      borderRadius: 16,
                      paddingVertical: 8,
                      paddingHorizontal: 4,
                      minWidth: 160,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: createMenuAnim,
                      transform: [
                        { scale: createMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                        { translateY: createMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                      ],
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        toggleCreateMenu();
                        router.push('/explore/create_story');
                      }}
                      style={({ pressed }) => [{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: pressed ? colors.faint : 'transparent',
                      }]}
                    >
                      <Ionicons name="create-outline" size={20} color={colors.accent} />
                      <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 12, fontSize: 15 }}>Create Post</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        toggleCreateMenu();
                        router.push('/home/soundgallery');
                      }}
                      style={({ pressed }) => [{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: pressed ? colors.faint : 'transparent',
                      }]}
                    >
                      <Ionicons name="musical-notes-outline" size={20} color={colors.accent} />
                      <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 12, fontSize: 15 }}>Music</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        toggleCreateMenu();
                        router.push('/aisearch');
                      }}
                      style={({ pressed }) => [{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: pressed ? colors.faint : 'transparent',
                      }]}
                    >
                      <Ionicons name="search-outline" size={20} color={colors.accent} />
                      <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 12, fontSize: 15 }}>Search</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        toggleCreateMenu();
                        setShowBiddings(true);
                      }}
                      style={({ pressed }) => [{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: pressed ? colors.faint : 'transparent',
                      }]}
                    >
                      <MaterialCommunityIcons name="gavel" size={20} color={colors.accent} />
                      <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 12, fontSize: 15 }}>Bid</Text>
                    </Pressable>
                  </Animated.View>
                )}
              </View>

              {/* Message pill */}
              <View style={[styles.actionPill, { backgroundColor: colors.faint, borderColor: colors.border, marginLeft: 8 }]}>
                <BounceButton onPress={() => router.push('/location')} style={{ padding: 8 }}>
                  <Ionicons name="paper-plane-outline" size={20} color={colors.accent} />
                </BounceButton>
                {unreadCount > 0 && (
                  <View style={[styles.pillBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.pillBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          )}

        </SafeAreaView>
      </View>

      {/* ACCOUNT SWITCHER SHEET */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Animated.View
            {...sheetPan.panHandlers}
            style={{
              transform: [{ translateY: sheetTranslate }],
              backgroundColor: colors.card,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              maxHeight: SHEET_MAX,
              paddingTop: 8,
              paddingBottom: Platform.OS === 'ios' ? 24 : 16,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>Switch accounts</Text>
                <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 13 }}>
                  Save profiles once, then hop between them without typing passwords again.
                </Text>
              </View>
              <Pressable onPress={closeSheet} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={colors.subtext} />
              </Pressable>
            </View>

            {profile && (
              <TouchableOpacity
                onPress={handleQuickSaveAccount}
                disabled={savingQuickAccount || isCurrentAccountSaved}
                style={{
                  borderRadius: 14,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: colors.faint,
                  marginBottom: 14,
                }}
              >
                {savingQuickAccount ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>
                        {isCurrentAccountSaved ? 'This account is ready to switch' : 'Save current account'}
                      </Text>
                      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
                        {isCurrentAccountSaved ? 'Tap a profile below to jump over' : 'We keep the token safely on this device only'}
                      </Text>
                    </View>
                    {isCurrentAccountSaved && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                  </View>
                )}
              </TouchableOpacity>
            )}

            {savedAccounts.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="people-circle-outline" size={48} color={colors.subtext} />
                <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 12 }}>
                  No saved accounts yet. Save the current profile and come back to see it here.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    closeSheet();
                    router.push('/logout/settings');
                  }}
                  style={{ marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingBottom: 12 }}>
                {savedAccounts.map((account) => (
                  <View
                    key={account.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    }}
                  >
                    {account.avatar ? (
                      <Image source={{ uri: account.avatar }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                    ) : (
                      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="person" size={18} color={colors.subtext} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{account.name}</Text>
                      {account.email ? <Text style={{ color: colors.subtext, fontSize: 12 }}>{account.email}</Text> : null}
                    </View>
                    {quickSwitchingId === account.id ? (
                      <ActivityIndicator color={colors.accent} style={{ marginRight: 12 }} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleQuickSwitch(account)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 16,
                          borderRadius: 999,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.border,
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>Switch</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleQuickRemoveAccount(account.id)} style={{ padding: 6 }}>
                      <Ionicons name="close" size={18} color={colors.subtext} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                onPress={handleAddAccount}
                style={{
                  borderRadius: 12,
                  backgroundColor: colors.accent,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Add another account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  closeSheet();
                  router.push('/logout/settings');
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Manage saved accounts in Settings</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* FEED: Stories first */}
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.subtext} />}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          // keep existing Animated event behavior
          try {
            Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })(e);
          } catch {}
          // determine whether scroll-to-top is needed
          try {
            const y = e?.nativeEvent?.contentOffset?.y ?? 0;
            const shouldShow = y > 80; // threshold: show after a bit of scroll
            // hide button when overlay is open
            const visible = shouldShow && !overlayOpenRef.current;
            if (visible !== lastShowScrollTopRef.current) {
              lastShowScrollTopRef.current = visible;
              setShowScrollTop(visible);
            }
          } catch {}
        }}
        onScrollBeginDrag={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
        }}
      >
        {/* Content wrapper with fade-in animation */}
        <Animated.View style={{ opacity: contentFadeAnim, transform: [{ translateY: contentFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        {/* Banner area - shows upload banner when uploading, otherwise app-center banner */}
              {activeUploadJob ? (
                <View style={{ width: '100%', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.faint, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    onPress={openUploadScreen}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="cloud-upload-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
                          {activeUploadJob.status === 'success' ? 'Story published' : 'Uploading story'}
                        </Text>
                      </View>
                      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2, marginLeft: 30 }} numberOfLines={1}>
                        {activeUploadJob.statusMessage ?? 'Working…'}
                      </Text>
                      <View style={{ height: 4, borderRadius: 999, overflow: 'hidden', marginTop: 6, marginLeft: 30, backgroundColor: colors.border }}>
                        <View style={{ height: '100%', borderRadius: 999, backgroundColor: colors.accent, width: `${uploadBannerProgress}%` }} />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                  </TouchableOpacity>
                  <Pressable onPress={dismissUploadBanner} style={{ padding: 6, marginLeft: 8 }}>
                    <Ionicons name="close" size={18} color={colors.subtext} />
                  </Pressable>
                </View>
              ) : appBannerText && showAppBanner ? (
                <View style={{ width: '100%', paddingTop: 0 }}>
                  <View style={{ width: '100%', borderRadius: 0, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.accent, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="megaphone-outline" size={20} color="#fff" />
                      <Text numberOfLines={2} style={{ color: '#fff', flex: 1, marginLeft: 10 }}>{appBannerText}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}>
                      <Pressable onPress={() => { try { router.push('/app_center'); } catch {} }} style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontWeight: '800' }}>Open</Text>
                      </Pressable>
                      <Pressable onPress={() => setShowAppBanner(false)} style={{ padding: 6 }}>
                        <Ionicons name="close" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}

        {/* Stories row (only other users' bubbles) */}
        {showStoriesRow && (
          <View style={{ paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }}>
              <Text style={[styles.sectionTitle, { marginLeft: 12, color: colors.text }]}>Stories</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 12, paddingRight: 0, paddingVertical: 8 }}
              onScrollBeginDrag={() => {
                try {
                  Haptics.selectionAsync();
                } catch {}
              }}
            >
              {/* other users stories (bubble row) */}
              {filteredStoriesGrouped.length === 0 ? null : (
                filteredStoriesGrouped.map((g) => {
                  const blink = Boolean(blinkMap[g.userId]);
                  const firstStory = Array.isArray(g.stories) && g.stories.length ? g.stories[0] : null;
                  const bubbleKey = String(g.userId ?? g.profile?.id ?? firstStory?.id ?? 'story-bubble');
                  const hidden = activeLaunch?.type === 'bubble' && activeLaunch.key === bubbleKey;
                  const displayName = g.profile?.full_name ?? g.profile?.username ?? 'User';
                  const ringRadius = (86 + 12) / 2;
                  return (
                    <View key={g.userId} style={{ alignItems: 'center', marginRight: 10, opacity: hidden ? 0 : 1 }}>
                      <View
                        ref={(node) => {
                          if (node) bubbleRefs.current.set(bubbleKey, node);
                          else bubbleRefs.current.delete(bubbleKey);
                        }}
                      >
                        <AvatarRing
                          userId={g.userId ?? null}
                          avatar={g.profile?.avatar_url ?? PLACEHOLDER_AVATAR}
                          size={86}
                          isHD={Boolean(firstStory?.isHD)}
                          onPress={() =>
                            handleStoryPress({
                              userId: g.userId ?? null,
                              storyId: firstStory?.id ?? null,
                              mediaUrl: firstStory?.media_url ?? firstStory?.raw_media_url ?? g.profile?.avatar_url ?? null,
                              mediaType: firstStory?.media_type ?? null,
                              originRef: bubbleRefs.current.get(bubbleKey) ?? null,
                              hideKey: bubbleKey,
                              hideType: 'bubble',
                              borderRadius: ringRadius,
                              displayName,
                            })
                          }
                          onLongPress={() => {
                            if (g.userId) {
                              openProfilePreview(g.userId, {
                                fullName: g.profile?.full_name,
                                username: g.profile?.username,
                                avatar: g.profile?.avatar_url,
                              });
                            }
                          }}
                          hasUnseen={g.hasUnseen}
                          isViewed={g.isViewed}
                          blink={blink}
                          storyCount={g.stories?.length ?? 0}
                        />
                      </View>
                      <Text style={[styles.smallText, { marginTop: 6, maxWidth: 72, textAlign: 'center', color: colors.subtext }]} numberOfLines={1}>
                        {g.profile?.username ?? g.profile?.full_name ?? 'User'} {/** show count already on badge */}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* All Stories thumbnails with tabs (All / Following) */}
        {showAllStories && (
          <View style={{ paddingTop: 6, paddingHorizontal: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionTitle, { marginLeft: 12, color: colors.text, marginBottom: 6 }]}>All Stories</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginRight: 12 }}>
                {/* Tab with cold glow effect during loading */}
                <AnimatedTabButton onPress={() => setAllStoriesTab('all')} isActive={allStoriesTab === 'all'} label="All" colors={colors} />
                <AnimatedTabButton onPress={() => setAllStoriesTab('following')} isActive={allStoriesTab === 'following'} label="Following" colors={colors} />
              </View>
            </View>

            {/* Carousel-style All Stories with scale animation */}
            <AllStoriesCarousel
              stories={filteredFlatStories.filter((s) => (allStoriesTab === 'all' ? true : followingsSet.has(String(s.userId))))}
              lastWatchedStoryId={lastWatchedStoryId}
              onStoryPress={handleAllStoriesCardPress}
              onStoryLongPress={(s) => {
                if (s.userId) {
                  openProfilePreview(s.userId, {
                    fullName: s.profile?.full_name,
                    username: s.profile?.username,
                    avatar: s.profile?.avatar_url,
                  });
                }
              }}
              timeAgoLabel={timeAgoLabel}
            />
          </View>
        )}

        {/* INITIAL LOADING SKELETON (page layout placeholders) */}
        {showInitialSkeleton && (
          <View style={{ paddingHorizontal: 0, paddingTop: 8 }}>
            {/* Header / Info */}
            <View style={{ height: 18, width: 160, borderRadius: 10, backgroundColor: colors.faint, marginBottom: 12 }} />

            {/* Stories row skeleton */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 8 }}
              onScrollBeginDrag={() => {
                try {
                  Haptics.selectionAsync();
                } catch {}
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={`sk-bub-${i}`} style={{ width: 82, height: 82, borderRadius: 41, backgroundColor: colors.faint, marginRight: 12 }} />
              ))}
            </ScrollView>

            {/* All stories thumbnails skeleton */}
            <View style={{ marginTop: 12 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 8 }}
                onScrollBeginDrag={() => {
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <View key={`sk-card-${i}`} style={{ width: 140, height: 200, borderRadius: 12, backgroundColor: colors.faint, marginRight: 12 }} />
                ))}
              </ScrollView>
            </View>

            {/* Recent chats skeleton */}
            <View style={{ marginTop: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={`sk-chat-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.faint, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ height: 16, width: '60%', backgroundColor: colors.faint, borderRadius: 8, marginBottom: 8 }} />
                    <View style={{ height: 12, width: '40%', backgroundColor: colors.faint, borderRadius: 6 }} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* RECENT CHATS */}
        {showChats && (
          <View style={{ paddingTop: 10, paddingHorizontal: 12 }}>
            <Text style={[styles.sectionTitle, { marginLeft: 0, color: colors.text }]}>Recent Chats</Text>

            <View style={{ marginTop: 8 }}>
              {recentChats.map((rc) => {
                const name = rc.is_group ? (rc.title ?? 'Group') : (rc.otherUser?.full_name ?? 'Unknown');
                const avatar = rc.is_group ? (rc.avatar_url ?? PLACEHOLDER_AVATAR) : (rc.otherUser?.avatar_url ?? PLACEHOLDER_AVATAR);
                const preview = rc.last_message?.content ?? '';
                const timeShort = rc.last_message?.created_at ? timeAgoLabel(rc.last_message.created_at) : '';
                // show story ring if this userId exists in the filtered story groups
                const hasStories = Boolean(rc.otherUser?.id && storyUserIdSet.has(rc.otherUser.id));
                const active = isChatActive(rc.last_message?.created_at);
                return (
                  <AnimatedListItem
                    key={rc.id}
                    onPress={() => router.push({ pathname: `/message/chat/${rc.id}`, params: rc.is_group ? {} : { otherName: rc.otherUser?.full_name, otherAvatar: rc.otherUser?.avatar_url ?? '' } })}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 0 }}
                  >
                    <View style={{ position: 'relative', marginRight: 12 }}>
                      {/* ring around chat avatars if they have stories */}
                      <View style={{ borderRadius: 26 + 6, padding: hasStories ? 3 : 0, backgroundColor: hasStories ? RING_COLOR_UNSEEN : 'transparent' }}>
                        <Image source={{ uri: avatar }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                      </View>
                    </View>

                    <View style={{ flex: 1, borderBottomWidth: 0, paddingVertical: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Text numberOfLines={1} style={[styles.headerName, { color: colors.text, maxWidth: 200 }]}>{name}</Text>
                          <VerifiedBadge />
                          {/* active pill */}
                          <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: active ? '#0D9F6E' : 'rgba(255,255,255,0.06)' }}>
                            <Text style={{ color: active ? '#fff' : '#9AA4B2', fontWeight: '800', fontSize: 12 }}>{active ? 'Active' : 'Offline'}</Text>
                          </View>
                        </View>
                        <Text style={[styles.smallText, { color: colors.subtext, marginLeft: 8 }]}>{timeShort}</Text>
                      </View>
                      <Text numberOfLines={1} style={[styles.subtext, { marginTop: 4, color: colors.subtext }]}>{preview}</Text>
                    </View>
                  </AnimatedListItem>
                );
              })}
            </View>
          </View>
        )}

        {/* Location Posts Section (replaces Commercials) */}
        {locationPosts.length > 0 && (
          <View style={{ paddingTop: 16, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location" size={20} color={VELT_ACCENT} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { marginLeft: 0, color: colors.text }]}>Location</Text>
              </View>
              <Pressable 
                onPress={() => router.push('/location')} 
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' })}
              >
                <Text style={{ color: VELT_ACCENT, fontWeight: '700', fontSize: 14 }}>See All</Text>
                <Ionicons name="chevron-forward" size={16} color={VELT_ACCENT} />
              </Pressable>
            </View>

            {/* Location posts in zigzag pattern with focus animation */}
            <View style={{ paddingVertical: 8, position: 'relative' }}>
              {/* Zigzag connecting line */}
              <Svg
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
                width="100%"
                height="100%"
              >
                {locationPosts.slice(0, 6).map((_, idx) => {
                  if (idx === locationPosts.slice(0, 6).length - 1) return null;
                  const cardWidth = Math.min(180, (width - 48) * 0.48);
                  const rowHeight = 244;
                  const cardOnLeft = idx % 2 === 0;
                  const nextCardOnLeft = (idx + 1) % 2 === 0;
                  
                  // Start from current card center, end at next card center
                  const startX = cardOnLeft ? cardWidth / 2 + 4 : width - 24 - cardWidth / 2 - 4;
                  const startY = idx * rowHeight + 220 / 2 + 8;
                  const endX = nextCardOnLeft ? cardWidth / 2 + 4 : width - 24 - cardWidth / 2 - 4;
                  const endY = (idx + 1) * rowHeight + 220 / 2 + 8;
                  
                  return (
                    <Line
                      key={`zigzag-${idx}`}
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                      strokeWidth={2}
                      strokeDasharray="6,4"
                    />
                  );
                })}
              </Svg>

              {locationPosts.slice(0, 6).map((post, idx) => {
                // Zigzag: even rows = card LEFT, caption RIGHT; odd rows = caption LEFT, card RIGHT
                const cardOnLeft = idx % 2 === 0;
                const isStarred = !!locationStarred[post.id];
                const cardWidth = Math.min(180, (width - 48) * 0.48);
                const cardHeight = 220;
                const infoWidth = Math.min(160, (width - 48) * 0.44);
                const ROW_HEIGHT = cardHeight + 24; // card height + margin
                // Approximate offset from content top to location section
                const LOCATION_SECTION_OFFSET = 850;
                const isStack = post.images.length > 1 || (post.videos?.length ?? 0) > 0;
                const hasVideo = (post.videos?.length ?? 0) > 0;
                const isOwnPost = profile?.id && post.authorId === profile.id;
                // Get the primary media (video first, then image)
                const primaryMediaUrl = hasVideo ? post.videos[0] : post.images[0];
                const primaryMediaType = hasVideo ? 'video' : 'image';
                
                return (
                  <FocusableLocationRow
                    key={post.id}
                    scrollY={scrollY}
                    index={idx}
                    rowHeight={ROW_HEIGHT}
                    headerOffset={LOCATION_SECTION_OFFSET}
                  >
                    <View 
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 24,
                        paddingHorizontal: 4,
                        zIndex: 1,
                      }}
                    >
                      {/* Card on LEFT for even rows */}
                      {cardOnLeft && (
                        <AnimatedCard
                          onPress={() => {
                            prefetchLocationPosts(post.id).catch(() => {});
                            try { router.push(`/location/${post.id}`); } catch {}
                          }}
                          containerStyle={{ width: cardWidth }}
                        >
                          <View style={{ 
                            width: '100%', 
                            height: cardHeight, 
                            borderRadius: 18, 
                            overflow: 'hidden', 
                            backgroundColor: '#111',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.5,
                            shadowRadius: 16,
                            elevation: 10,
                          }}>
                            {/* Full-bleed media (video or image) */}
                            {primaryMediaType === 'video' ? (
                              <Video
                                source={{ uri: primaryMediaUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay
                                isLooping
                                isMuted
                              />
                            ) : (
                              <Image
                                source={{ uri: primaryMediaUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            )}
                            
                            {/* Stack indicator (multiple media) */}
                            {isStack && (
                              <View style={{ 
                                position: 'absolute', top: 10, left: 10,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                                flexDirection: 'row', alignItems: 'center',
                              }}>
                                <Ionicons name={hasVideo ? 'videocam' : 'layers'} size={14} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{post.images.length + (post.videos?.length ?? 0)}</Text>
                              </View>
                            )}
                            
                            {/* Stars badge - pressable for other users' posts */}
                            {isOwnPost ? (
                              <View style={{
                                position: 'absolute', top: 10, right: 10,
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                              }}>
                                <Text style={{ color: '#fff', fontWeight: '800', marginRight: 5, fontSize: 14 }}>{post.stars ?? 0}</Text>
                                <Ionicons name="star" size={18} color="#f5c518" />
                              </View>
                            ) : (
                              <Pressable 
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleToggleLocationStar(post.id);
                                }}
                                hitSlop={12}
                                style={({ pressed }) => ({
                                  position: 'absolute', top: 10, right: 10,
                                  flexDirection: 'row', alignItems: 'center',
                                  backgroundColor: pressed ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)',
                                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                                  transform: [{ scale: pressed ? 0.95 : 1 }],
                                })}
                              >
                                <Text style={{ color: isStarred ? '#f5c518' : '#fff', fontWeight: '800', marginRight: 5, fontSize: 14 }}>{post.stars ?? 0}</Text>
                                <Ionicons name={isStarred ? 'star' : 'star-outline'} size={18} color={isStarred ? '#f5c518' : '#fff'} />
                              </Pressable>
                            )}
                            
                            {/* Gradient overlay */}
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.85)']}
                              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
                            />
                            
                            {/* Avatar at bottom center */}
                            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }}>
                              {post.avatar ? (
                                <Image source={{ uri: post.avatar }} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' }} />
                              ) : (
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                                  <Ionicons name="person" size={14} color="#fff" />
                                </View>
                              )}
                            </View>
                          </View>
                        </AnimatedCard>
                      )}

                      {/* Info box - on RIGHT for even rows, on LEFT for odd rows */}
                      <View style={{ 
                        width: infoWidth, 
                        justifyContent: 'center',
                        paddingHorizontal: 8,
                      }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 6 }} numberOfLines={2}>
                          {post.place}
                        </Text>
                        {post.caption ? (
                          <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 8, lineHeight: 18 }} numberOfLines={3}>
                            {post.caption}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="time-outline" size={12} color={colors.subtext} style={{ marginRight: 4 }} />
                          <Text style={{ color: colors.subtext, fontSize: 11 }}>
                            {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Card on RIGHT for odd rows */}
                      {!cardOnLeft && (
                        <AnimatedCard
                          onPress={() => {
                            prefetchLocationPosts(post.id).catch(() => {});
                            try { router.push(`/location/${post.id}`); } catch {}
                          }}
                          containerStyle={{ width: cardWidth }}
                        >
                          <View style={{ 
                            width: '100%', 
                            height: cardHeight, 
                            borderRadius: 18, 
                            overflow: 'hidden', 
                            backgroundColor: '#111',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.5,
                            shadowRadius: 16,
                            elevation: 10,
                          }}>
                            {/* Full-bleed media (video or image) */}
                            {primaryMediaType === 'video' ? (
                              <Video
                                source={{ uri: primaryMediaUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay
                                isLooping
                                isMuted
                              />
                            ) : (
                              <Image
                                source={{ uri: primaryMediaUrl }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                            )}
                            
                            {/* Stack indicator (multiple media) */}
                            {isStack && (
                              <View style={{ 
                                position: 'absolute', top: 10, left: 10,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                                flexDirection: 'row', alignItems: 'center',
                              }}>
                                <Ionicons name={hasVideo ? 'videocam' : 'layers'} size={14} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{post.images.length + (post.videos?.length ?? 0)}</Text>
                              </View>
                            )}
                            
                            {/* Stars badge - pressable for other users' posts */}
                            {isOwnPost ? (
                              <View style={{
                                position: 'absolute', top: 10, right: 10,
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                              }}>
                                <Text style={{ color: '#fff', fontWeight: '800', marginRight: 5, fontSize: 14 }}>{post.stars ?? 0}</Text>
                                <Ionicons name="star" size={18} color="#f5c518" />
                              </View>
                            ) : (
                              <Pressable 
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleToggleLocationStar(post.id);
                                }}
                                hitSlop={12}
                                style={({ pressed }) => ({
                                  position: 'absolute', top: 10, right: 10,
                                  flexDirection: 'row', alignItems: 'center',
                                  backgroundColor: pressed ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)',
                                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                                  transform: [{ scale: pressed ? 0.95 : 1 }],
                                })}
                              >
                                <Text style={{ color: isStarred ? '#f5c518' : '#fff', fontWeight: '800', marginRight: 5, fontSize: 14 }}>{post.stars ?? 0}</Text>
                                <Ionicons name={isStarred ? 'star' : 'star-outline'} size={18} color={isStarred ? '#f5c518' : '#fff'} />
                              </Pressable>
                            )}
                            
                            {/* Gradient overlay */}
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.85)']}
                              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
                            />
                            
                            {/* Avatar at bottom center */}
                            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }}>
                              {post.avatar ? (
                                <Image source={{ uri: post.avatar }} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' }} />
                              ) : (
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                                  <Ionicons name="person" size={14} color="#fff" />
                                </View>
                              )}
                            </View>
                          </View>
                        </AnimatedCard>
                      )}
                    </View>
                  </FocusableLocationRow>
                );
              })}
            </View>

            {/* View more button */}
            {locationPosts.length > 6 && (
              <Pressable
                onPress={() => router.push('/location')}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  paddingVertical: 14,
                  marginTop: 8,
                  borderRadius: 12,
                  backgroundColor: pressed ? (colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent',
                  borderWidth: 1,
                  borderColor: colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                })}
              >
                <Text style={{ color: VELT_ACCENT, fontWeight: '700' }}>View All Locations</Text>
              </Pressable>
            )}
          </View>
        )}
        </Animated.View>
      </Animated.ScrollView>

      {launchOverlay ? (
        <PortalStoryOverlay
          ref={overlayRef}
          launchOverlay={launchOverlay!}
          onRequestClose={closeOverlay}
          onClosed={() => {
            setLaunchOverlay(null);
            setActiveLaunch(null);
          }}
          onNext={overlayNext}
          onPrev={overlayPrev}
        />
      ) : null}

      {/* Floating scroll-to-top button (show only when there's space to scroll up) */}
      {showScrollTop ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 60, alignItems: 'center', zIndex: 40 }}>
          <BounceButton onPress={scrollToTop} onLongPress={openExploreSearch} style={{ backgroundColor: colors.accent }}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </BounceButton>
        </View>
      ) : null}

      {/* Biddings Bottom Sheet (unchanged structurally) */}
      <Modal visible={showBiddings} animationType="slide" transparent onRequestClose={() => setShowBiddings(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.95)' }}>
          <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ width: '100%' }}>
            <View
              {...sheetPan.panHandlers}
              style={{
                backgroundColor: colors.card,
                paddingTop: 8,
                paddingHorizontal: 12,
                paddingBottom: 12,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                maxHeight: height * 0.92,
              }}
            >
              {/* drag handle */}
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
              </View>

              {/* Header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Biddings</Text>
                <Pressable onPress={() => setShowBiddings(false)} style={{ padding: 6 }}>
                  <Ionicons name="close" size={22} color={colors.subtext} />
                </Pressable>
              </View>

              {/* TOP BIDDINGS rail */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ color: colors.subtext, fontWeight: '800', marginBottom: 6 }}>
                  Top Biddings
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
                  {topRail.length ? (
                    topRail.map(({ item, topAmount }) => (
                      <View
                        key={item.id}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.faint,
                          borderRadius: 999,
                          marginRight: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Ionicons name="pricetag-outline" size={14} color={colors.subtext} />
                        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', marginLeft: 6, maxWidth: 160 }}>
                          {item.title}
                        </Text>
                        <Text style={{ color: colors.text, fontWeight: '900', marginLeft: 10 }}>
                          {fmtMoney(topAmount)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: colors.subtext }}>No active biddings yet</Text>
                  )}
                </ScrollView>
              </View>

              <ScrollView showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Carousel list */}
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
                  {loadingBiddings ? (
                    <View style={{ width: width - 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                      <ActivityIndicator />
                      <Text style={{ color: colors.subtext, marginTop: 8, fontWeight: '700' }}>Loading…</Text>
                    </View>
                  ) : biddings.length === 0 ? (
                    <View style={{ width: width - 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                      <Ionicons name="albums-outline" size={32} color={colors.subtext} />
                      <Text style={{ color: colors.subtext, marginTop: 8, fontWeight: '700' }}>No auctions right now</Text>
                    </View>
                  ) : (
                    biddings.map((it) => (
                      <View key={it.id} style={{ width: width - 48, marginRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: '#222' }}>
                            {it.image_url ? (
                              <Image source={{ uri: it.image_url.split('||')[0] }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="image-outline" size={28} color={colors.subtext} />
                              </View>
                            )}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '900' }}>{it.title}</Text>
                            <Text style={{ color: colors.subtext, marginTop: 6 }}>{fmtMoney(it.starting_price)} • Ends {timeLeft(it.ends_at)}</Text>
                          </View>
                        </View>

                        <View style={{ marginTop: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TextInput
                              value={bidInput[it.id] ?? ''}
                              onChangeText={(t) => setBidInput((p) => ({ ...p, [it.id]: t }))}
                              placeholder="Enter your bid"
                              placeholderTextColor={colors.subtext}
                              keyboardType="numeric"
                              style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text }}
                            />
                            <BounceButton onPress={() => placeBid(it)} style={{ paddingHorizontal: 12 }}>
                              <Text style={{ color: '#fff', fontWeight: '800' }}>{placing[it.id] ? 'Placing...' : 'Place'}</Text>
                            </BounceButton>
                          </View>
                        </View>

                        {/* list of top bids */}
                        <View style={{ marginTop: 16 }}>
                          {(bidLists[it.id] || []).map((b) => (
                            <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                              <Text style={{ color: colors.subtext }}>{b.user?.full_name ?? 'Bidder'}</Text>
                              <Text style={{ color: colors.text, fontWeight: '800' }}>{fmtMoney(b.amount)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Profile Preview Bottom Sheet */}
      {profilePreviewVisible && (
        <Modal visible={profilePreviewVisible} transparent animationType="none" onRequestClose={closeProfilePreview}>
          <Pressable 
            onPress={closeProfilePreview} 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          >
            <Animated.View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingBottom: 40,
                maxHeight: height * 0.65,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -8 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 20,
                transform: [
                  {
                    translateY: profilePreviewAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [400, 0],
                    }),
                  },
                ],
                opacity: profilePreviewAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.8, 1],
                }),
              }}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                {/* Drag handle */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                </View>

                {/* Profile content */}
                <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
                  {/* Avatar and basic info */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ 
                      width: 80, 
                      height: 80, 
                      borderRadius: 40, 
                      borderWidth: 3, 
                      borderColor: VELT_ACCENT,
                      overflow: 'hidden',
                      backgroundColor: colors.border,
                    }}>
                      {profilePreview?.avatar ? (
                        <Image source={{ uri: profilePreview.avatar }} style={{ width: 74, height: 74 }} />
                      ) : (
                        <View style={{ width: 74, height: 74, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="person" size={36} color={colors.subtext} />
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                          {profilePreview?.fullName ?? profilePreview?.username ?? 'User'}
                        </Text>
                        {profilePreviewLoading && (
                          <ActivityIndicator size="small" color={VELT_ACCENT} />
                        )}
                      </View>
                      {profilePreview?.username && (
                        <Text style={{ fontSize: 14, color: colors.subtext, marginTop: 2 }}>
                          @{profilePreview.username}
                        </Text>
                      )}
                      {profilePreview?.profession && (
                        <View style={{ 
                          marginTop: 8, 
                          backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 12,
                          alignSelf: 'flex-start',
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: VELT_ACCENT }}>
                            {profilePreview.profession}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Bio */}
                  {profilePreview?.bio && (
                    <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                      <Text style={{ fontSize: 14, color: colors.subtext, lineHeight: 20 }} numberOfLines={4}>
                        {profilePreview.bio}
                      </Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                    {/* Follow button */}
                    {profile?.id !== profilePreview?.userId && (
                      <Pressable
                        onPress={handleProfilePreviewFollow}
                        disabled={profilePreviewFollowLoading}
                        style={({ pressed }) => ({
                          flex: 1,
                          backgroundColor: profilePreviewFollowing ? 'transparent' : VELT_ACCENT,
                          borderWidth: profilePreviewFollowing ? 2 : 0,
                          borderColor: colors.border,
                          paddingVertical: 14,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 8,
                          opacity: pressed ? 0.8 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        })}
                      >
                        {profilePreviewFollowLoading ? (
                          <ActivityIndicator size="small" color={profilePreviewFollowing ? colors.text : '#fff'} />
                        ) : (
                          <>
                            <Ionicons 
                              name={profilePreviewFollowing ? 'checkmark' : 'person-add'} 
                              size={18} 
                              color={profilePreviewFollowing ? colors.text : '#fff'} 
                            />
                            <Text style={{ 
                              fontWeight: '700', 
                              fontSize: 15,
                              color: profilePreviewFollowing ? colors.text : '#fff',
                            }}>
                              {profilePreviewFollowing ? 'Following' : 'Follow'}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}

                    {/* Share button */}
                    <Pressable
                      onPress={handleProfilePreviewShare}
                      style={({ pressed }) => ({
                        flex: profile?.id === profilePreview?.userId ? 1 : 0,
                        minWidth: 56,
                        backgroundColor: colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <Ionicons name="share-outline" size={18} color={colors.text} />
                      <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text }}>Share</Text>
                    </Pressable>
                  </View>

                  {/* View profile button */}
                  <Pressable
                    onPress={handleProfilePreviewViewProfile}
                    style={({ pressed }) => ({
                      marginTop: 12,
                      backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      opacity: pressed ? 0.8 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Ionicons name="person-circle-outline" size={20} color={colors.subtext} />
                    <Text style={{ fontWeight: '600', fontSize: 15, color: colors.subtext }}>View Full Profile</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <Modal visible={showQRModal} transparent animationType="none" onRequestClose={closeQRModal} statusBarTranslucent>
          <Pressable style={styles.qrModalOverlay} onPress={closeQRModal}>
            <Animated.View
              style={[
                styles.qrModalCard,
                {
                  opacity: qrModalAnim,
                  transform: [
                    { scale: qrModalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                    { translateY: qrModalAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                  ],
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()} style={styles.qrModalCardInner}>
                {/* Animated pulsing gold background */}
                <Animated.View
                  style={[
                    styles.qrGoldPulse,
                    {
                      transform: [{ scale: qrPulseAnim }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#D4AF37', '#F2D06B', '#D4AF37', '#B8962E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.qrGoldGradient}
                  />
                </Animated.View>
                
                {/* QR Code with centered avatar */}
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={`https://hello.app/u/${profile?.username || profile?.id || 'user'}`}
                    size={200}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                    logo={{ uri: profile?.avatar_url ?? PLACEHOLDER_AVATAR }}
                    logoSize={50}
                    logoBackgroundColor="#FFFFFF"
                    logoBorderRadius={25}
                    logoMargin={4}
                  />
                </View>

                {/* User info below QR */}
                <View style={styles.qrUserInfo}>
                  <Text style={styles.qrUsername}>@{profile?.username || 'user'}</Text>
                  <Text style={styles.qrSubtext}>Scan to view profile</Text>
                </View>

                {/* Close indicator */}
                <Text style={styles.qrDismissHint}>Tap outside to close</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </TabSwipeContainer>
  );
}

/* -------------------------- PortalStoryOverlay -------------------------- */
// Top-level overlay rendered in a Modal — uses Reanimated + Gesture Handler
// Instagram/Snapchat-style story viewer with smooth animations
type FrameRect = { x: number; y: number; width: number; height: number; borderRadius?: number };

type PortalOverlayHandle = {
  // animate closing to this target frame (or null = shrink to center fallback)
  closeToFrame: (target?: FrameRect | null) => Promise<void>;
};

// Spring configs for Instagram-like feel
const SPRING_CONFIG_OPEN = { damping: 20, stiffness: 300, mass: 0.8 };
const SPRING_CONFIG_CLOSE = { damping: 22, stiffness: 280, mass: 0.7 };
const SPRING_CONFIG_SNAP = { damping: 18, stiffness: 400, mass: 0.5 };

const PortalStoryOverlay = forwardRef<
  PortalOverlayHandle,
  { launchOverlay: LaunchOverlayState; onRequestClose: () => void; onClosed?: () => void; onNext?: () => void; onPrev?: () => void }
>(
  ({ launchOverlay, onRequestClose, onClosed, onNext, onPrev }, ref) => {
    if (!launchOverlay) return null;
    const start = launchOverlay.initial;
    const startFrame = useSharedValue({ x: start.x, y: start.y, w: start.width, h: start.height, r: start.borderRadius ?? 50 });
    const progress = useSharedValue(0); // 0=bubble frame, 1=fullscreen
    const contentOpacity = useSharedValue(0); // for smooth content fade-in

    const dragX = useSharedValue(0);
    const dragY = useSharedValue(0);
    const dragScale = useSharedValue(1); // Instagram-style scale on drag
    const mode = useSharedValue<'idle' | 'vertical' | 'horizontal'>('idle');
    const animating = useSharedValue(false);
    const isDismissing = useSharedValue(false);

    // JS callbacks for runOnJS - must be defined as stable references
    const handleClosed = useCallback(() => {
      try {
        onClosed?.();
      } catch (err) {
        console.warn('[overlay] onClosed threw', err);
      }
    }, [onClosed]);

    const handleRequestClose = useCallback(() => {
      try {
        onRequestClose();
      } catch (err) {
        console.warn('[overlay] onRequestClose threw', err);
      }
    }, [onRequestClose]);

    const handleNext = useCallback(() => {
      try {
        onNext?.();
      } catch (err) {
        console.warn('[overlay] onNext threw', err);
      }
    }, [onNext]);

    const handlePrev = useCallback(() => {
      try {
        onPrev?.();
      } catch (err) {
        console.warn('[overlay] onPrev threw', err);
      }
    }, [onPrev]);

    useEffect(() => {
      // Instagram-style spring open animation
      progress.value = withSpring(1, SPRING_CONFIG_OPEN);
      // Fade in content slightly delayed for smoother feel
      contentOpacity.value = withTiming(1, { duration: 200 });
    }, []);

    // expose imperative close method
    useImperativeHandle(ref, () => ({
      closeToFrame: async (target?: FrameRect | null) => {
        return new Promise<void>((resolve) => {
          isDismissing.value = true;
          // switch the anchor (startFrame) to the measured close target if provided
          if (target) {
            startFrame.value = { x: target.x, y: target.y, w: target.width, h: target.height, r: target.borderRadius ?? 50 } as any;
          } else {
            // center fallback — set startFrame to small centered rect
            startFrame.value = { x: width / 2 - 50, y: height / 2 - 50, w: 100, h: 100, r: 50 } as any;
          }
          animating.value = true;
          // Fade out content first, then animate frame
          contentOpacity.value = withTiming(0, { duration: 150 });
          progress.value = withSpring(0, SPRING_CONFIG_CLOSE, (isFinished) => {
            if (isFinished) {
              animating.value = false;
              isDismissing.value = false;
              runOnJS(handleClosed)();
              runOnJS(resolve)();
            }
          });
        });
      },
    }));

    // derived visual values: center offsets, scale, borderRadius, opacity
    const animatedStyle = useAnimatedStyle(() => {
      const s = startFrame.value;
      const originCenterX = s.x + s.w / 2 - width / 2;
      const originCenterY = s.y + s.h / 2 - height / 2;
      
      // Use uniform scale for Instagram-like expansion (not separate scaleX/scaleY)
      const scaleVal = interpolate(progress.value, [0, 1], [Math.max(s.w, s.h) / Math.max(width, height), 1], Extrapolate.CLAMP);
      
      // Apply drag scale for swipe-down effect (Instagram shrinks as you pull)
      const dragInfluence = Math.min(1, Math.abs(dragY.value) / (height * 0.5));
      const combinedScale = scaleVal * interpolate(dragInfluence, [0, 1], [1, 0.85], Extrapolate.CLAMP) * dragScale.value;
      
      const translateX = interpolate(progress.value, [0, 1], [originCenterX, 0], Extrapolate.CLAMP) + dragX.value;
      const translateY = interpolate(progress.value, [0, 1], [originCenterY, 0], Extrapolate.CLAMP) + dragY.value;
      
      // Instagram-style border radius: starts as circle, becomes 0 when fullscreen
      const br = interpolate(progress.value, [0, 0.5, 1], [s.r ?? 50, 24, 0], Extrapolate.CLAMP);

      return {
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        transform: [{ translateX }, { translateY }, { scale: combinedScale }],
        borderRadius: br,
        overflow: 'hidden',
        backgroundColor: '#000',
        zIndex: 130,
      } as any;
    });

    // Content wrapper style for fade-in effect (prevents black flash)
    const contentWrapperStyle = useAnimatedStyle(() => ({
      flex: 1,
      opacity: contentOpacity.value,
    }));

    const overlayBackdropStyle = useAnimatedStyle(() => {
      // Smooth backdrop that fades based on progress and drag
      const baseOpacity = interpolate(progress.value, [0, 0.3, 1], [0, 0.4, 0.95], Extrapolate.CLAMP);
      const dragAbs = Math.min(1, Math.abs(dragY.value) / (height * 0.4));
      const finalOpacity = Math.max(0, baseOpacity * (1 - dragAbs * 0.9));
      return { 
        position: 'absolute', 
        left: 0, 
        top: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: `rgba(0,0,0,${finalOpacity.toFixed(3)})`, 
        zIndex: 125 
      };
    });

    // hide label near fullscreen
    const showLabel = useDerivedValue(() => (progress.value < 0.85 ? 1 : 0));

    // gesture handling - Instagram/Snapchat style
    const THRESH_H = width * 0.2;
    const THRESH_V = height * 0.12; // Lower threshold for easier dismiss
    const VEL_THRESH = 800; // Lower velocity threshold for snappier response

    const useAGH: any = typeof useAnimatedGestureHandlerImported === 'function' ? useAnimatedGestureHandlerImported : (Reanimated as any).useAnimatedGestureHandler;

    let handlerOnGesture: any = null;
    let handlerOnStateChange: any | undefined = undefined;

    if (typeof useAGH === 'function') {
      handlerOnGesture = useAGH({
        onStart: (_: any, ctx: any) => {
          ctx.sx = dragX.value;
          ctx.sy = dragY.value;
          mode.value = 'idle';
          cancelAnimation(dragX);
          cancelAnimation(dragY);
          cancelAnimation(dragScale);
        },
        onActive: (ev: any, ctx: any) => {
          const absX = Math.abs(ev.translationX);
          const absY = Math.abs(ev.translationY);
          
          if (mode.value === 'idle') {
            // Determine gesture direction with slight bias toward vertical for dismiss
            if (absY > absX * 0.7) mode.value = 'vertical';
            else if (absX > absY) mode.value = 'horizontal';
          }

          if (mode.value === 'vertical') {
            // Instagram-style: vertical drag with slight horizontal parallax
            dragY.value = ctx.sy + ev.translationY;
            dragX.value = ctx.sx + ev.translationX * 0.2;
            // Scale down as you drag (Instagram effect)
            const dragRatio = Math.min(1, Math.abs(ev.translationY) / (height * 0.4));
            dragScale.value = interpolate(dragRatio, [0, 1], [1, 0.92], Extrapolate.CLAMP);
          } else if (mode.value === 'horizontal') {
            // Horizontal paging
            dragX.value = ctx.sx + ev.translationX;
            dragY.value = ctx.sy * 0.3;
            dragScale.value = 1;
          }
        },
        onEnd: (ev: any) => {
          const dy = dragY.value;
          const vy = ev.velocityY;

          if (mode.value === 'horizontal') {
            const dx = dragX.value;
            if (Math.abs(dx) > THRESH_H || Math.abs(ev.velocityX) > 600) {
              const direction = dx > 0 ? -1 : 1;
              dragX.value = withTiming(direction * width, { duration: 180 }, () => {
                if (direction === 1) runOnJS(handleNext)();
                else runOnJS(handlePrev)();
                dragX.value = withTiming(0, { duration: 200 });
              });
            } else {
              dragX.value = withSpring(0, SPRING_CONFIG_SNAP);
            }
            dragScale.value = withSpring(1, SPRING_CONFIG_SNAP);
          } else {
            // Vertical dismiss - Instagram style
            const shouldDismiss = Math.abs(dy) > THRESH_V || Math.abs(vy) > VEL_THRESH;
            if (shouldDismiss) {
              // Animate out in the direction of the swipe
              const exitDirection = dy > 0 ? 1 : -1;
              isDismissing.value = true;
              dragY.value = withTiming(exitDirection * height * 0.6, { duration: 200 });
              dragScale.value = withTiming(0.7, { duration: 200 });
              contentOpacity.value = withTiming(0, { duration: 150 });
              // Then request close
              runOnJS(handleRequestClose)();
            } else {
              // Snap back with spring
              dragX.value = withSpring(0, SPRING_CONFIG_SNAP);
              dragY.value = withSpring(0, SPRING_CONFIG_SNAP);
              dragScale.value = withSpring(1, SPRING_CONFIG_SNAP);
            }
          }

          mode.value = 'idle';
        },
      });
    } else {
      // Fallback JS-driven handler
      const ctx: any = { sx: 0, sy: 0, mode: 'idle' };
      handlerOnGesture = (ev: any) => {
        const e = ev.nativeEvent ?? ev;
        const absX = Math.abs(e.translationX ?? 0);
        const absY = Math.abs(e.translationY ?? 0);
        if (ctx.mode === 'idle') ctx.mode = absY > absX * 0.7 ? 'vertical' : 'horizontal';
        if (ctx.mode === 'vertical') {
          dragY.value = (e.translationY ?? 0) + ctx.sy;
          dragX.value = (e.translationX ?? 0) * 0.2 + ctx.sx;
          const dragRatio = Math.min(1, Math.abs(e.translationY ?? 0) / (height * 0.4));
          dragScale.value = interpolate(dragRatio, [0, 1], [1, 0.92], Extrapolate.CLAMP);
        } else {
          dragX.value = (e.translationX ?? 0) + ctx.sx;
          dragY.value = ctx.sy * 0.3;
        }
      };

      handlerOnStateChange = (ev: any) => {
        const state = ev.nativeEvent?.state ?? ev.state ?? 0;
        if (state === 2) {
          ctx.sx = dragX.value;
          ctx.sy = dragY.value;
        } else if (state === 4 || state === 5) {
          const dy = dragY.value;
          const vy = ev.nativeEvent?.velocityY ?? ev.velocityY ?? 0;
          if (ctx.mode === 'horizontal') {
            const dx = dragX.value;
            if (Math.abs(dx) > THRESH_H) {
              const direction = dx > 0 ? -1 : 1;
              dragX.value = withTiming(direction * width, { duration: 180 }, () => {
                if (direction === 1) runOnJS(handleNext)();
                else runOnJS(handlePrev)();
                dragX.value = withTiming(0, { duration: 200 });
              });
            } else dragX.value = withSpring(0, SPRING_CONFIG_SNAP);
            dragScale.value = withSpring(1, SPRING_CONFIG_SNAP);
          } else {
            const shouldDismiss = Math.abs(dy) > THRESH_V || Math.abs(vy) > VEL_THRESH;
            if (shouldDismiss) {
              const exitDirection = dy > 0 ? 1 : -1;
              dragY.value = withTiming(exitDirection * height * 0.6, { duration: 200 });
              dragScale.value = withTiming(0.7, { duration: 200 });
              contentOpacity.value = withTiming(0, { duration: 150 });
              runOnJS(handleRequestClose)();
            } else {
              dragX.value = withSpring(0, SPRING_CONFIG_SNAP);
              dragY.value = withSpring(0, SPRING_CONFIG_SNAP);
              dragScale.value = withSpring(1, SPRING_CONFIG_SNAP);
            }
          }
          ctx.mode = 'idle';
          ctx.sx = 0; ctx.sy = 0;
        }
      };
    }

    // render content — show full viewer when we have userId
    const content = launchOverlay.userId ? (
      <UserStoriesView initialUserId={launchOverlay.userId} onClose={handleRequestClose} />
    ) : launchOverlay.mediaType === 'video' && launchOverlay.mediaUrl ? (
      <Video source={{ uri: launchOverlay.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
    ) : launchOverlay.mediaUrl ? (
      <Image source={{ uri: launchOverlay.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    ) : null;

    // label style (fade away near fullscreen)
    const labelStyle = useAnimatedStyle(() => ({
      opacity: interpolate(showLabel.value, [0, 1], [0, 1], Extrapolate.CLAMP),
      transform: [{ translateY: interpolate(progress.value, [0, 0.8, 1], [8, 4, -8], Extrapolate.CLAMP) }],
    }));

    // bottom controls hide when dragging vertically or when not fully opened
    const controlsOpacity = useDerivedValue(() => {
      const dragAbs = Math.min(1, Math.abs(dragY.value) / 150);
      const appear = interpolate(progress.value, [0, 0.7, 1], [0, 0.5, 1], Extrapolate.CLAMP);
      return appear * (1 - dragAbs);
    });

    const controlsStyle = useAnimatedStyle(() => ({
      opacity: controlsOpacity.value,
      transform: [{ translateY: interpolate(controlsOpacity.value, [0, 1], [16, 0], Extrapolate.CLAMP) }],
      pointerEvents: controlsOpacity.value > 0.1 ? 'auto' as const : 'none' as const,
    }));

    // Close hint indicator (shows when dragging down)
    const closeHintStyle = useAnimatedStyle(() => {
      const dragDown = Math.max(0, dragY.value);
      const showHint = interpolate(dragDown, [0, 50, 100], [0, 0.5, 1], Extrapolate.CLAMP);
      return {
        opacity: showHint,
        transform: [{ scale: interpolate(showHint, [0, 1], [0.8, 1], Extrapolate.CLAMP) }],
      };
    });

    return (
      <Modal visible transparent statusBarTranslucent onRequestClose={handleRequestClose}>
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <Reanimated.View style={overlayBackdropStyle} pointerEvents="none" />

          <PanGestureHandler onGestureEvent={handlerOnGesture} onHandlerStateChange={handlerOnStateChange} activeOffsetY={[-4, 4]} activeOffsetX={[-4, 4]}>
            <Reanimated.View style={animatedStyle} pointerEvents="auto">
              {/* Content wrapper with fade effect to prevent black flash */}
              <Reanimated.View style={contentWrapperStyle}>
                {content}
              </Reanimated.View>

              {/* Close hint indicator at top */}
              <Reanimated.View style={[{ position: 'absolute', top: 60, alignSelf: 'center' }, closeHintStyle]} pointerEvents="none">
                <View style={{ backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Release to close</Text>
                </View>
              </Reanimated.View>

              {launchOverlay.displayName && !launchOverlay.userId ? (
                <Reanimated.View style={[{ position: 'absolute', left: 12, right: 12, bottom: 20 }, labelStyle]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '900', fontSize: 17, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>{launchOverlay.displayName}</Text>
                  </View>
                </Reanimated.View>
              ) : null}
              
              {/* simple bottom controls for single-media previews */}
              {!launchOverlay.userId ? (
                <Reanimated.View style={[{ position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' }, controlsStyle]} pointerEvents="box-none">
                  <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <Ionicons name="heart-outline" size={24} color="#fff" />
                      <Ionicons name="chatbubble-outline" size={24} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }} />
                    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Reply</Text>
                    </View>
                  </View>
                </Reanimated.View>
              ) : null}
            </Reanimated.View>
          </PanGestureHandler>
        </View>
      </Modal>
    );
  }
);

PortalStoryOverlay.displayName = 'PortalStoryOverlay';

/* ------------------------ STYLES ------------------------ */
const styles: any = StyleSheet.create({
  uploadBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadBannerTitle: { fontSize: 14, fontWeight: '800' },
  uploadBannerSubtitle: { fontSize: 12, marginTop: 2 },
  uploadBannerTrack: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  uploadBannerFill: { height: '100%', borderRadius: 999 },
  headerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
    borderBottomWidth: 0, // remove bottom border so header blends with content
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 4 : (StatusBar.currentHeight ?? 12) - 6,
    paddingBottom: 8,
  },
  brand: {
    fontSize: 24,
    fontWeight: '900',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '800',
  },
  actionPill: {
    minWidth: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 6,
  },
  pillBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 60,
  },
  pillBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  bigBtn: {
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    right: -4,
    top: -4,
    backgroundColor: '#f00',
    zIndex: 50,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  smallText: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtext: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  emptyStateLarge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  // home doodles - deep and bold (no fade out)
  homeDoodleLarge: {
    position: 'absolute',
    left: -48,
    top: -46,
    width: 520,
    height: 520,
    borderRadius: 300,
    borderWidth: 6.6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  homeDoodleRight: {
    position: 'absolute',
    right: -78,
    top: 36,
    width: 360,
    height: 360,
    borderRadius: 220,
    borderWidth: 5.6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  homeDoodleLower: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 160,
    height: 160,
    borderRadius: 120,
    borderWidth: 6.4,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    zIndex: 0,
  },
  offlineBanner: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: '#fff',
    fontWeight: '800',
  },
  launchOverlay: {
    position: 'absolute',
    zIndex: 120,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  launchOverlayFallback: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchOverlayFallbackText: {
    color: '#fff',
    fontWeight: '700',
    marginTop: 8,
  },
  launchOverlayLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  launchOverlayLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  launchOverlayLabelText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    flexShrink: 1,
  },
  // QR Modal Styles
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalCardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  qrGoldPulse: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
  },
  qrGoldGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  qrCodeContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  qrUserInfo: {
    marginTop: 24,
    alignItems: 'center',
  },
  qrUsername: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qrSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  qrDismissHint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    marginTop: 32,
    fontWeight: '400',
  },
});






