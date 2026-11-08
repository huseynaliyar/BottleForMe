import type { SupabaseClient, User } from '@supabase/supabase-js';
import { MALTA_LOCALITIES, type UserProfile, type UserRole } from './types';

export async function loadProfile(client: SupabaseClient, user: User): Promise<UserProfile> {
  const { data: profile, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
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

export async function saveProfile(client: SupabaseClient, user: UserProfile, change: { avatar_url: string } | { role: UserRole }) {
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
