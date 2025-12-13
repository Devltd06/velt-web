/**
 * Market Theme Hook - Now uses the centralized theme system from app/themes.tsx
 * This file provides backward compatibility for components still using useMarketTheme
 */

import { useTheme, VELT_ACCENT, THEMES, type ThemeColors } from 'app/themes';

export type MarketThemeColors = ThemeColors;

export const MARKET_THEME_STORAGE_KEY = 'user:selected_theme_key';

// Re-export THEMES for backward compatibility
export const MARKET_THEMES = THEMES;

/**
 * @deprecated Use useTheme from 'app/themes' directly for new components
 * This hook is kept for backward compatibility with existing market components
 */
export const useMarketTheme = () => {
  const { colors, selectedKey, applyTheme, clearTheme, isReady, availableThemes } = useTheme();

  // Provide a refresh function that doesn't do anything since useTheme already syncs
  const refresh = async () => {
    // No-op - useTheme already handles state updates
  };

  return { 
    colors, 
    selectedKey, 
    refresh,
    // Expose additional methods for any advanced usage
    applyTheme,
    clearTheme,
    isReady,
    availableThemes,
  };
};


// Re-export accent for convenience
export { VELT_ACCENT };
