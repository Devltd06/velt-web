import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/lib/store/profile";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "app/themes";

export default function AccountScreen() {
  const { profile } = useProfileStore();
  const { colors } = useTheme();
  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subtext: colors.subtext,
      border: colors.border,
      accent: colors.accent,
      faint: colors.faint,
    }),
    [colors],
  );
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!profile?.email) {
      return Alert.alert("Error", "We need an email on file before sending a reset link.");
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: "https://velt.app/reset",
    });
    setLoading(false);
    if (error) return Alert.alert("Error", error.message);
    Alert.alert("Check your inbox", "We’ve emailed secure instructions to update your password.");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "We’ll permanently remove Pulse history, media, and payouts. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await supabase.functions.invoke("delete-user", { body: { user_id: profile?.id } });
              await supabase.auth.signOut();
              Alert.alert("Deleted", "Your profile is no longer on VELT.");
            } catch (error: any) {
              Alert.alert("Error", error?.message ?? "Could not delete account right now.");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleBuyShares = () => {
    Linking.openURL("https://veltcompany.com/shares").catch(() =>
      Alert.alert("Unavailable", "Please try again from a browser."),
    );
  };

  const handleSponsor = () => {
    Linking.openURL("mailto:support@veltcompany.com?subject=Sponsorship Inquiry").catch(() =>
      Alert.alert("Email", "Could not open your mail client."),
    );
  };

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@veltcompany.com");
  };

  const quickActions = [
    { label: loading ? "Processing…" : "Reset password", icon: "key-outline" as const, tone: palette.accent, onPress: handleResetPassword },
    { label: "Buy company shares", icon: "cash-outline" as const, tone: "#F59E0B", onPress: handleBuyShares },
    { label: "Sponsor Atmosdev", icon: "hand-left-outline" as const, tone: "#10B981", onPress: handleSponsor },
    { label: "Talk to support", icon: "help-circle-outline" as const, tone: palette.accent, onPress: handleContactSupport },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.header, { color: palette.text }]}>Account</Text>
        <Text style={[styles.subheader, { color: palette.subtext }]}>Secure your profile, manage payouts, and explore company opportunities.</Text>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Security</Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Keep ownership of your identity</Text>
          <Text style={[styles.sectionBody, { color: palette.subtext }]}>Reset credentials instantly or remove your presence entirely. We verify every destructive request manually to keep creators safe from hijacks.</Text>
          <TouchableOpacity onPress={handleResetPassword} style={[styles.primaryBtn, { backgroundColor: palette.accent }]}>
            <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>{loading ? "Processing…" : "Reset password"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAccount} style={[styles.destructiveBtn, { borderColor: "#DC2626" }]}>
            <Ionicons name="trash-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={{ color: "#DC2626", fontWeight: "700" }}>Delete account</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: palette.text }]}>Business desk</Text>
        <View style={styles.grid}>
          {quickActions.map((action) => (
            <TouchableOpacity key={action.label} onPress={action.onPress} style={[styles.gridItem, { backgroundColor: palette.card, borderColor: palette.border }]}> 
              <View style={[styles.iconWrap, { backgroundColor: palette.faint }]}>
                <Ionicons name={action.icon} size={20} color={action.tone} />
              </View>
              <Text style={{ color: palette.text, fontWeight: "600", marginTop: 8 }}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <Text style={[styles.sectionLabel, { color: palette.subtext }]}>Membership perks</Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Why creators stay subscribed</Text>
          <View style={styles.bullets}>
            {[
              "Early access to new recording tools and analytics",
              "Creator toolkit (tripod, mic, light) after 60 active days",
              "Discounted promo inventory across Stories and Billboards",
              "Quarterly community labs hosted by Atmosdev",
            ].map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Ionicons name="sparkles" size={16} color={palette.accent} style={{ marginRight: 8 }} />
                <Text style={{ color: palette.subtext, flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 },
  header: { fontSize: 26, fontWeight: "800", marginBottom: 6 },
  subheader: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionLabel: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginTop: 6, marginBottom: 6 },
  sectionBody: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  destructiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeading: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  gridItem: {
    width: "48%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bullets: { marginTop: 12 },
  bulletRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
});
