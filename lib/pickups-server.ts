import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { PUBLIC_COLUMNS } from './pickup-visibility';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const pickupsDb = url && key ? createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
}) : null;

export const PRIVATE_COLUMNS = `${PUBLIC_COLUMNS},seller_id,collector_id,seller_name,seller_phone,seller_revolut_tag,address_notes` as const;

export function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function failure(error: string, status: number) {
  return response({ error }, status);
}

export async function requestUser(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token || !pickupsDb) return null;
  const { data, error } = await pickupsDb.auth.getUser(token);
  return error || !data.user || !UUID.test(data.user.id) ? null : data.user;
}

export async function takerAccess(userId: string) {
  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const { data, error } = await pickupsDb.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) return failure('Could not check your active role. Try again.', 503);
  return data?.role === 'taker' ? null : failure('Switch to Taker to view Radar or reserve a pickup.', 403);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
