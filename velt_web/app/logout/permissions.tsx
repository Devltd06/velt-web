import React, { useMemo, useState } from "react";
import { View, Text, Switch, TouchableOpacity, ScrollView, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { withSafeRouter } from '@/lib/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { useTheme } from "app/themes";

export default function PermissionsScreen() {
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();
  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subtext: colors.subtext,
      border: colors.border,
      accent: colors.accent,
    }),
    [colors],
  );

  // Track permission toggles
  const [permissions, setPermissions] = useState({
    location: false,
    camera: false,
    notifications: true,
  });

  const { profile, setProfile } = useProfileStore();
  const [inAppBannerEnabled, setInAppBannerEnabled] = useState<boolean>(true);

  // load saved preference (Supabase profile pref_in_app_banner OR AsyncStorage fallback)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (profile?.id) {
          const { data, error } = await supabase.from('profiles').select('pref_in_app_banner').eq('id', profile.id).maybeSingle();
          if (!error && data && typeof (data as any).pref_in_app_banner === 'boolean') {
            if (!mounted) return;
            setInAppBannerEnabled(Boolean((data as any).pref_in_app_banner));
            return;
          }
        }
      } catch (e) {
        // ignore
      }

      try {
        const raw = await AsyncStorage.getItem('pref:in_app_banner');
        if (raw !== null) {
          if (!mounted) return;
          setInAppBannerEnabled(raw === '1' || raw === 'true');
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [profile?.id]);

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Header with Back */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backPill, { backgroundColor: palette.accent }]}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.titlePill, { backgroundColor: palette.accent }]}>
          <Text style={styles.headerTitle}>Permissions</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.intro, { color: palette.subtext }]}>
          VELT only asks for the sensors needed to deliver secure payouts, zero-compression uploads, and timely alerts. Toggle each capability whenever your needs change.
        </Text>

        {/* Location */}
        <View style={[styles.permissionRow, { borderColor: palette.border }]}> 
          <View style={styles.textWrap}>
            <Text style={[styles.permissionTitle, { color: palette.text }]}>
              Location
            </Text>
            <Text style={[styles.permissionDesc, { color: palette.subtext }]}>
              Powers regional leaderboards, promo rates, and regulatory compliance for payouts.
            </Text>
          </View>
          <Switch
            value={permissions.location}
            onValueChange={() => togglePermission("location")}
            trackColor={{ false: "#888", true: "#4da6ff" }}
            thumbColor={permissions.location ? "#1e90ff" : "#ccc"}
          />
        </View>

        {/* Camera */}
        <View style={[styles.permissionRow, { borderColor: palette.border }]}> 
          <View style={styles.textWrap}>
            <Text style={[styles.permissionTitle, { color: palette.text }]}>
              Camera
            </Text>
            <Text style={[styles.permissionDesc, { color: palette.subtext }]}>
              Required for Pulse Stories, live auctions, and AR try-ons when listing products.
            </Text>
          </View>
          <Switch
            value={permissions.camera}
            onValueChange={() => togglePermission("camera")}
            trackColor={{ false: "#888", true: "#4da6ff" }}
            thumbColor={permissions.camera ? "#1e90ff" : "#ccc"}
          />
        </View>

        {/* Notifications */}
        <View style={[styles.permissionRow, { borderColor: palette.border }]}> 
          <View style={styles.textWrap}>
            <Text style={[styles.permissionTitle, { color: palette.text }]}>
              Notifications
            </Text>
            <Text style={[styles.permissionDesc, { color: palette.subtext }]}>
              Keeps you informed about payouts, account health, collaborations, and marketplace offers.
            </Text>
          </View>
          <Switch
            value={permissions.notifications}
            onValueChange={() => togglePermission("notifications")}
            trackColor={{ false: "#888", true: "#4da6ff" }}
            thumbColor={permissions.notifications ? "#1e90ff" : "#ccc"}
          />
        </View>

        {/* In-app Notification Banner */}
        <View style={[styles.permissionRow, { borderColor: palette.border }]}> 
          <View style={styles.textWrap}>
            <Text style={[styles.permissionTitle, { color: palette.text }]}> 
              In-app notification banner
            </Text>
            <Text style={[styles.permissionDesc, { color: palette.subtext }]}> 
              Shows a heads-up toast when you are already inside VELT so you never miss a PULSE spike.
            </Text>
          </View>
          <Switch
            value={inAppBannerEnabled}
            onValueChange={async (v) => {
                  setInAppBannerEnabled(v);
                  // optimistically update local profile store so UI responds immediately
                  try {
                    const nextProfile = profile ? { ...(profile as any), pref_in_app_banner: v } : ({ pref_in_app_banner: v } as any);
                    try { setProfile(nextProfile); } catch {}
                  } catch {}
                  try {
                    if (profile?.id) {
                      await supabase.from('profiles').update({ pref_in_app_banner: v }).eq('id', profile.id);
                    } else {
                      await AsyncStorage.setItem('pref:in_app_banner', v ? '1' : '0');
                    }
                  } catch (e) {
                    try { await AsyncStorage.setItem('pref:in_app_banner', v ? '1' : '0'); } catch {}
                  }
            }}
            trackColor={{ false: "#888", true: "#4da6ff" }}
            thumbColor={inAppBannerEnabled ? "#1e90ff" : "#ccc"}
          />
        </View>

        {/* Footer */}
        <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.card }]}> 
          <Text style={[styles.cardTitle, { color: palette.text }]}>Data Stewardship</Text>
          <Text style={[styles.permissionDesc, { color: palette.subtext }]}>We log only enough information to secure your account, and you can export or delete it anytime from Account → Legal. Every permission is optional—disable it without losing payouts.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: Platform.OS === "ios" ? 10 : 6,
  },
  backPill: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  titlePill: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  scrollContent: { padding: 20, paddingBottom: 80 },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 20, textAlign: "center" },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textWrap: { flex: 1, marginRight: 12 },
  permissionTitle: { fontSize: 16, fontWeight: "600" },
  permissionDesc: { fontSize: 13, marginTop: 2 },
  card: {
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 32,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
});
