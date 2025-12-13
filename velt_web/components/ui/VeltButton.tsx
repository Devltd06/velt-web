import React, { useRef, useCallback } from 'react';
import { 
  Pressable, 
  Animated, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, VELT_ACCENT } from 'app/themes';

export type VeltButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
export type VeltButtonSize = 'small' | 'medium' | 'large';

interface VeltButtonProps {
  title: string;
  onPress?: () => void | Promise<void>;
  onLongPress?: () => void | Promise<void>;
  variant?: VeltButtonVariant;
  size?: VeltButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
  // For oval/pill shape
  pill?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * VeltButton - Unified button component with Velt accent colors and smooth animations
 * 
 * Features:
 * - Spring-based press animations
 * - Multiple variants (primary, secondary, outline, ghost, accent)
 * - Consistent Velt Cyan accent
 * - Pill/oval shape option
 * - Loading state support
 * - Haptic feedback
 */
export const VeltButton: React.FC<VeltButtonProps> = ({
  title,
  onPress,
  onLongPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  haptic = true,
  pill = false,
  accessibilityLabel,
  testID,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animatePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const animatePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePress = useCallback(async () => {
    if (haptic) {
      try { await Haptics.selectionAsync(); } catch {}
    }
    if (onPress) await onPress();
  }, [onPress, haptic]);

  const handleLongPress = useCallback(async () => {
    if (haptic) {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    }
    if (onLongPress) await onLongPress();
  }, [onLongPress, haptic]);

  // Get styles based on variant
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    const isDisabled = disabled || loading;
    
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.border : colors.accent,
          },
          text: {
            color: isDisabled ? colors.subtext : colors.accentText,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.border : colors.card,
          },
          text: {
            color: isDisabled ? colors.subtext : colors.text,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: isDisabled ? colors.border : colors.accent,
          },
          text: {
            color: isDisabled ? colors.subtext : colors.accent,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: {
            color: isDisabled ? colors.subtext : colors.text,
          },
        };
      case 'accent':
        return {
          container: {
            backgroundColor: isDisabled ? colors.border : VELT_ACCENT,
          },
          text: {
            color: isDisabled ? colors.subtext : '#000000',
            fontWeight: '700',
          },
        };
      default:
        return {
          container: { backgroundColor: colors.accent },
          text: { color: colors.accentText },
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'small':
        return {
          container: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            minHeight: 36,
          },
          text: {
            fontSize: 13,
          },
        };
      case 'large':
        return {
          container: {
            paddingVertical: 16,
            paddingHorizontal: 28,
            minHeight: 56,
          },
          text: {
            fontSize: 17,
          },
        };
      case 'medium':
      default:
        return {
          container: {
            paddingVertical: 12,
            paddingHorizontal: 22,
            minHeight: 46,
          },
          text: {
            fontSize: 15,
          },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={animatePressIn}
      onPressOut={animatePressOut}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.container,
          variantStyles.container,
          sizeStyles.container,
          pill && styles.pill,
          fullWidth && styles.fullWidth,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          style,
        ]}
      >
        {icon && iconPosition === 'left' && (
          <View style={styles.iconLeft}>{icon}</View>
        )}
        <Text
          style={[
            styles.text,
            variantStyles.text,
            sizeStyles.text,
            textStyle,
          ]}
        >
          {loading ? 'Loading...' : title}
        </Text>
        {icon && iconPosition === 'right' && (
          <View style={styles.iconRight}>{icon}</View>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  pill: {
    borderRadius: 999,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default VeltButton;
