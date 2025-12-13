// app/profile/edit-profile.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import type { Asset } from 'expo-media-library';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, VELT_ACCENT } from 'app/themes';
import MediaImporter from '@/components/MediaImporter';
import PhotoEditorModal from '@/components/PhotoEditorModal';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import SwipeBackContainer from '@/components/SwipeBackContainer';

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dpejjmjxg/image/upload';
const UPLOAD_PRESET = 'private_profiles';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

let NativeLiquidGlass: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expoGlass = require('expo-glass-effect');
  NativeLiquidGlass = expoGlass && (expoGlass.LiquidGlassView || expoGlass.GlassView || expoGlass.default);
} catch {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const callstack = require('@callstack/liquid-glass');
    NativeLiquidGlass = callstack && (callstack.LiquidGlassView || callstack.default);
  } catch {
    NativeLiquidGlass = null;
  }
}

const Glass: React.FC<{ style?: any; intensity?: number; tint?: 'light' | 'dark' | 'default'; children?: React.ReactNode }> = ({ style, intensity = 80, tint = 'light', children }) => {
  if (Platform.OS === 'ios' && NativeLiquidGlass) {
    return (
      <NativeLiquidGlass style={style} intensity={intensity} tint={tint}>
        {children}
      </NativeLiquidGlass>
    );
  }
  return (
    <BlurView intensity={Math.min(intensity, 100)} tint={tint === 'dark' ? 'dark' : 'light'} style={style}>
      {children}
    </BlurView>
  );
};

type MediaMode = 'avatar' | 'cover';
type NullableString = string | null;

export default function EditProfileScreen() {
  const router = withSafeRouter(useRouter());
  const { profile, setProfile } = useProfileStore();
  const { colors } = useTheme();

  const theme = useMemo(() => {
    const hair = colors.border || (colors.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)');
    return {
      bg: colors.bg,
      text: colors.text,
      sub: colors.subtext,
      card: colors.card,
      accent: colors.accent,
      hair,
      faint: colors.faint || hair,
      isDark: colors.isDark ?? false,
    };
  }, [colors]);

  const statusBarStyle = theme.isDark ? 'light' : 'dark';

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profession, setProfession] = useState('');
  const [businessName, setBusinessName] = useState('');

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [mediaImporterVisible, setMediaImporterVisible] = useState(false);
  const [mediaMode, setMediaMode] = useState<MediaMode>('avatar');
  const [editorMode, setEditorMode] = useState<MediaMode>('avatar');
  const [editorAsset, setEditorAsset] = useState<(Asset & { localUri?: string | null }) | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? null;
        if (!userId) {
          setLoadingProfile(false);
          return;
        }
        const { data: prof, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!error && prof && mounted) {
          setProfile(prof as any);
        }
      } catch (err) {
        console.warn('edit-profile init', err);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [setProfile]);

  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    setUsername(p?.username ?? '');
    setFullName(p?.full_name ?? '');
    setBio(p?.bio ?? '');
    setWebsite(p?.website ?? '');
    setAvatarUrl(p?.avatar_url ?? '');
    setCoverUrl(p?.cover_photo_url ?? '');
    setDateOfBirth(p?.date_of_birth ? formatDateForInput(p.date_of_birth) : '');
    setProfession(p?.profession ?? '');
    setBusinessName(p?.business_name ?? '');
  }, [profile]);

  const formatDateForInput = (value?: NullableString) => {
    if (!value) return '';
    try {
      const dt = new Date(value);
      if (isNaN(dt.getTime())) return value ?? '';
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return value ?? '';
    }
  };

  const uploadToCloudinary = async (localUri: string, filename: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: filename,
      type: 'image/jpeg',
    } as any);
    formData.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
    const data = await res.json();
    if (!data?.secure_url) throw new Error('Cloudinary upload failed');
    return data.secure_url as string;
  };

  const handleAvatarFromUri = async (uri: string, options?: { skipPreprocess?: boolean }) => {
    try {
      setUploading(true);
      let preparedUri = uri;
      if (!options?.skipPreprocess) {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 900 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
        );
        preparedUri = manipulated.uri;
      }
      setAvatarUrl(preparedUri);
      const cloudUrl = await uploadToCloudinary(preparedUri, `avatar_${Date.now()}.jpg`);
      setAvatarUrl(cloudUrl);
    } catch (err) {
      console.warn('avatar upload err', err);
      Alert.alert('Upload Failed', 'Unable to process the selected photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverFromUri = async (uri: string, options?: { skipPreprocess?: boolean }) => {
    try {
      setCoverUploading(true);
      let preparedUri = uri;
      if (!options?.skipPreprocess) {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
        );
        preparedUri = manipulated.uri;
      }
      setCoverUrl(preparedUri);
      const cloudUrl = await uploadToCloudinary(preparedUri, `cover_${Date.now()}.jpg`);
      setCoverUrl(cloudUrl);
    } catch (err) {
      console.warn('cover upload err', err);
      Alert.alert('Upload Failed', 'Unable to process the selected cover.');
    } finally {
      setCoverUploading(false);
    }
  };

  const openMediaImporter = (mode: MediaMode) => {
    setMediaMode(mode);
    setMediaImporterVisible(true);
  };

  const handleMediaSelection = (asset: Asset & { localUri?: string | null }) => {
    setMediaImporterVisible(false);
    const uri = asset?.localUri ?? asset?.uri;
    if (!uri) {
      Alert.alert('No file', 'Unable to use the selected media.');
      return;
    }
    setEditorMode(mediaMode);
    setEditorAsset({ ...asset, localUri: uri });
    setEditorVisible(true);
  };

  const handleEditorCancel = () => {
    setEditorVisible(false);
    setEditorAsset(null);
  };

  const handleEditorApply = async (uri: string) => {
    setEditorVisible(false);
    setEditorAsset(null);
    if (editorMode === 'avatar') {
      await handleAvatarFromUri(uri, { skipPreprocess: true });
    } else {
      await handleCoverFromUri(uri, { skipPreprocess: true });
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return Alert.alert('Error', 'Profile not loaded.');
    if (uploading || coverUploading) return Alert.alert('Please wait', 'An upload is still in progress.');
    if (!username.trim() || !fullName.trim()) return Alert.alert('Validation', 'Username and full name are required.');
    if (website.trim() && !/^https?:\/\/\S+\.\S+/.test(website.trim())) return Alert.alert('Validation', 'Enter a valid website URL.');

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const updates: Record<string, any> = {
      username: username.trim(),
      full_name: fullName.trim(),
      bio: bio.trim(),
      website: website.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      cover_photo_url: coverUrl.trim() || null,
      date_of_birth: dateOfBirth || null,
      profession: profession.trim() || null,
      business_name: businessName.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', (profile as any).id);
    if (error) {
      console.warn('save profile error', error);
      Alert.alert('Update Failed', error.message);
      return;
    }

    setProfile({ ...(profile as any), ...updates, id: (profile as any).id });
    Alert.alert('Saved', 'Profile updated!');
    router.back();
  };

  const showNativeDatePicker = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('@react-native-community/datetimepicker').default;
      setShowPicker(true);
    } catch {
      Alert.alert('Date picker unavailable', 'Enter DOB as YYYY-MM-DD.');
    }
  };

  const parseDateString = (txt?: string) => {
    if (!txt) return new Date();
    const normalized = txt.replace(/\//g, '-');
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const yyyy = Number(parts[0]);
      const mm = Number(parts[1]) - 1;
      const dd = Number(parts[2]);
      const dt = new Date(yyyy, mm, dd);
      if (!isNaN(dt.getTime())) return dt;
    }
    const fallback = new Date(txt);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  };

  const onNativeDateChange = (_: any, selected?: any) => {
    setShowPicker(false);
    if (!selected) return;
    try {
      const dt = new Date(selected);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      setDateOfBirth(`${yyyy}-${mm}-${dd}`);
    } catch {}
  };

  if (loadingProfile) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.loaderWrap, { backgroundColor: theme.bg }]}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  const coverHeight = 200;

  return (
    <SwipeBackContainer>
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.container, { backgroundColor: theme.bg }]}> 
      <StatusBar style={statusBarStyle} translucent />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 72 }}>
          <View style={[styles.cover, { height: coverHeight }]}> 
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: VELT_ACCENT + '22' }]} />
            )}
            {/* Gradient overlay */}
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.4)']}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.coverTop}>
              <Pressable 
                onPress={() => router.back()} 
                style={({ pressed }) => [styles.headerButton, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
              > 
                <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                  <Ionicons name="chevron-back" size={20} color="#fff" />
                </BlurView>
              </Pressable>

              <Pressable 
                onPress={handleSave} 
                style={({ pressed }) => [styles.headerButton, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
              > 
                <BlurView intensity={40} tint="dark" style={[styles.headerButtonBlur, { backgroundColor: VELT_ACCENT + '99', paddingHorizontal: 16 }]}>
                  <Text style={[styles.saveText, { color: '#fff' }]}>Save</Text>
                </BlurView>
              </Pressable>
            </View>

            <Pressable 
              onPress={() => openMediaImporter('cover')} 
              style={({ pressed }) => [styles.changeCoverBtn, { backgroundColor: theme.card, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            > 
              <Feather name="camera" size={14} color={theme.text} />
              <Text style={[styles.changeCoverText, { color: theme.text }]}>{coverUploading ? 'Uploading…' : 'Change cover'}</Text>
            </Pressable>
          </View>

          <View style={styles.avatarWrapOuter}>
            <Pressable 
              onPress={() => openMediaImporter('avatar')} 
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}
            >
              <View style={[styles.avatarOuter, { borderColor: VELT_ACCENT }]}> 
                {uploading ? (
                  <View style={[styles.avatarInner, styles.center]}>
                    <ActivityIndicator color={VELT_ACCENT} />
                  </View>
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarInner} />
                ) : (
                  <View style={[styles.avatarInner, styles.center, { backgroundColor: theme.faint }]}>
                    <Ionicons name="person" size={48} color={theme.text} />
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hair }]}> 
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
                  {fullName || 'Full name'}
                </Text>
                <Text style={[styles.usernameText, { color: theme.sub }]} numberOfLines={1}>
                  @{username || 'username'}
                </Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.sub }]}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={theme.sub}
                style={[styles.pillInput, { backgroundColor: theme.hair, color: theme.text }]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.sub }]}>Username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="@username"
                autoCapitalize="none"
                placeholderTextColor={theme.sub}
                style={[styles.pillInput, { backgroundColor: theme.hair, color: theme.text }]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.sub }]}>Date of birth</Text>
              <View style={styles.dobRow}>
                <Pressable 
                  style={({ pressed }) => [styles.dobPill, { backgroundColor: VELT_ACCENT, transform: [{ scale: pressed ? 0.95 : 1 }] }]} 
                  onPress={showNativeDatePicker}
                >
                  <Text style={[styles.dobText, { color: '#fff' }]}>{dateOfBirth || 'Select date'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.sub }]}>Profession</Text>
              <TextInput
                value={profession}
                onChangeText={setProfession}
                placeholder="e.g. Content Creator"
                placeholderTextColor={theme.sub}
                style={[styles.pillInput, { backgroundColor: theme.hair, color: theme.text }]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.sub }]}>Business name</Text>
              <TextInput
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Company (optional)"
                placeholderTextColor={theme.sub}
                style={[styles.pillInput, { backgroundColor: theme.hair, color: theme.text, fontWeight: '700' }]}
              />
              <Pressable 
                onPress={() => router.push('/market/my-store')} 
                style={({ pressed }) => [{ marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: VELT_ACCENT, alignSelf: 'flex-start', transform: [{ scale: pressed ? 0.95 : 1 }] }]}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Manage storefront</Text>
              </Pressable>
              <Pressable 
                onPress={() => router.push('/profile/shipping-addresses')} 
                style={({ pressed }) => [{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: theme.hair, alignSelf: 'flex-start', transform: [{ scale: pressed ? 0.95 : 1 }] }]}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>Manage shipping addresses</Text>
              </Pressable>
              <Pressable 
                onPress={() => router.push('/market/orders')} 
                style={({ pressed }) => [{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: theme.hair, alignSelf: 'flex-start', transform: [{ scale: pressed ? 0.95 : 1 }] }]}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>My orders</Text>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.sub }]}>Bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Write something about yourself"
                placeholderTextColor={theme.sub}
                style={[styles.textarea, { borderColor: theme.hair, backgroundColor: theme.hair, color: theme.text }]}
                multiline
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.sub }]}>Website</Text>
              <TextInput
                value={website}
                onChangeText={setWebsite}
                placeholder="https://example.com"
                placeholderTextColor={theme.sub}
                style={[styles.pillInput, { backgroundColor: theme.hair, color: theme.text }]}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>


            <View style={styles.buttonRow}>
              <Pressable 
                style={({ pressed }) => [styles.cancelBtn, { borderColor: theme.hair, transform: [{ scale: pressed ? 0.95 : 1 }] }]} 
                onPress={() => router.back()}
              >
                <Text style={{ color: theme.text }}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={({ pressed }) => [styles.primaryBtn, { backgroundColor: VELT_ACCENT, transform: [{ scale: pressed ? 0.95 : 1 }] }]} 
                onPress={handleSave}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>{uploading || coverUploading ? 'Saving…' : 'Save Profile'}</Text>
              </Pressable>
            </View>
          </View>

          {showPicker && Platform.OS !== 'web'
            ? (() => {
                try {
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  const DateTimePicker = require('@react-native-community/datetimepicker').default;
                  const dt = parseDateString(dateOfBirth);
                  return (
                    <DateTimePicker
                      testID="dateTimePicker"
                      value={dt}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onNativeDateChange}
                      maximumDate={new Date()}
                    />
                  );
                } catch {
                  return null;
                }
              })()
            : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <MediaImporter
        visible={mediaImporterVisible}
        onClose={() => setMediaImporterVisible(false)}
        onSelect={handleMediaSelection}
        allowVideos={false}
        title={mediaMode === 'avatar' ? 'Choose profile photo' : 'Choose cover photo'}
      />

      <PhotoEditorModal
        visible={editorVisible}
        asset={editorAsset}
        mode={editorMode}
        onCancel={handleEditorCancel}
        onApply={handleEditorApply}
      />
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { width: SCREEN_WIDTH, overflow: 'hidden', alignItems: 'flex-end', justifyContent: 'flex-end' },
  coverImage: { width: '100%', height: '100%' },
  coverTop: { position: 'absolute', top: Platform.OS === 'ios' ? 48 : 18, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  // Glassmorphism header button
  headerButton: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    height: 42,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  iconPillGlass: { borderRadius: 999, padding: 6, overflow: 'hidden' },
  iconPill: { height: 42, minWidth: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row' },
  saveText: { fontWeight: '800', fontSize: 14 },
  changeCoverBtn: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeCoverText: { fontWeight: '700' },
  avatarWrapOuter: { marginTop: -48, alignItems: 'center', justifyContent: 'center' },
  avatarOuter: { width: 128, height: 128, borderRadius: 999, padding: 4, borderWidth: 3, overflow: 'hidden', backgroundColor: '#fff' },
  avatarInner: { width: 120, height: 120, borderRadius: 999 },
  editAvatarBtn: { position: 'absolute', right: -6, bottom: -6, width: 38, height: 38, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: 18, marginHorizontal: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nameText: { fontSize: 20, fontWeight: '900' },
  usernameText: { fontSize: 13, marginTop: 4 },
  fieldGroup: { marginTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  dobRow: { flexDirection: 'row', alignItems: 'center' },
  dobPill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, minWidth: 160, alignItems: 'center', justifyContent: 'center' },
  dobText: { fontSize: 14, fontWeight: '900' },
  pillInput: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, fontSize: 15 },
  textarea: { minHeight: 110, borderRadius: 16, borderWidth: 1, padding: 14, fontSize: 15, textAlignVertical: 'top' },
  buttonRow: { marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end', gap: 12, alignItems: 'center' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});










