import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    LayoutChangeEvent,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    Pressable,
    View,
    PanResponder,
} from "react-native";
import { GestureDetector, Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Audio, AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, CameraView } from "expo-camera";
import type { CameraType, FlashMode } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import type { Asset as MediaLibraryAsset } from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from "expo-asset";
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { withSafeRouter } from '@/lib/navigation';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from 'expo-blur';

import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from "app/themes";

import { supabase } from "@/lib/supabase";
import { useUploadStore } from "@/lib/store/uploadStore";
import { useProfileStore } from "@/lib/store/profile";
import type { StoryUploadMedia, StoryUploadSelectedMusic } from "@/lib/types/storyUpload";
import { generateUUID } from "@/lib/types/storyUpload";
import MediaImporter from "@/components/MediaImporter";
import PhotoEditorModal from "@/components/PhotoEditorModal";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MEDIA_AREA_HEIGHT = Math.round(SCREEN_H * 0.7);
const CAMERA_TOP_OFFSET = 32;
const DEFAULT_PUBLISH_TARGET: "stories" | "business" | "location" = "stories";
const MAX_MEDIA_ITEMS = 10;

// Format duration from milliseconds to mm:ss
const formatDuration = (ms: number | null | undefined): string => {
    if (!ms || ms <= 0) return '';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

// Soundtrack type matching the soundtracks table
type Soundtrack = {
    id: string;
    user_id?: string | null;
    title: string;
    description?: string | null;
    audio_url: string;
    audio_mime?: string | null;
    artwork_url?: string | null;
    duration_ms?: number | null;
    tags?: string[] | null;
    artist_name?: string | null;
    created_at?: string | null;
};

const STORY_ASPECT_PRESETS = [
    { id: "story", label: "Story", ratio: 9 / 16 },
    { id: "square", label: "1:1", ratio: 1 },
    { id: "portrait", label: "4:5", ratio: 4 / 5 },
    { id: "landscape", label: "16:9", ratio: 16 / 9 },
];

// Instagram-like filters with color matrix adjustments
type StoryFilter = {
    id: string;
    label: string;
    brightness: number;
    contrast: number;
    saturate: number;
    sepia?: number;
    temperature?: number;
    clarity?: number; // 0-1, adds sharpness/clarity effect via vignette darkness
    sharpness?: number; // 0-1, enhances edge contrast
    highlights?: number; // -1..1
    shadows?: number; // -1..1
    vibrance?: number; // 0..1
    blacks?: number; // -1..1
    whites?: number; // -1..1
    grain?: number; // 0..1
    tint?: number; // -1..1 green/red shift
};

// Remove legacy filter presets and replace with Jakarta family below
const STORIES_JAKARTA: StoryFilter[] = [
    // We'll map user-friendly +/− values to normalized factors used across the UI
    { id: 'jakarta', label: 'Jakarta', brightness: 0.10, contrast: 0.92, highlights: 0.12, shadows: 0.15, saturate: 0.06, temperature: 0.04, tint: -0.03, clarity: -0.10, sharpness: 0.05, vibrance: 0.04, blacks: 0.06, whites: 0.08, grain: 0 },
    { id: 'jakarta_plus', label: 'Jakarta+', brightness: 0.08, contrast: 0.95, highlights: 0.10, shadows: 0.10, saturate: 0.05, temperature: 0.03, tint: -0.02, clarity: 0.12, sharpness: 0.18, vibrance: 0.06, blacks: -0.05, whites: 0.10, grain: 0 },
    { id: 'jakarta_soft', label: 'Jakarta Soft', brightness: 0.12, contrast: 0.85, highlights: 0.15, shadows: 0.20, saturate: 0.03, temperature: 0.04, tint: -0.03, clarity: -0.25, sharpness: 0, vibrance: 0.02, blacks: 0.10, whites: 0.12, grain: 0 },
    { id: 'jakarta_dark', label: 'Jakarta Dark', brightness: -0.05, contrast: 1.08, highlights: 0, shadows: -0.10, saturate: 0.04, temperature: 0.05, tint: -0.03, clarity: 0.08, sharpness: 0.12, vibrance: 0.04, blacks: -0.15, whites: 0.05, grain: 0 },
    { id: 'jakarta_bright', label: 'Jakarta Bright', brightness: 0.22, contrast: 0.88, highlights: 0.20, shadows: 0.25, saturate: 0.04, temperature: 0.04, tint: -0.03, clarity: -0.05, sharpness: 0.03, vibrance: 0.06, blacks: 0.12, whites: 0.15, grain: 0 },
    { id: 'jakarta_warm', label: 'Jakarta Warm', brightness: 0.10, contrast: 0.92, highlights: 0.12, shadows: 0.15, saturate: 0.10, temperature: 0.18, tint: -0.01, clarity: -0.05, sharpness: 0.05, vibrance: 0.10, blacks: 0.05, whites: 0.08, grain: 0 },
    { id: 'jakarta_cool', label: 'Jakarta Cool', brightness: 0.08, contrast: 0.94, highlights: 0.10, shadows: 0.12, saturate: 0.04, temperature: -0.12, tint: -0.04, clarity: -0.05, sharpness: 0.08, vibrance: 0.04, blacks: 0.05, whites: 0.10, grain: 0 },
    { id: 'jakarta_deep', label: 'Jakarta Deep', brightness: -0.02, contrast: 1.15, highlights: 0.05, shadows: -0.15, saturate: 0.08, temperature: 0.03, tint: -0.01, clarity: 0.15, sharpness: 0.12, vibrance: 0.08, blacks: -0.20, whites: 0.05, grain: 0.03 },
];

// Replace default filters with Jakarta set
// Use the Jakarta filters as our main filter set
const STORY_FILTERS: StoryFilter[] = STORIES_JAKARTA;

// Helper function to get filter overlay style
const getFilterOverlay = (filter: StoryFilter): { overlay: string; opacity: number; blend?: string } | null => {
    switch (filter.id) {
        case 'jakarta':
        case 'jakarta_plus':
        case 'jakarta_soft':
        case 'jakarta_dark':
        case 'jakarta_bright':
        case 'jakarta_warm':
        case 'jakarta_cool':
        case 'jakarta_deep':
            // These are color/curve-only filters: no overlay
            return null;
        case 'clarendon':
            return { overlay: 'rgba(28, 46, 58, 0.2)', opacity: 0.2 };
        case 'gingham':
            return { overlay: 'rgba(43, 25, 25, 0.3)', opacity: 0.3 };
        case 'moon':
            return { overlay: 'rgba(1, 34, 10, 0.17)', opacity: 0.4 };
        case 'lark':
            return { overlay: 'rgba(242, 242, 242, 0.15)', opacity: 0.15 };
        case 'reyes':
            return { overlay: 'rgba(239, 205, 173, 0.35)', opacity: 0.35 };
        case 'juno':
            return { overlay: 'rgba(127, 187, 227, 0.15)', opacity: 0.15 };
        case 'slumber':
            return { overlay: 'rgba(125, 105, 125, 0.25)', opacity: 0.25 };
        case 'crema':
            return { overlay: 'rgba(255, 227, 200, 0.3)', opacity: 0.3 };
        case 'ludwig':
            return { overlay: 'rgba(125, 105, 75, 0.15)', opacity: 0.15 };
        case 'aden':
            return { overlay: 'rgba(66, 10, 14, 0.2)', opacity: 0.2 };
        case 'perpetua':
            return { overlay: 'rgba(0, 91, 154, 0.15)', opacity: 0.15 };
        // New Aden-like filters
        case 'valencia':
            return { overlay: 'rgba(255, 166, 125, 0.25)', opacity: 0.25 };
        case 'nashville':
            return { overlay: 'rgba(247, 176, 127, 0.35)', opacity: 0.35 };
        case 'sierra':
            return { overlay: 'rgba(185, 152, 114, 0.3)', opacity: 0.3 };
        case 'willow':
            return { overlay: 'rgba(212, 194, 178, 0.45)', opacity: 0.45 };
        case 'hudson':
            return { overlay: 'rgba(166, 177, 186, 0.25)', opacity: 0.25 };
        case 'lofi':
            return { overlay: 'rgba(50, 30, 10, 0.12)', opacity: 0.12 };
        case 'earlybird':
            return { overlay: 'rgba(208, 170, 120, 0.35)', opacity: 0.35 };
        case 'brannan':
            return { overlay: 'rgba(161, 130, 107, 0.4)', opacity: 0.4 };
        case 'inkwell':
            return { overlay: 'rgba(110, 110, 110, 0.35)', opacity: 0.35 };
        case 'hefe':
            return { overlay: 'rgba(255, 200, 130, 0.2)', opacity: 0.2 };
        case 'amaro':
            return { overlay: 'rgba(234, 214, 186, 0.2)', opacity: 0.2 };
        case 'rise':
            return { overlay: 'rgba(236, 205, 169, 0.25)', opacity: 0.25 };
        default:
            return null;
    }
};

// Helper component to render filtered image with simple overlay for smooth transitions
const FilteredImage = React.memo(({ uri, filter, style }: { uri: string; filter: StoryFilter; style?: any }) => {
    const overlayConfig = getFilterOverlay(filter);
    const hasClarityEffect = filter.clarity || filter.sharpness;
    
    return (
        <View style={[style, { overflow: 'hidden' }]}>
            <Image source={{ uri }} style={[StyleSheet.absoluteFill]} resizeMode="cover" />
            {overlayConfig && (
                <View 
                    style={[
                        StyleSheet.absoluteFill, 
                        { backgroundColor: overlayConfig.overlay }
                    ]} 
                    pointerEvents="none"
                />
            )}
            {/* Clarity/sharpness vignette effect for dark edges */}
            {hasClarityEffect && (
                <View 
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            borderWidth: SCREEN_W * 0.06 * (filter.clarity || 0),
                            borderColor: `rgba(0,0,0,${0.25 * (filter.clarity || 0)})`,
                        }
                    ]} 
                    pointerEvents="none"
                />
            )}
        </View>
    );
}, (prevProps, nextProps) => {
    return prevProps.uri === nextProps.uri && prevProps.filter.id === nextProps.filter.id;
});

// Story Stickers with nice colors and designs
type StorySticker = {
    id: string;
    label: string;
    icon?: string;
    emoji?: string;
    style: 'pill' | 'badge' | 'tag' | 'bubble' | 'gradient';
    colors: string[];
    textColor: string;
    category: 'action' | 'mood' | 'time' | 'social' | 'shopping' | 'reaction';
};

const STORY_STICKERS: StorySticker[] = [
    // Action stickers
    { id: 'buy_now', label: 'Buy Now', icon: 'cart', style: 'gradient', colors: ['#FF6B6B', '#EE5A24'], textColor: '#fff', category: 'shopping' },
    { id: 'shop', label: 'Shop', icon: 'bag-handle', style: 'pill', colors: ['#000'], textColor: '#fff', category: 'shopping' },
    { id: 'follow', label: 'Follow', icon: 'person-add', style: 'gradient', colors: ['#667eea', '#764ba2'], textColor: '#fff', category: 'social' },
    { id: 'link', label: 'Link', icon: 'link', style: 'pill', colors: ['#1DA1F2'], textColor: '#fff', category: 'action' },
    { id: 'swipe_up', label: 'Swipe Up', icon: 'chevron-up', style: 'badge', colors: ['#fff'], textColor: '#000', category: 'action' },
    { id: 'tap_here', label: 'Tap Here', icon: 'hand-left', style: 'bubble', colors: ['#FF9500'], textColor: '#fff', category: 'action' },
    
    // Mood stickers
    { id: 'morning', label: 'Good Morning', emoji: '☀️', style: 'gradient', colors: ['#f093fb', '#f5576c'], textColor: '#fff', category: 'time' },
    { id: 'night', label: 'Good Night', emoji: '🌙', style: 'gradient', colors: ['#0f0c29', '#302b63'], textColor: '#fff', category: 'time' },
    { id: 'weekend', label: 'Weekend Vibes', emoji: '🎉', style: 'gradient', colors: ['#11998e', '#38ef7d'], textColor: '#fff', category: 'time' },
    { id: 'monday', label: 'Monday Mood', emoji: '😤', style: 'pill', colors: ['#485563'], textColor: '#fff', category: 'time' },
    { id: 'friday', label: 'Finally Friday', emoji: '🥳', style: 'gradient', colors: ['#fc4a1a', '#f7b733'], textColor: '#fff', category: 'time' },
    
    // Reaction stickers
    { id: 'like', label: 'Like', icon: 'heart', style: 'badge', colors: ['#FF3B5C'], textColor: '#fff', category: 'reaction' },
    { id: 'fire', label: 'Fire', emoji: '🔥', style: 'bubble', colors: ['#ff4e50', '#f9d423'], textColor: '#fff', category: 'reaction' },
    { id: 'wow', label: 'WOW', emoji: '😍', style: 'tag', colors: ['#f5af19'], textColor: '#fff', category: 'reaction' },
    { id: 'lol', label: 'LOL', emoji: '😂', style: 'bubble', colors: ['#00c6ff', '#0072ff'], textColor: '#fff', category: 'reaction' },
    { id: 'cool', label: 'Cool', emoji: '😎', style: 'pill', colors: ['#4776E6'], textColor: '#fff', category: 'reaction' },
    { id: 'love', label: 'Love This', icon: 'heart', style: 'gradient', colors: ['#ee0979', '#ff6a00'], textColor: '#fff', category: 'reaction' },
    
    // Social stickers
    { id: 'dm_me', label: 'DM Me', icon: 'chatbubble', style: 'pill', colors: ['#833ab4'], textColor: '#fff', category: 'social' },
    { id: 'new_post', label: 'New Post', icon: 'add-circle', style: 'badge', colors: ['#00c853'], textColor: '#fff', category: 'social' },
    { id: 'collab', label: 'Collab?', icon: 'people', style: 'gradient', colors: ['#f7971e', '#ffd200'], textColor: '#fff', category: 'social' },
    { id: 'tag_me', label: 'Tag Me', icon: 'at', style: 'tag', colors: ['#1DA1F2'], textColor: '#fff', category: 'social' },
    
    // Shopping stickers
    { id: 'sale', label: 'SALE', emoji: '🏷️', style: 'badge', colors: ['#FF0844'], textColor: '#fff', category: 'shopping' },
    { id: 'new_arrival', label: 'New Arrival', icon: 'sparkles', style: 'gradient', colors: ['#8E2DE2', '#4A00E0'], textColor: '#fff', category: 'shopping' },
    { id: 'limited', label: 'Limited Edition', icon: 'star', style: 'tag', colors: ['#FFD700'], textColor: '#000', category: 'shopping' },
    { id: 'discount', label: '% OFF', icon: 'pricetag', style: 'badge', colors: ['#00C851'], textColor: '#fff', category: 'shopping' },
    
    // More mood stickers
    { id: 'blessed', label: 'Blessed', emoji: '🙏', style: 'gradient', colors: ['#f093fb', '#f5576c'], textColor: '#fff', category: 'mood' },
    { id: 'mood', label: 'Mood', emoji: '💅', style: 'pill', colors: ['#bc4e9c'], textColor: '#fff', category: 'mood' },
    { id: 'vibe', label: 'Vibe Check', emoji: '✨', style: 'gradient', colors: ['#12c2e9', '#c471ed', '#f64f59'], textColor: '#fff', category: 'mood' },
    { id: 'grateful', label: 'Grateful', emoji: '💕', style: 'bubble', colors: ['#ff9a9e', '#fad0c4'], textColor: '#fff', category: 'mood' },
    { id: 'happy', label: 'Happy', emoji: '😊', style: 'pill', colors: ['#f7971e'], textColor: '#fff', category: 'mood' },
];

// Sticker component renderer
const StickerView = ({ sticker, size = 'normal' }: { sticker: StorySticker; size?: 'small' | 'normal' }) => {
    const isSmall = size === 'small';
    const fontSize = isSmall ? 10 : 14;
    const iconSize = isSmall ? 12 : 16;
    const paddingH = isSmall ? 8 : 14;
    const paddingV = isSmall ? 4 : 8;
    
    const baseStyle = {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: isSmall ? 3 : 6,
    };
    
    const content = (
        <>
            {sticker.emoji && <Text style={{ fontSize: iconSize }}>{sticker.emoji}</Text>}
            {sticker.icon && <Ionicons name={sticker.icon as any} size={iconSize} color={sticker.textColor} />}
            <Text style={{ color: sticker.textColor, fontWeight: '700', fontSize, letterSpacing: 0.3 }}>
                {sticker.label}
            </Text>
        </>
    );
    
    if (sticker.style === 'gradient' && sticker.colors.length > 1) {
        return (
            <LinearGradient
                colors={sticker.colors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[baseStyle, {
                    paddingHorizontal: paddingH,
                    paddingVertical: paddingV,
                    borderRadius: 20,
                }]}
            >
                {content}
            </LinearGradient>
        );
    }
    
    const styleMap = {
        pill: { borderRadius: 20 },
        badge: { borderRadius: 8 },
        tag: { borderRadius: 4, borderWidth: 2, borderColor: sticker.colors[0] },
        bubble: { borderRadius: 16, borderBottomLeftRadius: 4 },
    };
    
    return (
        <View style={[
            baseStyle,
            {
                backgroundColor: sticker.style === 'tag' ? 'transparent' : sticker.colors[0],
                paddingHorizontal: paddingH,
                paddingVertical: paddingV,
                ...styleMap[sticker.style as keyof typeof styleMap] || styleMap.pill,
            }
        ]}>
            {content}
        </View>
    );
};

// Draggable wrapper component for stickers, tags, and music pill with optional scaling
type DraggableItemProps = {
    x: number;
    y: number;
    scale?: number;
    onPositionChange: (x: number, y: number) => void;
    onScaleChange?: (scale: number) => void;
    onLongPress?: () => void;
    children: React.ReactNode;
    bounds?: { width: number; height: number };
    enableScale?: boolean;
};

const DraggableItem = ({ x, y, scale = 1, onPositionChange, onScaleChange, onLongPress, children, bounds, enableScale = false }: DraggableItemProps) => {
    const [position, setPosition] = useState({ x, y });
    const [currentScale, setCurrentScale] = useState(scale);
    const [isDragging, setIsDragging] = useState(false);
    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef(scale);
    
    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
            // Allow pinch gestures for scaling
            return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2 || gestureState.numberActiveTouches > 1;
        },
        onPanResponderGrant: (evt) => {
            setIsDragging(true);
            if (enableScale && evt.nativeEvent.touches.length === 2) {
                const touch1 = evt.nativeEvent.touches[0];
                const touch2 = evt.nativeEvent.touches[1];
                initialDistance.current = Math.hypot(
                    touch2.pageX - touch1.pageX,
                    touch2.pageY - touch1.pageY
                );
                initialScale.current = currentScale;
            }
        },
        onPanResponderMove: (evt, gestureState) => {
            // Handle pinch to scale
            if (enableScale && evt.nativeEvent.touches.length === 2 && initialDistance.current) {
                const touch1 = evt.nativeEvent.touches[0];
                const touch2 = evt.nativeEvent.touches[1];
                const currentDistance = Math.hypot(
                    touch2.pageX - touch1.pageX,
                    touch2.pageY - touch1.pageY
                );
                const newScale = Math.min(Math.max(initialScale.current * (currentDistance / initialDistance.current), 0.5), 3);
                setCurrentScale(newScale);
                return;
            }
            
            // Handle drag
            let newX = x + gestureState.dx;
            let newY = y + gestureState.dy;
            
            if (bounds) {
                newX = Math.max(0, Math.min(newX, bounds.width - 100));
                newY = Math.max(0, Math.min(newY, bounds.height - 50));
            }
            
            setPosition({ x: newX, y: newY });
        },
        onPanResponderRelease: (_, gestureState) => {
            setIsDragging(false);
            initialDistance.current = null;
            
            // Save scale if changed
            if (enableScale && onScaleChange && currentScale !== scale) {
                onScaleChange(currentScale);
            }
            
            let newX = x + gestureState.dx;
            let newY = y + gestureState.dy;
            
            if (bounds) {
                newX = Math.max(0, Math.min(newX, bounds.width - 100));
                newY = Math.max(0, Math.min(newY, bounds.height - 50));
            }
            
            onPositionChange(newX, newY);
        },
        onPanResponderTerminate: () => {
            setIsDragging(false);
            initialDistance.current = null;
            setPosition({ x, y });
            setCurrentScale(scale);
        },
    }), [x, y, scale, bounds, onPositionChange, onScaleChange, enableScale, currentScale]);
    
    // Update position/scale when props change
    useEffect(() => {
        setPosition({ x, y });
    }, [x, y]);
    
    useEffect(() => {
        setCurrentScale(scale);
    }, [scale]);
    
    return (
        <View
            style={[
                {
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    opacity: isDragging ? 0.8 : 1,
                    transform: [{ scale: isDragging ? currentScale * 1.05 : currentScale }],
                }
            ]}
            {...panResponder.panHandlers}
        >
            <TouchableOpacity
                onLongPress={onLongPress}
                delayLongPress={500}
                activeOpacity={0.9}
            >
                {children}
            </TouchableOpacity>
        </View>
    );
};

// User tag display component
const UserTagView = ({ username, avatarUrl }: { username: string; avatarUrl?: string }) => {
    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 16,
            gap: 6,
        }}>
            {avatarUrl ? (
                <Image 
                    source={{ uri: avatarUrl }} 
                    style={{ width: 20, height: 20, borderRadius: 10 }} 
                />
            ) : (
                <View style={{ 
                    width: 20, 
                    height: 20, 
                    borderRadius: 10, 
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Ionicons name="person" size={12} color="#fff" />
                </View>
            )}
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>@{username}</Text>
        </View>
    );
};

// Text overlay display component
type TextOverlay = {
    id: string;
    text: string;
    color: string;
    backgroundColor: string;
    fontStyle: 'modern' | 'classic' | 'signature' | 'typewriter' | 'neon';
    alignment?: 'left' | 'center' | 'right';
    hasStroke?: boolean;
    hasShadow?: boolean;
    scale?: number;
    rotation?: number;
};

const TextOverlayView = ({ overlay }: { overlay: TextOverlay }) => {
    const getFontStyle = () => {
        switch (overlay.fontStyle) {
            case 'modern':
                return { fontWeight: '700' as const, fontSize: 22, letterSpacing: 0.5 };
            case 'classic':
                return { fontStyle: 'italic' as const, fontSize: 20, fontWeight: '500' as const };
            case 'signature':
                return { fontWeight: '400' as const, fontSize: 22, letterSpacing: 2 };
            case 'neon':
                return { 
                    fontWeight: '800' as const, 
                    fontSize: 24, 
                    textShadowColor: overlay.color,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 15,
                };
            case 'typewriter':
                return { fontFamily: 'monospace', fontSize: 18, fontWeight: '500' as const, letterSpacing: 2 };
            default:
                return { fontWeight: '600' as const, fontSize: 20 };
        }
    };
    
    const fontStyles = getFontStyle();
    const hasBg = overlay.backgroundColor !== 'transparent';
    
    // Apply shadow effect if enabled
    const shadowStyle = overlay.hasShadow ? {
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
    } : {};
    
    // Apply stroke effect if enabled (simulated with multiple shadows)
    const strokeStyle = overlay.hasStroke ? {
        textShadowColor: '#000',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 2,
    } : {};
    
    return (
        <View style={{
            backgroundColor: overlay.backgroundColor,
            paddingHorizontal: hasBg ? 14 : 4,
            paddingVertical: hasBg ? 8 : 2,
            borderRadius: hasBg ? 8 : 0,
            maxWidth: SCREEN_W * 0.8,
            transform: [{ scale: overlay.scale || 1 }, { rotate: `${overlay.rotation || 0}deg` }],
        }}>
            <Text style={{
                color: overlay.color,
                textAlign: overlay.alignment || 'center',
                ...fontStyles,
                ...shadowStyle,
                ...strokeStyle,
            }}>
                {overlay.text}
            </Text>
        </View>
    );
};

// Soundtracks cache constants
const SOUNDTRACKS_CACHE_KEY = '@soundtracks_cache';
const RECENT_TRACKS_CACHE_KEY = '@recent_tracks_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

// In-memory cache for faster access
let soundtracksMemoryCache: { data: Soundtrack[]; timestamp: number } | null = null;

type MediaItem = StoryUploadMedia;
type CameraViewHandle = ComponentRef<typeof CameraView>;
type PhotoEditorState = {
    index: number;
    asset: MediaLibrary.Asset & { localUri?: string | null };
};

const readImageSize = (uri: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(
            uri,
            (width, height) => resolve({ width, height }),
            (err) => reject(err ?? new Error("Unable to read dimensions")),
        );
    });

const ensureEditorAsset = (item: MediaItem): PhotoEditorState["asset"] =>
    ({
        id: item.id,
        filename: `${item.id}.jpg`,
        uri: item.editedUri ?? item.uri,
        localUri: item.editedUri ?? item.uri,
        mediaType: MediaLibrary.MediaType.photo,
        mediaSubtypes: [],
        width: item.editedWidth ?? item.width ?? 1080,
        height: item.editedHeight ?? item.height ?? 1920,
        duration: 0,
        creationTime: Date.now(),
        modificationTime: Date.now(),
    } as PhotoEditorState["asset"]);

// Video preview component using expo-video with filter support
function VideoPreview({ uri, durationMs, filter }: { uri: string; durationMs: number | null; filter?: StoryFilter }) {
    const player = useVideoPlayer(uri, (p) => {
        p.loop = true;
        p.muted = false;
        p.play();
    });
    
    const overlayConfig = filter ? getFilterOverlay(filter) : null;
    const hasClarityEffect = filter && (filter.clarity || filter.sharpness);

    return (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]}>
            <VideoView
                player={player}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                nativeControls={false}
            />
            {/* Filter overlay for video */}
            {overlayConfig && (
                <View 
                    style={[
                        StyleSheet.absoluteFill, 
                        { 
                            backgroundColor: overlayConfig.overlay,
                            opacity: overlayConfig.opacity,
                        }
                    ]} 
                    pointerEvents="none"
                />
            )}
            {/* Clarity/sharpness vignette effect */}
            {hasClarityEffect && (
                <View 
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            borderWidth: SCREEN_W * 0.08 * (filter.clarity || 0),
                            borderColor: `rgba(0,0,0,${0.3 * (filter.clarity || 0)})`,
                        }
                    ]} 
                    pointerEvents="none"
                />
            )}
            {/* Video duration badge */}
            {durationMs && (
                <View style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                }}>
                    <Ionicons name="videocam" size={12} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                        {Math.floor((durationMs / 1000) / 60)}:{String(Math.floor((durationMs / 1000) % 60)).padStart(2, '0')}
                    </Text>
                </View>
            )}
        </View>
    );
}

export default function CreateStoryScreen() {
    const router = withSafeRouter(useRouter());
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const theme = useMemo(() => {
        const hair = colors.border || (colors.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)");
        return {
            bg: colors.bg,
            card: colors.card,
            text: colors.text,
            muted: colors.subtext,
            accent: colors.accent,
            hair,
            isDark: colors.isDark ?? false,
        };
    }, [colors]);

    const bottomClearance = insets.bottom + 140;

    const profile = useProfileStore((state) => state.profile);
    const user = useProfileStore((state) => state.user);
    const currentUserId = profile?.id ?? user?.id ?? null;
    const setDraft = useUploadStore((state) => state.setDraft);

    const cameraRef = useRef<CameraViewHandle | null>(null);

    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [cameraType, setCameraType] = useState<CameraType>("back");
    // Camera zoom (rear only, normalized 0..1)
    const [cameraZoom, setCameraZoom] = useState(0);
    // Supported zoom multipliers - 0.5x, 1x, 2x only
    const zoomMultipliers = [0.5, 1, 2];
    const minMultiplier = 0.5;
    const maxMultiplier = 2;
    // Logarithmic mapping: multiplier → normalized zoom (0..1)
    // We map the camera multiplier range (minMultiplier..maxMultiplier) to a 0..1 space using logs.
    // The camera's `zoom` prop treats 0 as baseline (1x) and 1 as max zoom. To keep 1x visually unzoomed,
    // we shift and scale the normalized log mapping so multiplier==1 maps to 0 and multiplier==maxMultiplier maps to 1.
    // Multipliers < 1 (e.g. 0.5) will map below zero and are clamped to 0 — true <1x support requires a lens switch.
        const multiplierToZoom = useCallback((multiplier: number) => {
        const clamped = Math.max(minMultiplier, Math.min(maxMultiplier, multiplier));
        const logMin = Math.log(minMultiplier);
        const logMax = Math.log(maxMultiplier);
        const logVal = Math.log(clamped);

        // Normalized position over full range [min..max]
        const normalizedFull = (logVal - logMin) / (logMax - logMin);
        // Clamp to 0..1
        return Math.max(0, Math.min(1, normalizedFull));
    }, [minMultiplier, maxMultiplier]);
    // Animate zoom value (for smooth transitions)
    const setCameraZoomAnimated = useCallback((multiplier: number) => {
        const targetZoom = multiplierToZoom(multiplier);
        setCameraZoom(targetZoom);
    }, [multiplierToZoom]);

    // Ensure camera opens at 1x by initializing cameraZoom to the normalized value for 1x
    useEffect(() => {
        setCameraZoom(multiplierToZoom(1));
    }, [multiplierToZoom]);
    // Camera aspect ratio (front only)
    const [frontAspect, setFrontAspect] = useState<'default' | '4:3'>('default');
    const [flashMode, setFlashMode] = useState<FlashMode>("off");
    const [cameraMode, setCameraMode] = useState<"photo" | "video">("photo");
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [activeMediaIndex, setActiveMediaIndex] = useState(0);
    const [previewMode, setPreviewMode] = useState<"camera" | "review">("camera");
    const [captureInFlight, setCaptureInFlight] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaImporterVisible, setMediaImporterVisible] = useState(false);
    const [photoEditorVisible, setPhotoEditorVisible] = useState(false);
    const [photoEditorState, setPhotoEditorState] = useState<PhotoEditorState | null>(null);
    const [queueing, setQueueing] = useState(false);
    const [isConnected, setIsConnected] = useState(true);
    // Instagram-like filters
    const [activeFilterIndex, setActiveFilterIndex] = useState(0);
    const filterScrollRef = useRef<any>(null);
    // Pinch-to-zoom crop state - allows zoom out to 0.5 and zoom in to 4
    const imageScale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const [isCropMode, setIsCropMode] = useState(false);
    const [isZoomedOut, setIsZoomedOut] = useState(false);
    // Media background gradient colors (extracted or generated from media)
    const [mediaBgColors, setMediaBgColors] = useState<[string, string]>(['#1a1a2e', '#16213e']);
    const [cameraMusic, setCameraMusic] = useState<StoryUploadSelectedMusic | null>(null);
    const [previewLayout, setPreviewLayout] = useState({ width: SCREEN_W, height: MEDIA_AREA_HEIGHT });
    const [musicLoadingId, setMusicLoadingId] = useState<string | null>(null);
    
    // Animated style for pinch-to-zoom - must be at top level
    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: imageScale.value },
            { translateX: translateX.value / imageScale.value },
            { translateY: translateY.value / imageScale.value },
        ],
    }));
    
    // Generate gradient colors based on filter or default palette
    const getMediaGradientColors = useCallback((filterIndex: number): [string, string] => {
        const filter = STORY_FILTERS[filterIndex];
        if (!filter) return ['#1a1a2e', '#16213e'];
        
        // Generate complementary gradient based on filter overlay
        switch (filter.id) {
            case 'clarendon': return ['#1e3a5f', '#2d5a87'];
            case 'gingham': return ['#2d2d2d', '#4a4a4a'];
            case 'moon': return ['#1a1a1a', '#3d3d3d'];
            case 'lark': return ['#2d4a3e', '#1a3a2e'];
            case 'reyes': return ['#3d2a1a', '#5a4030'];
            case 'juno': return ['#1e3a5f', '#3a5a7f'];
            case 'slumber': return ['#2d1a2d', '#4a2a4a'];
            case 'crema': return ['#3a2a1a', '#5a4a3a'];
            case 'ludwig': return ['#2a1a0a', '#4a3a2a'];
            case 'aden': return ['#2d1a1a', '#4a2a2a'];
            case 'perpetua': return ['#0a1a3a', '#1a3a5a'];
            case 'valencia': return ['#3a1a0a', '#5a3a2a'];
            case 'nashville': return ['#3a2a1a', '#5a4a3a'];
            case 'sierra': return ['#2a1a0a', '#4a3a2a'];
            case 'willow': return ['#2a2a2a', '#4a4a4a'];
            case 'hudson': return ['#1a2a3a', '#3a4a5a'];
            case 'lofi': return ['#1a1a0a', '#3a3a2a'];
            case 'earlybird': return ['#3a2a1a', '#5a4a3a'];
            case 'brannan': return ['#2a1a0a', '#4a3a2a'];
            case 'inkwell': return ['#1a1a1a', '#3a3a3a'];
            case 'hefe': return ['#3a2a1a', '#5a4a3a'];
            case 'amaro': return ['#2a2a1a', '#4a4a3a'];
            case 'rise': return ['#2a2a1a', '#4a4a3a'];
            default: return ['#1a1a2e', '#16213e'];
        }
    }, []);
    
    // Update gradient colors when filter changes
    useEffect(() => {
        setMediaBgColors(getMediaGradientColors(activeFilterIndex));
    }, [activeFilterIndex, getMediaGradientColors]);
    
    // Soundtracks from database
    const [soundtracks, setSoundtracks] = useState<Soundtrack[]>([]);
    const [soundtracksLoading, setSoundtracksLoading] = useState(false);
    // Preview playback state
    const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
    const [previewingTrack, setPreviewingTrack] = useState<Soundtrack | null>(null);
    // Audio trim state (start and end in milliseconds)
    const [audioTrimStart, setAudioTrimStart] = useState<number>(0);
    const [audioTrimEnd, setAudioTrimEnd] = useState<number | null>(null);
    // Track search
    const [trackSearch, setTrackSearch] = useState('');
    // Music sheet tab state
    const [musicTab, setMusicTab] = useState<'foryou' | 'trending' | 'recent'>('foryou');
    // Recently used tracks (stored locally)
    const [recentTracks, setRecentTracks] = useState<Soundtrack[]>([]);

    const musicSoundRef = useRef<InstanceType<typeof Audio.Sound> | null>(null);
    const musicSheetRef = useRef<BottomSheetModal>(null);
    const stickerSheetRef = useRef<BottomSheetModal>(null);
    const tagSheetRef = useRef<BottomSheetModal>(null);
    const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [trendingScrollIndex, setTrendingScrollIndex] = useState(0);
    // Sticker state - now with dragging support
    const [selectedStickers, setSelectedStickers] = useState<Array<{ id: string; sticker: StorySticker; x: number; y: number; scale: number }>>([]);
    const [stickerCategory, setStickerCategory] = useState<StorySticker['category'] | 'all'>('all');
    // Music pill position (draggable)
    const [musicPillPosition, setMusicPillPosition] = useState<{ x: number; y: number }>({ x: SCREEN_W / 2 - 100, y: 60 });
    // User tagging state
    const [taggedUsers, setTaggedUsers] = useState<Array<{ id: string; username: string; displayName?: string; avatarUrl?: string; x: number; y: number }>>([]);
    const [tagSearchQuery, setTagSearchQuery] = useState('');
    const [tagSearchResults, setTagSearchResults] = useState<Array<{ id: string; username: string; display_name?: string; avatar_url?: string }>>([]);
    const [tagSearchLoading, setTagSearchLoading] = useState(false);
    const [pendingTagPosition, setPendingTagPosition] = useState<{ x: number; y: number } | null>(null);
    // Text overlay state
    const [textOverlays, setTextOverlays] = useState<Array<{ 
        id: string; 
        text: string; 
        x: number; 
        y: number; 
        scale: number;
        rotation: number;
        color: string;
        backgroundColor: string;
        fontStyle: 'modern' | 'classic' | 'signature' | 'typewriter' | 'neon';
        alignment: 'left' | 'center' | 'right';
        hasStroke: boolean;
        hasShadow: boolean;
    }>>([]);
    const [isAddingText, setIsAddingText] = useState(false);
    const [newTextValue, setNewTextValue] = useState('');
    const [newTextColor, setNewTextColor] = useState('#FFFFFF');
    const [newTextBgColor, setNewTextBgColor] = useState('transparent');
    const [newTextStyle, setNewTextStyle] = useState<'modern' | 'classic' | 'signature' | 'typewriter' | 'neon'>('modern');
    const [newTextAlignment, setNewTextAlignment] = useState<'left' | 'center' | 'right'>('center');
    const [newTextHasStroke, setNewTextHasStroke] = useState(false);
    const [newTextHasShadow, setNewTextHasShadow] = useState(false);
    const [newTextScale, setNewTextScale] = useState(1);
    const [textUndoStack, setTextUndoStack] = useState<string[]>([]);
    const [textRedoStack, setTextRedoStack] = useState<string[]>([]);
    const textInputRef = useRef<TextInput>(null);

    const sheetBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
        [],
    );

    const stickerSnapPoints = useMemo(() => ["50%", "80%"], []);
    const musicSnapPoints = useMemo(() => ["65%", "90%"], []);
    const tagSnapPoints = useMemo(() => ["50%", "75%"], []);
    // Location sheet snap points updated to 70% height
    const locationSnapPoints = useMemo(() => ["70%"], []);

    // Search for users to tag
    const searchUsersForTag = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setTagSearchResults([]);
            return;
        }
        
        setTagSearchLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, display_name, avatar_url')
                .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
                .limit(15);
            
            if (error) {
                console.warn('searchUsersForTag error', error);
                setTagSearchResults([]);
                return;
            }
            setTagSearchResults(data || []);
        } catch (e) {
            console.warn('searchUsersForTag exception', e);
            setTagSearchResults([]);
        } finally {
            setTagSearchLoading(false);
        }
    }, []);

    // Debounced tag search
    useEffect(() => {
        const timeout = setTimeout(() => {
            searchUsersForTag(tagSearchQuery);
        }, 300);
        return () => clearTimeout(timeout);
    }, [tagSearchQuery, searchUsersForTag]);

    // Open tag sheet
    const openTagSheet = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        setPendingTagPosition({ x: SCREEN_W / 2 - 50, y: MEDIA_AREA_HEIGHT / 2 });
        setTagSearchQuery('');
        setTagSearchResults([]);
        tagSheetRef.current?.present();
    }, []);

    // Add a tagged user
    const addTaggedUser = useCallback((user: { id: string; username: string; display_name?: string; avatar_url?: string }) => {
        if (!pendingTagPosition) return;
        
        // Check if already tagged
        if (taggedUsers.some(t => t.id === user.id)) {
            Alert.alert('Already Tagged', `@${user.username} is already tagged in this story`);
            return;
        }
        
        setTaggedUsers(prev => [...prev, {
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            x: pendingTagPosition.x,
            y: pendingTagPosition.y,
        }]);
        
        tagSheetRef.current?.dismiss();
        setPendingTagPosition(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [pendingTagPosition, taggedUsers]);

    // Remove a tagged user
    const removeTaggedUser = useCallback((userId: string) => {
        setTaggedUsers(prev => prev.filter(t => t.id !== userId));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Text overlay functions
    const openTextEditor = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        setIsAddingText(true);
        setNewTextValue('');
        setTimeout(() => textInputRef.current?.focus(), 100);
    }, []);

    const addTextOverlay = useCallback(() => {
        if (!newTextValue.trim()) {
            setIsAddingText(false);
            return;
        }
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const x = SCREEN_W / 2 - 80;
        const y = MEDIA_AREA_HEIGHT / 2 - 20;
        
        setTextOverlays(prev => [...prev, {
            id: `text-${Date.now()}`,
            text: newTextValue.trim(),
            x,
            y,
            scale: newTextScale,
            rotation: 0,
            color: newTextColor,
            backgroundColor: newTextBgColor,
            fontStyle: newTextStyle,
            alignment: newTextAlignment,
            hasStroke: newTextHasStroke,
            hasShadow: newTextHasShadow,
        }]);
        
        setIsAddingText(false);
        setNewTextValue('');
        setNewTextScale(1);
        setTextUndoStack([]);
        setTextRedoStack([]);
    }, [newTextValue, newTextColor, newTextBgColor, newTextStyle, newTextAlignment, newTextHasStroke, newTextHasShadow, newTextScale]);

    const removeTextOverlay = useCallback((textId: string) => {
        Haptics.selectionAsync().catch(() => {});
        setTextOverlays(prev => prev.filter(t => t.id !== textId));
    }, []);

    // Undo/Redo for text input
    const handleTextChange = useCallback((text: string) => {
        setTextUndoStack(prev => [...prev.slice(-20), newTextValue]); // Keep last 20 states
        setTextRedoStack([]);
        setNewTextValue(text);
    }, [newTextValue]);

    const undoText = useCallback(() => {
        if (textUndoStack.length === 0) return;
        const prev = textUndoStack[textUndoStack.length - 1];
        setTextRedoStack(stack => [...stack, newTextValue]);
        setTextUndoStack(stack => stack.slice(0, -1));
        setNewTextValue(prev);
        Haptics.selectionAsync().catch(() => {});
    }, [textUndoStack, newTextValue]);

    const redoText = useCallback(() => {
        if (textRedoStack.length === 0) return;
        const next = textRedoStack[textRedoStack.length - 1];
        setTextUndoStack(stack => [...stack, newTextValue]);
        setTextRedoStack(stack => stack.slice(0, -1));
        setNewTextValue(next);
        Haptics.selectionAsync().catch(() => {});
    }, [textRedoStack, newTextValue]);

    // Text style options - Instagram-style colors
    const TEXT_COLORS = ['#FFFFFF', '#000000', '#FF3B5C', '#FFD700', '#00D4FF', '#00FF88', '#FF6B6B', '#9B59B6', '#FF9500', '#34C759'];
    const TEXT_BG_COLORS = ['transparent', 'rgba(0,0,0,0.75)', 'rgba(255,255,255,0.95)', '#FF3B5C', '#000000', '#FFFFFF', '#FFD700', '#00D4FF'];

    // Font style configs
    const FONT_STYLES = [
        { id: 'modern', label: 'Modern', fontWeight: '700' as const, fontFamily: undefined },
        { id: 'classic', label: 'Classic', fontWeight: '500' as const, fontFamily: undefined, fontStyle: 'italic' as const },
        { id: 'signature', label: 'Signature', fontWeight: '400' as const, fontFamily: undefined, letterSpacing: 2 },
        { id: 'typewriter', label: 'Typewriter', fontWeight: '400' as const, fontFamily: 'monospace' },
        { id: 'neon', label: 'Neon', fontWeight: '800' as const, fontFamily: undefined, glow: true },
    ] as const;

    // Trending tracks for the carousel (first 5 tracks with artwork)
    const trendingTracks = useMemo(() => {
        return soundtracks.filter(t => t.artwork_url).slice(0, 5);
    }, [soundtracks]);

    // Auto-scroll trending carousel
    useEffect(() => {
        if (trendingTracks.length <= 1) return;
        const interval = setInterval(() => {
            setTrendingScrollIndex(prev => (prev + 1) % trendingTracks.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [trendingTracks.length]);

    // Filtered soundtracks based on search and tab
    const filteredSoundtracks = useMemo(() => {
        let tracks = soundtracks;
        
        // Filter by tab
        if (musicTab === 'recent') {
            tracks = recentTracks;
        } else if (musicTab === 'trending') {
            // For now, just shuffle - in future could sort by usage count
            tracks = [...soundtracks].sort(() => Math.random() - 0.5);
        }
        
        // Apply search filter
        if (!trackSearch.trim()) return tracks;
        const q = trackSearch.toLowerCase();
        return tracks.filter(
            (t) =>
                t.title.toLowerCase().includes(q) ||
                (t.artist_name?.toLowerCase().includes(q) ?? false)
        );
    }, [soundtracks, trackSearch, musicTab, recentTracks]);

    // Filtered stickers based on category
    const filteredStickers = useMemo(() => {
        if (stickerCategory === 'all') return STORY_STICKERS;
        return STORY_STICKERS.filter(s => s.category === stickerCategory);
    }, [stickerCategory]);

    const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setPreviewLayout((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    }, []);

    const resolveAssetUri = useCallback(async (moduleId: number) => {
        const asset = Asset.fromModule(moduleId);
        if (!asset.localUri) {
            try {
                // Use Asset.loadAsync which is supported across SDKs and avoids
                // calling into deprecated expo-file-system.downloadAsync directly.
                await Asset.loadAsync(moduleId);
            } catch (err) {
                console.warn("asset download", err);
            }
        }
        return asset.localUri ?? asset.uri;
    }, []);

    // filters removed — no filter thumbnails to resolve

    // Load recent tracks from cache on mount
    useEffect(() => {
        const loadRecentTracks = async () => {
            try {
                const cached = await AsyncStorage.getItem(RECENT_TRACKS_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        setRecentTracks(parsed);
                    }
                }
            } catch (e) {
                console.warn('loadRecentTracks error', e);
            }
        };
        loadRecentTracks();
    }, []);

    // Save recent tracks to cache when they change
    useEffect(() => {
        if (recentTracks.length > 0) {
            AsyncStorage.setItem(RECENT_TRACKS_CACHE_KEY, JSON.stringify(recentTracks)).catch(() => {});
        }
    }, [recentTracks]);

    // Fetch soundtracks from database with caching
    const fetchSoundtracks = useCallback(async (forceRefresh = false) => {
        try {
            // Check memory cache first (fastest)
            const now = Date.now();
            if (!forceRefresh && soundtracksMemoryCache && (now - soundtracksMemoryCache.timestamp) < CACHE_TTL_MS) {
                setSoundtracks(soundtracksMemoryCache.data);
                return;
            }

            // Check AsyncStorage cache
            if (!forceRefresh) {
                try {
                    const cached = await AsyncStorage.getItem(SOUNDTRACKS_CACHE_KEY);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (parsed.timestamp && (now - parsed.timestamp) < CACHE_TTL_MS && Array.isArray(parsed.data)) {
                            soundtracksMemoryCache = { data: parsed.data, timestamp: parsed.timestamp };
                            setSoundtracks(parsed.data);
                            return;
                        }
                    }
                } catch (e) {
                    // Ignore cache errors
                }
            }

            setSoundtracksLoading(true);
            const { data, error } = await supabase
                .from('soundtracks')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) {
                console.warn('fetchSoundtracks error', error);
                setSoundtracks([]);
                return;
            }
            const tracks = data || [];
            setSoundtracks(tracks);
            
            // Update caches
            soundtracksMemoryCache = { data: tracks, timestamp: now };
            AsyncStorage.setItem(SOUNDTRACKS_CACHE_KEY, JSON.stringify({ data: tracks, timestamp: now })).catch(() => {});
        } catch (e) {
            console.warn('fetchSoundtracks exception', e);
            setSoundtracks([]);
        } finally {
            setSoundtracksLoading(false);
        }
    }, []);

    // Prefetch soundtracks on mount
    useEffect(() => {
        fetchSoundtracks();
    }, [fetchSoundtracks]);

    const stopMusicPlayback = useCallback(async () => {
        try {
            await musicSoundRef.current?.stopAsync();
        } catch (err) {
            console.warn("music stop", err);
        }
        try {
            await musicSoundRef.current?.unloadAsync();
        } catch (err) {
            console.warn("music unload", err);
        }
        musicSoundRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            stopMusicPlayback().catch(() => {});
        };
    }, [stopMusicPlayback]);

    // Open sticker sheet
    const openStickerSheet = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        stickerSheetRef.current?.present();
    }, []);

    // Add sticker to preview
    const handleAddSticker = useCallback((sticker: StorySticker) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        // Random position in the center area
        const x = Math.random() * (previewLayout.width - 120) + 60;
        const y = Math.random() * (previewLayout.height * 0.4) + (previewLayout.height * 0.2);
        setSelectedStickers(prev => [...prev, { 
            id: `${sticker.id}-${Date.now()}`, 
            sticker, 
            x, 
            y,
            scale: 1, // Default scale
        }]);
        stickerSheetRef.current?.dismiss();
    }, [previewLayout]);

    // Remove sticker
    const handleRemoveSticker = useCallback((stickerId: string) => {
        Haptics.selectionAsync().catch(() => {});
        setSelectedStickers(prev => prev.filter(s => s.id !== stickerId));
    }, []);

    const openMusicSheet = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        fetchSoundtracks();
        musicSheetRef.current?.present();
    }, [fetchSoundtracks]);

    // Stop preview when sheet is dismissed
    const handleMusicSheetDismiss = useCallback(() => {
        // Clear preview timeout
        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
            previewTimeoutRef.current = null;
        }
        // Stop any preview playback when sheet is dismissed
        stopMusicPlayback().catch(() => {});
        setPreviewPlayingId(null);
        setPreviewingTrack(null);
    }, [stopMusicPlayback]);

    // Toggle preview playback for a track (plays only 15 seconds)
    const handleTogglePreview = useCallback(async (track: Soundtrack) => {
        try {
            Haptics.selectionAsync().catch(() => {});
            
            // Clear any existing preview timeout
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
                previewTimeoutRef.current = null;
            }
            
            // If already playing this track, stop it
            if (previewPlayingId === track.id) {
                await stopMusicPlayback();
                setPreviewPlayingId(null);
                setPreviewingTrack(null);
                return;
            }
            
            // Stop any current playback
            await stopMusicPlayback();
            setPreviewPlayingId(null);
            setMusicLoadingId(track.id);
            
            // Start new preview (no looping, will stop after 15 seconds)
            const { sound } = await Audio.Sound.createAsync(
                { uri: track.audio_url },
                { shouldPlay: true, isLooping: false, volume: 0.6 },
            );
            musicSoundRef.current = sound;
            setPreviewPlayingId(track.id);
            setPreviewingTrack(track);
            
            // Auto-stop after 15 seconds
            previewTimeoutRef.current = setTimeout(async () => {
                await stopMusicPlayback();
                setPreviewPlayingId(null);
                setPreviewingTrack(null);
            }, 15000);
        } catch (err) {
            console.warn("preview toggle", err);
        } finally {
            setMusicLoadingId(null);
        }
    }, [previewPlayingId, stopMusicPlayback]);

    // Handle selecting a track (use this sound)
    const handleUseSound = useCallback(
        async (track: Soundtrack) => {
            try {
                Haptics.selectionAsync().catch(() => {});
                setMusicLoadingId(track.id);
                setPreviewPlayingId(null);
                setPreviewingTrack(null);
                await stopMusicPlayback();
                const { sound, status } = await Audio.Sound.createAsync(
                    { uri: track.audio_url },
                    { shouldPlay: true, isLooping: true, volume: 0.45 },
                );
                musicSoundRef.current = sound;
                
                // Get the actual duration from playback status or use the database value
                const durationMs = (status as any)?.durationMillis ?? track.duration_ms ?? null;
                
                setCameraMusic({
                    id: track.id,
                    title: track.title,
                    artist: track.artist_name ?? undefined,
                    audioUrl: track.audio_url,
                    artworkUrl: track.artwork_url ?? undefined,
                    durationMs: durationMs,
                });
                // Add to recent tracks
                setRecentTracks(prev => {
                    const filtered = prev.filter(t => t.id !== track.id);
                    return [track, ...filtered].slice(0, 20); // Keep last 20
                });
                // Reset trim when selecting new track
                setAudioTrimStart(0);
                setAudioTrimEnd(null);
                musicSheetRef.current?.dismiss();
            } catch (err) {
                console.warn("music select", err);
                Alert.alert("Soundtrack", "Unable to start playback.");
            } finally {
                setMusicLoadingId(null);
            }
        },
        [stopMusicPlayback],
    );

    const clearCameraMusic = useCallback(() => {
        stopMusicPlayback()
            .catch(() => {})
            .finally(() => setCameraMusic(null));
    }, [stopMusicPlayback]);

    useEffect(() => {
        const subscription = NetInfo.addEventListener((state) => {
            const connected = state.isConnected !== false && state.isInternetReachable !== false;
            setIsConnected(connected);
        });
        return () => subscription();
    }, []);

    const ensureCameraPermission = useCallback(async () => {
        try {
            const existing = await Camera.getCameraPermissionsAsync();
            if (existing.status === "granted") {
                setHasCameraPermission(true);
                return;
            }
            const result = await Camera.requestCameraPermissionsAsync();
            setHasCameraPermission(result.status === "granted");
        } catch (err) {
            console.warn("camera permission", err);
            setHasCameraPermission(false);
        }
    }, []);

    useEffect(() => {
        ensureCameraPermission();
    }, [ensureCameraPermission]);

    const appendMediaItems = useCallback(
        (items: MediaItem | MediaItem[]) => {
            const additions = Array.isArray(items) ? items : [items];
            if (!additions.length) return;
            const normalized = additions; // no filters — keep imported items as-is
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setMedia((prev) => {
                const combined = [...prev, ...normalized];
                const next = combined.slice(-MAX_MEDIA_ITEMS);
                setActiveMediaIndex(Math.max(0, next.length - 1));
                return next;
            });
            setPreviewMode("review");
        },
        [],
    );

    const openMediaImporter = useCallback(async () => {
        Haptics.selectionAsync().catch(() => {});
        
        // Use expo-image-picker - it handles video URIs much better on Android
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: false,
                quality: 1,
                videoMaxDuration: 60,
            });
            
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                console.log('ImagePicker result:', JSON.stringify(asset, null, 2));
                
                const isVideo = asset.type === 'video';
                
                const mediaItem: MediaItem = {
                    id: generateUUID(),
                    type: isVideo ? 'video' : 'image',
                    uri: asset.uri,
                    width: asset.width ?? null,
                    height: asset.height ?? null,
                    durationMs: isVideo && asset.duration ? asset.duration * 1000 : null,
                    stickers: [],
                    isHD: true,
                };
                
                appendMediaItems(mediaItem);
            }
        } catch (err) {
            console.warn('ImagePicker error:', err);
            Alert.alert('Import', 'Unable to open gallery. Please try again.');
        }
    }, [appendMediaItems]);

    // filters removed — no filter change handler

    const buildMediaFromAsset = useCallback(
        async (asset: MediaLibraryAsset & { localUri?: string | null }): Promise<MediaItem | null> => {
        // MediaImporter already handles copying content:// URIs to file:// on Android
        // So localUri should already be a usable file:// URI
        const uri = asset.localUri ?? asset.uri;
        if (!uri) {
            console.warn('buildMediaFromAsset: No URI available');
            return null;
        }
        
        console.log('buildMediaFromAsset received URI:', uri);
        
        const isVideo = asset.mediaType === MediaLibrary.MediaType.video;
        
        if (isVideo) {
            return {
                id: generateUUID(),
                type: "video",
                uri: uri,
                durationMs: asset.duration ? asset.duration * 1000 : null,
                width: asset.width ?? null,
                height: asset.height ?? null,
                stickers: [],
                isHD: true,
            } as MediaItem;
        }
        
        // Handle images
        let width = asset.width ?? null;
        let height = asset.height ?? null;
        if (!width || !height) {
            try {
                const size = await readImageSize(uri);
                width = size.width;
                height = size.height;
            } catch (err) {
                console.warn("image size", err);
            }
        }
        return {
            id: generateUUID(),
            type: "image",
            uri,
            width,
            height,
            stickers: [],
            isHD: true,
        } as MediaItem;
    },
    [],
);

    const handleImportedAsset = useCallback(
        async (asset: MediaLibraryAsset & { localUri?: string | null }) => {
            setMediaImporterVisible(false);
            try {
                const mediaItem = await buildMediaFromAsset(asset);
                if (!mediaItem) {
                    Alert.alert("Import", "Unable to load that file. Try another.");
                    return;
                }
                appendMediaItems(mediaItem);
            } catch (err) {
                console.warn("handle import", err);
                Alert.alert("Import", "We couldn't import that file.");
            }
        },
        [appendMediaItems, buildMediaFromAsset],
    );

    const addCapturedMedia = useCallback(
        (item: MediaItem) => {
            appendMediaItems(item);
        },
        [appendMediaItems],
    );

    const handleCapturePhoto = useCallback(async () => {
        if (!cameraRef.current || captureInFlight) return;
        try {
            setCaptureInFlight(true);
            const result = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
            if (result?.uri) {
                addCapturedMedia({
                    id: generateUUID(),
                    type: "image",
                    uri: result.uri,
                    width: result.width ?? null,
                    height: result.height ?? null,
                    stickers: [],
                });
            }
        } catch (err) {
            console.warn("capture photo", err);
            Alert.alert("Camera", "Unable to capture photo. Try again.");
        } finally {
            setCaptureInFlight(false);
        }
    }, [addCapturedMedia, captureInFlight]);

    const handleRecordPress = useCallback(async () => {
        if (!cameraRef.current) return;
        if (isRecording) {
            try {
                cameraRef.current.stopRecording();
            } catch (err) {
                console.warn("stop recording", err);
            }
            return;
        }
        setIsRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        try {
            const recording = await cameraRef.current.recordAsync({ maxDuration: 20 });
            if (recording?.uri) {
                addCapturedMedia({
                    id: generateUUID(),
                    type: "video",
                    uri: recording.uri,
                    durationMs: (recording as any)?.durationMillis ?? null,
                    stickers: [],
                });
            }
        } catch (err) {
            console.warn("record video", err);
            Alert.alert("Camera", "Recording failed. Try again.");
        } finally {
            setIsRecording(false);
        }
    }, [addCapturedMedia, isRecording]);

    const handleCapturePress = useCallback(async () => {
        if (!hasCameraPermission || previewMode !== "camera") return;
        if (cameraMode === "photo") {
            await handleCapturePhoto();
        } else {
            await handleRecordPress();
        }
    }, [cameraMode, handleCapturePhoto, handleRecordPress, hasCameraPermission, previewMode]);

    const toggleCameraFacing = useCallback(() => {
        setCameraType((prev) => (prev === "back" ? "front" : "back"));
        Haptics.selectionAsync().catch(() => {});
    }, []);

    const toggleFlashMode = useCallback(() => {
        setFlashMode((prev) => {
            if (prev === "off") return "on";
            if (prev === "on") return "auto";
            return "off";
        });
        Haptics.selectionAsync().catch(() => {});
    }, []);

    const closePreviewMode = useCallback(() => {
        setPreviewMode("camera");
    }, []);

    const removeActiveMedia = useCallback(() => {
        setMedia((prev) => {
            if (!prev.length) {
                setPreviewMode("camera");
                setActiveMediaIndex(0);
                return prev;
            }
            const next = prev.filter((_, idx) => idx !== activeMediaIndex);
            if (!next.length) {
                setPreviewMode("camera");
                setActiveMediaIndex(0);
            } else if (activeMediaIndex >= next.length) {
                setActiveMediaIndex(next.length - 1);
            }
            return next;
        });
    }, [activeMediaIndex]);

    const openPhotoEditor = useCallback(
        (index: number) => {
            const target = media[index];
            if (!target || target.type !== "image") return;
            setPhotoEditorState({ index, asset: ensureEditorAsset(target) });
            setPhotoEditorVisible(true);
        },
        [media],
    );

    const handlePhotoApply = useCallback(
        async (uri: string) => {
            if (!photoEditorState) return;
            try {
                const size = await readImageSize(uri);
                setMedia((prev) =>
                    prev.map((item, idx) =>
                        idx === photoEditorState.index
                            ? {
                                  ...item,
                                  editedUri: uri,
                                  editedWidth: size.width,
                                  editedHeight: size.height,
                              }
                            : item,
                    ),
                );
            } catch (err) {
                Alert.alert("Editor", "Unable to update that photo.");
                console.warn("photo apply", err);
            } finally {
                setPhotoEditorVisible(false);
                setPhotoEditorState(null);
            }
        },
        [photoEditorState],
    );

    const resetCaptureState = useCallback(() => {
        setMedia([]);
        setPreviewMode("camera");
        setCameraMode("photo");
    }, []);

    const resolveUserId = useCallback(async () => {
        if (currentUserId) return currentUserId;
        try {
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                console.warn("resolve user id", error);
            }
            return data?.user?.id ?? null;
        } catch (err) {
            console.warn("resolve user id", err);
            return null;
        }
    }, [currentUserId]);

    const handleProceedToUpload = useCallback(async () => {
        if (!isConnected) {
            Alert.alert("Offline", "Reconnect to continue.");
            return;
        }
        if (!media.length) {
            Alert.alert("Missing media", "Add at least one photo or video.");
            return;
        }
        if (queueing) return;
        setQueueing(true);
        try {
            const userId = await resolveUserId();
            if (!userId) {
                Alert.alert("Account", "We couldn't confirm your account. Try again.");
                return;
            }
            setDraft({
                userId,
                media: media.map((item) => ({ ...item })),
                publishTarget: DEFAULT_PUBLISH_TARGET,
                cameraSelectedMusic: cameraMusic,
            });
            resetCaptureState();
            router.push("/explore/upload_story");
        } catch (err) {
            console.error("proceed to upload", err);
            Alert.alert("Queue failed", err instanceof Error ? err.message : "Try again in a moment.");
        } finally {
            setQueueing(false);
        }
    }, [cameraMusic, isConnected, media, queueing, resetCaptureState, resolveUserId, router, setDraft]);

    useEffect(() => {
        if (!media.length) {
            setActiveMediaIndex(0);
            if (previewMode === "review") {
                setPreviewMode("camera");
            }
            return;
        }
        if (activeMediaIndex > media.length - 1) {
            setActiveMediaIndex(media.length - 1);
        }
    }, [activeMediaIndex, media, previewMode]);

    // no per-clip filter state — filters removed

    const activeMedia = media[activeMediaIndex] ?? null;
    const captureDisabled = captureInFlight || hasCameraPermission !== true || previewMode !== "camera";
    const proceedBlockReason = useMemo(() => {
        if (!isConnected) return "offline" as const;
        if (!media.length) return "no-media" as const;
        return null;
    }, [isConnected, media.length]);
    const proceedDisabled = queueing;
    // Removed offline helper copy - proceed button is disabled when offline
    const flashIconName = flashMode === "off" ? "flash-off" : flashMode === "auto" ? "flash-outline" : "flash";

    // Construct a draggable music pill node so we don't accidentally declare JSX inside JSX
    let musicPill: React.ReactNode = null;
    if (cameraMusic && cameraMusic.title) {
        const safeMusic = cameraMusic as StoryUploadSelectedMusic;
        musicPill = (
            <DraggableItem
                key="music-pill"
                x={musicPillPosition.x}
                y={musicPillPosition.y}
                bounds={previewLayout}
                onPositionChange={(newX, newY) => setMusicPillPosition({ x: newX, y: newY })}
                onLongPress={clearCameraMusic}
            >
                <View style={[styles.musicPill, { backgroundColor: 'rgba(0,0,0,0.7)' }]}> 
                    <Ionicons name="musical-notes" size={14} color="#fff" />
                    <Text style={styles.musicPillText} numberOfLines={1} ellipsizeMode="tail">
                        {safeMusic.title}{safeMusic.artist ? ` • ${safeMusic.artist}` : ''}
                    </Text>
                </View>
            </DraggableItem>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#0a0a0f' }]}> 
            <View
                style={[
                    styles.snapCameraShell,
                    {
                        paddingTop: 0,
                        paddingBottom: insets.bottom,
                    },
                ]}
            > 
                {hasCameraPermission === false ? (
                    <View style={styles.previewSurface} onLayout={handlePreviewLayout}>
                        <View style={styles.cameraDenied}>
                            <Ionicons name="camera" size={36} color="#fff" />
                            <Text style={styles.cameraDeniedText}>Enable camera access in system settings to capture stories.</Text>
                        </View>
                    </View>
                ) : previewMode === "review" && activeMedia ? (
                    <View style={styles.previewSurface} onLayout={handlePreviewLayout}>
                        {activeMedia.type === "video" ? (
                            <VideoPreview 
                                uri={activeMedia.editedUri ?? activeMedia.uri} 
                                durationMs={activeMedia.durationMs ?? null}
                                filter={STORY_FILTERS[activeFilterIndex]}
                            />
                        ) : (
                            <GestureHandlerRootView style={StyleSheet.absoluteFillObject}>
                                {/* Gradient background for zoom-out effect */}
                                <LinearGradient
                                    colors={mediaBgColors}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                {/* Blurred edge effect when zoomed out */}
                                {isZoomedOut && (
                                    <>
                                        <Image 
                                            source={{ uri: activeMedia.editedUri ?? activeMedia.uri }}
                                            style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
                                            blurRadius={30}
                                            resizeMode="cover"
                                        />
                                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
                                    </>
                                )}
                                <GestureDetector gesture={Gesture.Simultaneous(
                                    Gesture.Pinch()
                                        .onUpdate((e) => {
                                            // Allow zoom out to 0.4 and zoom in to 4
                                            imageScale.value = Math.min(Math.max(savedScale.value * e.scale, 0.4), 4);
                                        })
                                        .onEnd(() => {
                                            savedScale.value = imageScale.value;
                                            if (imageScale.value > 1) {
                                                runOnJS(setIsCropMode)(true);
                                                runOnJS(setIsZoomedOut)(false);
                                            } else if (imageScale.value < 1) {
                                                runOnJS(setIsCropMode)(false);
                                                runOnJS(setIsZoomedOut)(true);
                                            } else {
                                                runOnJS(setIsCropMode)(false);
                                                runOnJS(setIsZoomedOut)(false);
                                            }
                                        }),
                                    Gesture.Pan()
                                        .onUpdate((e) => {
                                            // Allow panning when zoomed in OR zoomed out
                                            if (imageScale.value !== 1) {
                                                const maxTranslateX = (previewLayout.width * Math.abs(imageScale.value - 1)) / 2;
                                                const maxTranslateY = (previewLayout.height * Math.abs(imageScale.value - 1)) / 2;
                                                translateX.value = Math.min(Math.max(savedTranslateX.value + e.translationX, -maxTranslateX), maxTranslateX);
                                                translateY.value = Math.min(Math.max(savedTranslateY.value + e.translationY, -maxTranslateY), maxTranslateY);
                                            }
                                        })
                                        .onEnd(() => {
                                            savedTranslateX.value = translateX.value;
                                            savedTranslateY.value = translateY.value;
                                        }),
                                    // Double tap to reset
                                    Gesture.Tap()
                                        .numberOfTaps(2)
                                        .onEnd(() => {
                                            imageScale.value = withSpring(1);
                                            savedScale.value = 1;
                                            translateX.value = withSpring(0);
                                            translateY.value = withSpring(0);
                                            savedTranslateX.value = 0;
                                            savedTranslateY.value = 0;
                                            runOnJS(setIsCropMode)(false);
                                            runOnJS(setIsZoomedOut)(false);
                                        })
                                )}>
                                    <Animated.View style={[StyleSheet.absoluteFillObject, animatedImageStyle, { alignItems: 'center', justifyContent: 'center' }]}>
                                        <FilteredImage 
                                            uri={activeMedia.editedUri ?? activeMedia.uri}
                                            filter={STORY_FILTERS[activeFilterIndex]}
                                            style={StyleSheet.absoluteFillObject}
                                        />
                                    </Animated.View>
                                </GestureDetector>
                                {activeMedia.editedUri ? (
                                    <View style={styles.badge} pointerEvents="none">
                                        <Text style={styles.badgeText}>Edited</Text>
                                    </View>
                                ) : null}
                                {/* Zoom indicator */}
                                {(isCropMode || isZoomedOut) && (
                                    <View style={styles.zoomIndicator} pointerEvents="none">
                                        <Ionicons name={isZoomedOut ? "contract" : "expand"} size={14} color="#fff" />
                                        <Text style={styles.zoomIndicatorText}>
                                            {Math.round(imageScale.value * 100)}%
                                        </Text>
                                    </View>
                                )}
                            </GestureHandlerRootView>
                        )}
                        {/* Stickers overlay - draggable (works for both image and video) */}
                        {selectedStickers.map((item) => (
                            <DraggableItem
                                key={item.id}
                                x={item.x}
                                y={item.y}
                                scale={item.scale}
                                bounds={previewLayout}
                                enableScale={true}
                                onPositionChange={(newX, newY) => {
                                    setSelectedStickers(prev => prev.map(s => 
                                        s.id === item.id ? { ...s, x: newX, y: newY } : s
                                    ));
                                }}
                                onScaleChange={(newScale) => {
                                    setSelectedStickers(prev => prev.map(s => 
                                        s.id === item.id ? { ...s, scale: newScale } : s
                                    ));
                                }}
                                onLongPress={() => handleRemoveSticker(item.id)}
                            >
                                <StickerView sticker={item.sticker} />
                            </DraggableItem>
                        ))}
                        {/* Tagged users overlay - draggable */}
                        {taggedUsers.map((tag) => (
                            <DraggableItem
                                key={tag.id}
                                x={tag.x}
                                y={tag.y}
                                bounds={previewLayout}
                                onPositionChange={(newX, newY) => {
                                    setTaggedUsers(prev => prev.map(t => 
                                        t.id === tag.id ? { ...t, x: newX, y: newY } : t
                                    ));
                                }}
                                onLongPress={() => removeTaggedUser(tag.id)}
                            >
                                <UserTagView username={tag.username} avatarUrl={tag.avatarUrl} />
                            </DraggableItem>
                        ))}
                        {/* Draggable music pill on preview */}
                        {musicPill}
                        {/* Text overlays - draggable and scalable */}
                        {textOverlays.map((overlay) => (
                            <DraggableItem
                                key={overlay.id}
                                x={overlay.x}
                                y={overlay.y}
                                scale={overlay.scale}
                                bounds={previewLayout}
                                enableScale={true}
                                onPositionChange={(newX, newY) => {
                                    setTextOverlays(prev => prev.map(t => 
                                        t.id === overlay.id ? { ...t, x: newX, y: newY } : t
                                    ));
                                }}
                                onScaleChange={(newScale) => {
                                    setTextOverlays(prev => prev.map(t => 
                                        t.id === overlay.id ? { ...t, scale: newScale } : t
                                    ));
                                }}
                                onLongPress={() => removeTextOverlay(overlay.id)}
                            >
                                <TextOverlayView overlay={overlay} />
                            </DraggableItem>
                        ))}
                        {/* Top bar with back button and actions - all in line */}
                        <View style={styles.previewTopBar}>
                            <TouchableOpacity style={styles.previewBackBtnInline} onPress={closePreviewMode}>
                                <Ionicons name="arrow-back" size={18} color="#fff" />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity style={styles.heroActionBtn} onPress={removeActiveMedia}>
                                <Ionicons name="trash" size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        {/* Pinch hint */}
                        {activeMedia.type === "image" && !isCropMode && null}
                        {media.length > 1 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.previewThumbRow}
                                style={styles.previewThumbScroller}
                            >
                                {media.map((item, idx) => {
                                    const active = idx === activeMediaIndex;
                                    const sourceUri = item.editedUri ?? item.uri;
                                    return (
                                        <TouchableOpacity
                                            key={`${item.id}-thumb`}
                                            onPress={() => setActiveMediaIndex(idx)}
                                            style={[styles.previewThumb, active && styles.previewThumbActive]}
                                        >
                                            {item.type === "image" ? (
                                                <Image source={{ uri: sourceUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                                            ) : (
                                                <Video
                                                    source={{ uri: sourceUri }}
                                                    style={StyleSheet.absoluteFillObject}
                                                    resizeMode={ResizeMode.COVER}
                                                    shouldPlay={false}
                                                    isMuted
                                                />
                                            )}
                                            {item.type === "video" ? (
                                                <View style={styles.previewThumbBadge}>
                                                    <Ionicons name="videocam" size={14} color="#fff" />
                                                </View>
                                            ) : null}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        ) : null}
                        {/* Instagram-like filter swipe rail for images and videos */}
                        {(activeMedia.type === "image" || activeMedia.type === "video") && (
                            <View style={styles.filterSwipeContainer}>
                                <ScrollView
                                    ref={filterScrollRef}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    decelerationRate="fast"
                                    snapToInterval={80}
                                    contentContainerStyle={styles.filterSwipeContent}
                                    onMomentumScrollEnd={(e) => {
                                        const idx = Math.round(e.nativeEvent.contentOffset.x / 80);
                                        setActiveFilterIndex(Math.min(Math.max(idx, 0), STORY_FILTERS.length - 1));
                                        Haptics.selectionAsync().catch(() => {});
                                    }}
                                >
                                    {STORY_FILTERS.map((filter, idx) => (
                                        <TouchableOpacity
                                            key={filter.id}
                                            style={[
                                                styles.filterSwipeItem,
                                                activeFilterIndex === idx && styles.filterSwipeItemActive,
                                            ]}
                                            onPress={() => {
                                                setActiveFilterIndex(idx);
                                                filterScrollRef.current?.scrollTo({ x: idx * 80, animated: true });
                                                Haptics.selectionAsync().catch(() => {});
                                            }}
                                        >
                                            <View style={[
                                                styles.filterSwipePreview,
                                                activeFilterIndex === idx && styles.filterSwipePreviewActive,
                                            ]}>
                                                {/* Show thumbnail preview - use first frame for video */}
                                                <Image 
                                                    source={{ uri: activeMedia.editedUri ?? activeMedia.uri }}
                                                    style={styles.filterSwipeImage}
                                                />
                                                {/* Filter overlay on thumbnail */}
                                                {(() => {
                                                    const overlayConfig = getFilterOverlay(filter);
                                                    if (!overlayConfig) return null;
                                                    return (
                                                        <View 
                                                            style={[
                                                                StyleSheet.absoluteFill,
                                                                { 
                                                                    backgroundColor: overlayConfig.overlay,
                                                                    opacity: overlayConfig.opacity,
                                                                    borderRadius: 8,
                                                                }
                                                            ]} 
                                                            pointerEvents="none"
                                                        />
                                                    );
                                                })()}
                                            </View>
                                            <Text style={[
                                                styles.filterSwipeLabel,
                                                activeFilterIndex === idx && styles.filterSwipeLabelActive,
                                            ]}>
                                                {filter.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                ) : hasCameraPermission && isFocused ? (
                    <View style={styles.previewSurface} onLayout={handlePreviewLayout}>
                        <CameraView
                            ref={(ref: CameraViewHandle | null) => {
                                cameraRef.current = ref;
                            }}
                            style={StyleSheet.absoluteFillObject}
                            facing={cameraType}
                            flash={flashMode}
                            mode={cameraMode === "photo" ? "picture" : "video"}
                            zoom={cameraType === "back" ? cameraZoom : 1}
                        />
                        {/* filters removed — no overlay */}
                        {/* All top controls on one line */}
                        {previewMode === "camera" && (
                            <View style={[styles.topControlsRow, { top: insets.top + 6 }]} pointerEvents="box-none">
                                {/* Left side - flash and camera switch */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity style={styles.overlayBtnOval} onPress={toggleFlashMode}>
                                        <Ionicons name={flashIconName} size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.overlayBtnOval} onPress={toggleCameraFacing}>
                                        <Ionicons name="camera-reverse" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                
                                {/* Right side - text, stickers, music */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity style={styles.overlayBtnOval} onPress={openTextEditor}>
                                        <Ionicons name="text" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.overlayBtnOval} onPress={openStickerSheet}>
                                        <Ionicons name="happy" size={20} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.overlayBtnOval} onPress={openMusicSheet}>
                                        <Ionicons name="musical-notes" size={20} color={cameraMusic ? VELT_ACCENT : "#fff"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.previewSurface} onLayout={handlePreviewLayout}>
                        <View style={styles.cameraPreparing}>
                            <ActivityIndicator color="#fff" />
                            <Text style={styles.cameraDeniedText}>Opening camera…</Text>
                        </View>
                    </View>
                )}

                {/* Music pill on camera view - top centered (only shown in camera mode) */}
                {cameraMusic && previewMode === "camera" ? (
                    <TouchableOpacity
                        style={styles.musicPillContainer}
                        onPress={clearCameraMusic}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.musicPill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                            <Ionicons name="musical-notes" size={14} color="#fff" />
                            <Text style={styles.musicPillText} numberOfLines={1} ellipsizeMode="tail">
                                {cameraMusic.title}{cameraMusic.artist ? ` • ${cameraMusic.artist}` : ''}
                            </Text>
                            <TouchableOpacity onPress={clearCameraMusic} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ) : null}

                {/* filter rail relocated into the previewSurface overlays */}

                {/* top header removed per request (back/close + title) */}

                {previewMode === "camera" ? (
                    <View style={[styles.cameraSideControls, { bottom: bottomClearance + 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }]}> 
                        {/* Camera zoom controls (rear only) */}
                        {cameraType === "back" && (
                            <View style={styles.zoomControlRow}>
                                {(() => {
                                    const targets = zoomMultipliers
                                        .map((m) => ({ m, t: multiplierToZoom(m) }))
                                        .filter(({ m }) => m >= minMultiplier && m <= maxMultiplier);

                                    if (!targets.length) return null;

                                    // Find closest target to current cameraZoom
                                    let bestIdx = 0;
                                    let bestDiff = Math.abs(cameraZoom - targets[0].t);
                                    for (let i = 1; i < targets.length; i++) {
                                        const d = Math.abs(cameraZoom - targets[i].t);
                                        if (d < bestDiff - 1e-6) {
                                            bestDiff = d;
                                            bestIdx = i;
                                        } else if (Math.abs(d - bestDiff) < 1e-6) {
                                            // tie -> prefer multiplier closer to 1x
                                            const curDelta = Math.abs(targets[bestIdx].m - 1);
                                            const nextDelta = Math.abs(targets[i].m - 1);
                                            if (nextDelta < curDelta) bestIdx = i;
                                        }
                                    }

                                    return targets.map(({ m }, idx) => (
                                        <TouchableOpacity
                                            key={m}
                                            style={[styles.zoomBtn, idx === bestIdx && styles.zoomBtnActive]}
                                            onPress={() => setCameraZoomAnimated(m)}
                                        >
                                            <Text style={{ color: idx === bestIdx ? '#000' : 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 13 }}>
                                                {m === 0.5 ? '.5' : m}x
                                            </Text>
                                        </TouchableOpacity>
                                    ));
                                })()}
                            </View>
                        )}
                    </View>
                ) : null}

                {previewMode === "camera" ? (
                    <View style={[styles.snapBottomRow, { bottom: insets.bottom + 36 }]}>
                        <TouchableOpacity style={[styles.snapGhostBtn, { transform: [{ translateY: -8 }] }]} onPress={openMediaImporter}>
                            <Ionicons name="image" size={22} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.captureButtonGroup}>
                            <View style={[styles.captureModes, { marginBottom: 8 }]}>
                                {(["photo", "video"] as const).map((mode) => (
                                    <TouchableOpacity
                                        key={mode}
                                        onPress={() => setCameraMode(mode)}
                                        style={[styles.captureModeBtn, cameraMode === mode && styles.captureModeBtnActive]}
                                    >
                                        <Text style={[styles.captureModeLabel, cameraMode === mode && styles.captureModeLabelActive]}>{mode.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity
                                onPress={handleCapturePress}
                                disabled={captureDisabled}
                                style={[
                                    styles.captureButton,
                                    cameraMode === "video" && styles.captureButtonVideo,
                                    isRecording && styles.captureButtonRecording,
                                    captureDisabled && styles.captureButtonDisabled,
                                ]}
                            >
                                {isRecording ? (
                                    <View style={[styles.captureInner, isRecording && styles.captureInnerRecording]} />
                                ) : (
                                    <View style={styles.captureInnerContainer}>
                                        <View style={styles.captureInnerFallback} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                        <View style={styles.snapGhostPlaceholder} />
                    </View>
                ) : null}
            </View>

            {/* removed informational tip under the media container per request */}

            <View
                style={[
                    styles.bottomBar,
                    {
                        borderTopColor: theme.hair,
                        backgroundColor: theme.bg,
                        paddingBottom: 14 + insets.bottom,
                    },
                ]}
            > 
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    disabled={queueing}
                    activeOpacity={0.8}
                    onPress={handleProceedToUpload}
                    style={[(proceedBlockReason && !queueing) && styles.disabledBtn]}
                >
                    <LinearGradient
                        colors={[...GRADIENTS.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.postBtn}
                    >
                        <Text style={styles.postText}>{queueing ? "Preparing…" : "Next"}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <MediaImporter
                visible={mediaImporterVisible}
                onClose={() => setMediaImporterVisible(false)}
                onSelect={handleImportedAsset}
                allowVideos
                title="Studio Library"
            />

            <PhotoEditorModal
                visible={photoEditorVisible}
                asset={photoEditorState?.asset ?? null}
                mode="cover"
                onCancel={() => {
                    setPhotoEditorVisible(false);
                    setPhotoEditorState(null);
                }}
                onApply={handlePhotoApply}
                aspectPresetsOverride={STORY_ASPECT_PRESETS}
                desiredWidth={1080}
                desiredHeight={1920}
                title="Story Photo"
            />

            {/* stickers removed */}

            <BottomSheetModal
                ref={musicSheetRef}
                snapPoints={musicSnapPoints}
                backdropComponent={sheetBackdrop}
                enablePanDownToClose
                onDismiss={handleMusicSheetDismiss}
                backgroundStyle={{ 
                    backgroundColor: theme.isDark ? 'rgba(20,20,28,0.98)' : 'rgba(255,255,255,0.98)',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    elevation: 20,
                }}
                handleIndicatorStyle={{ 
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                }}
            >
                <View style={{ flex: 1 }}>
                    {/* Header with title */}
                    <View style={styles.musicSheetHeader}>
                        <Text style={[styles.musicSheetTitle, { color: theme.text }]}>Sounds</Text>
                    </View>
                    
                    {/* Tabs */}
                    <View style={[styles.musicTabs, { borderBottomColor: theme.hair }]}>
                        {(['foryou', 'trending', 'recent'] as const).map((tab) => {
                            const isActive = musicTab === tab;
                            const label = tab === 'foryou' ? 'For You' : tab === 'trending' ? 'Trending' : 'Recent';
                            return (
                                <TouchableOpacity
                                    key={tab}
                                    style={[
                                        styles.musicTab,
                                        isActive ? { borderBottomColor: theme.accent, borderBottomWidth: 2 } : undefined
                                    ]}
                                    onPress={() => setMusicTab(tab)}
                                >
                                    <Text style={[
                                        styles.musicTabText,
                                        { color: isActive ? theme.text : theme.muted }
                                    ]}>
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    
                    {soundtracksLoading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                            <ActivityIndicator size="large" color={theme.accent} />
                            <Text style={{ color: theme.muted, marginTop: 12 }}>Loading sounds...</Text>
                        </View>
                    ) : filteredSoundtracks.length === 0 ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                            <Ionicons name="musical-notes-outline" size={48} color={theme.muted} />
                            <Text style={{ color: theme.muted, marginTop: 12 }}>
                                {musicTab === 'recent' ? 'No recent sounds' : 'No sounds available'}
                            </Text>
                        </View>
                    ) : (
                    <BottomSheetFlatList
                        data={filteredSoundtracks}
                        keyExtractor={(item: Soundtrack) => item.id}
                        contentContainerStyle={{ paddingBottom: previewingTrack ? 70 : 20, paddingTop: 8 }}
                        ListHeaderComponent={
                            musicTab === 'foryou' && trendingTracks.length > 0 && trendingTracks[trendingScrollIndex]?.artwork_url ? (
                                <TouchableOpacity
                                    activeOpacity={0.95}
                                    style={styles.trendingCarousel}
                                    onPress={() => {
                                        const track = trendingTracks[trendingScrollIndex];
                                        if (track) handleTogglePreview(track);
                                    }}
                                >
                                    <Image 
                                        source={{ uri: trendingTracks[trendingScrollIndex].artwork_url! }} 
                                        style={styles.trendingArtwork}
                                    />
                                    {/* Dots indicator */}
                                    <View style={styles.trendingDots}>
                                        {trendingTracks.map((_, idx) => (
                                            <View 
                                                key={idx} 
                                                style={[
                                                    styles.trendingDot,
                                                    idx === trendingScrollIndex && styles.trendingDotActive
                                                ]} 
                                            />
                                        ))}
                                    </View>
                                </TouchableOpacity>
                            ) : null
                        }
                        renderItem={({ item }: { item: Soundtrack }) => {
                            const isPlaying = previewPlayingId === item.id;
                            const isLoading = musicLoadingId === item.id;
                            const isSelected = cameraMusic?.id === item.id;
                            
                            return (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    style={styles.trackRow}
                                    onPress={() => handleTogglePreview(item)}
                                >
                                    {/* Small artwork */}
                                    {item.artwork_url ? (
                                        <Image 
                                            source={{ uri: item.artwork_url }} 
                                            style={styles.trackArtworkSmall}
                                        />
                                    ) : (
                                        <View style={[styles.trackArtworkSmall, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' }]}>
                                            <Ionicons name="musical-notes" size={16} color={theme.accent} />
                                        </View>
                                    )}
                                    
                                    {/* Track info */}
                                    <View style={styles.trackInfo}>
                                        <Text style={[styles.trackTitle, { color: theme.text }]} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                        <Text style={[styles.trackArtist, { color: theme.muted }]} numberOfLines={1}>
                                            {item.artist_name || 'Unknown Artist'}
                                        </Text>
                                    </View>
                                    
                                    {/* Wave visualization when playing */}
                                    {isPlaying && !isLoading ? (
                                        <View style={styles.waveContainer}>
                                            {[1, 2, 3, 4].map((bar) => (
                                                <View 
                                                    key={bar} 
                                                    style={[
                                                        styles.waveBar, 
                                                        { 
                                                            backgroundColor: theme.accent,
                                                            height: 8 + (bar % 3) * 6,
                                                        }
                                                    ]} 
                                                />
                                            ))}
                                        </View>
                                    ) : isLoading ? (
                                        <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 8 }} />
                                    ) : isSelected ? (
                                        <Ionicons name="checkmark-circle" size={20} color={theme.accent} style={{ marginRight: 8 }} />
                                    ) : null}
                                </TouchableOpacity>
                            );
                        }}
                    />
                    )}
                    
                    {/* Bottom playback bar - shown when previewing */}
                    {previewingTrack ? (
                        <View style={[styles.playbackBar, { backgroundColor: theme.isDark ? '#000' : '#fff', borderTopColor: theme.hair }]}>
                            {/* Artwork on left */}
                            {previewingTrack.artwork_url ? (
                                <Image 
                                    source={{ uri: previewingTrack.artwork_url }} 
                                    style={styles.playbackArtwork}
                                />
                            ) : (
                                <View style={[styles.playbackArtwork, { backgroundColor: theme.accent + '30', alignItems: 'center', justifyContent: 'center' }]}>
                                    <Ionicons name="musical-notes" size={14} color={theme.accent} />
                                </View>
                            )}
                            
                            {/* Spacer */}
                            <View style={{ flex: 1 }} />
                            
                            {/* Play/Pause button */}
                            <TouchableOpacity
                                style={styles.playbackControlBtn}
                                onPress={() => handleTogglePreview(previewingTrack)}
                            >
                                <Ionicons 
                                    name={previewPlayingId === previewingTrack.id ? "pause" : "play"} 
                                    size={26} 
                                    color={theme.text} 
                                />
                            </TouchableOpacity>
                            
                            {/* Use this sound button (arrow) - bold accent button */}
                            <TouchableOpacity
                                style={[styles.useSoundBtn, { backgroundColor: theme.accent }]}
                                onPress={() => handleUseSound(previewingTrack)}
                            >
                                <Ionicons name="arrow-forward" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    
                    {/* Clear selection button - only show if music selected and not previewing */}
                    {cameraMusic && !previewingTrack ? (
                        <View style={[styles.clearBtnWrap, { borderTopColor: theme.hair, backgroundColor: theme.card }]}>
                            <TouchableOpacity 
                                style={[styles.clearBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]} 
                                onPress={clearCameraMusic}
                            >
                                <Ionicons name="close" size={18} color={theme.accent} />
                                <Text style={{ color: theme.accent, fontWeight: "700", marginLeft: 8 }}>Clear selection</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </BottomSheetModal>

            {/* Sticker Sheet */}
            <BottomSheetModal
                ref={stickerSheetRef}
                snapPoints={stickerSnapPoints}
                backdropComponent={sheetBackdrop}
                enablePanDownToClose
                backgroundStyle={{ 
                    backgroundColor: theme.isDark ? 'rgba(20,20,28,0.98)' : 'rgba(255,255,255,0.98)',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    elevation: 20,
                }}
                handleIndicatorStyle={{ 
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                }}
            >
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.stickerSheetHeader}>
                        <Text style={[styles.stickerSheetTitle, { color: theme.text }]}>Stickers</Text>
                        <Text style={[styles.stickerSheetSubtitle, { color: theme.muted }]}>Tap to add, long press to remove</Text>
                    </View>
                    
                    {/* Category tabs */}
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.stickerCategoryTabs}
                    >
                        {[
                            { id: 'all', label: 'All', icon: 'grid' },
                            { id: 'action', label: 'Action', icon: 'flash' },
                            { id: 'reaction', label: 'Reaction', icon: 'heart' },
                            { id: 'mood', label: 'Mood', icon: 'happy' },
                            { id: 'time', label: 'Time', icon: 'time' },
                            { id: 'social', label: 'Social', icon: 'people' },
                            { id: 'shopping', label: 'Shop', icon: 'cart' },
                        ].map((cat) => {
                            const isActive = stickerCategory === cat.id;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.stickerCategoryTab,
                                        isActive ? { backgroundColor: theme.accent } : undefined
                                    ]}
                                    onPress={() => setStickerCategory(cat.id as any)}
                                >
                                    <Ionicons 
                                        name={cat.icon as any} 
                                        size={16} 
                                        color={isActive ? '#fff' : theme.muted} 
                                    />
                                    <Text style={[
                                        styles.stickerCategoryLabel,
                                        { color: isActive ? '#fff' : theme.muted }
                                    ]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    
                    {/* Stickers grid */}
                    <BottomSheetFlatList
                        data={filteredStickers}
                        keyExtractor={(item: StorySticker) => item.id}
                        numColumns={3}
                        contentContainerStyle={styles.stickerGrid}
                        renderItem={({ item }: { item: StorySticker }) => (
                            <TouchableOpacity
                                style={styles.stickerGridItem}
                                onPress={() => handleAddSticker(item)}
                                activeOpacity={0.7}
                            >
                                <StickerView sticker={item} size="small" />
                            </TouchableOpacity>
                        )}
                    />
                    
                    {/* Selected stickers count */}
                    {selectedStickers.length > 0 && (
                        <View style={[styles.stickerCountBar, { backgroundColor: theme.card, borderTopColor: theme.hair }]}>
                            <Text style={{ color: theme.muted, fontSize: 13 }}>
                                {selectedStickers.length} sticker{selectedStickers.length !== 1 ? 's' : ''} added
                            </Text>
                            <TouchableOpacity onPress={() => setSelectedStickers([])}>
                                <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 13 }}>Clear all</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </BottomSheetModal>

            {/* Tag Sheet */}
            <BottomSheetModal
                ref={tagSheetRef}
                snapPoints={tagSnapPoints}
                backdropComponent={sheetBackdrop}
                enablePanDownToClose
                backgroundStyle={{ 
                    backgroundColor: theme.isDark ? 'rgba(20,20,28,0.98)' : 'rgba(255,255,255,0.98)',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    elevation: 20,
                }}
                handleIndicatorStyle={{ 
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                }}
            >
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.stickerSheetHeader}>
                        <Text style={[styles.stickerSheetTitle, { color: theme.text }]}>Tag People</Text>
                        <Text style={[styles.stickerSheetSubtitle, { color: theme.muted }]}>Search and tap to add, long press to remove</Text>
                    </View>
                    
                    {/* Search input */}
                    <View style={[styles.tagSearchContainer, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                        <Ionicons name="search" size={18} color={theme.muted} />
                        <TextInput
                            style={[styles.tagSearchInput, { color: theme.text }]}
                            placeholder="Search username..."
                            placeholderTextColor={theme.muted}
                            value={tagSearchQuery}
                            onChangeText={setTagSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {tagSearchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setTagSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color={theme.muted} />
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    {/* Search results */}
                    {tagSearchLoading ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator color={theme.accent} />
                        </View>
                    ) : tagSearchResults.length > 0 ? (
                        <BottomSheetFlatList
                            data={tagSearchResults}
                            keyExtractor={(item: { id: string; username: string; display_name?: string; avatar_url?: string }) => item.id}
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item }: { item: { id: string; username: string; display_name?: string; avatar_url?: string } }) => (
                                <TouchableOpacity
                                    style={styles.tagUserRow}
                                    onPress={() => addTaggedUser(item)}
                                    activeOpacity={0.7}
                                >
                                    {item.avatar_url ? (
                                        <Image 
                                            source={{ uri: item.avatar_url }} 
                                            style={styles.tagUserAvatar} 
                                        />
                                    ) : (
                                        <View style={[styles.tagUserAvatar, { backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }]}>
                                            <Ionicons name="person" size={18} color="#fff" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.tagUserName, { color: theme.text }]}>
                                            @{item.username}
                                        </Text>
                                        {item.display_name && (
                                            <Text style={[styles.tagUserDisplayName, { color: theme.muted }]}>
                                                {item.display_name}
                                            </Text>
                                        )}
                                    </View>
                                    <Ionicons name="add-circle" size={22} color={theme.accent} />
                                </TouchableOpacity>
                            )}
                        />
                    ) : tagSearchQuery.length >= 2 ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Ionicons name="person-outline" size={40} color={theme.muted} />
                            <Text style={{ color: theme.muted, marginTop: 8 }}>No users found</Text>
                        </View>
                    ) : (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Ionicons name="at" size={40} color={theme.muted} />
                            <Text style={{ color: theme.muted, marginTop: 8 }}>Type at least 2 characters to search</Text>
                        </View>
                    )}
                    
                    {/* Tagged users count */}
                    {taggedUsers.length > 0 && (
                        <View style={[styles.stickerCountBar, { backgroundColor: theme.card, borderTopColor: theme.hair }]}>
                            <Text style={{ color: theme.muted, fontSize: 13 }}>
                                {taggedUsers.length} user{taggedUsers.length !== 1 ? 's' : ''} tagged
                            </Text>
                            <TouchableOpacity onPress={() => setTaggedUsers([])}>
                                <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 13 }}>Clear all</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </BottomSheetModal>

            {/* Text Editor Modal - Full Screen Instagram Style */}
            {isAddingText && (
                <KeyboardAvoidingView 
                    style={styles.textEditorFullScreen}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={0}
                >
                    {/* Full screen media background */}
                    <View style={StyleSheet.absoluteFill}>
                        {activeMedia && (
                            <>
                                <Image 
                                    source={{ uri: activeMedia.uri }} 
                                    style={StyleSheet.absoluteFill}
                                    resizeMode="cover"
                                    blurRadius={2}
                                />
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
                            </>
                        )}
                    </View>

                    {/* Top bar with Done button */}
                    <View style={styles.textEditorTopBar}>
                        <TouchableOpacity 
                            style={styles.textEditorUndoBtn}
                            onPress={undoText}
                            disabled={textUndoStack.length === 0}
                        >
                            <Ionicons name="arrow-undo" size={22} color={textUndoStack.length > 0 ? '#fff' : 'rgba(255,255,255,0.3)'} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.textEditorUndoBtn}
                            onPress={redoText}
                            disabled={textRedoStack.length === 0}
                        >
                            <Ionicons name="arrow-redo" size={22} color={textRedoStack.length > 0 ? '#fff' : 'rgba(255,255,255,0.3)'} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity 
                            style={styles.textEditorDoneTopBtn}
                            onPress={addTextOverlay}
                        >
                            <Text style={styles.textEditorDoneTopText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Live text preview in center - editable area */}
                    <View style={styles.textEditorCanvasArea}>
                        <View style={[
                            styles.textEditorLiveText,
                            { 
                                transform: [{ scale: newTextScale }],
                                alignItems: newTextAlignment === 'left' ? 'flex-start' : newTextAlignment === 'right' ? 'flex-end' : 'center',
                            }
                        ]}>
                            {newTextBgColor !== 'transparent' && newTextValue.length > 0 && (
                                <View style={[
                                    styles.textEditorTextBg,
                                    { backgroundColor: newTextBgColor }
                                ]} />
                            )}
                            <TextInput
                                ref={textInputRef}
                                style={[
                                    styles.textEditorInlineInput,
                                    {
                                        color: newTextColor,
                                        fontWeight: FONT_STYLES.find(f => f.id === newTextStyle)?.fontWeight || '600',
                                        fontStyle: newTextStyle === 'classic' ? 'italic' : 'normal',
                                        fontFamily: newTextStyle === 'typewriter' ? 'monospace' : undefined,
                                        letterSpacing: newTextStyle === 'signature' ? 2 : 0,
                                        textAlign: newTextAlignment,
                                        textShadowColor: newTextHasShadow ? 'rgba(0,0,0,0.8)' : (newTextStyle === 'neon' ? newTextColor : 'transparent'),
                                        textShadowOffset: newTextHasShadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
                                        textShadowRadius: newTextHasShadow ? 4 : (newTextStyle === 'neon' ? 15 : 0),
                                    },
                                    newTextHasStroke ? {
                                        textShadowColor: '#000',
                                        textShadowOffset: { width: 0, height: 0 },
                                        textShadowRadius: 2,
                                    } : undefined
                                ]}
                                placeholder="Type something..."
                                placeholderTextColor="rgba(255,255,255,0.5)"
                                value={newTextValue}
                                onChangeText={handleTextChange}
                                multiline
                                maxLength={150}
                                autoFocus
                                textAlignVertical="center"
                            />
                        </View>
                        
                        {/* Scale slider on left side */}
                        <View style={styles.textEditorScaleSlider}>
                            <View style={styles.textEditorScaleTrack}>
                                <View style={[styles.textEditorScaleFill, { height: `${((newTextScale - 0.5) / 2) * 100}%` }]} />
                            </View>
                            <View style={styles.textEditorScaleButtons}>
                                <TouchableOpacity onPress={() => setNewTextScale(s => Math.min(s + 0.1, 2.5))}>
                                    <Ionicons name="add" size={18} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setNewTextScale(s => Math.max(s - 0.1, 0.5))}>
                                    <Ionicons name="remove" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Font style pills - above toolbar */}
                    <View style={styles.textEditorFontPills}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                            {FONT_STYLES.map((font) => (
                                <TouchableOpacity
                                    key={font.id}
                                    style={[
                                        styles.textEditorFontPill,
                                        newTextStyle === font.id && styles.textEditorFontPillActive,
                                    ]}
                                    onPress={() => {
                                        setNewTextStyle(font.id as any);
                                        Haptics.selectionAsync().catch(() => {});
                                    }}
                                >
                                    <Text style={[
                                        styles.textEditorFontPillText,
                                        { 
                                            fontWeight: font.fontWeight,
                                            fontStyle: font.id === 'classic' ? 'italic' : 'normal',
                                            fontFamily: font.fontFamily,
                                        },
                                        newTextStyle === font.id && styles.textEditorFontPillTextActive,
                                    ]}>
                                        {font.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Formatting toolbar - above keyboard */}
                    <View style={styles.textEditorToolbar}>
                        {/* Main formatting row */}
                        <View style={styles.textEditorToolbarRow}>
                            {/* Text size toggle */}
                            <TouchableOpacity 
                                style={styles.textEditorToolBtn}
                                onPress={() => setNewTextScale(s => s >= 1.5 ? 0.8 : s + 0.25)}
                            >
                                <Text style={styles.textEditorToolBtnAa}>Aa</Text>
                            </TouchableOpacity>

                            {/* Color picker */}
                            <TouchableOpacity 
                                style={[styles.textEditorColorBtn, { backgroundColor: newTextColor }]}
                                onPress={() => {
                                    const currentIdx = TEXT_COLORS.indexOf(newTextColor);
                                    const nextIdx = (currentIdx + 1) % TEXT_COLORS.length;
                                    setNewTextColor(TEXT_COLORS[nextIdx]);
                                    Haptics.selectionAsync().catch(() => {});
                                }}
                            />

                            {/* Stroke toggle */}
                            <TouchableOpacity 
                                style={[styles.textEditorToolBtn, newTextHasStroke && styles.textEditorToolBtnActive]}
                                onPress={() => {
                                    setNewTextHasStroke(v => !v);
                                    Haptics.selectionAsync().catch(() => {});
                                }}
                            >
                                <Text style={[styles.textEditorToolBtnText, { fontWeight: '800' }]}>A</Text>
                                <View style={styles.textEditorStrokeIndicator} />
                            </TouchableOpacity>

                            {/* Shadow/effect toggle */}
                            <TouchableOpacity 
                                style={[styles.textEditorToolBtn, newTextHasShadow && styles.textEditorToolBtnActive]}
                                onPress={() => {
                                    setNewTextHasShadow(v => !v);
                                    Haptics.selectionAsync().catch(() => {});
                                }}
                            >
                                <Text style={[styles.textEditorToolBtnText, { textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }]}>A</Text>
                            </TouchableOpacity>

                            {/* Alignment toggle */}
                            <TouchableOpacity 
                                style={styles.textEditorToolBtn}
                                onPress={() => {
                                    const alignments: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
                                    const currentIdx = alignments.indexOf(newTextAlignment);
                                    const nextIdx = (currentIdx + 1) % alignments.length;
                                    setNewTextAlignment(alignments[nextIdx]);
                                    Haptics.selectionAsync().catch(() => {});
                                }}
                            >
                                <Ionicons 
                                    name={newTextAlignment === 'left' ? 'menu' : newTextAlignment === 'right' ? 'menu' : 'menu'} 
                                    size={20} 
                                    color="#fff" 
                                    style={{ transform: [{ scaleX: newTextAlignment === 'right' ? -1 : 1 }] }}
                                />
                            </TouchableOpacity>

                            {/* Background toggle */}
                            <TouchableOpacity 
                                style={[styles.textEditorToolBtn, newTextBgColor !== 'transparent' ? styles.textEditorToolBtnActive : undefined]}
                                onPress={() => {
                                    const currentIdx = TEXT_BG_COLORS.indexOf(newTextBgColor);
                                    const nextIdx = (currentIdx + 1) % TEXT_BG_COLORS.length;
                                    setNewTextBgColor(TEXT_BG_COLORS[nextIdx]);
                                    Haptics.selectionAsync().catch(() => {});
                                }}
                            >
                                <View style={[styles.textEditorBgIcon, newTextBgColor !== 'transparent' ? { backgroundColor: newTextBgColor } : undefined]}>
                                    <Text style={{ color: newTextBgColor !== 'transparent' ? '#000' : '#fff', fontWeight: '700', fontSize: 12 }}>A</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Action chips row */}
                        <View style={styles.textEditorChipsRow}>
                            {/* Chips removed as requested */}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    snapCameraShell: {
        flexGrow: 1,
        flexBasis: 0,
        width: SCREEN_W,
        maxWidth: SCREEN_W,
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 12,
        alignSelf: "center",
        backgroundColor: "#000",
    },
    zoomControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        gap: 8,
    },
    zoomBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginHorizontal: 4,
        minWidth: 44,
        alignItems: 'center',
    },
    zoomBtnActive: {
        backgroundColor: VELT_ACCENT,
    },
    ratioBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
        marginLeft: 12,
    },
    cameraDenied: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
    cameraDeniedText: { color: "#fff", textAlign: "center", marginTop: 12 },
    cameraPreparing: { flex: 1, alignItems: "center", justifyContent: "center" },
    snapTopGradient: { position: "absolute", left: 0, right: 0, top: 0, height: 180 },
    snapBottomGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 220 },
    snapTopRow: {
        position: "absolute",
        top: 12,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    iconPill: { 
        width: 40, 
        height: 40, 
        borderRadius: 20, 
        backgroundColor: "rgba(0,0,0,0.5)", 
        alignItems: "center", 
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    cameraTitle: { color: "#fff", fontWeight: "800", fontSize: 16, textTransform: "uppercase", letterSpacing: 1 },
    cameraSideControls: {
        position: "absolute",
        right: 16,
        bottom: 130,
        flexDirection: "column",
        gap: 12,
    },
    sideControlBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.35)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.2)",
    },
    snapBottomRow: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
    },
    snapGhostBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    snapGhostPlaceholder: { width: 48, height: 48 },
    captureButtonGroup: { alignItems: "center" },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    captureButtonVideo: { borderColor: "#ff3b5c" },
    captureButtonRecording: { borderColor: "#ff2d55", backgroundColor: "rgba(255,45,85,0.1)" },
    captureButtonDisabled: { opacity: 0.4 },
    captureInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" },
    captureInnerRecording: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#ff2d55" },
    captureModes: { flexDirection: "row", alignItems: "center", borderRadius: 24, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 4, paddingVertical: 2 },
    captureModeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    captureModeBtnActive: { backgroundColor: VELT_ACCENT },
    captureModeLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 12 },
    captureModeLabelActive: { color: "#000" },
    previewBackBtn: {
        position: "absolute",
        top: 16,
        left: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    // New top bar for preview mode - aligns back button with crop/delete
    previewTopBar: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 10,
    },
    previewBackBtnInline: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.4)",
        alignItems: "center",
        justifyContent: "center",
    },
    cropResetBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(245,183,0,0.9)",
        alignItems: "center",
        justifyContent: "center",
    },
    pinchHint: {
        position: 'absolute',
        bottom: 200,
        left: 0,
        right: 0,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    pinchHintText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '600',
    },
    badge: { backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, alignSelf: "flex-start", margin: 12 },
    badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
    zoomIndicator: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    zoomIndicatorText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    previewSurface: { flex: 1, minHeight: MEDIA_AREA_HEIGHT, alignItems: 'center', justifyContent: 'center' },
    heroActions: { position: "absolute", right: 16, top: 16, flexDirection: "row", gap: 8 },
    heroActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(0,0,0,0.4)",
        alignItems: "center",
        justifyContent: "center",
    },
    previewThumbScroller: { position: "absolute", left: 0, right: 0, bottom: 16 },
    previewThumbRow: { paddingHorizontal: 16, gap: 10 },
    previewThumb: { width: 68, height: 68, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
    previewThumbActive: { borderColor: "#f5b700" },
    previewThumbBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    previewSticker: { position: "absolute" },
    filterBadge: {
        position: "absolute",
        left: 18,
        top: 18,
        backgroundColor: "rgba(0,0,0,0.35)",
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    filterBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
    overlayActionColumn: {
        position: "absolute",
        right: 12,
        top: 80,
        gap: 12,
        alignItems: "center",
    },
    overlayActionRow: {
        position: "absolute",
        left: 16,
        right: 16,
        top: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    topControlsRow: {
        position: "absolute",
        left: 16,
        right: 16,
        top: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    overlayBtn: {
        backgroundColor: "rgba(0,0,0,0.4)",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        minWidth: 74,
    },
    overlayBtnOval: {
        backgroundColor: "rgba(0,0,0,0.5)",
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    overlayBtnLabel: { color: "#fff", fontWeight: "700", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
    musicBadge: {
        position: "absolute",
        left: 20,
        bottom: 210,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6,
    },
    musicBadgeTitle: { fontWeight: "700", fontSize: 12 },
    musicBadgeArtist: { fontSize: 11 },
    // New music pill styles - top centered
    musicPillContainer: {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
        transform: [{ translateY: -20 }],
    },
    musicPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 24,
        maxWidth: 220,
        gap: 8,
    },
    musicPillText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
        maxWidth: 150,
    },
    // Filter swipe styles
    filterSwipeContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 100,
        height: 90,
    },
    filterSwipeContent: {
        paddingHorizontal: (SCREEN_W - 80) / 2,
        alignItems: 'center',
    },
    filterSwipeItem: {
        width: 80,
        alignItems: 'center',
        opacity: 0.7,
    },
    filterSwipeItemActive: {
        opacity: 1,
    },
    filterSwipePreview: {
        width: 56,
        height: 56,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    filterSwipePreviewActive: {
        borderColor: '#fff',
        transform: [{ scale: 1.08 }],
    },
    filterSwipeImage: {
        width: '100%',
        height: '100%',
    },
    filterSwipeLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 6,
        textAlign: 'center',
    },
    filterSwipeLabelActive: {
        color: '#fff',
    },
    tipCard: { margin: 16, marginTop: 12, borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "flex-start" },
    tipTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
    tipDismissBtn: { padding: 6, marginLeft: 12, borderRadius: 16 },
    filterRailWrap: { position: "absolute", left: 0, right: 0, bottom: 120, paddingVertical: 6 },
    filterRailOverlay: { position: "absolute", left: 0, right: 0, bottom: 20, alignItems: "center" },
    filterRailContent: { paddingHorizontal: 24, gap: 10, alignItems: "center" },
    filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)" },
    filterChipActive: { backgroundColor: "#f5b700" },
    filterChipLabel: { color: "#fff", fontWeight: "700", fontSize: 12 },
    filterChipLabelActive: { color: "#000" },
    filterThumbWrap: { width: 60, height: 60, borderRadius: 30, overflow: "hidden", marginHorizontal: 6, borderWidth: 2, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
    filterThumbActive: { borderColor: "#f5b700", transform: [{ scale: 1.05 }] },
    filterThumbImage: { width: 56, height: 56, borderRadius: 28 },
    filterThumbPlaceholder: { width: 56, height: 56, borderRadius: 28 },
    captureInnerImage: { width: 54, height: 54, borderRadius: 27 },
    captureInnerContainer: { width: 54, height: 54, borderRadius: 27, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
    captureInnerFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff" },
    filterCenterGuide: {
        position: "absolute",
        left: "50%",
        bottom: 6,
        marginLeft: -12,
        width: 24,
        height: 3,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.35)",
    },
    bottomBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    addButton: { flexDirection: "row", alignItems: "center" },
    postBtn: { marginLeft: 12, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 28, minWidth: 110, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    postText: { color: "#000", fontWeight: "800", fontSize: 15 },
    disabledBtn: { opacity: 0.4 },
    blockHelper: { textAlign: "right", marginRight: 16, marginTop: 6, color: "#aaa", fontSize: 12 },
    sheetHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    sheetTitle: { fontSize: 18, fontWeight: "800" },
    sheetSubtitle: { fontSize: 13, marginTop: 2 },
    sheetList: { paddingVertical: 16, paddingHorizontal: 16, gap: 14 },
    stickerCell: {
        flex: 1,
        maxWidth: 70,
        alignItems: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        padding: 10,
        gap: 6,
    },
    stickerImage: { width: 38, height: 38 },
    stickerLabel: { fontSize: 11, textAlign: "center" },
    musicRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    musicRowMeta: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    // New music sheet styles - enhanced with glassmorphism
    musicSheetHeader: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    musicSheetTitle: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    musicTabs: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
        gap: 4,
    },
    musicTab: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        marginRight: 6,
        borderRadius: 20,
    },
    musicTabText: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    // Trending carousel styles - enhanced
    trendingCarousel: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
        height: 120,
        backgroundColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    trendingArtwork: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    trendingDots: {
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    trendingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    trendingDotActive: {
        backgroundColor: '#fff',
        width: 24,
    },
    // Legacy featured styles (kept for reference)
    featuredCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    featuredArtwork: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    featuredInfo: {
        flex: 1,
        marginLeft: 12,
    },
    featuredLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    featuredTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#000',
        marginTop: 2,
    },
    featuredArtist: {
        fontSize: 12,
        color: '#666',
        marginTop: 1,
    },
    featuredPlayBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 8,
        marginVertical: 2,
        borderRadius: 14,
    },
    trackArtworkSmall: {
        width: 48,
        height: 48,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    trackInfo: {
        flex: 1,
        marginLeft: 14,
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    trackArtist: {
        fontSize: 13,
        marginTop: 3,
        opacity: 0.7,
    },
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginRight: 8,
    },
    waveBar: {
        width: 3,
        borderRadius: 2,
    },
    playbackBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    playbackArtwork: {
        width: 36,
        height: 36,
        borderRadius: 8,
    },
    playbackInfo: {
        flex: 1,
        marginLeft: 12,
    },
    playbackTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    playbackArtist: {
        fontSize: 13,
        marginTop: 2,
    },
    playbackControlBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    useSoundBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    // Legacy styles kept for compatibility
    galleryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    musicRowEnhanced: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        padding: 12,
        overflow: 'hidden',
    },
    musicRowMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trackArtwork: {
        width: 52,
        height: 52,
        borderRadius: 10,
    },
    previewBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playingBar: {
        height: 3,
        borderRadius: 2,
        marginTop: 10,
        overflow: 'hidden',
    },
    playingBarInner: {
        height: '100%',
        width: '30%',
        borderRadius: 2,
    },
    clearBtnWrap: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    // Video loading state
    videoLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoDurationBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    videoDurationText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    // Sticker styles
    stickerOnPreview: {
        position: 'absolute',
        zIndex: 50,
    },
    stickerSheetHeader: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 12,
    },
    stickerSheetTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    stickerSheetSubtitle: {
        fontSize: 13,
        marginTop: 4,
    },
    stickerCategoryTabs: {
        paddingHorizontal: 12,
        paddingBottom: 12,
        gap: 8,
    },
    stickerCategoryTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
        gap: 6,
    },
    stickerCategoryLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    stickerGrid: {
        paddingHorizontal: 12,
        paddingBottom: 20,
    },
    stickerGridItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        minHeight: 60,
    },
    stickerCountBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    // Tag search styles
    tagSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    tagSearchInput: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 0,
    },
    tagUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
    },
    tagUserAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    tagUserName: {
        fontSize: 15,
        fontWeight: '600',
    },
    tagUserDisplayName: {
        fontSize: 13,
        marginTop: 1,
    },
    // Text editor styles - Full Screen Instagram Style
    textEditorFullScreen: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        zIndex: 1000,
    },
    textEditorTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingBottom: 12,
        gap: 12,
    },
    textEditorUndoBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textEditorDoneTopBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderRadius: 20,
    },
    textEditorDoneTopText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 15,
    },
    textEditorCanvasArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    textEditorLiveText: {
        width: SCREEN_W - 80,
        minHeight: 60,
        justifyContent: 'center',
        position: 'relative',
    },
    textEditorTextBg: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 8,
        margin: -10,
    },
    textEditorInlineInput: {
        fontSize: 32,
        padding: 10,
        textAlignVertical: 'center',
        minHeight: 50,
    },
    textEditorScaleSlider: {
        position: 'absolute',
        left: 16,
        top: '30%',
        height: 120,
        width: 30,
        alignItems: 'center',
        gap: 8,
    },
    textEditorScaleTrack: {
        width: 4,
        height: 80,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    textEditorScaleFill: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    textEditorScaleButtons: {
        gap: 8,
    },
    textEditorFontPills: {
        paddingVertical: 12,
    },
    textEditorFontPill: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginRight: 8,
    },
    textEditorFontPillActive: {
        backgroundColor: '#fff',
    },
    textEditorFontPillText: {
        color: '#fff',
        fontSize: 14,
    },
    textEditorFontPillTextActive: {
        color: '#000',
    },
    textEditorToolbar: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 30 : 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    textEditorToolbarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    textEditorToolBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textEditorToolBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    textEditorToolBtnAa: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    textEditorToolBtnText: {
        color: '#fff',
        fontSize: 18,
    },
    textEditorColorBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#fff',
    },
    textEditorStrokeIndicator: {
        position: 'absolute',
        bottom: 8,
        width: 16,
        height: 2,
        backgroundColor: '#fff',
        borderRadius: 1,
    },
    textEditorBgIcon: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    textEditorChipsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 20,
    },
    textEditorChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
    },
    textEditorChipText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    // Legacy styles kept for compatibility
    colorCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorCircleActive: {
        borderColor: '#fff',
        borderWidth: 3,
    },
});
