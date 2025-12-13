// app/logout/settings.tsx
import React, { JSX, useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { useProfileStore } from "@/lib/store/profile";
import { supabase } from "@/lib/supabase";
import { SavedAccount, readSavedAccounts, upsertSavedAccount, deleteSavedAccount } from "@/lib/savedAccounts";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "app/themes";
import SwipeBackContainer from '@/components/SwipeBackContainer';

export type Profile = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string | null;
  website?: string | null;
  updated_at?: string | null;
  cover_photo_url?: string | null;
  pulse?: number | null;
  expo_push_token?: string | null;
  role?: string | null;
  subscription_start?: string | null;
  subscription_end?: string | null;
  payment_method?: string | null;
  email?: string | null;
  date_of_birth?: string | null;
  profession?: string | null;
  business_name?: string | null;
  zoho_contact_id?: string | null;
  zoho_invoice_id?: string | null;
  zoho_payment_id?: string | null;
  zoho_synced?: boolean | null;
  zoho_sync_error?: string | null;
  amount?: string | null;
  experience?: any | null;
  education?: any | null;
  services?: string[] | null;
  current_position?: string | null;
  industry?: string | null;
  location?: string | null;
  phone_number?: string | null;
  website_links?: string[] | null;
  company_page?: string | null;
  verified?: boolean | null;
};

const settingsItems = [
  { title: "Premium Features", path: "/logout/premium" },
  { title: "Account", path: "/logout/Account" },
  { title: "Legal Terms & Policy", path: "/logout/legal" },
  { title: "About This App", path: "/logout/about" },
  { title: "Permissions", path: "/logout/permissions" },
  { title: "Media Quality", path: "/logout/media" },
  { title: "Support", path: "/logout/support" },
];

export default function SettingsScreen(): JSX.Element {
  const router = withSafeRouter(useRouter());
  const { colors, selectedKey, applyTheme, availableThemes } = useTheme();

  const { profile: rawProfile, setProfile, loadProfile } = useProfileStore();
  const profile = rawProfile as Profile | null;

  const [loggingOut, setLoggingOut] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [search, setSearch] = useState("");
  const [recentAccounts, setRecentAccounts] = useState<SavedAccount[]>([]);
  const isCurrentAccountSaved = useMemo(() => {
    if (!profile?.id) return false;
    return recentAccounts.some((acc) => acc.id === profile.id);
  }, [profile?.id, recentAccounts]);
  // Theme selector has moved to the Premium page (logout/premium). We keep the theme API available in case other settings need it.

  const palette = useMemo(
    () => ({
      twitterBlue: colors.accent,
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subtext,
      border: colors.border,
      faint: colors.faint,
      isDark: colors.isDark ?? false,
    }),
    [colors],
  );

  // themeOptions intentionally removed from Settings — see /logout/premium for theme controls

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          await loadProfile(data.user.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.warn("Failed to init profile", err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await readSavedAccounts();
        if (mounted) setRecentAccounts(stored);
      } catch (err) {
        console.warn("load saved accounts", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      setLoggingOut(false);
      if (error) {
        Alert.alert("Logout Failed", error.message);
      } else {
        setProfile(null);
        router.dismissAll();
        requestAnimationFrame(() => {
          router.replace("/auth/login");
        });
      }
    } catch (err: any) {
      setLoggingOut(false);
      Alert.alert("Logout Failed", err?.message || "Unknown error");
    }
  }, [router, setProfile]);


  const handleSaveCurrentAccount = useCallback(async () => {
    if (!profile?.id) {
      Alert.alert("Save account", "Sign in to save this profile for quick switching.");
      return;
    }
    setSavingAccount(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const refreshToken = data?.session?.refresh_token ?? null;
      if (!refreshToken) {
        Alert.alert("Save account", "Refresh token unavailable. Please sign in again and retry.");
        return;
      }
      const entry: SavedAccount = {
        id: profile.id,
        name: profile.full_name || profile.username || "Account",
        avatar: profile.avatar_url,
        email: profile.email,
        refreshToken,
        savedAt: Date.now(),
      };
      const updated = await upsertSavedAccount(entry);
      setRecentAccounts(updated);
      Alert.alert("Saved", "We'll remember this account for quick switching.");
    } catch (err: any) {
      Alert.alert("Save account failed", err?.message || "Unable to save account right now.");
    } finally {
      setSavingAccount(false);
    }
  }, [profile]);

  const handleRemoveAccount = useCallback(async (accountId: string) => {
    try {
      const updated = await deleteSavedAccount(accountId);
      setRecentAccounts(updated);
    } catch (err) {
      console.warn("remove saved account", err);
    }
  }, []);

  const handleAccountSwitch = useCallback(
    async (target?: SavedAccount) => {
      setSwitchingAccountId(target?.id ?? "new");
      try {
        if (target?.refreshToken) {
          const { data, error } = await supabase.auth.refreshSession({ refresh_token: target.refreshToken });
          if (error || !data.session?.user) throw error ?? new Error("Unable to restore saved session");
          if (target) {
            try {
              const updated = await upsertSavedAccount({
                ...target,
                refreshToken: data.session?.refresh_token ?? target.refreshToken,
                savedAt: Date.now(),
              });
              setRecentAccounts(updated);
            } catch (persistErr) {
              console.warn("refresh saved account token", persistErr);
            }
          }
          await loadProfile(data.session.user.id);
          setSwitchingAccountId(null);
          router.dismissAll();
          router.replace("/");
          return;
        }
        await supabase.auth.signOut({ scope: "global" });
        setProfile(null);
        router.dismissAll();
        requestAnimationFrame(() => {
          if (target?.email) {
            router.replace({ pathname: "/auth/login", params: { emailHint: target.email } } as any);
          } else {
            router.replace({ pathname: "/auth/login", params: { mode: "switch" } });
          }
        });
      } catch (err: any) {
        Alert.alert("Switch Account Failed", err?.message || "Unable to switch accounts right now.");
        if (target?.id) {
          try {
            const updated = await deleteSavedAccount(target.id);
            setRecentAccounts(updated);
          } catch (cleanupErr) {
            console.warn("cleanup saved account", cleanupErr);
          }
        }
      } finally {
        setSwitchingAccountId(null);
      }
    },
    [loadProfile, router, setProfile],
  );

  const filteredItems = settingsItems.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "---";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const roleColorMap: Record<string, string> = {
    admin: "#8e44ad",
    moderator: "#ffb400",
    premium: "#00c853",
    pro: "#ff6b6b",
    basic: "#1DA1F2",
    guest: "#9aa8b2",
  };
  const getBadgeColor = (role?: string | null) => {
    if (!role) return roleColorMap.basic;
    return roleColorMap[role.toLowerCase()] || "#1DA1F2";
  };

  return (
    <SwipeBackContainer>
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}> 
      <View style={styles.headerContainer}> 
        <TouchableOpacity onPress={() => router.back()} style={[styles.backPill, { backgroundColor: palette.twitterBlue }]} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={16} color="#fff" />
        </TouchableOpacity>

        <View style={[styles.titlePill, { backgroundColor: palette.twitterBlue }]}> 
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <View style={styles.avatarWrapper}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: palette.twitterBlue, alignItems: "center", justifyContent: "center" }]}> 
                <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700" }}>
                  {profile?.full_name?.[0] || "?"}
                </Text>
              </View>
            )}

            {profile?.role && (
              <View
                style={[
                  styles.badgeOuter,
                  { borderColor: "#fff", backgroundColor: getBadgeColor(profile.role) },
                ]}
              >
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[styles.name, { color: palette.text }]}>{profile?.full_name || profile?.username || "Guest"}</Text>

              {profile?.verified && (
                <View style={styles.verifiedSmall}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>

            <Text style={[styles.subText, { color: palette.subText }]}>{profile ? "Signed in" : "Not signed in"}</Text>

            {profile?.role && (
              <View style={[styles.rolePill, { backgroundColor: getBadgeColor(profile.role) + "22" }]}> 
                <Text style={[styles.rolePillText, { color: getBadgeColor(profile.role) }]}>{profile.role.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        {profile && (
          <TouchableOpacity
            style={[styles.saveAccountBtn, { borderColor: palette.border, backgroundColor: palette.faint }]}
            onPress={handleSaveCurrentAccount}
            disabled={isCurrentAccountSaved || savingAccount}
          >
            {savingAccount ? (
              <ActivityIndicator color={palette.twitterBlue} />
            ) : (
              <Text style={{ color: palette.text, fontWeight: "700" }}>
                {isCurrentAccountSaved ? "Account saved for quick switch" : "Save this account"}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={[styles.searchContainer, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <Ionicons name="search" size={18} color={palette.subText} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search settings"
            placeholderTextColor={palette.subText}
            style={[styles.searchInput, { color: palette.text }]}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <TouchableOpacity
                key={item.title + index.toString()}
                style={[styles.settingRow, { borderBottomColor: palette.border }]}
                onPress={() => router.push(item.path)}
              >
                <Text style={[styles.settingText, { color: palette.text }]}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={18} color={palette.subText} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ color: palette.subText, padding: 14 }}>No results found.</Text>
          )}
        </View>

        {recentAccounts.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}> 
            <View style={styles.accountHeaderRow}>
              <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>Saved accounts</Text>
              <TouchableOpacity onPress={() => handleAccountSwitch()} style={styles.accountAddBtn}>
                <Ionicons name="add" size={16} color={palette.twitterBlue} />
                <Text style={{ color: palette.twitterBlue, marginLeft: 4, fontWeight: "600" }}>Add new</Text>
              </TouchableOpacity>
            </View>
            {recentAccounts.map((account, idx) => (
              <View
                key={`${account.id}-${idx}`}
                style={[styles.accountRow, { borderBottomColor: idx === recentAccounts.length - 1 ? "transparent" : palette.border }]}
              >
                <View style={styles.accountRowLeft}>
                  {account.avatar ? (
                    <Image source={{ uri: account.avatar }} style={styles.accountAvatar} />
                  ) : (
                    <View style={[styles.accountAvatar, { backgroundColor: palette.faint, alignItems: "center", justifyContent: "center" }]}>
                      <Ionicons name="person" size={16} color={palette.subText} />
                    </View>
                  )}
                  <View>
                    <Text style={{ color: palette.text, fontWeight: "600" }}>{account.name}</Text>
                    {account.email ? <Text style={{ color: palette.subText, fontSize: 12 }}>{account.email}</Text> : null}
                  </View>
                </View>
                <View style={styles.accountRowActions}>
                  {switchingAccountId === account.id ? (
                    <ActivityIndicator color={palette.twitterBlue} style={{ marginRight: 12 }} />
                  ) : (
                    <TouchableOpacity onPress={() => handleAccountSwitch(account)} style={[styles.accountSwitchBtn, { borderColor: palette.border }]}> 
                      <Text style={{ color: palette.twitterBlue, fontWeight: "700" }}>Switch</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleRemoveAccount(account.id)} style={styles.accountRemoveBtn}>
                    <Ionicons name="close" size={16} color={palette.subText} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Appearance settings were moved to Premium — removed duplicate/leftover controls here. */}

        {profile && (
          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: palette.twitterBlue }]} onPress={logout} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.logoutText}>Log out</Text>}
          </TouchableOpacity>
        )}

        {profile?.subscription_start && profile?.subscription_end && (
          <View style={{ marginTop: 20, marginHorizontal: 12 }}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700", marginBottom: 6 }}>Subscription</Text>
            <Text style={{ color: palette.subText, marginBottom: 4 }}>Started: {formatDate(profile.subscription_start)}</Text>
            <Text style={{ color: palette.subText }}>Renewal: {formatDate(profile.subscription_end)}</Text>

            <View style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800" }}>VELT™</Text>
              <Text style={{ color: palette.subText, fontSize: 12, marginTop: 4 }}>Made in Ghana</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    </SwipeBackContainer>
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
  profileCard: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  avatarWrapper: {
    width: 88,
    height: 88,
    position: "relative",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 88,
    overflow: "hidden",
  },
  badgeOuter: {
    position: "absolute",
    right: -2,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedSmall: {
    marginLeft: 8,
    backgroundColor: "#1DA1F2",
    padding: 3,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 20, fontWeight: "800" },
  subText: { fontSize: 13, marginTop: 6, color: '#8899a6' },
  rolePill: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  rolePillText: {
    fontWeight: "700",
    fontSize: 12,
  },
  searchContainer: {
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    marginBottom: 18,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  card: {
    marginHorizontal: 12,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 18,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  settingRow: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingText: { fontSize: 17 },
  accountHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  accountAddBtn: { flexDirection: "row", alignItems: "center" },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accountRowLeft: { flexDirection: "row", alignItems: "center" },
  accountAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1f1f1f", marginRight: 12 },
  accountRowActions: { flexDirection: "row", alignItems: "center" },
  accountSwitchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  accountRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveAccountBtn: {
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  themeScroll: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  themeCard: {
    width: 200,
    marginHorizontal: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  themeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  themeSwatches: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  themeSwatch: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  logoutBtn: {
    marginHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 6,
  },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});