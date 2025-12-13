import React, { useRef, useEffect, useState } from "react";
import { Animated, Text, StyleSheet, useColorScheme, View, AccessibilityInfo } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  title?: string;
  subtitle?: string;
  showTitle?: boolean;
  fullScreen?: boolean;
  children?: React.ReactNode;
};

export default function AuthLayout({ title, subtitle, children, showTitle = true, fullScreen = false }: Props) {
  const dark = useColorScheme() === "dark";

  // subtle looping animation for doodles (auth screens should animate regardless of user toggle — only respect reduced-motion)
  const [reduceMotion, setReduceMotion] = useState(false);
  const leftAnim = useRef(new Animated.Value(0)).current;
  const rightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // check reduced-motion accessibility preference
    (async () => {
      try {
        AccessibilityInfo.isReduceMotionEnabled()
          .then((isReduced) => setReduceMotion(isReduced))
          .catch(() => setReduceMotion(false));
      } catch {
        setReduceMotion(false);
      }
    })();

    if (reduceMotion) {
      // reset values
      leftAnim.setValue(0);
      rightAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(leftAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(leftAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rightAnim, { toValue: 1, duration: 4200, useNativeDriver: true }),
          Animated.timing(rightAnim, { toValue: 0, duration: 4200, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [leftAnim, rightAnim, reduceMotion]);

  const inner = (
      <LinearGradient
        // clearer, balanced gradients for both modes
        colors={
          dark
            ? ["#050505", "#0b0b10"]
            : [
                // light mode uses a warm-ish gradient that's still subtle
                "#f8fafc",
                "#eef2ff",
              ]
        }
        style={[styles.gradient, fullScreen ? styles.fullScreenGradient : null]}
      >
        {/* doodle shapes (hidden in fullScreen mode and only when enabled) */}
        {!fullScreen && !reduceMotion && (
          <>
            <Animated.View
              style={[
                styles.doodleLeft,
                {
                  transform: [
                    { translateY: leftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                  ],
                  backgroundColor: dark ? 'rgba(108,99,255,0.14)' : 'rgba(99,102,241,0.12)'
                },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.doodleRight,
                {
                  transform: [
                    { translateY: rightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                    { rotate: rightAnim.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '-12deg'] }) },
                  ],
                  backgroundColor: dark ? 'rgba(110,231,240,0.06)' : 'rgba(34,211,238,0.06)'
                },
              ]}
              pointerEvents="none"
            />
            <View style={[styles.scribble, { backgroundColor: dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)' }]} pointerEvents="none" />
          </>
        )}

        {/* header (hidden in fullScreen mode) */}
        {!fullScreen ? (
          <View style={styles.header}>
            {showTitle ? (
              <>
                <Text style={[styles.headerTitle, { color: dark ? '#fff' : '#071133' }]}>{title ?? 'VELT'}</Text>
                <Animated.View
                  style={[
                    styles.underline,
                    { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(7,17,51,0.06)', transform: [{ translateX: leftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] },
                  ]}
                />
              </>
            ) : null}
            {subtitle ? <Text style={[styles.headerSubtitle, { color: dark ? 'rgba(255,255,255,0.78)' : 'rgba(7,17,51,0.64)' }]}>{subtitle}</Text> : null}
          </View>
        ) : null}

        <View style={[styles.content, fullScreen ? styles.contentFull : null]}>{children}</View>
      </LinearGradient>
  );

  return fullScreen ? (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>{inner}</SafeAreaView>
  ) : (
    <SafeAreaView style={styles.container}>{inner}</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  gradient: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  header: { alignItems: "center", paddingVertical: 10 },
  headerTitle: { fontSize: 48, color: "#fff", fontWeight: "800", letterSpacing: 4 },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.78)", marginTop: 6 },
  underline: {
    marginTop: 8,
    width: 140,
    height: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 2,
  },
  doodleLeft: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 120,
    // backgroundColor is chosen at runtime depending on theme
    top: 14,
    left: -40,
    transform: [{ rotate: "12deg" }],
  },
  doodleRight: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 160,
    // backgroundColor is chosen at runtime depending on theme
    top: 40,
    right: -80,
    transform: [{ rotate: "-18deg" }],
  },
  scribble: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 54,
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  content: { flex: 1, justifyContent: "center" },
  contentFull: { justifyContent: 'flex-start', paddingTop: 0 },
  fullScreenGradient: { paddingTop: 0, paddingHorizontal: 0 },
});
