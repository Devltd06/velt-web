import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  useColorScheme,
  AccessibilityInfo,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
// Ionicons imported once above
import * as Font from "expo-font";
import { VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from "app/themes";

// device width is used for full-screen paging below
import AuthLayout from "@/components/AuthLayout";

export default function Welcome() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const router = withSafeRouter(useRouter());
  // animations
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const previewsY = useRef(new Animated.Value(18)).current;
  const previewsOpacity = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const width = Dimensions.get('window').width; // full-screen slides match device width
  // Force welcome screen to always render in the "really dark" theme per design
  const dark = true;
  // Velt brand gradient colors with unique cyan accent
  const brandLight: [string, string] = [VELT_ACCENT, '#00E5A0']; // cyan to teal
  const brandDark: [string, string] = ['#000000', VELT_ACCENT]; // black to cyan
  const previewFloat1 = useRef(new Animated.Value(0)).current;
  const previewFloat2 = useRef(new Animated.Value(0)).current;
  const previewFloat3 = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  // doodle neon background anim values
  const doodleA = useRef(new Animated.Value(0)).current;
  const doodleB = useRef(new Animated.Value(0)).current;
  const doodleC = useRef(new Animated.Value(0)).current;
  const doodleAnimRef = useRef<any>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const loadFont = async () => {
      await Font.loadAsync({
        GreatVibes: require("../../assets/fonts/GreatVibes-Regular.ttf"),
      });
      setFontsLoaded(true);
    };
    loadFont();
  }, []);

  useEffect(() => {
    // run entrance animations once fonts are loaded
    if (!fontsLoaded) return;
    Animated.sequence([
      Animated.timing(titleOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
        Animated.stagger(120, [
          Animated.timing(previewsY, { toValue: 0, duration: 380, useNativeDriver: true }),
          Animated.timing(previewsOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        ]),
        ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoFloat, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(logoFloat, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ])
      )
    ]).start();
    // gentle bobbing for preview chips (staggered)
    Animated.loop(
      Animated.parallel([
        Animated.sequence([Animated.timing(previewFloat1, { toValue: 1, duration: 2600, useNativeDriver: true }), Animated.timing(previewFloat1, { toValue: 0, duration: 2600, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(300), Animated.timing(previewFloat2, { toValue: 1, duration: 2600, useNativeDriver: true }), Animated.timing(previewFloat2, { toValue: 0, duration: 2600, useNativeDriver: true })]),
        Animated.sequence([Animated.delay(600), Animated.timing(previewFloat3, { toValue: 1, duration: 2600, useNativeDriver: true }), Animated.timing(previewFloat3, { toValue: 0, duration: 2600, useNativeDriver: true })]),
      ])
    ).start();

    // neon doodles are controlled separately (respect feature flag & reduce-motion)
  }, [fontsLoaded, titleOpacity, logoScale, previewsY, previewsOpacity]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((isReduced) => setReduceMotion(isReduced)).catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    // start/stop doodle loop depending on reduce-motion (auth screens ignore the global doodle toggle)
    try {
      const willAnimate = !reduceMotion;
      if (!doodleAnimRef.current) {
        doodleAnimRef.current = Animated.loop(
          Animated.parallel([
            Animated.sequence([Animated.timing(doodleA, { toValue: 1, duration: 4200, useNativeDriver: true }), Animated.timing(doodleA, { toValue: 0, duration: 4200, useNativeDriver: true })]),
            Animated.sequence([Animated.delay(400), Animated.timing(doodleB, { toValue: 1, duration: 5200, useNativeDriver: true }), Animated.timing(doodleB, { toValue: 0, duration: 5200, useNativeDriver: true })]),
            Animated.sequence([Animated.delay(800), Animated.timing(doodleC, { toValue: 1, duration: 6200, useNativeDriver: true }), Animated.timing(doodleC, { toValue: 0, duration: 6200, useNativeDriver: true })]),
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
  }, [reduceMotion]);

  const showAnimatedDoodles = !reduceMotion;
  const showStaticDoodles = reduceMotion;

  const slides = [
    { title: 'Creators', copy: 'Discover and follow creators nearby. Explore short feeds and curated highlights.', icon: 'people-outline' },
    { title: 'Marketplace', copy: 'Buy and sell local goods with confidence. Support small businesses in your community.', icon: 'cart-outline' },
    { title: 'Billboards', copy: 'Book outdoor advertising spaces quickly and reach new audiences.', icon: 'megaphone-outline' },
  ];

  // per-slide gradient colors (light / dark variants) - using Velt cyan palette
  const slideColors = slides.map((_, i) => {
    if (!dark) {
      // light theme gradients
      const choices = [
        [VELT_ACCENT, '#00E5A0'], // creators - cyan to teal
        ['#00B8E6', VELT_ACCENT], // marketplace - light cyan to cyan
        [VELT_ACCENT, '#0099CC'], // billboards - cyan to darker
      ];
      return choices[i % choices.length];
    }
    // dark theme gradients (deep, full dark friendly) - still using cyan accents
    const darkChoices = [
      ['#003D4D', VELT_ACCENT],   // creators
      ['#004D40', '#00E5A0'],     // marketplace  
      ['#003344', '#00B8E6'],     // billboards
    ];
    return darkChoices[i % darkChoices.length];
  });

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: dark ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    // Welcome should be full-screen like the login page
    <AuthLayout showTitle={false} fullScreen={true}>
      {/* Disable back swipe */}
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      {/* full-screen dark when requested */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: dark ? '#000' : 'transparent' }} />

      {/* animated neon doodle background (under content) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {showAnimatedDoodles ? (
        <>
        <Animated.View style={[styles.doodle, {
          backgroundColor: 'transparent',
          borderColor: VELT_ACCENT,
          opacity: doodleA.interpolate({ inputRange: [0,1], outputRange: [0.06, 0.32] }),
          borderWidth: 3.6,
          transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [-20, 24] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [6, 100] }) }, { rotate: doodleA.interpolate({ inputRange: [0,1], outputRange: ['-6deg', '6deg'] }) }]
        }]} />
        <Animated.View style={[styles.doodle, {
          backgroundColor: 'transparent',
          borderColor: '#00E5A0',
          opacity: doodleB.interpolate({ inputRange: [0,1], outputRange: [0.04, 0.28] }),
          left: 40,
          top: 220,
          borderWidth: 3.2,
          transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [40, -26] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [6, -20] }) }, { rotate: doodleB.interpolate({ inputRange: [0,1], outputRange: ['3deg', '-5deg'] }) }]
        }]} />
        <Animated.View style={[styles.doodle, {
          backgroundColor: 'transparent',
          borderColor: '#00B8E6',
          opacity: doodleC.interpolate({ inputRange: [0,1], outputRange: [0.03, 0.22] }),
          right: 12,
          bottom: 26,
          borderWidth: 3.4,
          transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [-18, 18] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [-6, 6] }) }, { rotate: doodleC.interpolate({ inputRange: [0,1], outputRange: ['-12deg', '12deg'] }) }]
        }]} />

        {/* add more thick doodle elements clustered on the right side */}
        <Animated.View style={[styles.doodleRight, {
          borderColor: VELT_ACCENT,
          opacity: doodleA.interpolate({ inputRange: [0,1], outputRange: [0.04, 0.24] }),
          borderWidth: 4.2,
          transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [10, -40] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [0, 30] }) }, { rotate: doodleA.interpolate({ inputRange: [0,1], outputRange: ['8deg', '-8deg'] }) }]
        }]} />
        {/* doodles clustered near the login area (lower part) */}
        <Animated.View style={[styles.doodleLower, { borderColor: VELT_ACCENT, opacity: doodleA.interpolate({ inputRange: [0,1], outputRange: [0.02, 0.22] }), borderWidth: 4.2, transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [0, 6] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [6, 24] }) }] }]} />
        <Animated.View style={[styles.doodleLower2, { borderColor: '#00E5A0', opacity: doodleB.interpolate({ inputRange: [0,1], outputRange: [0.02, 0.18] }), borderWidth: 4.0, transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [6, -10] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [8, -16] }) }] }]} />
        <Animated.View style={[styles.doodleLower3, { borderColor: '#00B8E6', opacity: doodleC.interpolate({ inputRange: [0,1], outputRange: [0.01, 0.16] }), borderWidth: 3.6, transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [-6, 12] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [12, -8] }) }] }]} />
        <Animated.View style={[styles.doodleRight, {
          borderColor: '#00E5A0',
          opacity: doodleB.interpolate({ inputRange: [0,1], outputRange: [0.03, 0.18] }),
          borderWidth: 3.8,
          right: 18,
          top: 60,
          height: 220,
          transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [-6, 24] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [-8, 18] }) }, { rotate: doodleB.interpolate({ inputRange: [0,1], outputRange: ['-10deg', '12deg'] }) }]
        }]} />
        <Animated.View style={[styles.doodleRight, {
          borderColor: '#00B8E6',
          opacity: doodleC.interpolate({ inputRange: [0,1], outputRange: [0.02, 0.14] }),
          borderWidth: 3.2,
          right: 44,
          bottom: 40,
          height: 260,
          transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [26, -6] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [6, -26] }) }, { rotate: doodleC.interpolate({ inputRange: [0,1], outputRange: ['4deg', '-18deg'] }) }]
        }]} />
        </>
        ) : showStaticDoodles ? (
          <>
            <View style={[styles.doodle, { backgroundColor: 'transparent', borderColor: '#6EE7F0', opacity: 0.14, borderWidth: 3.6 }]} />
            <View style={[styles.doodle, { backgroundColor: 'transparent', borderColor: '#FF6B6B', left: 40, top: 220, opacity: 0.12, borderWidth: 3.2 }]} />
            <View style={[styles.doodle, { backgroundColor: 'transparent', borderColor: '#FFD166', right: 12, bottom: 26, opacity: 0.1, borderWidth: 3.4 }]} />
            <View style={[styles.doodleRight, { borderColor: '#6EE7F0', opacity: 0.12, borderWidth: 4.2 }]} />
            <View style={[styles.doodleLower, { borderColor: '#6EE7F0', opacity: 0.12, borderWidth: 4.2 }]} />
            <View style={[styles.doodleLower2, { borderColor: '#FF6B6B', opacity: 0.1, borderWidth: 4.0 }]} />
            <View style={[styles.doodleLower3, { borderColor: '#FFD166', opacity: 0.08, borderWidth: 3.6 }]} />
            <View style={[styles.doodleRight, { borderColor: '#FF6B6B', opacity: 0.1, borderWidth: 3.8, right: 18, top: 60, height: 220 }]} />
            <View style={[styles.doodleRight, { borderColor: '#FFD166', opacity: 0.08, borderWidth: 3.2, right: 44, bottom: 40, height: 260 }]} />
          </>
        ) : null}
      </View>

      <View style={[styles.content, { backgroundColor: 'transparent' }]}>
        {/* Inline headline: Welcome to VELT (VELT uses GreatVibes) */}
        <Animated.View style={[styles.titleRow, { opacity: titleOpacity }] }>
          <Text style={[styles.welcome, { color: dark ? '#fff' : '#071133' }]}>Welcome to </Text>
          <Animated.Text style={[styles.appNameInline, { fontFamily: "GreatVibes", color: dark ? '#fff' : '#071133', transform: [{ scale: logoScale }, { translateY: logoFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] } ]}>VELT</Animated.Text>
        </Animated.View>
        <Animated.Text style={[styles.description, { opacity: titleOpacity, color: dark ? 'rgba(255,255,255,0.88)' : 'rgba(7,17,51,0.76)' }]}>A simple way to discover creators, shop local and advertise outdoors.</Animated.Text>

        {/* 3 highlight slides */}
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width: '100%', marginTop: 36 }}
          contentContainerStyle={{ paddingHorizontal: 0 }}
          onScroll={Animated.event([
            { nativeEvent: { contentOffset: { x: scrollX } } }
          ], { useNativeDriver: true })}
          scrollEventThrottle={16}
        >
          {slides.map((s, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const translateY = scrollX.interpolate({ inputRange, outputRange: [24, 0, 24], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });

            return (
              <Animated.View key={i} style={[styles.slide, { width, opacity, transform: [{ translateY }], paddingHorizontal: 28 }]}>
                      {/* slide background reflection removed (no slide-level reflection) */}

                      <LinearGradient colors={slideColors[i] as [string, string]} style={[styles.slideIcon, { padding: 0 }]} start={[0,0]} end={[1,1]}>
                        <View style={{ width: 128, height: 128, borderRadius: 72, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={s.icon as any} size={56} color={dark ? 'rgba(255,255,255,0.95)' : 'rgba(7,17,51,0.95)'} />
                        </View>
                      </LinearGradient>
                <Text style={[styles.slideTitle, { color: dark ? '#fff' : '#071133' }]}>{s.title}</Text>
                <Text style={[styles.slideCopy, { color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(7,17,51,0.75)' }]}>{s.copy}</Text>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>

        {/* pager dots */}
        <View style={styles.pagerRow}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotScale = scrollX.interpolate({ inputRange, outputRange: [0.8, 1.4, 0.8], extrapolate: 'clamp' });
            const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });
            return (
              <Animated.View key={i} style={[styles.pagerDot, { opacity: dotOpacity, transform: [{ scale: dotScale }], backgroundColor: dark ? 'rgba(255,255,255,0.85)' : 'rgba(7,17,51,0.85)' }]} />
            );
          })}
        </View>

        {/* Buttons */}
        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/auth/login")}
            activeOpacity={0.9}
          >
            <LinearGradient colors={dark ? brandDark : brandLight} start={[0,0]} end={[1,1]} style={[styles.primaryGradient, { borderRadius: 999, width: '100%', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={[styles.buttonText, { textAlign: 'center', width: '100%' }]}>Login</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { marginTop: 12 }]}
            onPress={() => router.push("/auth/signup")}
            activeOpacity={0.9}
          >
            <LinearGradient colors={dark ? brandLight : brandDark} start={[0,0]} end={[1,1]} style={[styles.primaryGradient, { borderRadius: 999, width: '100%', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={[styles.buttonText, { textAlign: 'center', width: '100%' }]}>Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>© 2025 atmosdev. All rights reserved.</Text>
        
        {/* Bottom safe area spacer for iPhone X and newer */}
        <View style={{ height: 20 }} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  /* gradient/background is handled by AuthLayout */
  content: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  welcome: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 6,
    fontWeight: "500",
  },
  appName: {
    fontSize: 62,
    color: "#fff",
    marginBottom: 12,
    lineHeight: 64,
  },
  description: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 22,
    maxWidth: 640,
  },
  button: {
    width: "92%",
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryGradient: { paddingVertical: 16, borderRadius: 18 },
  loginButton: {
    backgroundColor: "#507b94ff",
  },
  buttonText: {
    fontWeight: "700",
    fontSize: 20,
    color: "#fff",
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 40,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.69)",
  },
  previewCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 110,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  previewText: { color: '#071133', fontSize: 12, fontWeight: '700' },
  slide: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 10,
  },
  slideIcon: {
    width: 128,
    height: 128,
    borderRadius: 72,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  slideCopy: { color: '#071133', textAlign: 'center', maxWidth: 540 },
  pagerRow: { flexDirection: 'row', marginTop: 16, justifyContent: 'center', marginBottom: 26 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 6 },
  appNameInline: { fontSize: 58, marginLeft: 6 },
  actionsWrap: { width: '100%', alignItems: 'center', marginTop: 28 },
  pagerDot: { width: 8, height: 8, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.85)', marginHorizontal: 6 },
  // thin neon-style line doodle across the top (elongated rounded line)
  doodle: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 6,
    height: 6,
    borderRadius: 40,
    borderWidth: 3.8,
    borderStyle: 'solid',
  },
  // vertical / angled neon lines cluster on the right
  doodleRight: {
    position: 'absolute',
    right: 12,
    width: 220,
    height: 8,
    borderRadius: 40,
    borderWidth: 4.4,
    borderStyle: 'solid',
  },
  // small helper for elongated reflection glow #2
  /* slideReflection removed per request */
  /* slideBg removed */
  doodleLower: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 156,
    height: 10,
    borderRadius: 80,
  },
  doodleLower2: {
    position: 'absolute',
    left: 72,
    right: 72,
    bottom: 104,
    height: 12,
    borderRadius: 80,
  },
  doodleLower3: {
    position: 'absolute',
    left: 18,
    right: 120,
    bottom: 76,
    height: 14,
    borderRadius: 80,
  },
});




