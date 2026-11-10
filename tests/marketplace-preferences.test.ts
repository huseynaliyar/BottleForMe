import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('archive rules and marketplace preferences keep private data under server control', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create table public.profiles (id uuid primary key);
      create table public.pickups (id uuid primary key, status text not null);
      create table public.pickup_requests (pickup_id uuid not null, status text not null);
    `);
    for (const name of ['favorites_and_reports', 'archive_pickup_listings', 'pickup_reviews_and_contact']) {
      const path = new URL('../supabase/migrations/', import.meta.url);
      const filename = readdirSync(path).find((file) => file.endsWith('_' + name + '.sql'));
      assert.ok(filename);
      await db.exec(readFileSync(new URL(filename, path), 'utf8'));
    }
    const seller = '00000000-0000-4000-8000-000000000001';
    const taker = '00000000-0000-4000-8000-000000000002';
    const pickup = '00000000-0000-4000-8000-000000000003';
    await db.exec(`
      insert into auth.users values ('${seller}'), ('${taker}');
      insert into public.profiles (id) values ('${seller}'), ('${taker}');
      insert into public.pickups (id,status) values ('${pickup}','open');
      insert into public.pickup_requests values ('${pickup}','pending');
    `);
    const archive = "update public.pickups set archived_at = now() where id = '" + pickup + "'";
    await assert.rejects(db.exec(archive), { code: 'BF007' });
    await db.exec("update public.pickup_requests set status = 'cancelled'");
    await db.exec(archive);
    await assert.rejects(db.exec("insert into public.pickup_requests values ('" + pickup + "','pending')"), { code: 'BF007' });
    await db.exec("update public.pickups set archived_at = null, status = 'reserved'");
    await assert.rejects(db.exec(archive), { code: 'BF007' });
    await db.exec("update public.pickups set status = 'completed'");
    const result = await db.query<{ share_pickup_phone: boolean }>('select share_pickup_phone from public.profiles');
    assert.ok(result.rows.every((row) => !row.share_pickup_phone));
    await db.exec(`
      set role service_role;
      insert into public.pickup_reviews values ('${pickup}','${seller}','${taker}',4,'Good communication');
      insert into public.pickup_reviews values ('${pickup}','${taker}','${seller}',5,'Ready on time');
    `);
    const summary = await db.query('select * from public.pickup_review_summary($1)', [seller]);
    assert.deepEqual(summary.rows, [{ average: '5.0', count: 1 }]);
    await db.exec('reset role; set role authenticated');
    for (const table of ['pickup_reviews', 'pickup_favorites', 'marketplace_reports']) {
      await assert.rejects(db.exec('select * from public.' + table), { code: '42501' });
    }
  } finally {
    await db.close();
  }
});
