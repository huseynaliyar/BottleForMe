import countries from './phone-countries.json';

export const phoneCountries = countries;

export function formatPhone(country: string, input: string) {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (input.trim().startsWith('+')) return '+' + digits;
  const code = phoneCountries.find((item) => item.value === country)?.code ?? '+356';
  return code + digits;
}
