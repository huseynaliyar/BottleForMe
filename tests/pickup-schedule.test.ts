import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { formatPickupTime, maltaDateTime, parseWindowDrafts, pickupTimeOptions, validateWindows } from '../lib/pickup-schedule';
import { signupCodeError } from '../lib/signup-otp';
import { participantPickup, publicPickup } from '../lib/pickup-visibility';

const day = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
const time = (hour: string) => day + 'T' + hour + ':00.000Z';
const windows = [
  { start: time('10:00'), end: time('11:00') },
  { start: time('12:00'), end: time('13:00') },
];

test('interprets Malta time across daylight saving changes and rejects ambiguous wall times', () => {
  assert.equal(maltaDateTime('2026-01-15', '14:00'), '2026-01-15T13:00:00.000Z');
  assert.equal(maltaDateTime('2026-07-15', '14:00'), '2026-07-15T12:00:00.000Z');
  assert.equal(maltaDateTime('2026-03-29', '02:30'), null);
  assert.equal(maltaDateTime('2026-10-25', '02:30'), null);
  assert.notEqual(formatPickupTime('2026-10-25T00:30:00.000Z'), formatPickupTime('2026-10-25T01:30:00.000Z'));
  assert.equal(maltaDateTime('2026-02-30', '14:00'), null);
  assert.equal(parseWindowDrafts([{ date: '2020-01-15', start: '14:00', end: '18:00' }]), null);
  assert.deepEqual(validateWindows([...windows].reverse()), windows);
  assert.equal(validateWindows([...windows, { start: time('10:30'), end: time('12:30') }]), null);
  assert.deepEqual(pickupTimeOptions(windows), [
    '10:00', '10:15', '10:30', '10:45', '12:00', '12:15', '12:30', '12:45',
  ].map(time));
});

test('signup codes explain invalid, expired, reused and rate-limited responses', () => {
  assert.match(signupCodeError({ code: 'otp_expired' }, 'verify'), /incorrect, expired, or already used/);
  assert.match(signupCodeError({ code: 'over_request_rate_limit' }, 'verify'), /Too many requests/);
  assert.match(signupCodeError({ code: 'over_email_send_rate_limit' }, 'resend'), /Too many requests/);
  assert.match(signupCodeError({ code: 'email_address_not_authorized' }, 'resend'), /cannot receive/);
});

test('migrated database handles scheduling, private notifications and legacy reservations', async () => {
  const db = new PGlite();
  const [seller, collector, rival, giver] = Array.from({ length: 4 }, randomUUID);
  const [offer, legacy, request, competingRequest, invalidRequest] = Array.from({ length: 5 }, randomUUID);
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql
        AS 'SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      GRANT USAGE ON SCHEMA auth TO authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec('CREATE PUBLICATION supabase_realtime FOR TABLE public.pickups');
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const migration of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(migration, migrations), 'utf8'));
    }
    for (const [user, role] of [[seller, 'giver'], [collector, 'taker'], [rival, 'taker'], [giver, 'giver']]) {
      await db.query('INSERT INTO auth.users (id, email_confirmed_at) VALUES ($1, now())', [user]);
      await db.query("INSERT INTO public.profiles (id, full_name, role) VALUES ($1, 'Test user', $2)", [user, role]);
    }
    await db.exec('SET ROLE service_role');
    const create = (id: string, availability: typeof windows | null) => db.query(`
      INSERT INTO public.pickups (id, seller_id, seller_name, locality, address_notes, bag_count,
        estimated_bottles, total_bcrs_value, seller_payout, collector_profit, availability)
      VALUES ($1, $2, 'Seller', 'Sliema', 'Private door', 1, 1, 0.1, 0, 0.1, $3)`,
    [id, seller, availability ? JSON.stringify(availability) : null]);
    await assert.rejects(create(offer, [{ start: '2020-01-01T10:00:00.000Z', end: '2020-01-01T11:00:00.000Z' }]), /future/);
    await assert.rejects(create(offer, [windows[0], windows[0]]), /non-overlapping/);
    await create(offer, windows);
    await create(legacy, null);
    const act = async (actor: string, operation: string, id: string | null, {
      at = null as string | null, kind = null as string | null, version = null as number | null,
      availability = null as typeof windows | null,
    } = {}) => (await db.query<{ ok: boolean }>(
      'SELECT public.manage_pickup_schedule($1,$2,$3,$4,$5,$6,$7,$8) AS ok',
      [offer, actor, operation, id, at, kind, version, availability && JSON.stringify(availability)],
    )).rows[0].ok;
    const transition = (listing: string, actor: string, status: string) =>
      db.query('SELECT * FROM public.transition_pickup($1,$2,$3)', [listing, actor, status]);
    const endpoint = 'https://fcm.googleapis.com/fcm/send/test-browser';
    const registerPush = (owner: string) => db.query(
      'SELECT public.register_web_push($1,$2,$3,$4)', [owner, endpoint, 'browser-public-key', 'browser-auth'],
    );
    await registerPush(seller);
    assert.equal((await transition(offer, collector, 'reserved')).rows.length, 0);
    assert.equal((await transition(legacy, collector, 'reserved')).rows.length, 1);
    assert.equal(await act(giver, 'request', request, { at: time('10:15'), kind: 'available' }), false);
    assert.equal(await act(collector, 'request', request, { at: time('11:00'), kind: 'available' }), false);
    assert.equal(await act(collector, 'request', request, { at: '2020-01-01T09:00:00.000Z', kind: 'alternative' }), false);
    const initial = { at: time('10:15'), kind: 'available' };
    assert.equal(await act(collector, 'request', request, initial), true);
    assert.equal(await act(collector, 'request', request, initial), true);
    assert.equal(await act(collector, 'request', invalidRequest, initial), false);
    assert.equal(await act(collector, 'accept', request, { version: 0 }), false);
    assert.equal(await act(rival, 'accept', request, { version: 0 }), false);
    assert.equal(await act(giver, 'availability', null, { version: 0, availability: [windows[1]] }), false);
    assert.equal(await act(seller, 'availability', null, { version: 0, availability: [windows[1]] }), true);
    assert.equal(await act(seller, 'availability', null, { version: 0, availability: windows }), false);
    assert.equal(await act(rival, 'request', competingRequest, { at: time('15:00'), kind: 'alternative' }), true);
    const [before] = (await db.query<Parameters<typeof participantPickup>[0]>('SELECT * FROM public.pickups WHERE id=$1', [offer])).rows;
    assert.equal(before.status, 'open');
    assert.equal(publicPickup(before).address_notes, '');
    assert.equal(participantPickup(before, rival).address_notes, '');
    assert.equal(await act(seller, 'reject', request, { version: 0 }), true);
    assert.equal(await act(collector, 'request', invalidRequest, { at: time('12:15'), kind: 'available' }), true);
    assert.equal(await act(seller, 'counter', competingRequest, { version: 0, at: time('16:00') }), true);
    assert.equal(await act(seller, 'accept', competingRequest, { version: 1 }), false);

    const [confirmed, competing] = await Promise.all([
      act(rival, 'accept', competingRequest, { version: 1 }),
      act(seller, 'accept', invalidRequest, { version: 0 }),
    ]);
    assert.equal(Number(confirmed) + Number(competing), 1);
    const assigned = confirmed ? rival : collector;
    const [after] = (await db.query<Parameters<typeof participantPickup>[0]>('SELECT * FROM public.pickups WHERE id=$1', [offer])).rows;
    assert.equal(after.status, 'reserved');
    assert.equal(after.collector_id, assigned);
    assert.equal(participantPickup(after, assigned).address_notes, 'Private door');
    assert.equal(participantPickup(after, confirmed ? collector : rival).address_notes, '');
    assert.equal(await act(seller, 'availability', null, { version: 1, availability: windows }), false);
    assert.equal((await transition(offer, assigned, 'cancelled')).rows.length, 1);

    const claimed = await db.query<{ endpoint: string; lease_id: string; title: string; message: string }>('SELECT * FROM public.claim_web_push()');
    assert.ok(claimed.rows.length > 0 && claimed.rows.every((job) => job.endpoint === endpoint && job.lease_id));
    assert.ok(claimed.rows.some((job) => job.title === 'Pickup time requested'));
    assert.ok(claimed.rows.every((job) => job.message === 'Open Handover in BottleForMe to see the pickup arrangement.'));
    assert.ok(claimed.rows.every((job) => job.title !== 'Another pickup time proposed'), 'other recipients titles are private');
    assert.equal((await db.query('SELECT * FROM public.claim_web_push()')).rows.length, 0, 'leased jobs are not claimed twice');
    await registerPush(collector);
    assert.equal((await db.query('SELECT * FROM public.web_push_jobs')).rows.length, 0, 'a new browser owner does not inherit pending jobs');
    await db.exec('RESET ROLE');
    const notices = (await db.query<{ title: string; user_id: string }>('SELECT title, user_id FROM public.account_notifications')).rows;
    assert.equal(notices.filter((notice) => notice.title === 'Pickup time requested' && notice.user_id === seller).length, 2);
    assert.ok(notices.some((notice) => notice.title === 'Alternative pickup time proposed' && notice.user_id === seller));
    assert.ok(notices.some((notice) => notice.title === 'Another pickup time proposed' && notice.user_id === rival));
    assert.ok(notices.some((notice) => notice.title === 'Pickup request declined' && notice.user_id === collector));
    assert.ok(notices.some((notice) => notice.title === 'Pickup time confirmed'));
    assert.ok(notices.some((notice) => notice.title === 'Pickup is no longer available'));
    assert.ok(notices.some((notice) => notice.title === 'Pickup arrangement cancelled' && notice.user_id === seller));

    await db.exec('SET ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [giver]);
    assert.equal((await db.query('SELECT * FROM public.pickup_requests')).rows.length, 0);
    await assert.rejects(act(giver, 'accept', request, { version: 0 }), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public.web_push_subscriptions'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public.claim_web_push()'), /permission denied/);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [assigned]);
    const own = (await db.query<{ status: string }>('SELECT status FROM public.pickup_requests')).rows;
    assert.ok(own.some((row) => row.status === 'cancelled'));
    assert.ok(own.every((row) => row.status !== 'accepted'));
    await assert.rejects(db.query("UPDATE public.pickup_requests SET status='pending'"), /permission denied/);
  } finally {
    await db.close();
  }
});
