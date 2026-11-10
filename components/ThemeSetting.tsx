'use client';

import { useLanguage } from '@/lib/language-context';
import { useSyncExternalStore } from 'react';
import { themeKey, themes, type Theme } from '@/lib/appearance';

const themeEvent = 'bottleforme-theme-changed';
const currentTheme = (): Theme => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const initialTheme = (): Theme => 'dark';
function applyTheme(value: Theme) {
  document.documentElement.dataset.theme = value;
  try { localStorage.setItem(themeKey, value); } catch { /* The current page still uses the selected theme. */ }
  window.dispatchEvent(new Event(themeEvent));
}
function subscribe(onChange: () => void) {
  function sync(event: StorageEvent) {
    if (event.key !== themeKey) return;
    document.documentElement.dataset.theme = event.newValue === 'light' ? 'light' : 'dark';
    onChange();
  }
  window.addEventListener('storage', sync);
  window.addEventListener(themeEvent, onChange);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener(themeEvent, onChange);
  };
}

export default function ThemeSetting() {
  const { t } = useLanguage();
  const theme = useSyncExternalStore(subscribe, currentTheme, initialTheme);
  return <section className="glass-navy space-y-2 rounded-xl p-4">
    <h2 className="font-semibold">{t("Appearance")}</h2>
    <fieldset className="flex flex-wrap gap-4 text-sm">
      <legend className="sr-only">{t("Color theme")}</legend>
      {themes.map(({ value, label }) => <label key={value} className="flex items-center gap-2">
        <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => applyTheme(value)} /> {t(label)}
      </label>)}
    </fieldset>
    <p className="text-sm text-blue-200">{t("Saved in this browser.")}</p>
  </section>;
}
