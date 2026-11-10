import { createClient } from '@supabase/supabase-js';
import { failure, pickupsDb, requestUser, response } from '@/lib/pickups-server';

export async function GET(request: Request) {
  if (!pickupsDb) return failure('Account management is unavailable.', 503);
  const user = await requestUser(request, true);
  if (!user) return failure('Sign in to manage your account.', 401);
  const { data, error } = await pickupsDb.from('marketplace_paused_accounts').select('deleting').eq('user_id', user.id).maybeSingle();
  if (error) return failure('Could not load your account status.', 503);
  return response({ paused: !!data, deleting: data?.deleting === true });
}

export async function POST(request: Request) {
  const db = pickupsDb;
  if (!db) return failure('Account management is unavailable.', 503);
  const user = await requestUser(request, true);
  if (!user) return failure('Sign in to manage your account.', 401);
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== 'pause' && action !== 'reactivate' && action !== 'delete') return failure('Invalid account action.', 400);

  if (action === 'delete') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return failure('Account deletion is unavailable.', 503);
    if (!user.email || typeof body.password !== 'string' || !body.password || body.password.length > 256) {
      return failure('Enter your current password to delete the account.', 400);
    }
    const verification = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const result = await verification.auth.signInWithPassword({ email: user.email, password: body.password });
    if (result.error?.status === 429) return failure('Too many attempts. Try again later.', 429);
    if (result.error || result.data.user?.id !== user.id || !result.data.session) return failure('The password could not be verified.', 401);
    await verification.auth.signOut({ scope: 'local' });
  }

  const { data, error } = await db.rpc('set_account_lifecycle', { actor: user.id, operation: action });
  if (error) return failure('Could not update your account. Try again.', 503);
  if (data === 'active_pickups') return failure('Complete or cancel active pickups and pending requests first. Contact support if you need help.', 409);
  if (data === 'maintenance') return failure('Account deletion is temporarily unavailable during maintenance. Try again shortly.', 503);
  if (action === 'reactivate' && data === 'deleting') return failure('Deletion is pending. Retry deletion or contact support.', 409);
  if (action === 'delete') {
    if (data !== 'deleting') return failure('Could not start account deletion.', 503);
    const removed = await db.auth.admin.deleteUser(user.id);
    if (removed.error) return failure('Deletion is pending. Retry or contact support.', 503);
    return response({ deleted: true });
  }
  return response({ paused: data !== 'active', deleting: data === 'deleting' });
}
