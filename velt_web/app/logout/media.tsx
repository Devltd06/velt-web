import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { withSafeRouter } from '@/lib/navigation';
import { useTheme } from "app/themes";

export default function MediaQualityScreen() {
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

  const [settings, setSettings] = useState({
    highUploads: true,
    dataSaver: false,
    autoWifi: true,
  });

  const toggle = (key: keyof typeof settings) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}> 
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backPill, { backgroundColor: palette.accent }]}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.titlePill, { backgroundColor: palette.accent }]}>
          <Text style={styles.headerTitle}>Media Quality</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.intro, { color: palette.subtext }]}>Keep footage pristine without burning through data. VELT streams in studio quality by default and lets you fine-tune how uploads move between devices.</Text>

        {/* High quality uploads */}
        <View style={[styles.optionRow, { borderColor: palette.border }]}> 
          <View style={styles.textWrap}>
            <Text style={[styles.optionTitle, { color: palette.text }]}>
              Upload in High Quality
            </Text>
            <Text style={[styles.optionDesc, { color: palette.subtext }]}>
              Keep original bitrate for creative work, merch drops, and timed premieres.
            </Text>
          </View>
          <Switch
            value={settings.highUploads}
            onValueChange={() => toggle("highUploads")}
            trackColor={{ false: "#888", true: "#4da6ff" }}
            thumbColor={settings.highUploads ? "#1e90ff" : "#ccc"}
          />
        </View>

        {/* Data saver */}
        <View style={[styles.optionRow, { borderColor: palette.border }]}> 
          <View style={styles.textWrap}>
            <Text style={[styles.optionTitle, { color: palette.text }]}>
              Data Saver Mode
            </Text>
            <Text style={[styles.optionDesc, { color: palette.subtext }]}>
              Drops playback from 4K to HD when on cellular to conserve bundles.
            </Text>
          </View>
          <Switch
            value={settings.dataSaver}
            onValueChange={() => toggle("dataSaver")}
            trackColor={{ false: "#888", true: "#4da6ff" }}
            thumbColor={settings.dataSaver ? "#1e90ff" : "#ccc"}
          />
        </View>

        {/* Auto-Enhance removed — managed elsewhere */}

        <View style={styles.networkGrid}>
          {[
            {
              title: "Cellular",
              detail: "Caps at 12 Mbps when Data Saver is on to keep bundles safe.",
            },
            {
              title: "WiFi",
              detail: "Scales to 4K/60 on WiFi for best quality.",
            },
            {
              title: "Downloads",
              detail: "Offline copies are encrypted at rest inside your device sandbox.",
            },
          ].map((item) => (
            <View
              key={item.title}
              style={[styles.networkCard, { borderColor: palette.border, backgroundColor: palette.card }]}
            >
              <Text style={[styles.networkTitle, { color: palette.text }]}>{item.title}</Text>
              <Text style={[styles.optionDesc, { color: palette.subtext }]}>{item.detail}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: palette.subtext }]}>VELT never compresses your uploads server-side. What you shoot is exactly what your collectors and fans experience.</Text>
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
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textWrap: { flex: 1, marginRight: 12 },
  optionTitle: { fontSize: 16, fontWeight: "600" },
  optionDesc: { fontSize: 13, marginTop: 2 },
  networkGrid: { marginTop: 28 },
  networkCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
  },
  networkTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  footer: { marginTop: 30, alignItems: "center" },
  footerText: { fontSize: 13, textAlign: "center" },
});
