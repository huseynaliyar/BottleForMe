import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { failure, pickupsDb, response } from '@/lib/pickups-server';

export const dynamic = 'force-dynamic';

const invalidLink = 'This password reset link is no longer valid. Request a new link.';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const privateKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pickupsDb || !url || !key || !privateKey) return failure('Account service is unavailable.', 503);
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).auth;
  const body = await request.json().catch(() => null);

  if (body?.action === 'inspect') {
    if (typeof body.hash !== 'string' || !/^[a-zA-Z0-9_-]{32,128}$/.test(body.hash)) return failure(invalidLink, 400);
    const { data, error } = await pickupsDb.rpc('is_recovery_link_valid', { supplied_hash: body.hash });
    if (error) return failure('Could not check your reset link. Try refreshing this page.', 503);
    return response({ valid: data === true });
  }

  if (body?.action === 'recover') {
    if (typeof body.hash !== 'string' || !/^[a-zA-Z0-9_-]{32,128}$/.test(body.hash)) return failure(invalidLink, 400);
    if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 256) return failure('Use between 6 and 256 characters for your password.', 400);
    const { error: verifyError, data } = await auth.verifyOtp({ token_hash: body.hash, type: 'recovery' });
    if (verifyError || !data.session) return failure(invalidLink, 400);
    const { error } = await auth.updateUser({ password: body.password });
    if (error) return failure(error.message + ' Request a new reset link to try again.', 400);
    await auth.signOut({ scope: 'local' });
    return response({ ok: true });
  }

  const action = body?.action;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if ((action !== 'otp' && action !== 'reset') || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return failure('Enter a valid email address.', 400);
  }
  if (action === 'otp' && (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))) return failure('Enter your six-digit code.', 400);
  const emailKey = createHmac('sha256', privateKey).update(email).digest('hex');
  const { data: wait, error: limitError } = await pickupsDb.rpc('claim_auth_attempt', { action_name: action, email_key: emailKey });
  if (limitError || typeof wait !== 'number') return failure('Account service is unavailable.', 503);
  if (wait > 0) return response({
    code: 'over_request_rate_limit', retryAfter: wait,
    error: action === 'otp' ? 'Too many code attempts. Wait before trying again.' : 'Wait two minutes between reset requests.',
  }, 429);

  if (action === 'reset') {
    const { error } = await auth.resetPasswordForEmail(email, { redirectTo: 'https://www.bottleforme.com/reset-password' });
    if (error && error.code !== 'user_not_found') return failure('Could not send a password reset link. Try again shortly.', 503);
    return response({ ok: true });
  }

  const { data, error } = await auth.verifyOtp({ email, token: body.code, type: 'email' });
  if (error || !data.session || !data.user?.email_confirmed_at) {
    return response({ code: error?.code, error: error?.message ?? 'Could not confirm your email.' }, 400);
  }
  await pickupsDb.from('auth_action_limits').delete().eq('action', 'otp').eq('email_hash', emailKey);
  return response({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}
