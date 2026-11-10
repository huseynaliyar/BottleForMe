import { useEffect, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageProvider } from '../../lib/language-context';
import { isLocale, localeKey, type Locale } from '../../lib/locale';

export default function MobileLanguageProvider({ children }: PropsWithChildren) {
  const [locale, update] = useState<Locale>('en');
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(localeKey).then((value) => {
      if (active && isLocale(value)) update(value);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  function setLocale(value: Locale) {
    update(value);
    void AsyncStorage.setItem(localeKey, value).catch(() => {});
  }
  return <LanguageProvider locale={locale} setLocale={setLocale}>{children}</LanguageProvider>;
}
