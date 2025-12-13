// app/theme.tsx
// app/themes/index.ts

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "user:selected_theme_key";

/**
 * Unified App Themes - Dark & Light modes with unique Velt accent color
 * Accent: Premium Gold (#D4AF37) - A luxurious, distinctive gold
 */

// Unified accent color used across all themes - Premium Gold
export const VELT_ACCENT = "#D4AF37";
export const VELT_ACCENT_LIGHT = "#C9A227"; // Slightly darker for light mode
export const VELT_ACCENT_FAINT = "rgba(212, 175, 55, 0.08)";
export const VELT_ACCENT_FAINT_LIGHT = "rgba(201, 162, 39, 0.08)";

// Extended button color palette for professional UI
export const BUTTON_COLORS = {
  // Primary actions - uses premium gold accent
  primary: VELT_ACCENT,
  primaryDark: "#B8962E",
  
  // Secondary actions - subtle gray
  secondary: "#6B7280",
  secondaryDark: "#4B5563",
  secondaryLight: "#9CA3AF",
  
  // Destructive/danger actions
  danger: "#EF4444",
  dangerDark: "#DC2626",
  dangerLight: "#F87171",
  
  // Success actions
  success: "#10B981",
  successDark: "#059669",
  successLight: "#34D399",
  
  // Warning actions
  warning: "#F59E0B",
  warningDark: "#D97706",
  warningLight: "#FBBF24",
  
  // Premium/gold actions
  premium: "#F59E0B",
  premiumDark: "#B45309",
  
  // Social colors
  like: "#FF4D6D",
  likeFaint: "rgba(255, 77, 109, 0.12)",
  
  // Muted actions
  muted: "#374151",
  mutedLight: "#6B7280",
};

// Gradient presets for professional UI
export const GRADIENTS = {
  // Primary accent gradient (premium gold flow)
  accent: ['#D4AF37', '#B8962E'] as const,
  accentReverse: ['#B8962E', '#D4AF37'] as const,
  
  // Premium/gold gradient
  premium: ['#D4AF37', '#B8962E'] as const,
  premiumShine: ['#E8C547', '#D4AF37', '#9A7B2A'] as const,
  
  // Success gradient
  success: ['#10B981', '#059669'] as const,
  
  // Danger gradient
  danger: ['#EF4444', '#DC2626'] as const,
  
  // Dark overlays (for cards/modals)
  darkOverlay: ['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'transparent'] as const,
  darkOverlayReverse: ['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)'] as const,
  
  // Light overlays
  lightOverlay: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.4)', 'transparent'] as const,
  
  // Sunset/warm gradient (for special sections)
  sunset: ['#FF6B6B', '#FFE66D'] as const,
  
  // Ocean/cool gradient
  ocean: ['#00D4FF', '#0066FF'] as const,
  oceanDeep: ['#0066FF', '#00D4FF', '#00FFD4'] as const,
  
  // Purple/violet gradient (for premium features)
  violet: ['#8B5CF6', '#6D28D9'] as const,
  violetShine: ['#A78BFA', '#8B5CF6', '#6D28D9'] as const,
  
  // Mesh/aurora gradient (for headers)
  aurora: ['#D4AF37', '#8B5CF6', '#FF6B6B'] as const,
  
  // Subtle card gradients
  cardDark: ['rgba(20,20,25,0.95)', 'rgba(30,30,35,0.9)'] as const,
  cardLight: ['rgba(255,255,255,0.98)', 'rgba(245,245,245,0.95)'] as const,
  
  // Glass effect gradients
  glassDark: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'] as const,
  glassLight: ['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.01)'] as const,
};

export const THEMES: Record<string, any> = {
  dark: {
    displayName: "Dark",
    bg: "#000000",
    text: "#FFFFFF",
    subtext: "#A0A0A0",
    card: "#0D0D0D",
    border: "#1A1A1A",
    accent: VELT_ACCENT,
    accentText: "#000000",
    faint: VELT_ACCENT_FAINT,
    isDark: true,
    // Additional semantic colors
    success: "#00E676",
    error: "#FF5252",
    warning: "#FFD740",
    // Button variants
    btnPrimary: VELT_ACCENT,
    btnPrimaryText: "#000000",
    btnSecondary: "#1F1F1F",
    btnSecondaryText: "#FFFFFF",
    btnDanger: BUTTON_COLORS.danger,
    btnDangerText: "#FFFFFF",
    btnSuccess: BUTTON_COLORS.success,
    btnSuccessText: "#FFFFFF",
    btnMuted: "rgba(255,255,255,0.08)",
    btnMutedText: "#A0A0A0",
  },
  light: {
    displayName: "Light",
    bg: "#FFFFFF",
    text: "#0A0A0A",
    subtext: "#6B6B6B",
    card: "#F5F5F5",
    border: "#E0E0E0",
    accent: VELT_ACCENT_LIGHT,
    accentText: "#FFFFFF",
    faint: VELT_ACCENT_FAINT_LIGHT,
    isDark: false,
    // Additional semantic colors
    success: "#00C853",
    error: "#D50000",
    warning: "#FFAB00",
    // Button variants
    btnPrimary: VELT_ACCENT_LIGHT,
    btnPrimaryText: "#FFFFFF",
    btnSecondary: "#F0F0F0",
    btnSecondaryText: "#0A0A0A",
    btnDanger: BUTTON_COLORS.dangerDark,
    btnDangerText: "#FFFFFF",
    btnSuccess: BUTTON_COLORS.successDark,
    btnSuccessText: "#FFFFFF",
    btnMuted: "rgba(0,0,0,0.05)",
    btnMutedText: "#6B6B6B",
  },
};

export type ThemeColors = {
  bg: string;
  text: string;
  subtext: string;
  card: string;
  border: string;
  accent: string;
  accentText: string;
  faint: string;
  isDark: boolean;
  success: string;
  error: string;
  warning: string;
  // Button variants
  btnPrimary: string;
  btnPrimaryText: string;
  btnSecondary: string;
  btnSecondaryText: string;
  btnDanger: string;
  btnDangerText: string;
  btnSuccess: string;
  btnSuccessText: string;
  btnMuted: string;
  btnMutedText: string;
};

type ThemeValue = {
  colors: ThemeColors;
  selectedKey: string;
  applyTheme: (key: string) => Promise<void>;
  clearTheme: () => Promise<void>;
  isReady: boolean;
  availableThemes: typeof THEMES;
};

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

const useSystemTheme = () => {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return useMemo(
    () => ({
      isDark,
      colors: isDark ? THEMES.dark : THEMES.light,
    }),
    [scheme]
  );
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sys = useSystemTheme();
  const [selectedKey, setSelectedKey] = useState<string>("system");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && (stored === "system" || THEMES[stored])) {
          setSelectedKey(stored);
        } else {
          setSelectedKey("system");
        }
      } catch (e) {
        setSelectedKey("system");
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const applyTheme = useCallback(async (key: string) => {
    if (key !== "system" && !THEMES[key]) {
      console.warn("Attempted to set unknown theme key:", key);
      return;
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY, key);
    } catch {}
    setSelectedKey(key);
  }, []);

  const clearTheme = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
    setSelectedKey("system");
  }, []);

  // -------------------------
  // FIX: build colors object from selected THEMES entry (or system)
  // -------------------------
  const colors = useMemo<ThemeColors>(() => {
    const fallback = sys.colors as ThemeColors;
    if (selectedKey === "system") return fallback;

    const t = THEMES[selectedKey];
    if (!t) return fallback;

    return {
      bg: t.bg ?? fallback.bg,
      text: t.text ?? fallback.text,
      subtext: t.subtext ?? fallback.subtext,
      card: t.card ?? fallback.card,
      border: t.border ?? fallback.border,
      accent: t.accent ?? fallback.accent,
      accentText: t.accentText ?? fallback.accentText,
      faint: t.faint ?? fallback.faint,
      isDark: typeof t.isDark === "boolean" ? t.isDark : fallback.isDark,
      success: t.success ?? fallback.success,
      error: t.error ?? fallback.error,
      warning: t.warning ?? fallback.warning,
      // Button variants
      btnPrimary: t.btnPrimary ?? fallback.btnPrimary ?? t.accent,
      btnPrimaryText: t.btnPrimaryText ?? fallback.btnPrimaryText ?? t.accentText,
      btnSecondary: t.btnSecondary ?? fallback.btnSecondary ?? t.card,
      btnSecondaryText: t.btnSecondaryText ?? fallback.btnSecondaryText ?? t.text,
      btnDanger: t.btnDanger ?? fallback.btnDanger ?? BUTTON_COLORS.danger,
      btnDangerText: t.btnDangerText ?? fallback.btnDangerText ?? '#FFFFFF',
      btnSuccess: t.btnSuccess ?? fallback.btnSuccess ?? BUTTON_COLORS.success,
      btnSuccessText: t.btnSuccessText ?? fallback.btnSuccessText ?? '#FFFFFF',
      btnMuted: t.btnMuted ?? fallback.btnMuted ?? 'rgba(128,128,128,0.1)',
      btnMutedText: t.btnMutedText ?? fallback.btnMutedText ?? t.subtext,
    };
  }, [selectedKey, sys.colors]);

  return (
    <ThemeContext.Provider value={{ colors, selectedKey, applyTheme, clearTheme, isReady, availableThemes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
