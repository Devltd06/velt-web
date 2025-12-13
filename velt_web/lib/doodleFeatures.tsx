import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ScreenKey = 'profile' | 'home' | 'chat';

type DoodleContextValue = {
  state: Record<ScreenKey, boolean>;
  setEnabled: (screen: ScreenKey, v: boolean) => Promise<void>;
  toggle: (screen: ScreenKey) => Promise<void>;
  loaded: boolean;
};

const STORAGE_PREFIX = 'user:doodle_';
const LEGACY_KEY = 'user:doodle_animations_enabled';

const DoodleContext = createContext<DoodleContextValue | null>(null);

export function DoodleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Record<ScreenKey, boolean>>({ profile: false, home: false, chat: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const keys = ['profile', 'home', 'chat'] as ScreenKey[];
        const storageKeys = keys.map(k => `${STORAGE_PREFIX}${k}_enabled`);
        const kvs = await AsyncStorage.multiGet(storageKeys);
        if (!mounted) return;

        const next: Record<ScreenKey, boolean> = { profile: false, home: false, chat: false };
        kvs.forEach(([k, v]) => {
          if (!k) return;
          const match = k.match(new RegExp(`${STORAGE_PREFIX}(.+)_enabled`));
          if (!match) return;
          const screen = match[1] as ScreenKey;
          if (screen in next) next[screen] = v === '1';
        });
        // If nothing was found for any of the per-screen keys, check for a legacy
        // single-key toggle and migrate it to per-screen keys so older installs
        // continue to behave as expected.
        const anyFound = kvs.some(([, v]) => v !== null);
        if (!anyFound) {
          try {
            const legacy = await AsyncStorage.getItem(LEGACY_KEY);
            if (legacy !== null) {
              const legacyVal = legacy === '1';
              Object.keys(next).forEach((s) => (next[s as ScreenKey] = legacyVal));
              // persist migrated values (fire-and-forget)
              await Promise.all(Object.keys(next).map((s) => AsyncStorage.setItem(`${STORAGE_PREFIX}${s}_enabled`, legacyVal ? '1' : '0'))).catch(() => {});
            }
          } catch (e) {}
        }

        setState(next);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const setEnabled = useCallback(async (screen: ScreenKey, v: boolean) => {
    try {
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${screen}_enabled`, v ? '1' : '0');
      // small debug signal so we can see what's happening in the app logs
      try { console.debug('[DoodleProvider] setEnabled', screen, v); } catch {}
    } catch {}
    setState((prev) => ({ ...prev, [screen]: v }));
  }, []);

  const toggle = useCallback(async (screen: ScreenKey) => {
    setState((prev) => {
      const next = !prev[screen];
      // persist async but don't await in render path
      AsyncStorage.setItem(`${STORAGE_PREFIX}${screen}_enabled`, next ? '1' : '0').catch(() => {});
      try { console.debug('[DoodleProvider] toggle', screen, next); } catch {}
      return { ...prev, [screen]: next };
    });
  }, []);

  const isEnabled = useCallback((screen: ScreenKey) => state[screen] ?? false, [state]);

  return <DoodleContext.Provider value={{ state, setEnabled, toggle, loaded }}>{children}</DoodleContext.Provider>;
}

export function useDoodleFeatures(screen?: ScreenKey) {
  const ctx = useContext(DoodleContext);
  if (!ctx) {
    throw new Error('useDoodleFeatures must be used within DoodleProvider');
  }

  // if a caller doesn't pass a screen, default to 'profile' to preserve prior behaviour
  const key = screen ?? 'profile';
  // Access state directly so component re-renders when the specific screen's enabled value changes
  const enabled = ctx.state[key] ?? false;
  return {
    enabled,
    setEnabled: (v: boolean) => ctx.setEnabled(key, v),
    toggle: () => ctx.toggle(key),
    loaded: ctx.loaded,
  };
}

export default DoodleProvider;
