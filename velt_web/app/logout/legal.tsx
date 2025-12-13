// File: app/logout/legal.tsx

import React, { useMemo, useState } from "react";
import { ScrollView, Text, StyleSheet, TouchableOpacity, View, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "app/themes";

const PRIVACY_COLLECTION = [
  "• Profile details (name, email, avatar, phone)",
  "• Content you publish or import",
  "• Location and device analytics for security",
  "• Payment + payout metadata (handled via trusted providers)",
];

const PRIVACY_USAGE = [
  "• Operate and secure your VELT account",
  "• Personalise discovery and Pulse payouts",
  "• Detect spam, abuse, and platform manipulation",
  "• Improve campaigns through aggregated analytics",
];

const TERMS_PROHIBITED = [
  "• No harmful or illegal content",
  "• No harassment, impersonation, or discrimination",
  "• No spam, manipulation, or Pulse farming",
  "• Respect all IP and commercial rights",
];

const joinLines = (items: string[]) => items.join("\n");

export default function LegalScreen() {
  const [tab, setTab] = useState<"privacy" | "terms">("privacy");
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();
  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subtext: colors.subtext,
      accent: colors.accent,
      border: colors.border,
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
          <Text style={styles.headerTitle}>Legal</Text>
        </View>
      </View>

      {/* Header Tabs */}
      <View style={[styles.tabContainer, { borderColor: palette.border }]}>
        <TouchableOpacity
          style={[styles.tab, tab === "privacy" && { backgroundColor: palette.accent }]}
          onPress={() => setTab("privacy")}
        >
          <Text style={[styles.tabText, { color: tab === "privacy" ? "#fff" : palette.subtext }]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "terms" && { backgroundColor: palette.accent }]}
          onPress={() => setTab("terms")}
        >
          <Text style={[styles.tabText, { color: tab === "terms" ? "#fff" : palette.subtext }]}>Terms & Conditions</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: palette.card }]}>
        {tab === "privacy" ? (
          <>
            <Text style={[styles.heading, { color: palette.text }]}>Privacy Policy – Velt</Text>
            <Text style={[styles.date, { color: palette.subtext }]}>Effective: July 22, 2025</Text>

            <Text style={[styles.paragraph, { color: palette.subtext }]}>Your privacy is important to us. This policy explains how VELT collects, uses, and protects your data across mobile, web, and partner touchpoints.</Text>

            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            <Text style={[styles.paragraph, { color: palette.subtext }]}>{joinLines(PRIVACY_COLLECTION)}</Text>

            <Text style={styles.sectionTitle}>2. How We Use Info</Text>
            <Text style={[styles.paragraph, { color: palette.subtext }]}>{joinLines(PRIVACY_USAGE)}</Text>

            <Text style={styles.sectionTitle}>3. Sharing</Text>
            <Text style={[styles.paragraph, { color: palette.subtext }]}>We integrate with Supabase, Google Maps, and payment partners to deliver the service. We never sell personal data and only share what’s necessary to run VELT.</Text>
          </>
        ) : (
          <>
            <Text style={[styles.heading, { color: palette.text }]}>Terms & Conditions – Velt</Text>
            <Text style={[styles.date, { color: palette.subtext }]}>Effective: July 22, 2025</Text>

            <Text style={[styles.paragraph, { color: palette.subtext }]}>By using VELT you agree to the following baseline rules. We designed them to protect creators, businesses, and the broader community.</Text>

            <Text style={styles.sectionTitle}>1. Eligibility</Text>
            <Text style={[styles.paragraph, { color: palette.subtext }]}>You must be 18+ (or have guardian consent) and provide accurate information. Businesses must be legally registered in their operating country.</Text>

            <Text style={styles.sectionTitle}>2. Account Responsibility</Text>
            <Text style={[styles.paragraph, { color: palette.subtext }]}>You’re responsible for safeguarding credentials and notifying us at support@veltcompany.com if you suspect compromise. Activity from your login is treated as yours.</Text>

            <Text style={styles.sectionTitle}>3. Prohibited Conduct</Text>
            <Text style={[styles.paragraph, { color: palette.subtext }]}>{joinLines(TERMS_PROHIBITED)}</Text>
          </>
        )}

        {/* Footer Trademark */}
        <View style={styles.footer}>
          <Text style={{ color: palette.subtext, fontSize: 12 }}>© {new Date().getFullYear()} Atmosdevltd™ – all rights reserved.</Text>
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
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scroll: { padding: 20, paddingBottom: 80 },
  heading: { fontSize: 22, fontWeight: "bold", marginBottom: 8 },
  date: { fontSize: 13, marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 18,
    marginBottom: 6,
    color: "#2563eb",
  },
  paragraph: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  footer: { marginTop: 30, alignItems: "center" },
});
