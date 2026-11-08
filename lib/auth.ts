'use client';

import type { User } from '@supabase/supabase-js';
import { MALTA_LOCALITIES, UserProfile, UserRole } from './types';
import { supabase } from './supabase';

function authClient() {
  if (!supabase) throw new Error('Account service is unavailable.');
  return supabase;
}

export async function loadProfile(user: User): Promise<UserProfile> {
  const { data: profile, error } = await authClient().from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new Error('Could not load your profile.');
  const meta = user.user_metadata;
  const role = profile?.role || meta.role;
  const locality = profile?.locality || meta.locality;
  return {
    id: user.id,
    email: user.email || '',
    full_name: profile?.full_name || (typeof meta.full_name === 'string' && meta.full_name) || user.email?.split('@')[0] || 'User',
    phone: profile?.phone || (typeof meta.phone === 'string' ? meta.phone : ''),
    revolut_tag: profile?.revolut_tag || (typeof meta.revolut_tag === 'string' ? meta.revolut_tag : ''),
    role: role === 'driver' || role === 'taker' ? 'taker' : 'giver',
    avatar_url: profile?.avatar_url || '/logo.jpg',
    locality: MALTA_LOCALITIES.find((item) => item.name === locality)?.name || '',
    rating: Number(profile?.rating ?? 5),
    total_bottles_recycled: profile?.total_bottles_recycled ?? 0,
    total_earnings: 0,
  };
}

export async function saveProfile(user: UserProfile, change: { avatar_url: string } | { role: UserRole }) {
  const client = authClient();
  const { error: insertError } = await client.from('profiles').upsert({
    id: user.id,
    full_name: user.full_name,
    phone: user.phone,
    revolut_tag: user.revolut_tag,
    locality: user.locality,
    role: user.role,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (insertError) throw new Error('Could not save your profile.');
  const { error } = await client.from('profiles').update(change).eq('id', user.id);
  if (error) throw new Error('Could not save your profile.');
}

export async function registerWithSupabase(data: {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  revolut_tag: string;
  locality: string;
}) {
  const { email, password, ...metadata } = data;
  const { data: result, error } = await authClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin, data: metadata },
  });
  if (error) throw error;
  return result.session?.user ? loadProfile(result.session.user) : null;
}

export async function signInWithSupabase(email: string, password: string) {
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return loadProfile(data.user);
}

export async function requestPasswordReset(email: string) {
  const { error } = await authClient().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await authClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOutFromSupabase() {
  const { error } = await authClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function pickupRequest(path: string, init: RequestInit = {}, authenticated = true) {
  const headers = new Headers(init.headers);
  if (authenticated) {
    const { data, error } = await authClient().auth.getSession();
    if (error || !data.session) throw new Error('Sign in to continue.');
    headers.set('Authorization', 'Bearer ' + data.session.access_token);
  }
  const result = await fetch('/api/pickups' + path, { ...init, headers, cache: 'no-store' });
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error || 'Pickup request failed.');
  return payload;
}
