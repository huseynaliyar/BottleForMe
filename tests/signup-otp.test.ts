import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftTermsVersion } from '../lib/draft-terms';
import { signupCodeError } from '../lib/signup-otp';

test('signup requires confirmation and delegates code validation and resend to Supabase Auth', async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only';
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true, value: { location: { origin: 'http://127.0.0.1:3100' } },
  });
  t.after(() => {
    if (windowBefore) Object.defineProperty(globalThis, 'window', windowBefore);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  const email = 'new-giver@example.test';
  const user = {
    id: '762a9415-7ee1-4ca6-a83b-bba3a23ac791',
    aud: 'authenticated',
    email,
    app_metadata: {},
    user_metadata: { full_name: 'New Giver', role: 'giver', locality: 'Sliema', terms_version: draftTermsVersion },
    created_at: '2026-11-09T00:00:00.000Z',
  };
  let token = '123456';
  let expired = false;
  let confirmed = false;
  let duplicate = false;
  const access = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600, sub: user.id, role: 'authenticated',
  })).toString('base64url') + '.c2ln';
  let profileReads = 0;
  let recoveries = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input, 'http://127.0.0.1:3100');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'x-supabase-api-version': '2024-01-01' } });
    switch (url.pathname) {
      case '/auth/v1/signup':
        assert.equal(body.email, email);
        assert.equal(body.data.terms_version, draftTermsVersion);
        return json({ ...user, identities: duplicate ? [] : [{ id: user.id, provider: 'email' }] });
      case '/auth/v1/resend':
        assert.equal(body.type, 'signup');
        token = '654321';
        expired = false;
        return json({});
      case '/api/auth/email':
        assert.equal(body.email, email);
        if (body.action === 'reset') { recoveries += 1; return json({ ok: true }); }
        assert.equal(body.action, 'otp');
        if (confirmed || expired || body.code !== token) return json({ code: 'otp_expired', error: 'Token has expired or is invalid' }, 400);
        confirmed = true;
        return json({ access_token: access, refresh_token: 'fixture-refresh' });
      case '/auth/v1/user':
        return json({ ...user, email_confirmed_at: user.created_at });
      case '/auth/v1/token':
        return confirmed
          ? json({ access_token: access, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user })
          : json({ code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400);
      case '/rest/v1/profiles':
        profileReads += 1;
        return json([{ id: user.id, ...user.user_metadata }]);
      default:
        throw new Error('Unexpected auth fixture request ' + url.pathname);
    }
  });

  const { registerWithSupabase, requestPasswordReset, resendSignupCode, signInWithSupabase, verifySignupCode } = await import('../lib/auth');
  const { supabase } = await import('../lib/supabase');
  t.after(async () => { await supabase?.auth.stopAutoRefresh(); });

  await registerWithSupabase({ ...user.user_metadata, email, password: 'test-password', role: 'giver', phone: '', revolut_tag: '' });
  assert.equal(profileReads, 0);
  await assert.rejects(signInWithSupabase(email, 'test-password'), { code: 'email_not_confirmed' });
  const invalid = (error: unknown) => {
    assert.match(signupCodeError(error, 'verify'), /incorrect, expired, or already used/);
    return true;
  };
  await assert.rejects(verifySignupCode(email, '111111'), invalid);
  expired = true;
  await assert.rejects(verifySignupCode(email, '123456'), invalid);
  await resendSignupCode(email);
  const profile = await verifySignupCode(email, '654321');
  assert.equal(profile.id, user.id);
  assert.equal(profileReads, 1);
  await assert.rejects(verifySignupCode(email, '654321'), invalid);
  assert.equal((await signInWithSupabase(email, 'test-password')).id, user.id);
  await requestPasswordReset(email);
  assert.equal(recoveries, 1);
  duplicate = true;
  await assert.rejects(registerWithSupabase({ ...user.user_metadata, email, password: 'test-password', role: 'giver', phone: '', revolut_tag: '' }), /account.*already exists/i);
});
