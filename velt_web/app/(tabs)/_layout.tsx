import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, AccessibilityInfo, Animated, Easing } from 'react-native';
import { withLayoutContext, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useTheme, VELT_ACCENT } from 'app/themes';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { useLoadingStore } from '@/lib/store/loadingStore';

type BannerState = {
  visible: boolean;
  title: string;
  body: string;
  onPress?: () => void;
};

const { Navigator } = createBottomTabNavigator();

const BottomTabs = withLayoutContext(Navigator);

type TabDisplay = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

// Tab order: Contents, Shopr, Home (center), Billboards, Chats
// E-commerce (Shopr, Billboards) on sides, creation/social (Contents, Chats) at ends, Home in center
const TAB_ITEMS: TabDisplay[] = [
  { name: 'Contents', label: 'Contents', icon: 'play-circle' },
  { name: 'Shopr', label: 'Shopr', icon: 'bag-handle' },
  { name: 'home', label: 'Home', icon: 'location' },
  { name: 'Billboards', label: 'Billboards', icon: 'pricetag' },
  { name: 'Chats', label: 'Chats', icon: 'chatbubble-ellipses' },
];

const NotificationBanner = ({ visible, title, body, onClose, onPress }: BannerState & { onClose: () => void }) => {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <TouchableOpacity onPress={onPress} style={styles.bannerContent}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerBody}>{body}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function TabLayout() {
  const { colors, selectedKey } = useTheme();
  const isDark = colors.background === '#000' || colors.background?.toLowerCase() === '#000000' || colors.card?.toLowerCase()?.startsWith('#1') || colors.card?.toLowerCase()?.startsWith('#0');

  // Loading store for global loading indicator glow
  const contentLoading = useLoadingStore((s) => s.contentLoading);
  const loadingPulse = useRef(new Animated.Value(0)).current;
  const loadingAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  
  // Animated gradient component
  const AnimatedLinearGradient = useMemo(() => Animated.createAnimatedComponent(LinearGradient), []);

  // Loading pulse animation effect
  useEffect(() => {
    if (contentLoading) {
      // Start the gradient pulse animation
      loadingAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(loadingPulse, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(loadingPulse, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
      loadingAnimRef.current.start();
    } else {
      // Fade out when loading completes
      loadingAnimRef.current?.stop();
      Animated.timing(loadingPulse, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }

    return () => {
      loadingAnimRef.current?.stop();
    };
  }, [contentLoading, loadingPulse]);

  // Interpolate loading pulse for gradient opacity
  const loadingGradientOpacity = loadingPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  // deep, non-fading doodle background for the global tabs layout
  const [reduceMotion, setReduceMotion] = useState(false);
  const doodleA = useRef(new Animated.Value(0)).current;
  const doodleB = useRef(new Animated.Value(0)).current;
  const doodleC = useRef(new Animated.Value(0)).current;
  const doodleAnimRef = useRef<any>(null);
  // global tab layout shouldn't rely on the user's doodle feature toggle — only respect reduced-motion

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((isReduced) => setReduceMotion(isReduced))
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    try {
      const willAnimate = !reduceMotion;
      if (!doodleAnimRef.current) {
        doodleAnimRef.current = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(doodleA, { toValue: 1, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              Animated.timing(doodleA, { toValue: 0, duration: 8200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.delay(600),
              Animated.timing(doodleB, { toValue: 1, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              Animated.timing(doodleB, { toValue: 0, duration: 9200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.delay(1200),
              Animated.timing(doodleC, { toValue: 1, duration: 9800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              Animated.timing(doodleC, { toValue: 0, duration: 9800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
          ])
        );
      }

      if (willAnimate) {
        try { doodleAnimRef.current.start(); } catch {}
      } else {
        try { doodleAnimRef.current.stop?.(); } catch {}
        try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {}
      }
    } catch (e) {}
    return () => { try { doodleAnimRef.current?.stop?.(); } catch {} };
  }, [doodleA, doodleB, doodleC, reduceMotion]);

  const showAnimatedDoodles = !reduceMotion;
  const showStaticDoodles = reduceMotion;

  const router = withSafeRouter(useRouter());
  const store = useProfileStore ? useProfileStore() : null;
  const storeProfile = store?.profile ?? null;
  const [profile, setProfile] = useState<{ id?: string; avatar_url?: string | null } | null>(
    storeProfile ? { id: storeProfile.id, avatar_url: storeProfile.avatar_url } : null
  );

  const [banner, setBanner] = useState<BannerState>({ visible: false, title: '', body: '' });

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = (response?.notification?.request?.content?.data || {}) as any;
        if (data?.screen && typeof data.screen === 'string') {
          setTimeout(() => {
            try {
              router.push(data.screen, data.params);
            } catch {}
          }, 250);
        }
      } catch {}
      setBanner((s) => ({ ...s, visible: false }));
    });

    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = (last?.notification?.request?.content?.data || {}) as any;
        if (data?.screen && typeof data.screen === 'string') {
          setTimeout(() => {
            try {
              router.push(data.screen, data.params);
            } catch {}
          }, 250);
        }
      } catch {}
    })();

    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const tokenObj = await Notifications.getExpoPushTokenAsync();
        const token = tokenObj?.data ?? null;
        if (token) {
          await supabase.from('profiles').update({ expo_push_token: token }).eq('id', profile.id);
        }
      } catch {}
    })();
  }, [profile?.id]);

  useEffect(() => {
    if (storeProfile && storeProfile.id) {
      setProfile({ id: storeProfile.id, avatar_url: storeProfile.avatar_url ?? null });
    } else {
      (async () => {
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user?.id) {
            setProfile((p) => p ?? { id: data.user.id, avatar_url: null });
          }
        } catch {}
      })();
    }
  }, [storeProfile]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`tab-banner:${profile.id}`)
      .on('postgres_changes', { schema: 'public', table: 'notifications', event: 'INSERT', filter: `recipient=eq.${profile.id}` }, (payload: any) => {
        const n = payload?.new;
        if (!n) return;
        setBanner({
          visible: true,
          title: n.title ?? 'Notification',
          body: n.body ?? '',
          onPress: () => {
            if (n?.data?.screen) {
              router.push(n.data.screen, n.data.params);
            }
          },
        });
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch {}
    };
  }, [profile?.id, router]);

  return (
    <>
      {/* Global doodle background for tabs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {showAnimatedDoodles ? (
          <>
            <Animated.View style={[styles.tabsDoodleLeft, { borderColor: colors.accent, opacity: 0.72, transform: [{ translateX: doodleA.interpolate({ inputRange: [0, 1], outputRange: [-36, 48] }) }, { translateY: doodleA.interpolate({ inputRange: [0, 1], outputRange: [-20, 64] }) }, { rotate: doodleA.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }) }] }]} />
            <Animated.View style={[styles.tabsDoodleRight, { borderColor: colors.subtext, opacity: 0.58, transform: [{ translateX: doodleB.interpolate({ inputRange: [0, 1], outputRange: [40, -56] }) }, { translateY: doodleB.interpolate({ inputRange: [0, 1], outputRange: [10, -36] }) }, { rotate: doodleB.interpolate({ inputRange: [0, 1], outputRange: ['4deg', '-12deg'] }) }] }]} />
            <Animated.View style={[styles.tabsDoodleLower, { borderColor: colors.faint || colors.accent, opacity: 0.62, transform: [{ translateX: doodleC.interpolate({ inputRange: [0, 1], outputRange: [-42, 26] }) }, { translateY: doodleC.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }, { rotate: doodleC.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) }] }]} />
          </>
        ) : showStaticDoodles ? (
          <>
            <View style={[styles.tabsDoodleLeft, { borderColor: colors.accent, opacity: 0.64 }]} />
            <View style={[styles.tabsDoodleRight, { borderColor: colors.subtext, opacity: 0.5 }]} />
            <View style={[styles.tabsDoodleLower, { borderColor: colors.faint || colors.accent, opacity: 0.6 }]} />
          </>
        ) : null}
      </View>
      <BottomTabs
        key={selectedKey}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            overflow: 'hidden',
            height: Platform.select({ ios: 85, default: 70 }),
            paddingBottom: Platform.select({ ios: 24, default: 10 }),
            paddingTop: 10,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.subtext,
          tabBarShowLabel: false,
          tabBarIconStyle: {
            marginTop: 4,
          },
          tabBarBackground: () => (
            <>
              {/* Loading gradient pulse overlay */}
              {contentLoading && (
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
                        ? ['rgba(0,212,255,0.5)', 'rgba(0,184,230,0.4)', 'rgba(0,255,200,0.5)', 'rgba(0,212,255,0.4)']
                        : ['rgba(0,184,230,0.35)', 'rgba(0,160,200,0.3)', 'rgba(0,200,180,0.35)', 'rgba(0,184,230,0.3)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              )}
            </>
          ),
        }}
      >
        {TAB_ITEMS.map((tab) => (
          <BottomTabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarLabel: () => null,
              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                <Ionicons name={tab.icon} size={26} color={color} />
              ),
            }}
          />
        ))}
      </BottomTabs>

      <NotificationBanner
        visible={banner.visible}
        title={banner.title}
        body={banner.body}
        onClose={() => setBanner((s) => ({ ...s, visible: false }))}
        onPress={() => {
          banner.onPress?.();
          setBanner((s) => ({ ...s, visible: false }));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.select({ ios: 54, default: 24 }),
    left: 16,
    right: 16,
    backgroundColor: '#202226',
    padding: 16,
    flexDirection: 'row',
    borderRadius: 14,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontWeight: '800',
    marginBottom: 4,
  },
  bannerBody: {
    color: '#fff',
  },
  closeButton: {
    padding: 6,
    alignSelf: 'flex-start',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  // tabs doodles
  tabsDoodleLeft: {
    position: 'absolute',
    left: -56,
    top: -44,
    width: 560,
    height: 560,
    borderRadius: 300,
    borderWidth: 6.4,
    borderStyle: 'solid',
  },
  tabsDoodleRight: {
    position: 'absolute',
    right: -64,
    top: 36,
    width: 360,
    height: 360,
    borderRadius: 220,
    borderWidth: 5.6,
    borderStyle: 'solid',
  },
  tabsDoodleLower: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 120,
    height: 160,
    borderRadius: 120,
    borderWidth: 6.0,
    borderStyle: 'solid',
  },
});



