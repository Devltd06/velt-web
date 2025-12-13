/**
 * SwipeBackContainer - A wrapper component that enables swipe-back navigation
 * from anywhere on the screen, not just from the edge.
 * 
 * Like TikTok/Snapchat - NO visual animation during swipe, just gesture detection
 * and instant navigation when threshold is reached.
 * 
 * Usage:
 * <SwipeBackContainer>
 *   <YourPageContent />
 * </SwipeBackContainer>
 * 
 * Props:
 * - enabled: boolean (default: true) - Enable/disable swipe back
 * - threshold: number (default: 80) - Minimum swipe distance to trigger navigation
 * - onSwipeBack: () => void (optional) - Custom callback instead of router.back()
 * - children: ReactNode - Page content
 */

import React, { useRef, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

interface SwipeBackContainerProps {
  children: React.ReactNode;
  enabled?: boolean;
  threshold?: number;
  onSwipeBack?: () => void;
  style?: any;
}

export default function SwipeBackContainer({
  children,
  enabled = true,
  threshold = 80,
  onSwipeBack,
  style,
}: SwipeBackContainerProps) {
  const router = useRouter();
  const hasNavigatedRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);

  const handleSwipeBack = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    
    // Haptic feedback on navigation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    if (onSwipeBack) {
      onSwipeBack();
    } else {
      try {
        router.back();
      } catch (e) {
        console.warn('SwipeBackContainer: Could not navigate back', e);
        hasNavigatedRef.current = false;
      }
    }
  }, [onSwipeBack, router]);

  const panResponder = useRef(
    PanResponder.create({
      // Only capture horizontal swipes that start moving right
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (!enabled) return false;
        if (hasNavigatedRef.current) return false;
        
        // Must be moving right (positive dx) and primarily horizontal
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        const isMovingRight = gestureState.dx > 10;
        const hasEnoughVelocity = gestureState.vx > 0.1;
        
        return isHorizontalSwipe && isMovingRight && hasEnoughVelocity;
      },
      
      onMoveShouldSetPanResponderCapture: () => false,
      
      onPanResponderGrant: () => {
        hasTriggeredHapticRef.current = false;
        hasNavigatedRef.current = false;
      },
      
      onPanResponderMove: (evt, gestureState) => {
        if (hasNavigatedRef.current) return;
        
        const dx = Math.max(0, gestureState.dx);
        
        // Light haptic when threshold is crossed (to indicate swipe is recognized)
        if (dx > threshold && !hasTriggeredHapticRef.current) {
          hasTriggeredHapticRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        } else if (dx < threshold && hasTriggeredHapticRef.current) {
          hasTriggeredHapticRef.current = false;
        }
        
        // NO visual changes - just tracking the gesture
      },
      
      onPanResponderRelease: (evt, gestureState) => {
        if (hasNavigatedRef.current) return;
        
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        
        // Trigger navigation if:
        // 1. Swiped past threshold, OR
        // 2. Fast swipe velocity even if below threshold
        const shouldNavigate = dx > threshold || (dx > 40 && vx > 0.5);
        
        if (shouldNavigate) {
          handleSwipeBack();
        }
        // If not navigating, nothing happens - no animation needed
      },
      
      onPanResponderTerminate: () => {
        // Nothing to reset - no animation state
      },
    })
  ).current;

  if (!enabled) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <View
      style={[styles.container, style]}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
