'use client';

import { createContext, useContext, type PropsWithChildren } from 'react';
import type { Locale } from './locale';
import { translate } from './translations';

type Preference = { locale: Locale; setLocale: (value: Locale) => void };
const Language = createContext<Preference>({ locale: 'en', setLocale() {} });

export function LanguageProvider({ children, locale, setLocale }: PropsWithChildren<Preference>) {
  return <Language.Provider value={{ locale, setLocale }}>{children}</Language.Provider>;
}

export function useLanguage() {
  const value = useContext(Language);
  return { ...value, t: (text: string) => translate(value.locale, text) };
}
