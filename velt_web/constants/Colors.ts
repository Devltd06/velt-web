/**
 * Unified Velt color system - Uses the Velt Cyan accent (#00D4FF)
 * This ensures consistency across all components and themes
 */

// Velt unique accent colors
export const VELT_ACCENT = "#00D4FF";
export const VELT_ACCENT_LIGHT = "#00B8E6";
export const VELT_ACCENT_GLOW = "rgba(0, 212, 255, 0.3)";

const tintColorLight = VELT_ACCENT_LIGHT;
const tintColorDark = VELT_ACCENT;

export const Colors = {
  light: {
    text: '#0A0A0A',
    background: '#FFFFFF',
    tint: tintColorLight,
    icon: '#6B6B6B',
    tabIconDefault: '#9E9E9E',
    tabIconSelected: tintColorLight,
    accent: VELT_ACCENT_LIGHT,
    card: '#F5F5F5',
    border: '#E0E0E0',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: tintColorDark,
    icon: '#A0A0A0',
    tabIconDefault: '#6B6B6B',
    tabIconSelected: tintColorDark,
    accent: VELT_ACCENT,
    card: '#0D0D0D',
    border: '#1A1A1A',
  },
};
