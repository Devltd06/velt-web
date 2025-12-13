// app/index.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "../lib/supabase";

SplashScreen.preventAutoHideAsync(); // keep splash until we decide

export default function Index() {
  const router = withSafeRouter(useRouter());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          router.replace("/home"); // logged in
        } else {
          router.replace("/auth/welcome"); // not logged in
        }

        // Listen for auth changes (login/logout)
        const { data: listener } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (session) {
              router.replace("/home");
            } else {
              router.replace("/auth/welcome");
            }
          }
        );

        return () => {
          listener.subscription.unsubscribe();
        };
      } catch (err) {
        console.error("Error during boot:", err);
      } finally {
        setLoading(false);
        await SplashScreen.hideAsync(); // hide splash once ready
      }
    };

    init();
  }, []);

  if (loading) {
    // Loader UI while checking session
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000ff" }}>
        <ActivityIndicator size="large" color="#ffffffff" />
      </View>
    );
  }

  // This screen never actually shows because we always redirect,
  // but it's good to have fallback.
  return null;
}




