import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function BlurTabBarBackground() {
  return (
    <BlurView
      // System chrome material automatically adapts to the system's theme
      // and matches the native tab bar appearance on iOS.
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  try {
    return useBottomTabBarHeight();
  } catch (err) {
    // If this hook is called outside of a Bottom Tab Navigator context
    // (e.g. during certain render phases), `useBottomTabBarHeight` throws.
    // Return 0 as a safe fallback so callers can continue rendering.
    return 0;
  }
}
