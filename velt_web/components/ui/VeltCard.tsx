import React, { useRef, useCallback } from 'react';
import { 
  Pressable, 
  Animated, 
  View, 
  StyleSheet, 
  ViewStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from 'app/themes';

interface VeltCardProps {
  children: React.ReactNode;
  onPress?: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  // Visual options
  elevated?: boolean;
  bordered?: boolean;
  accentBorder?: boolean;
  // Animation options
  animated?: boolean;
  haptic?: boolean;
  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * VeltCard - Unified card component with smooth press animations
 * 
 * Features:
 * - Theme-aware colors
 * - Optional press animation
 * - Elevated/bordered variants
 * - Accent border option for highlighting
 */
export const VeltCard: React.FC<VeltCardProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  contentStyle,
  elevated = false,
  bordered = true,
  accentBorder = false,
  animated = true,
  haptic = true,
  accessibilityLabel,
  testID,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const isInteractive = !!onPress || !!onLongPress;

  const animatePressIn = useCallback(() => {
    if (!animated || !isInteractive) return;
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.985,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, animated, isInteractive]);

  const animatePressOut = useCallback(() => {
    if (!animated || !isInteractive) return;
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, animated, isInteractive]);

  const handlePress = useCallback(async () => {
    if (haptic && isInteractive) {
      try { await Haptics.selectionAsync(); } catch {}
    }
    if (onPress) await onPress();
  }, [onPress, haptic, isInteractive]);

  const handleLongPress = useCallback(async () => {
    if (haptic && isInteractive) {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    if (onLongPress) await onLongPress();
  }, [onLongPress, haptic, isInteractive]);

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: 16,
    ...(bordered && {
      borderWidth: accentBorder ? 1.5 : StyleSheet.hairlineWidth,
      borderColor: accentBorder ? colors.accent : colors.border,
    }),
    ...(elevated && {
      shadowColor: colors.isDark ? '#000' : '#333',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: colors.isDark ? 0.4 : 0.15,
      shadowRadius: 12,
      elevation: 6,
    }),
  };

  const content = (
    <Animated.View
      style={[
        styles.container,
        cardStyle,
        isInteractive && animated && {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </Animated.View>
  );

  if (isInteractive) {
    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    padding: 16,
  },
});

export default VeltCard;
