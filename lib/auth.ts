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
  // Default to Demo Giver on first visit so user experience is immediate
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

export async function registerUser(data: {
  full_name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone: string;
  revolut_tag: string;
  locality: string;
  avatar_url?: string;
}): Promise<UserProfile> {
  const newUser: UserProfile = {
    id: `usr-${Date.now()}`,
    email: data.email,
    full_name: data.full_name,
    phone: data.phone,
    revolut_tag: data.revolut_tag.startsWith('@') ? data.revolut_tag : `@${data.revolut_tag}`,
    role: data.role,
    avatar_url: data.avatar_url || '/logo.jpg',
    locality: data.locality,
    rating: 5.0,
    total_bottles_recycled: 0,
    total_earnings: 0,
    created_at: new Date().toISOString(),
  };

  // If Supabase is configured, also attempt to sync profile
  if (isSupabaseConfigured() && supabase && data.password) {
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            role: data.role,
          },
        },
      });

      if (!authErr && authData.user) {
        newUser.id = authData.user.id;
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          full_name: data.full_name,
          phone: data.phone,
          revolut_tag: newUser.revolut_tag,
          role: data.role,
          avatar_url: newUser.avatar_url,
        });
      }
    } catch (e) {
      console.warn('Supabase auth sign up fallback to local profile:', e);
    }
  }

  saveStoredUser(newUser);
  return newUser;
}
