'use client';

import { languages, isLocale } from '@/lib/locale';
import { useLanguage } from '@/lib/language-context';

export default function LanguageSetting() {
  const { locale, setLocale, t } = useLanguage();
  return <section className="glass-navy space-y-2 rounded-xl p-4">
    <label className="block font-semibold" htmlFor="interface-language">{t('Language')}</label>
    <select id="interface-language" value={locale} onChange={(event) => {
      if (isLocale(event.target.value)) setLocale(event.target.value);
    }} className="block w-full rounded-lg bg-[#0b1220] p-2">
      {languages.map(({ value, label }) => <option key={value} value={value} lang={value}>{label}</option>)}
    </select>
  </section>;
}
