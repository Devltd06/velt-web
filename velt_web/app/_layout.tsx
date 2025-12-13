// app/_layout.tsx  OR  app/root.tsx  OR wherever your RootLayout lives
import { ThemeProvider, VELT_ACCENT } from "app/themes"; 
import { DoodleProvider } from '@/lib/doodleFeatures';
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, SplashScreen } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useProfileStore } from "@/lib/store/profile";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { safePush } from '@/lib/navigation';
import { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { AuthProvider } from "./providers/AuthProvider";
import { PaystackProvider } from "react-native-paystack-webview";
import { PAYSTACK_MERCHANT_CURRENCY, PAYSTACK_PUBLIC_KEY } from './utils/paystackConfig';
import BootScreen from "../components/bootscreen";
import { useIncomingCall } from "@/hooks/useIncomingCall";
import { CustomAlertProvider } from '@/components/CustomAlert';

// Screen transition animation config
const screenAnimationConfig = {
  animation: 'spring',
  config: {
    stiffness: 1000,
    damping: 500,
    mass: 3,
    overshootClamping: true,
    restDisplacementThreshold: 10,
    restSpeedThreshold: 10,
  },
};

const fadeTransition = {
  cardStyleInterpolator: ({ current }: { current: { progress: any } }) => ({
    cardStyle: {
      opacity: current.progress,
    },
  }),
};

const slideTransition = {
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
  transitionSpec: {
    open: screenAnimationConfig,
    close: screenAnimationConfig,
  },
};



SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);
  const { profile } = useProfileStore();
  const router = withSafeRouter(useRouter());
  const { call, accept, decline } = useIncomingCall();

  const handleAcceptCall = useCallback(async () => {
    const accepted = await accept();
    if (accepted) {
      safePush(router, {
        pathname: "/message/call/[id]",
        params: {
          id: accepted.conversationId,
          mode: accepted.mode,
          caller: accepted.callerId,
        },
      });
    }
  }, [accept, router]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setAppIsReady(true);
      SplashScreen.hideAsync();
    };

    init();
  }, []);

  // Banner subscription intentionally moved into the native Tab layout
  // Always render the app Stack so routing/navigation is available immediately.
  // Show the BootScreen as an overlay while `booting` is true so child routes
  // (like `app/index.tsx`) can perform navigation during startup without
  // causing "unmatched route" errors.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <BottomSheetModalProvider>
          <AuthProvider>
            <DoodleProvider>
            <ThemeProvider>
              <PaystackProvider
                publicKey={PAYSTACK_PUBLIC_KEY}
                currency={PAYSTACK_MERCHANT_CURRENCY}
                defaultChannels={["card", "bank", "mobile_money"]}
                debug={true}
              >
                <CustomAlertProvider>
                  <Stack 
                    screenOptions={{ 
                      headerShown: false,
                      animation: 'slide_from_right',
                      animationDuration: 200,
                      gestureEnabled: true,
                      gestureDirection: 'horizontal',
                      contentStyle: { backgroundColor: '#000000' },
                    }} 
                  />
                  {booting ? <BootScreen onFinish={() => setBooting(false)} /> : null}
                  {/* Global Notification Banner handled inside the native Tab layout for correct z-order */}
                </CustomAlertProvider>
              </PaystackProvider>
              </ThemeProvider>
            </DoodleProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
