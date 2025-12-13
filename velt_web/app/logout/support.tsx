import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { withSafeRouter } from '@/lib/navigation';
import { useTheme } from "app/themes";

export default function SupportScreen() {
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

  const openWhatsApp = () => {
    const phoneNumber = "233503540645"; // Ghana number (no leading 0)
    const url = `https://wa.me/${phoneNumber}`;
    Linking.openURL(url).catch((err) =>
      console.error("Failed to open WhatsApp:", err)
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: palette.bg },
      ]}
    >
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backPill, { backgroundColor: palette.accent }]}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.titlePill, { backgroundColor: palette.accent }]}>
          <Text style={styles.headerTitle}>Support VELT</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: palette.subtext }]}>
          VELT is more than an app — it's a movement built for creators,
          dreamers, and communities. Here’s how you can support or invest in
          VELT and be part of our growth.
        </Text>

        {/* Section: Support as a User */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            🌍 Support as a User
          </Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>
            • Stay active — engage, share, and create.{"\n"}
            • Subscribe to premium plans to unlock more features.{"\n"}
            • Spread the word — invite friends and communities to join VELT.
          </Text>
        </View>

        {/* Section: Business / Entrepreneur */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            🤝 Partner as a Business
          </Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>
            • Collaborate with VELT to promote your brand.{"\n"}
            • Launch campaigns, sponsorships, and community events.{"\n"}
            • Leverage our platform for targeted reach.
          </Text>
        </View>

        {/* Section: Invest in VELT */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            💡 Invest in VELT
          </Text>
          <Text style={[styles.sectionText, { color: palette.subtext }]}>
            • Be part of the future of creator economy in Africa.{"\n"}
            • Access opportunities to buy shares with exclusive perks.{"\n"}
            • Join our mission to scale beyond Ghana and inspire the world.
          </Text>
        </View>

        {/* WhatsApp Button */}
        <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp}>
          <Text style={styles.whatsappText}>💬 Contact Us on WhatsApp</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: palette.subtext }]}>
            Every contribution, big or small, fuels our mission to empower
            creators and communities. Thank you for being part of VELT’s story.
          </Text>
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
  scroll: { padding: 20, paddingBottom: 80 },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 20, textAlign: "center" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  sectionText: { fontSize: 14, lineHeight: 21 },
  whatsappBtn: {
    backgroundColor: "#25D366",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  whatsappText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footer: { marginTop: 30, alignItems: "center" },
  footerText: { fontSize: 13, textAlign: "center" },
});
