import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import DoodleToggle from '@/components/DoodleToggle';
import { useDoodleFeatures } from '@/lib/doodleFeatures';
import { useTheme } from "app/themes";

type Plan = {
  name: string;
  price: string;
  badge: string;
  perks: string[];
  tone: string;
};

const plans: Plan[] = [
  {
    name: "Pro",
    price: "GHS 30 / $2.50",
    badge: "Best for emerging voices",
    tone: "#3B82F6",
    perks: [
      "Pulse payouts every 30 days",
      "Standard discovery placement",
      "1–3 day MoMo withdrawals",
      "Creator toolkit after 2 consecutive months",
    ],
  },
  {
    name: "Celebrity",
    price: "GHS 42 / $3.50",
    badge: "Priority reach",
    tone: "#F59E0B",
    perks: [
      "VIP placement across Explore",
      "1–2 day instant withdrawals",
      "Invite-only brand collaborations",
      "Discounted access to VELT equity rounds",
    ],
  },
  {
    name: "Channel",
    price: "GHS 36 / $3.00",
    badge: "Built for media teams",
    tone: "#10B981",
    perks: [
      "Server access + scheduling tools",
      "Cross-post TikTok / Reels instantly",
      "Pulse monetisation for every team member",
      "Studio concierge from our partnerships crew",
    ],
  },
  {
    name: "Partnership",
    price: "GHS 30 / $2.50",
    badge: "Community & agencies",
    tone: "#A855F7",
    perks: [
      "Shared dashboards for collaborators",
      "Bulk promo credits",
      "Toolkit rewards after 60 active days",
      "Pulse payouts pooled into one wallet",
    ],
  },
];

const operationalGuarantees = [
  "Pulse Currency — every genuine like equals 1 Pulse and resets each month, keeping earnings accountable.",
  "Local-first payouts — we wire through MoMo in Ghana cedis so creators are never waiting on external processors.",
  "Audience trust — anti-spam scoring plus manual audits keep feeds brand-safe.",
  "Business concierge — partnerships team advises on campaigns, sponsorships, and market expansion.",
];

export default function PremiumFeatures() {
  const router = withSafeRouter(useRouter());
  const { colors, selectedKey, applyTheme, availableThemes } = useTheme();
  const themeKeys = useMemo(() => Object.keys(availableThemes), [availableThemes]);

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subtext: colors.subtext,
      accent: colors.accent,
      faint: colors.faint,
      border: colors.border,
      isDark: (colors as any)?.isDark ?? false,
    }),
    [colors],
  );

  const themeOptions = useMemo(
    () => [
      {
        key: "system",
        title: "System Default",
        subtitle: colors.isDark ? "Mirrors device (now)" : "Mirrors device (now)",
        swatches: [colors.bg, colors.card, palette.accent],
      },
      ...themeKeys.map((key) => {
        const theme = availableThemes[key];
        return {
          key,
          title: theme.displayName,
          subtitle: theme.isDark ? "Dark" : "Light",
          swatches: [theme.bg, theme.card, theme.accent ?? palette.accent],
        };
      }),
    ],
    [availableThemes, colors.isDark, palette, themeKeys]
  );
  

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Professional Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backPill, { backgroundColor: palette.accent }]} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.titlePill, { backgroundColor: palette.accent }]}>
          <Text style={styles.headerTitle}>Premium</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={[styles.iconPill, { backgroundColor: palette.faint }]}> 
            <Ionicons name="sparkles" color={palette.accent} size={18} />
          </View>
          <Text style={[styles.heroTitle, { color: palette.text }]}>Appearance</Text>
          <Text style={[styles.heroSubtitle, { color: palette.subtext }]}>Choose a theme and toggle per-screen doodle animations for Profile, Home and Chat.</Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Theme</Text>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{selectedKey === "system" ? "System default" : availableThemes[selectedKey]?.displayName ?? "Custom"}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScroll}>
            {themeOptions.map((option) => {
              const isSelected = selectedKey === option.key;
              return (
                <TouchableOpacity key={option.key} onPress={() => applyTheme(option.key)} activeOpacity={0.85}>
                  <View
                    style={[
                      styles.themeCard,
                      {
                        borderColor: isSelected ? palette.accent : palette.border,
                        backgroundColor: palette.bg,
                      },
                    ]}
                  >
                    <View style={styles.themeCardHeader}>
                      <View>
                        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16 }}>{option.title}</Text>
                        <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 2 }}>
                          {option.key === "system" && isSelected
                            ? `Using ${palette.isDark ? "dark" : "light"} mode`
                            : option.subtitle}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={palette.accent} />}
                    </View>
                    <View style={styles.themeSwatches}>
                      {option.swatches.map((swatchColor, idx) => (
                        <View
                          key={`${option.key}-swatch-${idx}`}
                          style={[styles.themeSwatch, { backgroundColor: swatchColor ?? palette.border }]}
                        />
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Doodles</Text>
          <Text style={[styles.sectionBody, { color: palette.subtext }]}>Control doodle animations independently for Profile, Home and Chat.</Text>
          <View style={{ marginTop: 10 }}>
            <DoodleToggle screen="profile" style={{ marginBottom: 6 }} />
            <DoodleToggle screen="home" style={{ marginBottom: 6 }} />
            <DoodleToggle screen="chat" style={{ marginBottom: 6 }} />
          </View>

          {/* Debug helpers: show current persisted state and allow quick reset */}
          <View style={{ marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 }}>
            <DebugDoodleState />
          </View>
        </View>

        {/* Keep the page minimal — theme picker + per-screen doodle toggles only */}
      </ScrollView>
    </SafeAreaView>
  );
}

function DebugDoodleState() {
  const profile = useDoodleFeatures('profile');
  const home = useDoodleFeatures('home');
  const chat = useDoodleFeatures('chat');

  return (
    <View>
      <Text style={{ color: '#888', marginBottom: 6 }}>Current doodle settings (per-screen)</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
        <Text>Profile: {profile.enabled ? 'on' : 'off'}</Text>
        <Text>Home: {home.enabled ? 'on' : 'off'}</Text>
        <Text>Chat: {chat.enabled ? 'on' : 'off'}</Text>
      </View>
      <TouchableOpacity
        onPress={async () => { await profile.setEnabled(false); await home.setEnabled(false); await chat.setEnabled(false); }}
        style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#eee', borderRadius: 8 }}
      >
        <Text>Reset to OFF</Text>
      </TouchableOpacity>
    </View>
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
  scroll: { padding: 20, paddingBottom: 48 },
  hero: { marginBottom: 20 },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  heroSubtitle: { fontSize: 15, lineHeight: 22 },
  sectionCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 24,
  },
  sectionLabel: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginTop: 4, marginBottom: 6 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionBody: { fontSize: 14, lineHeight: 20 },
  metricsRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  metricCard: { flex: 1, borderRadius: 14, padding: 14 },
  metricValue: { fontSize: 18, fontWeight: "700" },
  metricLabel: { fontSize: 12, marginTop: 4 },
  sectionHeading: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  planCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  planHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  planName: { fontSize: 20, fontWeight: "800" },
  planBadge: { fontSize: 13, marginTop: 2 },
  planPrice: { fontSize: 16, fontWeight: "600" },
  perkRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  opRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },
  ctaBlock: { marginTop: 16, alignItems: "center" },
  ctaTitle: { fontSize: 20, fontWeight: "700" },
  ctaSubtitle: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 4 },
  ctaButton: {
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  ctaButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  /* theme picker styles */
  themeScroll: { paddingHorizontal: 12, paddingVertical: 8 },
  themeCard: { width: 220, padding: 12, borderRadius: 12, marginRight: 12 },
  themeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeSwatches: { flexDirection: 'row', marginTop: 10 },
  themeSwatch: { width: 28, height: 28, borderRadius: 6, marginRight: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.06)' },
});
