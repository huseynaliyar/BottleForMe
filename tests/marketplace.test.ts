import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { GET as authCallback } from '../app/auth/callback/route';
import { PGlite } from '@electric-sql/pglite';
import { validatePickup } from '../lib/pickup-validation';
import { calculateDepositSplit, PickupOffer } from '../lib/types';
import { participantPickup, publicPickup } from '../lib/pickup-visibility';

const valid = {
  locality: 'Sliema',
  address_notes: 'Door 1',
  bag_count: 2,
  split_percentage: 50,
  payout_method: 'cash',
  containers: { plastic_bottles: 3, cans: 1, glass_bottles: 1 },
};

test('voucher math conserves cents across every supported split and rounds a half cent up', () => {
  assert.equal(calculateDepositSplit(0, 0, 0, 50).totalDepositValue, 0);
  assert.equal(calculateDepositSplit(1, 0, 0, 5).sellerPayout, 0.01);
  assert.deepEqual(calculateDepositSplit(35, 25, 15, 70), {
    totalContainers: 75, totalDepositValue: 7.5, sellerPayout: 5.25, collectorProfit: 2.25,
  });

  for (let percentage = 0; percentage <= 70; percentage++) {
    const result = calculateDepositSplit(3, 1, 1, percentage);
    assert.equal(Math.round(result.sellerPayout * 100) + Math.round(result.collectorProfit * 100), 50);
    assert.ok(result.collectorProfit >= 0);
  }
});

test('rejects invalid counts, empty listings, invalid terms and malformed payment handles', () => {
  for (const count of [-1, 1.5, Infinity, NaN, 10_001, '3', null]) {
    assert.equal(validatePickup({ ...valid, containers: { ...valid.containers, cans: count } }), null);
  }
  for (const change of [
    { containers: { plastic_bottles: 0, cans: 0, glass_bottles: 0 } },
    { containers: { plastic_bottles: 5000, cans: 5000, glass_bottles: 1 } },
    { split_percentage: 71 }, { split_percentage: -1 }, { split_percentage: 2.5 }, { split_percentage: '50' },
    { bag_count: 0 }, { bag_count: 21 }, { bag_count: 1.5 },
    { locality: '<img src=x onerror=alert(1)>' }, { address_notes: ' ' },
    { payout_method: 'revolut' }, { payout_method: 'revolut', seller_revolut_tag: '@alex?amount=0' },
  ]) {
    assert.equal(validatePickup({ ...valid, ...change }), null);
  }
  assert.equal(validatePickup(null), null);
  assert.equal(validatePickup({ ...valid, containers: { plastic_bottles: 10_000, cans: 0, glass_bottles: 0 } })?.estimated_bottles, 10_000);
});

test('server derives ownership-independent amounts from exact counts, not bags or client totals', () => {
  const offer = validatePickup({ ...valid, bag_count: 20, estimated_bottles: 888, seller_payout: 1000 });
  assert.equal(offer?.estimated_bottles, 5);
  assert.equal(offer?.total_bcrs_value, 0.5);
  assert.equal(offer?.seller_payout, 0.25);
  assert.equal(offer?.collector_profit, 0.25);
  assert.equal(validatePickup({ ...valid, split_percentage: 0, payout_method: 'revolut' })?.seller_revolut_tag, null);
  assert.equal(validatePickup({ ...valid, payout_method: 'revolut', seller_revolut_tag: ' alice_1 ' })?.seller_revolut_tag, '@alice_1');
});

test('public pickup projection removes private details and uses a locality center', () => {
  const row: Partial<PickupOffer> = {
    id: 'fixture', locality: 'Sliema', seller_id: 'seller', collector_id: 'taker',
    seller_name: 'Private seller name', seller_phone: '555', seller_revolut_tag: '@tag',
    address_notes: 'Door 1', lat: 35.9, lng: 14.5,
  };
  const publicRow = publicPickup(row);
  assert.equal(publicRow.lat, 35.9122);
  assert.equal(publicRow.address_notes, '');
  assert.equal(publicRow.seller_name, 'Giver');
  for (const field of ['seller_id', 'collector_id', 'seller_phone', 'seller_revolut_tag']) {
    assert.equal(Object.hasOwn(publicRow, field), false);
  }
  assert.equal(participantPickup({ ...row, status: 'reserved' }, 'taker').address_notes, 'Door 1');
  assert.equal(participantPickup({ ...row, status: 'completed' }, 'taker').address_notes, '');
  assert.equal(participantPickup({ ...row, status: 'completed' }, 'seller').address_notes, 'Door 1');
});

test('legacy auth links redirect to the same origin without asserting verification', () => {
  const result = authCallback();
  assert.equal(result.status, 307);
  assert.equal(result.headers.get('location'), '/');
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('migration secures legacy data and enforces participant transitions in PostgreSQL', async () => {
  const db = new PGlite();
  const seller = '00000000-0000-0000-0000-000000000001';
  const taker = '00000000-0000-0000-0000-000000000002';
  const other = '00000000-0000-0000-0000-000000000003';
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql
        AS 'SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      GRANT USAGE ON SCHEMA auth TO authenticated;
      INSERT INTO auth.users VALUES ('${seller}'), ('${taker}'), ('${other}');
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.exec(`
      CREATE PUBLICATION supabase_realtime FOR TABLE public.pickups;
      GRANT ALL ON public.pickups, public.profiles TO anon, authenticated;
      CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
      CREATE POLICY "Anyone can view open and active pickups" ON public.pickups FOR SELECT USING (true);
      CREATE POLICY "Authenticated users or anonymous guests can create pickups" ON public.pickups FOR INSERT WITH CHECK (true);
      CREATE POLICY "Collectors and sellers can update their pickup status" ON public.pickups FOR UPDATE USING (true);
      INSERT INTO public.profiles (id, full_name, phone, role) VALUES ('${seller}', 'Seller', '123456', 'resident');
      INSERT INTO public.pickups (seller_name, locality, address_notes, bag_count, estimated_bottles,
        total_bcrs_value, seller_payout, collector_profit) VALUES ('Legacy', 'Sliema', 'Private legacy address', 1, 1, 0.1, 0, 0.1);
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202611080001_secure_marketplace.sql', import.meta.url), 'utf8'));
    const legacy = await db.query<{ id: string; address_notes: string }>('SELECT id, address_notes FROM public.pickups');
    assert.equal(legacy.rows[0].address_notes, 'Private legacy address');

    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.pickups'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public.profiles'), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [taker]);
    assert.equal((await db.query('SELECT * FROM public.profiles')).rows.length, 0);
    await assert.rejects(db.query('UPDATE public.pickups SET status = $1', ['cancelled']), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public.transition_pickup($1, $2, $3)', [legacy.rows[0].id, taker, 'reserved']), /permission denied/);
    await db.query("INSERT INTO public.profiles (id, full_name, role) VALUES ($1, 'Taker', 'taker')", [taker]);
    await assert.rejects(db.query("INSERT INTO public.profiles (id, full_name) VALUES ($1, 'Other')", [other]), /row-level security/);
    await assert.rejects(db.query('UPDATE public.profiles SET total_bottles_recycled = 1000'), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE service_role');

    const insert = await db.query<{ id: string }>(`INSERT INTO public.pickups (seller_id, seller_name, locality,
      address_notes, bag_count, estimated_bottles, total_bcrs_value, seller_payout, collector_profit)
      VALUES ($1, 'Seller', 'Sliema', 'Private address', 1, 1, 0.1, 0, 0.1) RETURNING id`, [seller]);
    const id = insert.rows[0].id;
    const transition = (actor: string, status: string, pickup = id) =>
      db.query<{ collector_id: string; status: string; updated_at: Date }>(
        'SELECT collector_id, status, updated_at FROM public.transition_pickup($1, $2, $3)', [pickup, actor, status]);

    assert.equal((await transition(taker, 'reserved', legacy.rows[0].id)).rows.length, 0);
    assert.equal((await transition(seller, 'reserved')).rows.length, 0);
    assert.equal((await transition(taker, 'completed')).rows.length, 0);
    const [claim, competingClaim] = await Promise.all([transition(taker, 'reserved'), transition(other, 'reserved')]);
    assert.equal(claim.rows[0].collector_id, taker);
    assert.equal(competingClaim.rows.length, 0);
    assert.equal((await transition(other, 'cancelled')).rows.length, 0);
    assert.equal((await transition(other, 'completed')).rows.length, 0);
    assert.equal((await transition(taker, 'arrived')).rows.length, 0);
    assert.equal((await transition(taker, 'en_route')).rows[0].status, 'en_route');
    assert.equal((await transition(taker, 'arrived')).rows[0].status, 'arrived');
    const completed = (await transition(taker, 'completed')).rows[0];
    assert.equal(completed.status, 'completed');
    assert.deepEqual((await transition(taker, 'completed')).rows[0].updated_at, completed.updated_at);
    assert.equal((await transition(seller, 'cancelled')).rows.length, 0);
  } finally {
    await db.close();
  }
});
