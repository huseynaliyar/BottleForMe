import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type User } from '@supabase/supabase-js';
import { loadProfile as readProfile, saveProfile as writeProfile } from '../../lib/profile';
import type { PickupOffer, PickupStatus, UserProfile, UserRole } from '../../lib/types';
import type { validatePickup } from '../../lib/pickup-validation';
import type { AddressSuggestion } from '../../lib/pickup-address';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const apiOrigin = (process.env.EXPO_PUBLIC_API_ORIGIN || 'https://www.bottleforme.com').replace(/\/+$/, '');

export const supabase = supabaseUrl && publishableKey?.startsWith('sb_publishable_')
  ? createClient(supabaseUrl, publishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  : null;

function client() {
  if (!supabase) throw new Error('Account service is unavailable.');
  return supabase;
}

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function register(email: string, password: string, metadata: Pick<UserProfile, 'full_name' | 'role' | 'phone' | 'revolut_tag' | 'locality'>) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: apiOrigin,
      data: metadata,
    },
  });
  if (error) throw error;
  return !!data.session;
}

export async function verifySignupCode(email: string, token: string) {
  const { error } = await client().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function resendSignupCode(email: string) {
  const { error } = await client().auth.resend({ email, type: 'signup' });
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: apiOrigin });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export function loadProfile(user: User) {
  return readProfile(client(), user);
}

export function saveProfile(user: UserProfile, change: { avatar_url: string } | { role: UserRole }) {
  return writeProfile(client(), user, change);
}

export function errorMessage(error: unknown) {
  if (error instanceof TypeError && /network request failed|failed to fetch/i.test(error.message)) {
    return 'Could not reach BottleForMe. Check your connection and try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (authenticated) {
    const { data, error } = await client().auth.getSession();
    if (error || !data.session) throw new Error('Sign in to continue.');
    headers.set('Authorization', 'Bearer ' + data.session.access_token);
  }
  const response = await fetch(apiOrigin + path, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload === null) {
    throw new Error(payload?.error || 'Could not load a response from the pickup service.');
  }
  return payload as T;
}

export async function listPickups(locality: string, mine: boolean, signal: AbortSignal) {
  const query = mine ? '?mine=true' : locality ? '?locality=' + encodeURIComponent(locality) : '';
  const { offers } = await request<{ offers: PickupOffer[] }>('/api/pickups' + query, { signal }, true);
  return offers;
}

export function searchPickupAddresses(input: string, signal: AbortSignal) {
  return request<{ suggestions: AddressSuggestion[] }>('/api/addresses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }), signal,
  }, true);
}

export function publishPickup(values: NonNullable<ReturnType<typeof validatePickup>> & {
  pickup_address: string; address_proof?: string;
}, key: string) {
  return request<PickupOffer>('/api/pickups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(values),
  }, true);
}

export function changePickup(id: string, status: Exclude<PickupStatus, 'open'>) {
  return request<PickupOffer>('/api/pickups/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }, true);
}
