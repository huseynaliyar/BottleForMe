'use client';

import { UserProfile, UserRole } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

export const DEMO_GIVER: UserProfile = {
  id: 'usr-giver-maria',
  email: 'maria@bottleforme.mt',
  full_name: 'Maria Borg',
  phone: '+356 9912 3456',
  revolut_tag: '@maria_mlt',
  role: 'giver',
  avatar_url: '/logo.jpg',
  locality: 'Sliema',
  rating: 4.95,
  total_bottles_recycled: 185,
  total_earnings: 9.25,
};

export const DEMO_TAKER: UserProfile = {
  id: 'usr-taker-alex',
  email: 'alex@bottleforme.mt',
  full_name: 'Alex Zammit',
  phone: '+356 7955 8899',
  revolut_tag: '@alex_collector',
  role: 'taker',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  locality: 'Gzira',
  rating: 5.0,
  total_bottles_recycled: 430,
  total_earnings: 32.50,
};

const STORAGE_KEY = 'bottleforme_current_user';

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return DEMO_GIVER;
}

export function saveStoredUser(user: UserProfile | null) {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

/**
 * Register securely with Supabase Auth & create database profile
 */
export async function registerWithSupabase(data: {
  full_name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone: string;
  revolut_tag: string;
  locality: string;
  avatar_url?: string;
}): Promise<{ user: UserProfile; message?: string }> {
  const revolut = data.revolut_tag.startsWith('@') ? data.revolut_tag : `@${data.revolut_tag}`;

  if (isSupabaseConfigured() && supabase && data.password) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          role: data.role,
          phone: data.phone,
          revolut_tag: revolut,
          locality: data.locality,
        },
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const userId = authData.user?.id || `usr-${Date.now()}`;

    // Upsert into public.profiles
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: data.full_name,
        phone: data.phone,
        revolut_tag: revolut,
        role: data.role,
        avatar_url: data.avatar_url || '/logo.jpg',
      });
    } catch (e) {
      console.warn('Profile DB upsert note:', e);
    }

    const newUser: UserProfile = {
      id: userId,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      revolut_tag: revolut,
      role: data.role,
      avatar_url: data.avatar_url || '/logo.jpg',
      locality: data.locality,
      rating: 5.0,
      total_bottles_recycled: 0,
      total_earnings: 0,
      created_at: new Date().toISOString(),
    };

    saveStoredUser(newUser);

    const requiresEmailConfirm = !authData.session;
    return {
      user: newUser,
      message: requiresEmailConfirm
        ? 'Account created! Please check your email inbox to confirm your address.'
        : undefined,
    };
  }

  // Fallback if client offline / demo
  const fallbackUser: UserProfile = {
    id: `usr-${Date.now()}`,
    email: data.email,
    full_name: data.full_name,
    phone: data.phone,
    revolut_tag: revolut,
    role: data.role,
    avatar_url: data.avatar_url || '/logo.jpg',
    locality: data.locality,
    rating: 5.0,
    total_bottles_recycled: 0,
    total_earnings: 0,
    created_at: new Date().toISOString(),
  };

  saveStoredUser(fallbackUser);
  return { user: fallbackUser };
}

/**
 * Sign In securely with Supabase Auth
 */
export async function signInWithSupabase(
  email: string,
  password: string
): Promise<UserProfile> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('No user returned from Supabase authentication.');
    }

    // Fetch profile from database
    let profileData: any = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      profileData = profile;
    } catch (e) {
      console.warn('Failed to fetch profile row:', e);
    }

    const meta = data.user.user_metadata || {};
    const loggedInUser: UserProfile = {
      id: data.user.id,
      email: data.user.email || email,
      full_name: profileData?.full_name || meta.full_name || email.split('@')[0],
      phone: profileData?.phone || meta.phone || '+356 9900 1122',
      revolut_tag: profileData?.revolut_tag || meta.revolut_tag || `@${email.split('@')[0]}`,
      role: (profileData?.role as UserRole) || (meta.role as UserRole) || 'giver',
      avatar_url: profileData?.avatar_url || meta.avatar_url || '/logo.jpg',
      locality: profileData?.locality || meta.locality || 'Sliema',
      rating: profileData?.rating ? Number(profileData.rating) : 5.0,
      total_bottles_recycled: profileData?.total_bottles_recycled || 0,
      total_earnings: profileData?.total_earnings || 0,
    };

    saveStoredUser(loggedInUser);
    return loggedInUser;
  }

  // Fallback demo signin
  const localUser: UserProfile = {
    id: `usr-${Date.now()}`,
    email,
    full_name: email.split('@')[0] || 'User',
    phone: '+356 9900 1122',
    revolut_tag: `@${email.split('@')[0]}`,
    role: 'giver',
    avatar_url: '/logo.jpg',
    locality: 'Sliema',
    rating: 5.0,
    total_bottles_recycled: 10,
    total_earnings: 1.0,
  };

  saveStoredUser(localUser);
  return localUser;
}

/**
 * Sign out from Supabase & clear storage
 */
export async function signOutFromSupabase() {
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
  }
  saveStoredUser(null);
}
