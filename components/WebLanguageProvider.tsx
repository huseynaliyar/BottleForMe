'use client';

import { useSyncExternalStore, type PropsWithChildren } from 'react';
import { LanguageProvider } from '@/lib/language-context';
import { isLocale, isRtl, localeKey, type Locale } from '@/lib/locale';

const eventName = 'bottleforme-language-changed';
function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
}
function setLocale(locale: Locale) {
  applyLocale(locale);
  try { localStorage.setItem(localeKey, locale); } catch { /* Use the new language until reload. */ }
  window.dispatchEvent(new Event(eventName));
}
function subscribe(listener: () => void) {
  function sync(event: StorageEvent) {
    if (event.key !== localeKey) return;
    applyLocale(isLocale(event.newValue) ? event.newValue : 'en');
    listener();
  }
  window.addEventListener('storage', sync);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener(eventName, listener);
  };
}
function getLocale(): Locale {
  const locale = document.documentElement.lang;
  return isLocale(locale) ? locale : 'en';
}
const defaultLocale = (): Locale => 'en';

export default function WebLanguageProvider({ children }: PropsWithChildren) {
  const locale = useSyncExternalStore(subscribe, getLocale, defaultLocale);
  return <LanguageProvider locale={locale} setLocale={setLocale}>{children}</LanguageProvider>;
}
