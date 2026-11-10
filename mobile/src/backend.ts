import 'react-native-url-polyfill/auto';
import { emailAuthRequest } from '../../lib/email-auth-request';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type User } from '@supabase/supabase-js';
import { loadProfile as readProfile, saveProfile as writeProfile } from '../../lib/profile';
import type { PickupOffer, PickupStatus, UserProfile, UserRole } from '../../lib/types';
import type { validatePickup } from '../../lib/pickup-validation';
import type { PickupWindow, ScheduleAction, ScheduleRequest } from '../../lib/pickup-schedule';
import type { ChatAction, ChatPage, UnreadChat } from '../../lib/use-pickup-chat';
import type { PickupPartner, Review } from '../../lib/pickup-partner';
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

export async function register(email: string, password: string, metadata: Pick<UserProfile, 'full_name' | 'role' | 'phone' | 'revolut_tag' | 'locality'> & { terms_version: string }) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: apiOrigin,
      data: metadata,
    },
  });
  if (error) throw error;
  if (data.user?.identities?.length === 0) throw new Error('An account with this email already exists. Sign in or reset your password.');
  if (data.session) {
    await signOut();
    throw new Error('Email verification is unavailable. Try again later.');
  }
}

export async function verifySignupCode(email: string, token: string) {
  const session = await emailAuthRequest<{ access_token: string; refresh_token: string }>(apiOrigin, { action: 'otp', email, code: token });
  const { data, error } = await client().auth.setSession(session);
  if (error || !data.user?.email_confirmed_at || !data.session) throw error ?? new Error('Could not confirm your email.');
}

export async function resendSignupCode(email: string) {
  const { error } = await client().auth.resend({ email, type: 'signup' });
  if (error) throw error;
}

export async function resetPassword(email: string) {
  await emailAuthRequest(apiOrigin, { action: 'reset', email });
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
    throw Object.assign(new Error(payload?.error || 'Could not load a response from the pickup service.'), { code: payload?.code, pickupId: payload?.pickupId });
  }
  return payload as T;
}

export async function setMobilePushDevice(userId: string, installationId: string, token: string | null) {
  const { data: { session } } = await client().auth.getSession();
  if (session?.user.id !== userId) throw new Error('Sign in to change push settings.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await request<{ ok: boolean }>('/api/push/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ installationId, token }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function loadFavorites(signal: AbortSignal) {
  return request<{ ids: string[] }>('/api/pickups/favorites', { signal }, true);
}

export function saveFavorite(pickupId: string, saved: boolean) {
  return request('/api/pickups/favorites', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickupId, saved }),
  }, true);
}

export function setListingArchived(pickupId: string, archived: boolean) {
  return request('/api/pickups/archive', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickupId, archived }),
  }, true);
}

export function reportPickup(pickupId: string, target: 'listing' | 'user', reason: string) {
  return request('/api/pickups/report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickupId, target, reason }),
  }, true);
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

export function listScheduleRequests(signal: AbortSignal, listingId?: string) {
  return request<{ requests: ScheduleRequest[] }>('/api/pickups/schedule' + (listingId ? '?listing=' + encodeURIComponent(listingId) : ''), { signal }, true);
}

export function saveSchedule(listingId: string, action: ScheduleAction) {
  return request<{ ok: boolean }>('/api/pickups/schedule', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, ...action }),
  }, true);
}

export function loadSettings(signal: AbortSignal) {
  return request<{ sharePhone: boolean }>('/api/account/settings', { signal }, true);
}

export function saveSettings(sharePhone: boolean) {
  return request<{ sharePhone: boolean }>('/api/account/settings', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sharePhone }),
  }, true);
}

export function getUnreadChats() {
  return request<{ unread: UnreadChat[] }>('/api/pickups/chat', {}, true);
}

export function getChat(pickupId: string, before?: number, signal?: AbortSignal) {
  return request<ChatPage>('/api/pickups/chat?pickup=' + encodeURIComponent(pickupId) + (before ? '&before=' + before : ''), { signal }, true);
}

export function postChat(pickup: string, action: ChatAction, signal?: AbortSignal) {
  return request('/api/pickups/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickup, ...action }), signal,
  }, true);
}

export function getPickupPartner(id: string, signal: AbortSignal) {
  return request<PickupPartner>('/api/pickups/' + encodeURIComponent(id) + '/partner', { signal }, true);
}

export function submitPickupReview(id: string, review: Review) {
  return request<Review>('/api/pickups/' + encodeURIComponent(id) + '/partner', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review),
  }, true);
}

export function getListingPhoto(pickupId: string) {
  return request<{ photo: string | null }>('/api/pickups/' + encodeURIComponent(pickupId) + '/photo', {}, true);
}

export function publishPickup(values: NonNullable<ReturnType<typeof validatePickup>> & {
  pickup_address: string; address_proof?: string; availability?: PickupWindow[]; photo: string;
}, key: string) {
  return request<PickupOffer>('/api/pickups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(values),
  }, true);
}

export function changePickup(id: string, status: Exclude<PickupStatus, 'open'>, code?: string) {
  return request<PickupOffer>('/api/pickups/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, code }),
  }, true);
}

export function getHandoverCode(id: string) {
  return request<{ code: string }>('/api/pickups/' + encodeURIComponent(id) + '/code', { method: 'POST' }, true);
}
