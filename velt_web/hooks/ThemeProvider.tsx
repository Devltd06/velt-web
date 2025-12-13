// theme/ThemeProvider.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { lightTheme, darkTheme } from "constants/theme"; // same constants you showed me

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: typeof lightTheme;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>("light");

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));
  const colors = useMemo(() => (mode === "light" ? lightTheme : darkTheme), [mode]);

  const value = useMemo(() => ({ mode, colors, toggle }), [mode, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
