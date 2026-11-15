import countries from './phone-countries.json';

export const phoneCountries = countries;

export const signupPhoneError = 'Enter a valid mobile number.';

export function isSignupPhone(value: unknown): value is string {
  return typeof value === 'string' && /^\+[1-9][0-9]{6,14}$/.test(value);
}

export function formatPhone(country: string, input: string) {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  if (input.trim().startsWith('+')) return '+' + digits;
  const code = phoneCountries.find((item) => item.value === country)?.code ?? '+356';
  return code + digits;
}
