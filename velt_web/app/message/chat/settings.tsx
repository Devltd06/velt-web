import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  ActionSheetIOS,
  Platform,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinaryLocal, CLOUDINARY_BILLBOARD_CLOUD } from '@/utils/cloudinary';
import PhotoEditorModal from '@/components/PhotoEditorModal';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useProfileStore, Profile } from '@/lib/store/profile';
import { useTheme, VELT_ACCENT } from 'app/themes';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedPressable from '@/components/AnimatedPressable';
import { getCachedChatSettings } from '@/lib/store/prefetchStore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const AVATAR_FALLBACK = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';
// Use existing Cloudinary preset for wallpaper uploads
const WALLPAPER_UPLOAD_PRESET = 'in_app_ads';

// Wallpaper aspect presets (portrait orientation for chat)
const WALLPAPER_ASPECT_PRESETS = [
  { id: '9x16', label: '9:16', ratio: 9 / 16 },
  { id: '9x19', label: '9:19.5', ratio: 9 / 19.5 },
  { id: '3x4', label: '3:4', ratio: 3 / 4 },
];

// Report reasons
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'other', label: 'Other' },
];

type ConversationParticipant = {
  id: string;
  full_name?: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  accepted?: boolean;
  follower_count?: number;
};

export default function ChatSettings() {
  const insets = useSafeAreaInsets();
  const router = withSafeRouter(useRouter());
  const { profile } = useProfileStore();
  const { id, otherUserId: paramOtherUserId, otherName: paramOtherName, otherAvatar: paramOtherAvatar } = useLocalSearchParams<{
    id: string;
    otherUserId?: string;
    otherName?: string;
    otherAvatar?: string;
  }>();
  const convoId = Array.isArray(id) ? id[0] : id;

  const { colors: themeColors } = useTheme();
  const isDark = themeColors.isDark;
  const ui = useMemo(
    () => ({
      text: themeColors.text,
      subtext: themeColors.subtext,
      bg: themeColors.bg,
      card: themeColors.card,
    }),
    [themeColors]
  );

  // State
  const [initialLoading, setInitialLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<ConversationParticipant | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  
  // Wallpaper state
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [wallpaperUploading, setWallpaperUploading] = useState(false);
  
  // Photo editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorAsset, setEditorAsset] = useState<{ uri: string; width: number; height: number } | null>(null);

  // Modals
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reportContext, setReportContext] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [clearChatConfirmVisible, setClearChatConfirmVisible] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const loadingPulse = useRef(new Animated.Value(0)).current;
  const loadingRef = useRef(false);

  // Start loading animation
  useEffect(() => {
    if (initialLoading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(loadingPulse, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(loadingPulse, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [initialLoading, loadingPulse]);

  // Load conversation data
  const loadData = useCallback(async () => {
    if (loadingRef.current || !convoId || !profile?.id) return;
    loadingRef.current = true;

    try {
      // Check for cached data first (prefetched during navigation)
      const cached = getCachedChatSettings(convoId);
      if (cached) {
        setIsGroup(cached.isGroup);
        if (cached.otherUser) {
          setOtherUser({
            id: cached.otherUser.id,
            full_name: cached.otherUser.full_name,
            username: cached.otherUser.username,
            avatar_url: cached.otherUser.avatar_url,
          });
        }
        setIsBlocked(cached.isBlocked);
        setWallpaperUrl(cached.wallpaperUrl);
        setInitialLoading(false);
        loadingRef.current = false;
        
        // Fetch follower count in background if we have cached data
        if (cached.otherUser?.id) {
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', cached.otherUser.id)
            .then(({ count }) => {
              setOtherUser(prev => prev ? { ...prev, follower_count: count || 0 } : prev);
            });
        }
        return;
      }

      // Load conversation details
      const { data: convoData, error: convoError } = await supabase
        .from('conversations')
        .select('id, is_group, title, avatar_url')
        .eq('id', convoId)
        .single();

      if (convoError) throw convoError;

      setIsGroup(convoData?.is_group === true);

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id, accepted, profiles:user_id(id, full_name, username, avatar_url, bio)')
        .eq('conversation_id', convoId);

      if (participantsError) throw participantsError;

      // Find the other user (for 1:1 chats)
      if (!convoData?.is_group && participantsData) {
        const other = participantsData.find((p: any) => p.user_id !== profile.id);
        if (other?.profiles) {
          const otherProfile = Array.isArray(other.profiles) ? other.profiles[0] : other.profiles;
          
          // Get follower count
          const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', otherProfile.id);

          setOtherUser({
            ...otherProfile,
            accepted: other.accepted,
            follower_count: count || 0,
          });

          // Check if blocked
          const { data: blockData } = await supabase.rpc('is_user_blocked', {
            p_other_id: otherProfile.id,
          });
          setIsBlocked(blockData === true);
        }
      }
    } catch (err) {
      console.warn('ChatSettings loadData err:', err);
    } finally {
      setInitialLoading(false);
      loadingRef.current = false;
    }
  }, [convoId, profile?.id]);

  useEffect(() => {
    if (convoId && profile?.id) {
      loadData();
    }
  }, [convoId, profile?.id]);

  // Handle wallpaper selection
  const handleWallpaperPress = useCallback(async () => {
    if (!profile?.id) return;

    const options = wallpaperUrl
      ? ['Choose from Library', 'Remove Wallpaper', 'Cancel']
      : ['Choose from Library', 'Cancel'];
    const destructiveIndex = wallpaperUrl ? 1 : undefined;
    const cancelIndex = wallpaperUrl ? 2 : 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: destructiveIndex,
          cancelButtonIndex: cancelIndex,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            await pickAndUploadWallpaper();
          } else if (wallpaperUrl && buttonIndex === 1) {
            await removeWallpaper();
          }
        }
      );
    } else {
      // Android - use Alert
      Alert.alert(
        'Chat Wallpaper',
        'Customize your chat background',
        wallpaperUrl
          ? [
              { text: 'Choose from Library', onPress: pickAndUploadWallpaper },
              { text: 'Remove Wallpaper', style: 'destructive', onPress: removeWallpaper },
              { text: 'Cancel', style: 'cancel' },
            ]
          : [
              { text: 'Choose from Library', onPress: pickAndUploadWallpaper },
              { text: 'Cancel', style: 'cancel' },
            ]
      );
    }
  }, [profile?.id, wallpaperUrl]);

  const pickAndUploadWallpaper = async () => {
    if (!profile?.id) return;
    try {
      // Request permission
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = (permResult as any)?.granted ?? (permResult as any)?.status === 'granted';
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to set a wallpaper.');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false, // We use our own editor
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      
      // Open editor for cropping
      setEditorAsset({
        uri: asset.uri,
        width: asset.width || SCREEN_W,
        height: asset.height || SCREEN_H,
      });
      setEditorVisible(true);
    } catch (err: any) {
      console.warn('wallpaper pick err:', err);
      Alert.alert('Error', err?.message || 'Failed to pick image');
    }
  };

  // Handle edited wallpaper from PhotoEditorModal
  const handleEditorApply = async (editedUri: string) => {
    setEditorVisible(false);
    setEditorAsset(null);
    
    if (!profile?.id) return;
    
    try {
      setWallpaperUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Upload to Cloudinary with wallpaper preset
      const result = await uploadToCloudinaryLocal(
        editedUri,
        'image',
        WALLPAPER_UPLOAD_PRESET,
        'image/jpeg',
        CLOUDINARY_BILLBOARD_CLOUD
      );
      const uploadedUrl = result.secure_url;

      // Save to user_settings
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: profile.id, chat_wallpaper_url: uploadedUrl, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setWallpaperUrl(uploadedUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      console.warn('wallpaper upload err:', err);
      Alert.alert('Error', err?.message || 'Failed to set wallpaper');
    } finally {
      setWallpaperUploading(false);
    }
  };

  const handleEditorCancel = () => {
    setEditorVisible(false);
    setEditorAsset(null);
  };

  const removeWallpaper = async () => {
    if (!profile?.id) return;
    try {
      setWallpaperUploading(true);

      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: profile.id, chat_wallpaper_url: null, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setWallpaperUrl(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      console.warn('wallpaper remove err:', err);
      Alert.alert('Error', err?.message || 'Failed to remove wallpaper');
    } finally {
      setWallpaperUploading(false);
    }
  };



  // Block user
  const handleBlockUser = useCallback(async () => {
    if (!otherUser?.id || !profile?.id) return;
    setBlockLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      if (isBlocked) {
        const { error } = await supabase.rpc('unblock_user', {
          p_blocked_id: otherUser.id,
        });
        if (error) throw error;
        setIsBlocked(false);
        Alert.alert('Unblocked', `${otherUser.full_name || 'User'} has been unblocked.`);
      } else {
        const { error } = await supabase.rpc('block_user', {
          p_blocked_id: otherUser.id,
        });
        if (error) throw error;
        setIsBlocked(true);
        Alert.alert('Blocked', `${otherUser.full_name || 'User'} has been blocked. They will no longer be able to message you.`);
      }
    } catch (err: any) {
      console.warn('block/unblock err:', err);
      Alert.alert('Error', err?.message || 'Failed to update block status');
    } finally {
      setBlockLoading(false);
      setBlockModalVisible(false);
    }
  }, [isBlocked, otherUser?.id, otherUser?.full_name, profile?.id]);

  // Report user
  const handleReportUser = useCallback(async () => {
    if (!otherUser?.id || !profile?.id || !selectedReason) return;
    setReportSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      const { error } = await supabase.rpc('report_user', {
        p_reported_id: otherUser.id,
        p_reason: selectedReason,
        p_details: reportContext.trim() || null,
        p_conversation_id: convoId || null,
      });
      if (error) throw error;

      Alert.alert('Report Submitted', 'Thank you for your report. Our team will review it shortly.');
      setReportModalVisible(false);
      setSelectedReason(null);
      setReportContext('');
    } catch (err: any) {
      console.warn('report err:', err);
      Alert.alert('Error', err?.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  }, [otherUser?.id, profile?.id, selectedReason, reportContext, convoId]);

  // Clear chat
  const handleClearChat = useCallback(async () => {
    if (!convoId || !profile?.id) return;
    setClearingChat(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    try {
      // Use RPC function to clear all messages in conversation
      const { data, error } = await supabase.rpc('clear_chat_messages', {
        p_conversation_id: convoId,
      });

      if (error) throw error;
      
      const result = data as any;
      if (result && result.success === false) {
        throw new Error(result.error || 'Failed to clear chat');
      }

      Alert.alert('Chat Cleared', 'All messages have been deleted from this conversation.');
      
      // Navigate back to chat screen
      router.back();
    } catch (err: any) {
      console.warn('clearChat err:', err);
      Alert.alert('Error', err?.message || 'Failed to clear chat');
    } finally {
      setClearingChat(false);
      setClearChatConfirmVisible(false);
    }
  }, [convoId, profile?.id, router]);

  // Collided avatars component
  const CollidedAvatars = useMemo(() => {
    if (!profile || !otherUser) return null;

    const myAvatar = profile.avatar_url || AVATAR_FALLBACK;
    const theirAvatar = otherUser.avatar_url || AVATAR_FALLBACK;

    return (
      <View style={styles.collidedAvatarsContainer}>
        <View style={styles.collidedAvatarWrapper}>
          {/* Other user's avatar (left, slightly behind) */}
          <View style={[styles.collidedAvatar, styles.collidedAvatarLeft]}>
            <Image source={{ uri: theirAvatar }} style={styles.collidedAvatarImage} />
          </View>
          {/* Current user's avatar (right, in front) */}
          <View style={[styles.collidedAvatar, styles.collidedAvatarRight]}>
            <Image source={{ uri: myAvatar }} style={styles.collidedAvatarImage} />
          </View>
        </View>
        <View style={styles.collidedAvatarsInfo}>
          <Text style={[styles.collidedAvatarsTitle, { color: ui.text }]}>
            {profile.full_name || 'You'} & {otherUser.full_name || 'Someone'}
          </Text>
          <Text style={[styles.collidedAvatarsSubtitle, { color: ui.subtext }]}>
            Chat settings
          </Text>
        </View>
      </View>
    );
  }, [profile, otherUser, ui.text, ui.subtext]);

  // Loading state with animated gradient
  if (initialLoading) {
    const opacity = loadingPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    return (
      <View style={[styles.container, { backgroundColor: ui.bg }]}>
        <SafeAreaView style={styles.flex1}>
          <View style={styles.loadingContainer}>
            <Animated.View style={[styles.loadingGradient, { opacity }]}>
              <LinearGradient
                colors={isDark ? ['#1a1a2e', '#16213e', '#0f3460'] : ['#e0e5ec', '#f0f5fc', '#d0ddef']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </Animated.View>
            <ActivityIndicator size="large" color={VELT_ACCENT} />
            <Text style={[styles.loadingText, { color: ui.subtext }]}>Loading settings...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <SafeAreaView style={styles.flex1} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <AnimatedPressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={ui.text} />
          </AnimatedPressable>
          <Text style={[styles.headerTitle, { color: ui.text }]}>Settings</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                loadingRef.current = false; // Allow reload
                await loadData();
                // Refresh wallpaper
                try {
                  const { data } = await supabase
                    .from('user_settings')
                    .select('chat_wallpaper_url')
                    .eq('user_id', profile?.id)
                    .single();
                  setWallpaperUrl((data as any)?.chat_wallpaper_url || null);
                } catch {}
                setRefreshing(false);
              }}
              tintColor={VELT_ACCENT}
              colors={[VELT_ACCENT]}
            />
          }
        >
          {/* Collided Avatars Section */}
          {!isGroup && CollidedAvatars}

          {/* Wallpaper Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: ui.text }]}>Chat Wallpaper</Text>
            <Text style={[styles.sectionDesc, { color: ui.subtext }]}>
              Personalize your chat background
            </Text>

            <Pressable
              onPress={handleWallpaperPress}
              disabled={wallpaperUploading}
              style={({ pressed }) => [
                styles.wallpaperCard,
                {
                  backgroundColor: pressed
                    ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                    : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              <View style={styles.wallpaperPreviewContainer}>
                {wallpaperUrl ? (
                  <Image
                    source={{ uri: wallpaperUrl }}
                    style={styles.wallpaperPreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.wallpaperPlaceholder, { backgroundColor: isDark ? '#1a1a2e' : '#e8eef5' }]}>
                    <Ionicons name="image-outline" size={32} color={ui.subtext} />
                  </View>
                )}
                {wallpaperUploading && (
                  <View style={styles.wallpaperUploadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                {wallpaperUrl && !wallpaperUploading && (
                  <View style={styles.wallpaperCheckBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={VELT_ACCENT} />
                  </View>
                )}
              </View>
              <View style={styles.wallpaperInfo}>
                <Text style={[styles.wallpaperTitle, { color: ui.text }]}>
                  {wallpaperUrl ? 'Custom Wallpaper' : 'No Wallpaper'}
                </Text>
                <Text style={[styles.wallpaperSubtitle, { color: ui.subtext }]}>
                  {wallpaperUrl ? 'Tap to change or remove' : 'Tap to choose an image'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
            </Pressable>
          </View>

          {/* Actions Section */}
          {!isGroup && otherUser && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: ui.text }]}>Actions</Text>

              {/* Block User */}
              <Pressable
                onPress={() => setBlockModalVisible(true)}
                style={({ pressed }) => [
                  styles.actionItem,
                  { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent' },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: isBlocked ? '#FF3B30' : isDark ? 'rgba(255,59,48,0.15)' : 'rgba(255,59,48,0.1)' }]}>
                  <Ionicons name={isBlocked ? 'checkmark' : 'ban'} size={18} color={isBlocked ? '#fff' : '#FF3B30'} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: ui.text }]}>
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </Text>
                  <Text style={[styles.actionDesc, { color: ui.subtext }]}>
                    {isBlocked ? 'Allow this user to message you again' : 'Stop receiving messages from this user'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
              </Pressable>

              {/* Report User */}
              <Pressable
                onPress={() => setReportModalVisible(true)}
                style={({ pressed }) => [
                  styles.actionItem,
                  { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent' },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.1)' }]}>
                  <Ionicons name="flag" size={18} color="#FF9500" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: ui.text }]}>Report User</Text>
                  <Text style={[styles.actionDesc, { color: ui.subtext }]}>
                    Report inappropriate behavior
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
              </Pressable>

              {/* Clear Chat */}
              <Pressable
                onPress={() => setClearChatConfirmVisible(true)}
                style={({ pressed }) => [
                  styles.actionItem,
                  { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent' },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: isDark ? 'rgba(88,86,214,0.15)' : 'rgba(88,86,214,0.1)' }]}>
                  <Ionicons name="trash-outline" size={18} color="#5856D6" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: ui.text }]}>Clear Chat</Text>
                  <Text style={[styles.actionDesc, { color: ui.subtext }]}>
                    Delete your messages in this chat
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ui.subtext} />
              </Pressable>
            </View>
          )}

          {/* Other User Profile */}
          {!isGroup && otherUser && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: ui.text }]}>About</Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push({ pathname: `/profile/view/${otherUser.id}` });
                }}
                style={({ pressed }) => [
                  styles.profileCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Image
                  source={{ uri: otherUser.avatar_url || AVATAR_FALLBACK }}
                  style={styles.profileAvatar}
                />
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, { color: ui.text }]}>
                    {otherUser.full_name || 'Someone'}
                  </Text>
                  {otherUser.username && (
                    <Text style={[styles.profileUsername, { color: ui.subtext }]}>
                      @{otherUser.username}
                    </Text>
                  )}
                  <Text style={[styles.profileFollowers, { color: ui.subtext }]}>
                    {otherUser.follower_count || 0} followers
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ui.subtext} />
              </Pressable>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Block Modal */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setBlockModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: ui.bg }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: isBlocked ? '#34C759' : '#FF3B30' }]}>
                <Ionicons name={isBlocked ? 'checkmark' : 'ban'} size={28} color="#fff" />
              </View>
              <Text style={[styles.modalTitle, { color: ui.text }]}>
                {isBlocked ? 'Unblock User?' : 'Block User?'}
              </Text>
              <Text style={[styles.modalDesc, { color: ui.subtext }]}>
                {isBlocked
                  ? `${otherUser?.full_name || 'This user'} will be able to send you messages again.`
                  : `${otherUser?.full_name || 'This user'} will no longer be able to send you messages or see your online status.`}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setBlockModalVisible(false)}
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              >
                <Text style={[styles.modalBtnText, { color: ui.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleBlockUser}
                disabled={blockLoading}
                style={[styles.modalBtn, styles.modalBtnConfirm, { backgroundColor: isBlocked ? '#34C759' : '#FF3B30' }]}
              >
                {blockLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    {isBlocked ? 'Unblock' : 'Block'}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReportModalVisible(false)}>
          <Pressable style={[styles.modalCard, styles.reportModal, { backgroundColor: ui.bg }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="flag" size={28} color="#fff" />
              </View>
              <Text style={[styles.modalTitle, { color: ui.text }]}>Report User</Text>
              <Text style={[styles.modalDesc, { color: ui.subtext }]}>
                Why are you reporting {otherUser?.full_name || 'this user'}?
              </Text>
            </View>

            <View style={styles.reportReasons}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedReason(reason.id);
                  }}
                  style={[
                    styles.reportReasonItem,
                    {
                      backgroundColor:
                        selectedReason === reason.id
                          ? isDark
                            ? 'rgba(255,149,0,0.15)'
                            : 'rgba(255,149,0,0.1)'
                          : 'transparent',
                      borderColor:
                        selectedReason === reason.id ? '#FF9500' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    },
                  ]}
                >
                  <Text style={[styles.reportReasonText, { color: ui.text }]}>{reason.label}</Text>
                  {selectedReason === reason.id && <Ionicons name="checkmark" size={18} color="#FF9500" />}
                </Pressable>
              ))}
            </View>

            <TextInput
              value={reportContext}
              onChangeText={setReportContext}
              placeholder="Additional details (optional)"
              placeholderTextColor={ui.subtext}
              multiline
              style={[
                styles.reportInput,
                {
                  color: ui.text,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setReportModalVisible(false);
                  setSelectedReason(null);
                  setReportContext('');
                }}
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              >
                <Text style={[styles.modalBtnText, { color: ui.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleReportUser}
                disabled={reportSubmitting || !selectedReason}
                style={[
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  { backgroundColor: '#FF9500', opacity: selectedReason ? 1 : 0.5 },
                ]}
              >
                {reportSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Submit Report</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Clear Chat Confirm Modal */}
      <Modal
        visible={clearChatConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClearChatConfirmVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setClearChatConfirmVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: ui.bg }]} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#5856D6' }]}>
                <Ionicons name="trash" size={28} color="#fff" />
              </View>
              <Text style={[styles.modalTitle, { color: ui.text }]}>Clear Chat?</Text>
              <Text style={[styles.modalDesc, { color: ui.subtext }]}>
                This will delete all your messages in this conversation. This action cannot be undone.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setClearChatConfirmVisible(false)}
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              >
                <Text style={[styles.modalBtnText, { color: ui.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleClearChat}
                disabled={clearingChat}
                style={[styles.modalBtn, styles.modalBtnConfirm, { backgroundColor: '#5856D6' }]}
              >
                {clearingChat ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Clear</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Photo Editor Modal for Wallpaper */}
      <PhotoEditorModal
        visible={editorVisible}
        asset={editorAsset as any}
        mode="cover"
        onCancel={handleEditorCancel}
        onApply={handleEditorApply}
        aspectPresetsOverride={WALLPAPER_ASPECT_PRESETS}
        title="Edit Wallpaper"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    margin: 20,
    overflow: 'hidden',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  // Collided Avatars
  collidedAvatarsContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 8,
  },
  collidedAvatarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  collidedAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  collidedAvatarLeft: {
    marginRight: -24,
    zIndex: 1,
  },
  collidedAvatarRight: {
    zIndex: 2,
  },
  collidedAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
  },
  collidedAvatarsInfo: {
    alignItems: 'center',
  },
  collidedAvatarsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  collidedAvatarsSubtitle: {
    fontSize: 14,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 16,
  },

  // Wallpaper
  wallpaperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  wallpaperPreviewContainer: {
    position: 'relative',
    marginRight: 14,
  },
  wallpaperPreview: {
    width: 64,
    height: 80,
    borderRadius: 10,
  },
  wallpaperPlaceholder: {
    width: 64,
    height: 80,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallpaperUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallpaperCheckBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  wallpaperInfo: {
    flex: 1,
  },
  wallpaperTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  wallpaperSubtitle: {
    fontSize: 12,
  },

  // Actions
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  profileFollowers: {
    fontSize: 12,
    marginTop: 4,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: Math.min(SCREEN_W - 48, 400),
    borderRadius: 20,
    padding: 24,
  },
  reportModal: {
    maxHeight: SCREEN_H * 0.85,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
  },
  modalBtnConfirm: {},
  modalBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Report Modal
  reportReasons: {
    marginBottom: 16,
  },
  reportReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  reportReasonText: {
    fontSize: 14,
  },
  reportInput: {
    minHeight: 80,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
});
