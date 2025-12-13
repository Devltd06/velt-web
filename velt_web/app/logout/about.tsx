import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "app/themes";

const DIFFERENTIATORS = [
  "• Local-first monetisation with instant MoMo payouts in GHS",
  "• USD subscriptions that stay predictable despite inflation",
  "• Pulse scoring that resets monthly to reward active communities",
  "• Studio-grade tooling for scheduling, analytics, and rewards",
];

const COMMITMENTS = [
  "• Transparent payouts with no hidden cuts",
  "• Affordable promo inventory for small businesses",
  "• Community rewards like the Creator Toolkit",
  "• Safety, privacy, and cultural respect in every release",
];

const joinLines = (rows: string[]) => rows.join("\n");

export default function AboutScreen() {
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Professional Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backPill, { backgroundColor: palette.accent }]} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.titlePill, { backgroundColor: palette.accent }]}>
          <Text style={styles.headerTitle}>About</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Welcome</Text>
          <Text style={[styles.paragraph, { color: palette.subtext }]}>VELT is Ghana’s first creator-economy platform built by Atmosdev. We convert genuine engagement into Pulse currency so creators, businesses, and communities can grow sustainably.</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>What makes us different</Text>
        <Text style={[styles.paragraph, { color: palette.subtext }]}>{joinLines(DIFFERENTIATORS)}</Text>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Pulse system</Text>
        <Text style={[styles.paragraph, { color: palette.subtext }]}>Every sincere like equals one Pulse. Pulse refreshes every 30 days so the leaderboard reflects current momentum and payouts mirror real attention.</Text>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Fair payouts</Text>
        <Text style={[styles.paragraph, { color: palette.subtext }]}>Withdrawals hit mobile money within 1–3 days depending on membership tier. No hidden marketplace fees—your dashboard always shows the FX rate used.</Text>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Vision & growth</Text>
        <Text style={[styles.paragraph, { color: palette.subtext }]}>We launched in Ghana and are expanding to Nigeria, Kenya, and South Africa. The mission is to build an African-led ecosystem where creators can earn globally without leaving home.</Text>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Commitment</Text>
        <Text style={[styles.paragraph, { color: palette.subtext }]}>{joinLines(COMMITMENTS)}</Text>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: palette.subtext }]}>© {new Date().getFullYear()} Atmosdevltd™ — VELT is made in Ghana.</Text>
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
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  paragraph: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  footer: { marginTop: 30, alignItems: "center" },
  footerText: { fontSize: 13, textAlign: "center" },
});
