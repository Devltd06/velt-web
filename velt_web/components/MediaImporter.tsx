import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Platform,
  Animated,
  PanResponder,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { BlurView } from 'expo-blur';
import { useTheme, VELT_ACCENT } from 'app/themes';
import * as Haptics from 'expo-haptics';
// UnifiedBottomSheet removed — use RN Modal for importing media

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CELL = Math.floor((width - 36) / 3);
const PAGE_SIZE = 60;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

type MediaImporterProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (asset: MediaLibrary.Asset & { localUri?: string | null }) => void;
  allowVideos?: boolean;
  // when true, show a small overlay spinner while the host is preparing the selected media
  isBusy?: boolean;
  title?: string;
};

const MediaImporter: React.FC<MediaImporterProps> = ({ visible, onClose, onSelect, allowVideos = false, isBusy = false, title = 'Import Media' }) => {
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

  // Animation refs for slide-up bottom sheet
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Animate sheet in when visible
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  // Close with animation
  const animateClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  // Pan responder for drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > SHEET_HEIGHT * 0.25 || gs.vy > 0.5) {
          animateClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
        }
      },
    })
  ).current;

  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparingVideo, setPreparingVideo] = useState(false);

  const resetState = useCallback(() => {
    setAssets([]);
    setCursor(null);
    setHasNextPage(true);
    setError(null);
    setRefreshing(false);
    setLoading(false);
    setPreparingVideo(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

  const loadAssets = useCallback(
    async (reset = false) => {
      if (!permissionResponse || permissionResponse.status !== 'granted') return;
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const mediaTypes = allowVideos
          ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
          : [MediaLibrary.MediaType.photo];
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: mediaTypes,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          first: PAGE_SIZE,
          ...(reset ? {} : { after: cursor ?? undefined }),
        });
        setCursor(result.endCursor ?? null);
        setHasNextPage(result.hasNextPage);
        setAssets((prev) => {
          // Ensure we don't accidentally append duplicate assets (some devices/paginated APIs
          // can return overlapping pages). Keep items unique by id and preserve order.
          const incoming = reset ? result.assets : [...prev, ...result.assets];
          const seen = new Set<string>();
          const unique: MediaLibrary.Asset[] = [];
          for (const a of incoming) {
            if (!a || !a.id) continue;
            if (seen.has(a.id)) continue;
            seen.add(a.id);
            unique.push(a);
          }
          return unique;
        });
      } catch (err) {
        console.warn('media importer load err', err);
        setError('Unable to load your gallery right now.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allowVideos, cursor, loading, permissionResponse],
  );

  useEffect(() => {
    if (!visible) return;
    if (!permissionResponse) {
      requestPermission();
      return;
    }
    if (permissionResponse.status === 'granted') {
      loadAssets(true);
    }
  }, [visible, permissionResponse, requestPermission, loadAssets]);

  const handleRefresh = useCallback(() => {
    if (permissionResponse?.status !== 'granted') return;
    setRefreshing(true);
    loadAssets(true);
  }, [permissionResponse, loadAssets]);

  const handleAssetPress = useCallback(
    async (asset: MediaLibrary.Asset) => {
      // Show preparing indicator for videos
      if (asset.mediaType === MediaLibrary.MediaType.video) {
        setPreparingVideo(true);
      }
      
      try {
        // Get full asset info including localUri (file path)
        const info = await MediaLibrary.getAssetInfoAsync(asset);
        
        let finalUri: string = info.localUri ?? info.uri ?? asset.uri;
        
        console.log('MediaImporter - Original URI:', finalUri);
        console.log('MediaImporter - Asset info:', JSON.stringify({ localUri: info.localUri, uri: info.uri }, null, 2));
        
        // For videos on Android, content:// URIs don't work with video players
        // We need to copy to a file:// location
        if (asset.mediaType === MediaLibrary.MediaType.video && Platform.OS === 'android') {
          const sourceUri = info.localUri ?? info.uri ?? asset.uri;
          
          // Check if it's a content:// URI that needs copying
          if (sourceUri.startsWith('content://') || sourceUri.startsWith('content:')) {
            console.log('MediaImporter - Copying content:// video to cache...');
            try {
              const filename = `video_${Date.now()}.mp4`;
              const destUri = `${FileSystem.cacheDirectory}${filename}`;
              
              // Copy the file
              await FileSystem.copyAsync({
                from: sourceUri,
                to: destUri,
              });
              
              // Verify it was copied
              const fileInfo = await FileSystem.getInfoAsync(destUri);
              console.log('MediaImporter - Copy result:', JSON.stringify(fileInfo, null, 2));
              
              if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 0) {
                finalUri = destUri;
                console.log('MediaImporter - Video copied successfully to:', destUri, 'size:', fileInfo.size);
              } else {
                console.warn('MediaImporter - Copy succeeded but file is empty/missing');
              }
            } catch (copyErr) {
              console.warn('MediaImporter - Failed to copy video:', copyErr);
              // Keep original URI as fallback
            }
          } else if (sourceUri.startsWith('/') && !sourceUri.startsWith('file://')) {
            // Add file:// prefix for bare paths
            finalUri = `file://${sourceUri}`;
          }
        }
        
        console.log('MediaImporter - Final URI being returned:', finalUri);
        setPreparingVideo(false);
        onSelect({ ...asset, localUri: finalUri });
      } catch (err) {
        console.warn('media importer select err', err);
        setPreparingVideo(false);
        onSelect(asset);
      }
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaLibrary.Asset }) => (
      <TouchableOpacity style={[styles.cell, { width: CELL, height: CELL }]} onPress={() => handleAssetPress(item)}>
        <ExpoImage source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        {item.mediaType === MediaLibrary.MediaType.video ? (
          <View style={styles.videoBadge}>
            <Ionicons name="videocam" size={14} color="#fff" />
          </View>
        ) : null}
      </TouchableOpacity>
    ),
    [handleAssetPress],
  );

  const keyExtractor = useCallback((item: MediaLibrary.Asset) => item.id, []);

  const showPermissionWarning = permissionResponse && permissionResponse.status !== 'granted';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      {/* Animated backdrop with blur */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
        <TouchableWithoutFeedback onPress={animateClose}>
          <BlurView intensity={20} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
          </BlurView>
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Animated Bottom Sheet */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.sheetContainer,
          {
            transform: [{ translateY }],
            height: SHEET_HEIGHT,
          },
        ]}
      >
        <BlurView intensity={80} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.isDark ? 'rgba(20,20,25,0.85)' : 'rgba(255,255,255,0.92)' }]} />
        </BlurView>

        <SafeAreaView style={styles.sheetContent}>
          {/* Drag handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
          </View>

          {/* Header */}
          <View style={styles.modalHeader}>
            <Pressable
              onPress={animateClose}
              style={({ pressed }) => [
                styles.headerBtn,
                { 
                  borderColor: theme.hair,
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <View style={{ width: 40 }} />
          </View>

          {showPermissionWarning ? (
            <View style={[styles.permissionBlock, { borderColor: theme.hair, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }]}>
              <Ionicons name="images-outline" size={40} color={VELT_ACCENT} style={{ marginBottom: 12 }} />
              <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 8, fontSize: 16 }}>Gallery Access Needed</Text>
              <Text style={{ color: theme.sub, textAlign: 'center', marginBottom: 16 }}>
                Grant photo access so you can choose images directly inside VELT without leaving the app.
              </Text>
              <Pressable
                onPress={requestPermission}
                style={({ pressed }) => [
                  styles.permissionBtn,
                  { 
                    backgroundColor: VELT_ACCENT,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Grant Access</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={assets}
              extraData={assets.length}
              keyExtractor={keyExtractor}
              numColumns={3}
              renderItem={renderItem}
              columnWrapperStyle={{ gap: 6, paddingHorizontal: 12 }}
              contentContainerStyle={{ paddingBottom: 32, paddingTop: 12, gap: 6 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                loading ? (
                  <View style={styles.empty}>
                    <ActivityIndicator color={VELT_ACCENT} size="large" />
                    <Text style={{ color: theme.sub, marginTop: 12 }}>Loading media...</Text>
                  </View>
                ) : (
                  <View style={styles.empty}>
                    <Ionicons name="images-outline" size={48} color={theme.sub} />
                    <Text style={{ color: theme.sub, marginTop: 12 }}>No media found</Text>
                  </View>
                )
              }
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[VELT_ACCENT]} tintColor={VELT_ACCENT} />}
              onEndReached={() => {
                if (hasNextPage && !loading) loadAssets(false);
              }}
              onEndReachedThreshold={0.4}
            />
          )}

          {error ? <Text style={[styles.errorText, { color: '#ff6b6b' }]}>{error}</Text> : null}

          {/* overlay spinner when preparing video (copying content:// to cache on Android) */}
          {(isBusy || preparingVideo) ? (
            <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: 24, borderRadius: 16, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={VELT_ACCENT} />
                <Text style={{ color: '#fff', marginTop: 12, fontWeight: '700' }}>Preparing video…</Text>
              </View>
            </BlurView>
          ) : null}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetContent: {
    flex: 1,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800' },
  cell: { borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  videoBadge: { 
    position: 'absolute', 
    bottom: 6, 
    right: 6, 
    backgroundColor: 'rgba(0,0,0,0.65)', 
    borderRadius: 8, 
    paddingHorizontal: 6, 
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  permissionBlock: { 
    marginTop: 48, 
    marginHorizontal: 24, 
    padding: 24, 
    borderRadius: 20, 
    alignItems: 'center', 
    borderWidth: 1,
  },
  permissionBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  errorText: { textAlign: 'center', paddingBottom: 12 },
});

export default MediaImporter;
