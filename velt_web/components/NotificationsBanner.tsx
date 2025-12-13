// app/components/NotificationBanner.tsx
import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, StyleSheet, TouchableOpacity, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '@/lib/store/profile';

type Props = {
  visible: boolean;
  title?: string;
  body?: string;
  onClose?: () => void;
  onPress?: () => void;
  topOffset?: number;
  avatarUrl?: string | null;
};

export default function NotificationBanner({ visible, title, body, onClose = () => {}, onPress = () => {}, topOffset, avatarUrl }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const { profile } = useProfileStore();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  // load preference: prefer profile.pref_in_app_banner, fallback to AsyncStorage, default true
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (profile?.id) {
          const p = (profile as any) || {};
          if (typeof p.pref_in_app_banner === 'boolean') {
            if (!mounted) return;
            setAllowed(Boolean(p.pref_in_app_banner));
            return;
          }
        }
      } catch {}

      try {
        const raw = await AsyncStorage.getItem('pref:in_app_banner');
        if (!mounted) return;
        if (raw === null) setAllowed(true);
        else setAllowed(raw === '1' || raw === 'true');
      } catch {
        if (mounted) setAllowed(true);
      }
    })();
    return () => { mounted = false; };
  }, [profile?.id, (profile as any)?.pref_in_app_banner]);

  useEffect(() => {
    if (!visible) return;
    // if preference not loaded yet, wait (do not show)
    if (allowed === false) {
      // user disabled in-app banners — close parent state if visible
      onClose?.();
      return;
    }
    if (allowed === null) return;

    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, allowed]);

  // If user disabled banners, don't render
  if (!visible) return null;
  if (allowed === false) return null;

  const finalTop = typeof topOffset === 'number' ? topOffset : 12;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-90, finalTop] });
  const opacity = anim;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity, top: finalTop }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.inner}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.iconContainer}>
            <Ionicons name="notifications-outline" size={18} color="#fff" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {!!body && (
            <Text style={styles.body} numberOfLines={2}>
              {body}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 12, right: 12, top: 12, zIndex: 9999, elevation: 9999 },
  inner: { backgroundColor: "#222", padding: 12, borderRadius: 12, flexDirection: "row", alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: "#333" },
  iconContainer: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: "#444", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontWeight: "700", marginBottom: 2 },
  body: { color: "#ddd", fontSize: 12 },
});


