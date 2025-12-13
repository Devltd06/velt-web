import { create } from 'zustand';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeState = {
  mode: ThemeMode;
  setLight: () => void;
  setDark: () => void;
  setAuto: () => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',

  setLight: () => set({ mode: 'light' }),

  setDark: () => set({ mode: 'dark' }),

  setAuto: () => {
    const systemColor = Appearance.getColorScheme();
    set({ mode: systemColor === 'dark' ? 'dark' : 'light' });
  },
}));



