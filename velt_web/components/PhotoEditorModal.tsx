import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  PanResponder,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import type { Asset } from 'expo-media-library';
import { useTheme } from 'app/themes';

type EditableAsset = {
  uri: string;
  width: number;
  height: number;
};

type PhotoEditorModalProps = {
  visible: boolean;
  asset: (Asset & { localUri?: string | null }) | null;
  mode: 'avatar' | 'cover';
  onCancel: () => void;
  onApply: (uri: string) => void;
  aspectPresetsOverride?: AspectPreset[];
  desiredWidth?: number;
  desiredHeight?: number;
  title?: string;
};

type Point = { x: number; y: number };

type AspectPreset = { id: string; label: string; ratio: number };

const SCREEN = Dimensions.get('window');
const MAX_WIDTH = SCREEN.width - 24;
const MAX_HEIGHT = SCREEN.height * 0.55;

const ensureDimensions = async (uri: string, fallback?: { width?: number; height?: number }): Promise<EditableAsset> => {
  if (fallback?.width && fallback?.height) {
    return { uri, width: fallback.width, height: fallback.height };
  }
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ uri, width: w, height: h }),
      (err) => reject(err ?? new Error('Unable to read image dimensions')),
    );
  });
};

const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  visible,
  asset,
  mode,
  onCancel,
  onApply,
  aspectPresetsOverride,
  desiredWidth,
  desiredHeight,
  title,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const theme = useMemo(() => {
    const hair = colors.border || (colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)');
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

  const aspectPresets = useMemo<AspectPreset[]>(() => {
    if (aspectPresetsOverride?.length) return aspectPresetsOverride;
    if (mode === 'cover') {
      return [
        { id: '16x9', label: '16:9', ratio: 16 / 9 },
        { id: '2x1', label: '2:1', ratio: 2 },
        { id: '21x9', label: '21:9', ratio: 21 / 9 },
      ];
    }
    return [{ id: 'sq', label: 'Square', ratio: 1 }];
  }, [aspectPresetsOverride, mode]);

  const [aspectRatio, setAspectRatio] = useState(aspectPresets[0]?.ratio ?? 1);
  const [editableAsset, setEditableAsset] = useState<EditableAsset | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const panValue = useRef<Point>({ x: 0, y: 0 });
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAspectRatio(aspectPresets[0]?.ratio ?? 1);
  }, [aspectPresets]);

  const cropBox = useMemo(() => {
    const preset = Math.max(aspectRatio, 0.1);
    let width = MAX_WIDTH;
    let height = width / preset;
    if (height > MAX_HEIGHT) {
      height = MAX_HEIGHT;
      width = height * preset;
    }
    return { cropWidth: Math.round(width), cropHeight: Math.round(height) };
  }, [aspectRatio]);

  const resetTransform = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    panValue.current = { x: 0, y: 0 };
    panStart.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    if (!visible) {
      setEditableAsset(null);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      panValue.current = { x: 0, y: 0 };
      panStart.current = { x: 0, y: 0 };
      setError(null);
      return;
    }
    if (!asset) {
      setEditableAsset(null);
      return;
    }
    const uri = asset.localUri ?? asset.uri;
    if (!uri) {
      setError('Unable to open this file.');
      setEditableAsset(null);
      return;
    }
    let cancelled = false;
    setInitializing(true);
    setError(null);
    (async () => {
      try {
        const next = await ensureDimensions(uri, { width: asset.width, height: asset.height });
        if (!cancelled) {
          setEditableAsset(next);
          resetTransform();
        }
      } catch (err) {
        console.warn('photo editor init err', err);
        if (!cancelled) {
          setEditableAsset(null);
          setError('We could not prepare that image. Try another one.');
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset, visible, resetTransform]);

  useEffect(() => {
    resetTransform();
  }, [aspectRatio, resetTransform]);

  const metrics = useMemo(() => {
    if (!editableAsset) return null;
    const coverScale = Math.max(cropBox.cropWidth / editableAsset.width, cropBox.cropHeight / editableAsset.height);
    const baseWidth = editableAsset.width * coverScale;
    const baseHeight = editableAsset.height * coverScale;
    const scaledWidth = baseWidth * zoom;
    const scaledHeight = baseHeight * zoom;
    const halfDiffX = Math.max(0, (scaledWidth - cropBox.cropWidth) / 2);
    const halfDiffY = Math.max(0, (scaledHeight - cropBox.cropHeight) / 2);
    return {
      coverScale,
      scaledWidth,
      scaledHeight,
      halfDiffX,
      halfDiffY,
      scaleApplied: coverScale * zoom,
    };
  }, [editableAsset, cropBox, zoom]);

  const clampPosition = useCallback(
    (value: Point) => {
      if (!metrics) return value;
      return {
        x: Math.max(-metrics.halfDiffX, Math.min(metrics.halfDiffX, value.x)),
        y: Math.max(-metrics.halfDiffY, Math.min(metrics.halfDiffY, value.y)),
      };
    },
    [metrics],
  );

  useEffect(() => {
    setPosition((prev) => {
      const clamped = clampPosition(prev);
      panValue.current = clamped;
      return clamped;
    });
  }, [clampPosition]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1,
        onPanResponderGrant: () => {
          panStart.current = panValue.current;
        },
        onPanResponderMove: (_, gesture) => {
          const next: Point = {
            x: panStart.current.x + gesture.dx,
            y: panStart.current.y + gesture.dy,
          };
          const clamped = clampPosition(next);
          panValue.current = clamped;
          setPosition(clamped);
        },
        onPanResponderRelease: () => {
          const clamped = clampPosition(panValue.current);
          panValue.current = clamped;
          setPosition(clamped);
        },
      }),
    [clampPosition],
  );

  const handleApplyTransform = useCallback(
    async (actions: ImageManipulator.Action[]) => {
      if (!editableAsset) return;
      setProcessing(true);
      try {
        const result = await ImageManipulator.manipulateAsync(editableAsset.uri, actions, {
          compress: 1,
          format: ImageManipulator.SaveFormat.PNG,
        });
        setEditableAsset({
          uri: result.uri,
          width: result.width ?? editableAsset.width,
          height: result.height ?? editableAsset.height,
        });
        resetTransform();
      } catch (err) {
        console.warn('photo editor transform err', err);
        Alert.alert('Editor', 'Unable to update that photo.');
      } finally {
        setProcessing(false);
      }
    },
    [editableAsset, resetTransform],
  );

  const handleRotate = useCallback(() => handleApplyTransform([{ rotate: 90 }]), [handleApplyTransform]);

  const handleFlip = useCallback(
    () => handleApplyTransform([{ flip: ImageManipulator.FlipType.Horizontal }]),
    [handleApplyTransform],
  );

  const handleApply = useCallback(async () => {
    if (!editableAsset || !metrics) return;
    setProcessing(true);
    try {
      const baseLeft = (cropBox.cropWidth - metrics.scaledWidth) / 2;
      const baseTop = (cropBox.cropHeight - metrics.scaledHeight) / 2;
      const left = baseLeft + position.x;
      const top = baseTop + position.y;
      const cropXDisplay = -left;
      const cropYDisplay = -top;
      const cropWidthOriginal = cropBox.cropWidth / metrics.scaleApplied;
      const cropHeightOriginal = cropBox.cropHeight / metrics.scaleApplied;
      const originX = Math.min(
        Math.max(0, cropXDisplay / metrics.scaleApplied),
        editableAsset.width - cropWidthOriginal,
      );
      const originY = Math.min(
        Math.max(0, cropYDisplay / metrics.scaleApplied),
        editableAsset.height - cropHeightOriginal,
      );

      const cropData = {
        originX: Math.max(0, Math.round(originX)),
        originY: Math.max(0, Math.round(originY)),
        width: Math.min(editableAsset.width, Math.round(cropWidthOriginal)),
        height: Math.min(editableAsset.height, Math.round(cropHeightOriginal)),
      };

      const actions: ImageManipulator.Action[] = [{ crop: cropData }];
      const resolvedWidth = desiredWidth ?? (mode === 'avatar' ? 1080 : 1920);
      const resolvedHeight = desiredHeight ?? Math.round(resolvedWidth / aspectRatio);
      if (cropData.width > resolvedWidth || cropData.height > resolvedHeight) {
        actions.push({ resize: { width: resolvedWidth, height: resolvedHeight } });
      }

      const result = await ImageManipulator.manipulateAsync(editableAsset.uri, actions, {
        compress: 0.92,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      onApply(result.uri);
    } catch (err) {
      console.warn('photo editor apply err', err);
      Alert.alert('Editor', 'Unable to save that edit. Try again.');
    } finally {
      setProcessing(false);
    }
  }, [editableAsset, metrics, cropBox, position, mode, aspectRatio, onApply]);

  const headerTitle = title ?? (mode === 'avatar' ? 'Profile Photo' : 'Cover Photo');
  const zoomLabel = `Zoom x${zoom.toFixed(1)}`;

  const showAspectControls = aspectPresets.length > 1;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={[styles.root, { backgroundColor: theme.bg, paddingTop: Math.max(insets.top, 12) }]}
      > 
        <View style={styles.header}>
          <TouchableOpacity style={[styles.headerBtn, { borderColor: theme.hair }]} onPress={onCancel} disabled={processing}>
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{headerTitle} Editor</Text>
          <TouchableOpacity
            style={[styles.headerBtn, { borderColor: theme.hair, backgroundColor: theme.accent }]}
            onPress={handleApply}
            disabled={!editableAsset || processing}
          >
            {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyText}>Done</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={[styles.cropShell, { width: cropBox.cropWidth, height: cropBox.cropHeight }]}> 
            {initializing ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={theme.accent} />
                <Text style={{ color: theme.sub, marginTop: 8 }}>Preparing image…</Text>
              </View>
            ) : editableAsset ? (
              <View style={StyleSheet.absoluteFillObject} {...panResponder.panHandlers}>
                <Image
                  source={{ uri: editableAsset.uri }}
                  style={{
                    width: metrics?.scaledWidth ?? cropBox.cropWidth,
                    height: metrics?.scaledHeight ?? cropBox.cropHeight,
                    position: 'absolute',
                    left: metrics ? (cropBox.cropWidth - metrics.scaledWidth) / 2 + position.x : 0,
                    top: metrics ? (cropBox.cropHeight - metrics.scaledHeight) / 2 + position.y : 0,
                  }}
                />
              </View>
            ) : (
              <View style={styles.loadingState}>
                <Text style={{ color: theme.sub, textAlign: 'center' }}>{error ?? 'Select another photo to continue.'}</Text>
              </View>
            )}

            <View pointerEvents="none" style={styles.gridOverlay}>
              {[1, 2].map((index) => (
                <View
                  key={`h-${index}`}
                  style={[styles.gridLine, { top: (cropBox.cropHeight / 3) * index, backgroundColor: theme.faint }]}
                />
              ))}
              {[1, 2].map((index) => (
                <View
                  key={`v-${index}`}
                  style={[styles.gridLineVertical, { left: (cropBox.cropWidth / 3) * index, backgroundColor: theme.faint }]}
                />
              ))}
              <View style={[styles.border, { borderColor: theme.accent }]} />
            </View>
          </View>

          <View style={styles.controlsBlock}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sliderLabel, { color: theme.sub }]}>Zoom</Text>
              <Text style={[styles.sliderValue, { color: theme.text }]}>{zoomLabel}</Text>
            </View>
            <Slider
              value={zoom}
              minimumValue={1}
              maximumValue={3}
              step={0.01}
              onValueChange={(value) => setZoom(value)}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.hair}
              thumbTintColor={theme.accent}
              disabled={!editableAsset}
            />

            {showAspectControls ? (
              <View style={styles.aspectRow}>
                {aspectPresets.map((preset) => {
                  const active = Math.abs(preset.ratio - aspectRatio) < 0.001;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.aspectBtn,
                        {
                          backgroundColor: active ? theme.accent : theme.card,
                          borderColor: active ? 'transparent' : theme.hair,
                        },
                      ]}
                      disabled={processing}
                      onPress={() => setAspectRatio(preset.ratio)}
                    >
                      <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '700' }}>{preset.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: theme.hair }]}
                onPress={resetTransform}
                disabled={!editableAsset || processing}
              >
                <Feather name="refresh-ccw" size={16} color={theme.text} />
                <Text style={{ color: theme.text, fontWeight: '700' }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: theme.hair }]}
                onPress={handleRotate}
                disabled={!editableAsset || processing}
              >
                <Feather name="rotate-ccw" size={16} color={theme.text} />
                <Text style={{ color: theme.text, fontWeight: '700' }}>Rotate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: theme.hair }]}
                onPress={handleFlip}
                disabled={!editableAsset || processing}
              >
                <MaterialCommunityIcons name="flip-horizontal" size={18} color={theme.text} />
                <Text style={{ color: theme.text, fontWeight: '700' }}>Flip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {processing ? (
          <View style={[styles.processingOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.2)' }]}> 
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 44, height: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  applyText: { color: '#fff', fontWeight: '800' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  cropShell: { marginTop: 12, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.45 },
  gridLineVertical: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.45 },
  border: { ...StyleSheet.absoluteFillObject, borderWidth: 1.5, borderRadius: 24 },
  controlsBlock: { width: '100%', marginTop: 24 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sliderLabel: { fontSize: 12, fontWeight: '700' },
  sliderValue: { fontSize: 12, fontWeight: '800' },
  aspectRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  aspectBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  processingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});

export default PhotoEditorModal;
