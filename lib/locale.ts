export const languages = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'ru', label: 'Русский' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'ur', label: 'اردو' },
] as const;

export type Locale = (typeof languages)[number]['value'];
export const localeKey = 'bottleforme-language';
export const isLocale = (value: unknown): value is Locale => languages.some((item) => item.value === value);
export const isRtl = (locale: Locale) => locale === 'ar' || locale === 'ur';
