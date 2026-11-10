import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeKey, type Theme } from '../../lib/appearance';

const Appearance = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: 'dark', setTheme() {} });

export function AppearanceProvider({ children }: PropsWithChildren) {
  const [theme, updateTheme] = useState<Theme>('dark');
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(themeKey).then((value) => {
      if (active && value === 'light') updateTheme('light');
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  function setTheme(value: Theme) {
    updateTheme(value);
    void AsyncStorage.setItem(themeKey, value).catch(() => {});
  }
  return <Appearance.Provider value={{ theme, setTheme }}>{children}</Appearance.Provider>;
}

export function useAppearance() {
  return useContext(Appearance);
}
