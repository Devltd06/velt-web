// components/AvatarRing.tsx
// Unified avatar ring component used across the app
// - Shows story ring when user has stories, routes to story viewer
// - Routes to profile when no stories
// - Consistent ring colors and animations

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Image, Text, Animated, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { VELT_ACCENT } from 'app/themes';
import { supabase } from '@/lib/supabase';

// Ring colors - unified across app
export const RING_COLORS = {
  hasStory: VELT_ACCENT, // Cyan accent when user has story
  viewed: '#6EE7B7', // Soft green when story viewed
  default: '#374151', // Gray when no story
  live: '#EF4444', // Red for live status (future)
};

const PLACEHOLDER_AVATAR = 'https://ui-avatars.com/api/?background=1a1a2e&color=fff&name=U';

type AvatarRingProps = {
  userId?: string | null;
  avatar?: string | null;
  size?: number;
  username?: string | null;
  fullName?: string | null;
  
  // Story status (if known from parent)
  hasStory?: boolean;
  storyViewed?: boolean;
  storyCount?: number;
  
  // Custom handlers (override default behavior)
  onPress?: () => void;
  onLongPress?: () => void;
  
  // Disable auto-navigation
  disableNavigation?: boolean;
  
  // Show HD badge
  isHD?: boolean;
  
  // Show count badge
  showCount?: boolean;
  
  // Custom ring color override
  ringColor?: string;
  
  // Blink animation
  blink?: boolean;
};

export const AvatarRing: React.FC<AvatarRingProps> = ({
  userId,
  avatar,
  size = 56,
  username,
  fullName,
  hasStory: hasStoryProp,
  storyViewed: storyViewedProp,
  storyCount: storyCountProp,
  onPress: customOnPress,
  onLongPress: customOnLongPress,
  disableNavigation = false,
  isHD = false,
  showCount = true,
  ringColor: ringColorOverride,
  blink = false,
}) => {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const longPressTriggered = useRef(false);
  
  // Local story status (fetched if not provided)
  const [hasStory, setHasStory] = useState(hasStoryProp ?? false);
  const [storyViewed, setStoryViewed] = useState(storyViewedProp ?? false);
  const [storyCount, setStoryCount] = useState(storyCountProp ?? 0);
  const [loading, setLoading] = useState(false);

  // Fetch story status if not provided
  useEffect(() => {
    if (hasStoryProp !== undefined) {
      setHasStory(hasStoryProp);
      return;
    }
    if (!userId) return;
    
    let mounted = true;
    const checkStoryStatus = async () => {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('stories')
          .select('id')
          .eq('user_id', userId)
          .gt('expires_at', now)
          .limit(10);
        
        if (!error && mounted) {
          const count = data?.length ?? 0;
          setHasStory(count > 0);
          setStoryCount(count);
        }
      } catch (err) {
        console.warn('AvatarRing: Failed to check story status', err);
      }
    };
    
    checkStoryStatus();
    return () => { mounted = false; };
  }, [userId, hasStoryProp]);

  // Update from props
  useEffect(() => {
    if (storyViewedProp !== undefined) setStoryViewed(storyViewedProp);
  }, [storyViewedProp]);
  
  useEffect(() => {
    if (storyCountProp !== undefined) setStoryCount(storyCountProp);
  }, [storyCountProp]);

  // Press animations - Instagram/Snapchat style with bounce
  const handlePressIn = useCallback(() => {
    longPressTriggered.current = false;
    // Quick responsive scale down
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      friction: 10,
      tension: 400,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    // Bouncy spring back - Instagram feel
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 300,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handleLongPress = useCallback(() => {
    longPressTriggered.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    customOnLongPress?.();
  }, [customOnLongPress]);

  const handlePress = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    
    try {
      Haptics.selectionAsync();
    } catch {}
    
    // Custom handler takes priority
    if (customOnPress) {
      customOnPress();
      return;
    }
    
    // Default navigation behavior
    if (disableNavigation || !userId) return;
    
    if (hasStory) {
      // Route to story viewer
      router.push(`/explore/user_stories/${userId}`);
    } else {
      // Route to profile
      router.push(`/profile/view/${userId}`);
    }
  }, [customOnPress, disableNavigation, userId, hasStory, router]);

  // Determine ring style
  const ringSize = size + 8;
  const ringWidth = hasStory ? 3 : 2;
  
  let ringColor = ringColorOverride;
  if (!ringColor) {
    if (hasStory) {
      ringColor = storyViewed ? RING_COLORS.viewed : RING_COLORS.hasStory;
    } else {
      ringColor = RING_COLORS.default;
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePress}
        onLongPress={customOnLongPress ? handleLongPress : undefined}
        delayLongPress={400}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
      >
        <View
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: ringWidth,
              borderColor: ringColor,
            },
          ]}
        >
          <View
            style={[
              styles.avatarContainer,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          >
            {avatar ? (
              <Image
                source={{ uri: avatar }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
              />
            ) : (
              <View
                style={[
                  styles.placeholder,
                  { width: size, height: size, borderRadius: size / 2 },
                ]}
              >
                <Ionicons name="person" size={size * 0.45} color="#9CA3AF" />
              </View>
            )}
          </View>

          {/* Story count badge */}
          {showCount && storyCount > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{storyCount}</Text>
            </View>
          )}

          {/* HD badge */}
          {isHD && (
            <View style={styles.hdBadge}>
              <Text style={styles.hdText}>HD</Text>
            </View>
          )}

          {/* Story indicator dot (when has story but small size) */}
          {hasStory && size < 50 && (
            <View
              style={[
                styles.storyDot,
                { backgroundColor: storyViewed ? RING_COLORS.viewed : RING_COLORS.hasStory },
              ]}
            />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// Smaller avatar for lists/chats with story indicator
export const AvatarWithStoryIndicator: React.FC<{
  userId?: string | null;
  avatar?: string | null;
  size?: number;
  hasStory?: boolean;
  storyViewed?: boolean;
  onPress?: () => void;
}> = ({ userId, avatar, size = 48, hasStory, storyViewed, onPress }) => {
  return (
    <AvatarRing
      userId={userId}
      avatar={avatar}
      size={size}
      hasStory={hasStory}
      storyViewed={storyViewed}
      onPress={onPress}
      showCount={false}
    />
  );
};

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatarContainer: {
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
  },
  countBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    backgroundColor: '#101214',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  hdBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  hdText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  storyDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default AvatarRing;
