'use client';

import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from './types';
import { loadProfile as readProfile, saveProfile as writeProfile } from './profile';
import { supabase } from './supabase';

function authClient() {
  if (!supabase) throw new Error('Account service is unavailable.');
  return supabase;
}

export async function loadProfile(user: User) {
  return readProfile(authClient(), user);
}

export async function saveProfile(user: UserProfile, change: { avatar_url: string } | { role: UserRole }) {
  return writeProfile(authClient(), user, change);
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
