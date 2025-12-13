import React, { useRef, useCallback } from 'react';
import { Pressable, Animated, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';

interface AnimatedPressableProps {
  onPress?: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  haptic?: boolean;
  hapticStyle?: 'light' | 'medium' | 'heavy' | 'selection';
  // Animation config
  scaleFrom?: number;
  scaleTo?: number;
  opacityFrom?: number;
  opacityTo?: number;
  // Animation timing
  pressInDuration?: number;
  pressOutDuration?: number;
  // Visual effects
  glowColor?: string;
  glowOnPress?: boolean;
  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * Enhanced AnimatedPressable with smooth spring-like animations
 * Uses native driver for 60fps performance
 */
export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  onPress,
  onLongPress,
  disabled,
  style,
  children,
  haptic = true,
  hapticStyle = 'selection',
  scaleFrom = 1,
  scaleTo = 0.95,
  opacityFrom = 1,
  opacityTo = 0.8,
  pressInDuration = 80,
  pressOutDuration = 180,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const scaleAnim = useRef(new Animated.Value(scaleFrom)).current;
  const opacityAnim = useRef(new Animated.Value(opacityFrom)).current;

  const triggerHaptic = useCallback(async (type: 'press' | 'longPress') => {
    if (!haptic) return;
    
    try {
      if (type === 'longPress') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        switch (hapticStyle) {
          case 'light':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'selection':
          default:
            await Haptics.selectionAsync();
            break;
        }
      }
    } catch {}
  }, [haptic, hapticStyle]);

  const animatePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleTo,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: opacityTo,
        duration: pressInDuration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, scaleTo, opacityTo, pressInDuration]);

  const animatePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleFrom,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: opacityFrom,
        duration: pressOutDuration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, scaleFrom, opacityFrom, pressOutDuration]);

  const handlePress = useCallback(async () => {
    triggerHaptic('press');
    if (onPress) await onPress();
  }, [onPress, triggerHaptic]);

  const handleLongPress = useCallback(async () => {
    triggerHaptic('longPress');
    if (onLongPress) await onLongPress();
  }, [onLongPress, triggerHaptic]);

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={animatePressIn}
      onPressOut={animatePressOut}
      style={style}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Animated.View 
        style={{ 
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

/**
 * Preset animation configurations for common use cases
 */
export const AnimationPresets = {
  // Subtle press for small buttons/icons
  subtle: {
    scaleTo: 0.97,
    opacityTo: 0.9,
    pressInDuration: 60,
    pressOutDuration: 150,
  },
  // Standard button press
  standard: {
    scaleTo: 0.95,
    opacityTo: 0.85,
    pressInDuration: 80,
    pressOutDuration: 180,
  },
  // Bouncy press for interactive elements
  bouncy: {
    scaleTo: 0.92,
    opacityTo: 0.8,
    pressInDuration: 100,
    pressOutDuration: 200,
  },
  // Card press effect
  card: {
    scaleTo: 0.98,
    opacityTo: 0.95,
    pressInDuration: 100,
    pressOutDuration: 200,
  },
  // FAB/large button press
  fab: {
    scaleTo: 0.9,
    opacityTo: 0.75,
    pressInDuration: 100,
    pressOutDuration: 200,
  },
};

export default AnimatedPressable;
