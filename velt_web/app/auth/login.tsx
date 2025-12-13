import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  useColorScheme,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Animated } from "react-native";
import AuthLayout from "@/components/AuthLayout";
import * as Haptics from "expo-haptics";
import { Stack } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from "@/lib/supabase";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from "app/themes";
import SwipeBackContainer from '@/components/SwipeBackContainer';

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [greeting, setGreeting] = useState("");
  const router = withSafeRouter(useRouter());
  const params = useLocalSearchParams();
  // Keep the login screen strongly dark-themed per design
  const dark = true;
  // accessibility: reduced-motion
  const [reduceMotion, setReduceMotion] = useState(false);
  // Velt brand gradient colors with accent
  const brandLight: [string, string] = ["#111111ff", VELT_ACCENT]; // Velt cyan accent for light mode
  const brandDark: [string, string] = ["#0c0c0cff", "#007A8A"]; // deeper cyan for dark mode
  const overlayBg = dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)';
  const spinnerTop = dark ? 'rgba(245, 245, 245, 0.85)' : '#1b1b1bff';
  const scrollRef = useRef<ScrollView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // spinner and success animations
  const spin = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;
  // doodle neon background anim values (login page)
  const doodleA = useRef(new Animated.Value(0)).current;
  const doodleB = useRef(new Animated.Value(0)).current;
  const doodleC = useRef(new Animated.Value(0)).current;
  const doodleAnimRef = useRef<any>(null);
  // login should not depend on the global doodle toggle — auth screens animate unless reduce-motion is enabled

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning 👋");
    else if (hour < 18) setGreeting("Good Afternoon 🌞");
    else setGreeting("Good Evening 🌙");

    // reduced motion preference — don't run heavy background loops if user asked for reduced motion
    AccessibilityInfo.isReduceMotionEnabled()
      .then((isReduced) => setReduceMotion(isReduced))
      .catch(() => setReduceMotion(false));
  }, []);

  const showAnimatedDoodles = !reduceMotion;
  const showStaticDoodles = reduceMotion;

  useEffect(() => {
    try {
      const willAnimate = !reduceMotion;
      if (!doodleAnimRef.current) {
        doodleAnimRef.current = Animated.loop(
          Animated.parallel([
            Animated.sequence([Animated.timing(doodleA, { toValue: 1, duration: 4500, useNativeDriver: true }), Animated.timing(doodleA, { toValue: 0, duration: 4500, useNativeDriver: true })]),
            Animated.sequence([Animated.delay(300), Animated.timing(doodleB, { toValue: 1, duration: 5200, useNativeDriver: true }), Animated.timing(doodleB, { toValue: 0, duration: 5200, useNativeDriver: true })]),
            Animated.sequence([Animated.delay(700), Animated.timing(doodleC, { toValue: 1, duration: 6200, useNativeDriver: true }), Animated.timing(doodleC, { toValue: 0, duration: 6200, useNativeDriver: true })]),
          ])
        );
      }

      if (willAnimate) { try { doodleAnimRef.current.start(); } catch {} }
      else { try { doodleAnimRef.current.stop?.(); } catch {} try { doodleA.setValue(0); doodleB.setValue(0); doodleC.setValue(0); } catch {} }
    } catch (e) {}
    return () => { try { doodleAnimRef.current?.stop?.(); } catch {} };
  }, [reduceMotion]);

  // keep greeting logic but do not animate entrance for Login screen

  const handleLogin = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setIsLoading(true);
    setLoginSuccess(false);
    // start spinner
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: true })).start();

    if (!email || !password) {
      return Alert.alert("Missing Info", "Please enter your email and password.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error(error);
      setIsLoading(false);
      spin.stopAnimation();
      return Alert.alert("Login Error", error.message);
    }

    // ✅ Fetch subscription
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_end")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError.message);
      setIsLoading(false);
      spin.stopAnimation();
      return Alert.alert("Error", "Could not fetch subscription info.");
    }

    if (!profile || !profile.subscription_end) {
      setIsLoading(false);
      spin.stopAnimation();
      return Alert.alert("Subscription Required", "Please renew to continue.", [
        { text: "OK", onPress: () => router.replace("/auth/login") },
      ]);
      return;
    }

    const now = new Date();
    const endDate = new Date(profile.subscription_end);

    if (endDate < now) {
      setIsLoading(false);
      spin.stopAnimation();
      return Alert.alert("Subscription Expired", "Please renew your subscription.", [
        { text: "OK", onPress: () => router.replace("/auth/login") },
      ]);
      return;
    }

    // animate success micro-interaction then navigate
    spin.stopAnimation();
    setLoginSuccess(true);
    Animated.spring(successScale, { toValue: 1.1, useNativeDriver: true }).start();

    // short delay for the success animation to play
    setTimeout(() => {
      setIsLoading(false);
      router.replace("/home");
    }, 800);
  };

  const handleForgotPassword = async () => {
    await Haptics.selectionAsync();

    if (!email) {
      return Alert.alert("Forgot Password", "Please enter your email first.");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://yourapp.com/reset",
    });

    if (error) {
      console.error(error);
      return Alert.alert("Error", error.message);
    }

    Alert.alert("Check your email", "We’ve sent you a password reset link.");
  };

  return (
    <SwipeBackContainer>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
            <AuthLayout showTitle={false} fullScreen={true}>
              <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

              {/* full-screen dark background + animated neon doodles (subtle) */}
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000' }} />
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {showAnimatedDoodles ? (
                <>
                <Animated.View style={[styles.doodle, {
                  backgroundColor: 'transparent',
                  borderColor: '#6EE7F0',
                  opacity: doodleA.interpolate({ inputRange: [0,1], outputRange: [0.06, 0.32] }),
                  borderWidth: 3.6,
                  transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [-20, 24] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [6, 100] }) }, { rotate: doodleA.interpolate({ inputRange: [0,1], outputRange: ['-6deg', '6deg'] }) }]
                }]} />
                <Animated.View style={[styles.doodle, {
                  backgroundColor: 'transparent',
                  borderColor: '#FF6B6B',
                  opacity: doodleB.interpolate({ inputRange: [0,1], outputRange: [0.04, 0.28] }),
                  left: 40,
                  top: 220,
                  borderWidth: 3.2,
                  transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [40, -26] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [6, -20] }) }, { rotate: doodleB.interpolate({ inputRange: [0,1], outputRange: ['3deg', '-5deg'] }) }]
                }]} />
                <Animated.View style={[styles.doodle, {
                  backgroundColor: 'transparent',
                  borderColor: '#FFD166',
                  opacity: doodleC.interpolate({ inputRange: [0,1], outputRange: [0.03, 0.22] }),
                  right: 12,
                  bottom: 26,
                  borderWidth: 3.4,
                  transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [-18, 18] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [-6, 6] }) }, { rotate: doodleC.interpolate({ inputRange: [0,1], outputRange: ['-12deg', '12deg'] }) }]
                }]} />

                <Animated.View style={[styles.doodleRight, {
                  borderColor: '#6EE7F0',
                  opacity: doodleA.interpolate({ inputRange: [0,1], outputRange: [0.04, 0.24] }),
                  borderWidth: 4.2,
                  transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [10, -40] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [0, 30] }) }, { rotate: doodleA.interpolate({ inputRange: [0,1], outputRange: ['8deg', '-8deg'] }) }]
                }]} />

                <Animated.View style={[styles.doodleLower, { borderColor: '#6EE7F0', opacity: doodleA.interpolate({ inputRange: [0,1], outputRange: [0.02, 0.22] }), borderWidth: 4.2, transform: [{ translateX: doodleA.interpolate({ inputRange: [0,1], outputRange: [0, 6] }) }, { translateY: doodleA.interpolate({ inputRange: [0,1], outputRange: [6, 24] }) }] }]} />
                <Animated.View style={[styles.doodleLower2, { borderColor: '#FF6B6B', opacity: doodleB.interpolate({ inputRange: [0,1], outputRange: [0.02, 0.18] }), borderWidth: 4.0, transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [6, -10] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [8, -16] }) }] }]} />
                <Animated.View style={[styles.doodleLower3, { borderColor: '#FFD166', opacity: doodleC.interpolate({ inputRange: [0,1], outputRange: [0.01, 0.16] }), borderWidth: 3.6, transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [-6, 12] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [12, -8] }) }] }]} />
                <Animated.View style={[styles.doodleRight, {
                  borderColor: '#FF6B6B',
                  opacity: doodleB.interpolate({ inputRange: [0,1], outputRange: [0.03, 0.18] }),
                  borderWidth: 3.8,
                  right: 18,
                  top: 60,
                  height: 220,
                  transform: [{ translateX: doodleB.interpolate({ inputRange: [0,1], outputRange: [-6, 24] }) }, { translateY: doodleB.interpolate({ inputRange: [0,1], outputRange: [-8, 18] }) }, { rotate: doodleB.interpolate({ inputRange: [0,1], outputRange: ['-10deg', '12deg'] }) }]
                }]} />
                <Animated.View style={[styles.doodleRight, {
                  borderColor: '#FFD166',
                  opacity: doodleC.interpolate({ inputRange: [0,1], outputRange: [0.02, 0.14] }),
                  borderWidth: 3.2,
                  right: 44,
                  bottom: 40,
                  height: 260,
                  transform: [{ translateX: doodleC.interpolate({ inputRange: [0,1], outputRange: [26, -6] }) }, { translateY: doodleC.interpolate({ inputRange: [0,1], outputRange: [6, -26] }) }, { rotate: doodleC.interpolate({ inputRange: [0,1], outputRange: ['4deg', '-18deg'] }) }]
                }]} />
                </>
                ) : showStaticDoodles ? (
                  // reduced-motion friendly static background
                  <View style={[styles.doodleLower, { borderColor: '#6EE7F0', borderWidth: 2, opacity: 0.06 }]} />
                ) : null}
              </View>
              <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* custom back button for full-screen layout */}
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backBtn}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  accessibilityLabel="Go back"
                >
                  <View style={[styles.backInner, { backgroundColor: dark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.9)' }]}> 
                    <Ionicons name="chevron-back" size={22} color={dark ? '#fff' : '#071133'} />
                  </View>
                </TouchableOpacity>

          {/* paymentSuccess banner removed: replaced by improved in-page feedback elsewhere */}

          <View style={[styles.hero]}>
            <Text style={[styles.pageTitle, { color: dark ? '#fff' : '#071133' }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(7,17,51,0.75)' }]}>Sign in to continue</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10 }}>
            <View style={[styles.previewCard, { backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(7,17,51,0.04)', marginRight: 8 }]}><Text style={[styles.previewText, { color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(7,17,51,0.9)' }]}>Creators</Text></View>
            <View style={[styles.previewCard, { backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(7,17,51,0.03)', marginRight: 8 }]}><Text style={[styles.previewText, { color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(7,17,51,0.9)' }]}>Marketplace</Text></View>
            <View style={[styles.previewCard, { backgroundColor: dark ? 'rgba(255,255,255,0.02)' : 'rgba(7,17,51,0.02)' }]}><Text style={[styles.previewText, { color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(7,17,51,0.9)' }]}>Billboards</Text></View>
          </View>

          <View>
              {/* use theme-aware surface instead of decorative gradient card */}
              <View style={[styles.formCard, dark ? styles.formCardDark : styles.formCardLight, styles.formCardFull]}>
              <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(7,17,51,0.75)' }]}>Email</Text>
                <View style={[styles.inputRow, { borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(7,17,51,0.12)", backgroundColor: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.98)' }]}>
                <TextInput
                  style={[styles.input, { color: dark ? '#fff' : '#071133' }]}
                  placeholder="Enter your email"
                  placeholderTextColor={dark ? 'rgba(255,255,255,0.5)' : 'rgba(7,17,51,0.35)'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                />
              </View>
            </View>

              <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(7,17,51,0.75)' }]}>Password</Text>
              <View style={[styles.inputRow, { borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(7,17,51,0.12)", backgroundColor: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.98)' }]}>
                <TextInput
                  style={[styles.input, { color: dark ? '#fff' : '#071133' }]}
                  placeholder="••••••••"
                  placeholderTextColor={dark ? 'rgba(255,255,255,0.5)' : 'rgba(7,17,51,0.35)'}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
              </View>
            </View>

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotWrapper}>
              <Text style={[styles.forgotText, { color: dark ? '#8bc6ff' : '#0b6b9f' }]}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity disabled={isLoading} style={[styles.primaryBtn, { width: '92%', alignSelf: 'center', borderRadius: 999 }, isLoading ? { opacity: 0.65 } : {}]} onPress={handleLogin} activeOpacity={0.85}>
              <LinearGradient colors={dark ? brandDark : brandLight} start={[0, 0]} end={[1, 1]} style={[styles.primaryGradient, { borderRadius: 999, width: '100%', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={styles.primaryBtnText}>Log In</Text>
              </LinearGradient>
            </TouchableOpacity>
            {/* secondary actions */}
            <TouchableOpacity onPress={() => router.push('/auth/verify')} style={[styles.secondaryBtn, { marginTop: 12, borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(7,17,51,0.06)'}]}>
              <Text style={[styles.secondaryText, { color: dark ? '#fff' : '#071133' }]}>Continue with phone</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/auth/welcome')} style={{ marginTop: 12 }}>
              <Text style={[styles.helper, { color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(7,17,51,0.75)' }]}>Back to Welcome</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/auth/signup')} style={{ marginTop: 12 }}>
              <Text style={[styles.helper, { color: dark ? '#8bc6ff' : '#0b6b9f', fontWeight: 'bold' }]}>Sign Up</Text>
            </TouchableOpacity>
            </View>
          </View>
            </ScrollView>
            </AuthLayout>

        {/* Loading / success overlay */}
        {isLoading && (
          <Animated.View style={[styles.overlay, { backgroundColor: overlayBg }]} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.spinnerOuter,
                {
                  borderTopColor: spinnerTop,
                  borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(7,17,51,0.06)',
                  transform: [
                    {
                      rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }),
                    },
                  ],
                },
              ]}
            />

            {loginSuccess ? (
              <Animated.View style={[styles.successBadge, { backgroundColor: dark ? '#313131ff' : '#10b981', transform: [{ scale: successScale }] }]}>
                <Text style={[styles.successText, { color: dark ? '#000000ff' : '#000000ff' }]}>✓</Text>
              </Animated.View>
            ) : (
              <Animated.View style={styles.loadingBox}>
                <Text style={styles.loadingText}>Signing in…</Text> 
              </Animated.View>
            )}
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  /* background gradient is provided by AuthLayout */
  banner: {
    backgroundColor: "#000000ff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    zIndex: 2,
  },
  bannerText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  hero: { alignItems: "center", marginBottom: 24, zIndex: 2 },
  greeting: { fontSize: 18, marginBottom: 6, fontWeight: "500" },
  pageTitle: { fontSize: 28, color: '#fff', fontWeight: '700', marginBottom: 6 },
  title: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 6,
    color: "#fff",
  },
  subtitle: {
    fontSize: 17,
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
  },
  helper: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 12,
  },
  formCard: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 1)",
    backgroundColor: "rgba(0, 0, 0, 1)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  formCardDark: {
    backgroundColor: 'rgba(0, 0, 0, 1)',
    borderColor: 'rgba(255,255,255,0.06)'
  },
  formCardLight: {
    backgroundColor: '#ffffffff',
    borderColor: 'rgba(0, 0, 0, 0.09)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  inputGroup: { marginBottom: 20 },
  label: {
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
    fontWeight: "600",
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Platform.select({ ios: 14, android: 10 }) },
  forgotWrapper: { alignSelf: "flex-end", marginBottom: 24 },
  forgotText: { color: "#8bc6ff", fontSize: 14, fontWeight: "600" },
  primaryBtn: { borderRadius: 18, overflow: "hidden" },
  primaryGradient: { paddingVertical: 16, borderRadius: 18 },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 17,
    letterSpacing: 0.5,
  },
  previewCard: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)'
  },
  previewText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600'
  }
  ,
  // increased top padding so full-screen login content sits lower on tall screens
  scrollContent: { paddingBottom: 60, paddingTop: 60, alignItems: 'stretch', paddingHorizontal: 18 },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 1)'
  },
  spinnerOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(110,231,240,0.85)',
    marginBottom: 18,
  },
  loadingBox: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  loadingText: { color: '#fff', fontWeight: '600' },
  successBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#6ee7f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6ee7f0',
    shadowOpacity: 0.3,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  successText: { fontSize: 44, color: '#05201f', fontWeight: '800' }
  ,
  formCardFull: { width: '100%' },
  secondaryBtn: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '700' },

  // back button is slightly lower to avoid being too close to the status bar
  // back button is slightly lower to avoid being too close to the status bar
  backBtn: { position: 'absolute', top: 56, left: 12, zIndex: 20 },
  backInner: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'center', alignItems: 'center' },
  doodle: { position: 'absolute', width: 160, height: 160, borderRadius: 120, top: 14, left: -40, transform: [{ rotate: '12deg' }] },
  doodleRight: { position: 'absolute', width: 240, height: 240, borderRadius: 160, top: 40, right: -80, transform: [{ rotate: '-18deg' }] },
  doodleLower: { position: 'absolute', width: 64, height: 64, borderRadius: 54, bottom: 180, left: 44 },
  doodleLower2: { position: 'absolute', width: 84, height: 84, borderRadius: 54, bottom: 120, left: 86 },
  doodleLower3: { position: 'absolute', width: 96, height: 96, borderRadius: 56, bottom: 96, right: 22 },
});

