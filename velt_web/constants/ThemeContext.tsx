import React, { ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeType = {
  background: string;
  text: string;
  card: string;
  border: string;
};

const LightTheme: ThemeType = {
  background: '#ffffff',
  text: '#000000',
  card: '#f2f2f2',
  border: '#e0e0e0',
};

const DarkTheme: ThemeType = {
  background: '#000000',
  text: '#ffffff',
  card: '#1a1a1a',
  border: '#333333',
};

const ThemeContext = React.createContext<{
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}>({
  theme: LightTheme,
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>(
    colorScheme === 'dark' ? DarkTheme : LightTheme
  );

  useEffect(() => {
    setTheme(colorScheme === 'dark' ? DarkTheme : LightTheme);
  }, [colorScheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
