// App.tsx
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/lib/store/profile";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(projectId: string) {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    alert("Failed to get push token for push notification!");
    return;
  }

  token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;

  return token;
}

export default function App() {
  const { profile } = useProfileStore();
  const router = withSafeRouter(useRouter());

  const pushReceivedListener = useRef<any>(null);
  const pushResponseListener = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      const projectId = "8c76779b-96c4-4798-8c67-a6dde1928094"; // your UUID
      const token = await registerForPushNotificationsAsync(projectId);

      if (token && profile?.id) {
        await supabase.from("profiles").update({ expo_push_token: token }).eq("id", profile.id);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // push notification listeners (Expo)
  useEffect(() => {
    pushReceivedListener.current = Notifications.addNotificationReceivedListener(() => {});
    pushResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      // optional: handle push response tap
    });

    return () => {
      if (pushReceivedListener.current) pushReceivedListener.current.remove();
      if (pushResponseListener.current) pushResponseListener.current.remove();
    };
  }, []);

  // App.tsx only manages push token and listeners now; banner is rendered in root layout
  return null;
}


