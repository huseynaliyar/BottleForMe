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
      create table public.pickups (
        id uuid primary key, status text not null,
        seller_id uuid references auth.users(id) on delete set null,
        collector_id uuid references auth.users(id) on delete set null,
        seller_name text default 'Giver', seller_phone text, seller_revolut_tag text, address_notes text, photo_jpeg text
      );
      create table public.pickup_requests (pickup_id uuid not null, status text not null, seller_id uuid, collector_id uuid);
      create table public.pickup_chat_messages (giver_id uuid not null, taker_id uuid not null);
      create table public.marketplace_settings (singleton boolean not null, maintenance boolean not null);
      insert into public.marketplace_settings values (true, false);
      create table public.web_push_subscriptions (user_id uuid);
      create table public.mobile_push_devices (user_id uuid);
      grant select on public.pickups to service_role;
    `);
    for (const name of ['favorites_and_reports', 'archive_pickup_listings', 'pickup_reviews_and_contact', 'marketplace_user_blocks', 'account_lifecycle']) {
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
      insert into public.pickups (id,status,seller_id) values ('${pickup}','open','${seller}');
      insert into public.pickup_requests values ('${pickup}','pending','${seller}','${taker}');
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
    await db.exec("reset role; update public.pickups set status = 'open'; set role service_role");
    assert.equal((await db.query('select id from public.get_radar_pickups($1)', [taker])).rows.length, 1);
    await db.query('insert into public.marketplace_blocks (blocker_id,blocked_id) values ($1,$2)', [seller, taker]);
    assert.equal((await db.query('select id from public.get_radar_pickups($1)', [taker])).rows.length, 0);
    assert.equal((await db.query<{ blocked: boolean }>('select public.is_marketplace_blocked($1,$2) as blocked', [taker, seller])).rows[0].blocked, true);
    await db.exec('reset role');
    await assert.rejects(db.query('update public.pickups set collector_id = $1', [taker]), { code: 'BF008' });
    await assert.rejects(db.query("insert into public.pickup_requests values ($1,'pending',$2,$3)", [pickup, seller, taker]), { code: 'BF008' });
    await assert.rejects(db.query('insert into public.pickup_chat_messages values ($1,$2)', [seller, taker]), { code: 'BF008' });
    await db.query('delete from public.marketplace_blocks where blocker_id = $1', [seller]);
    await db.query('insert into public.pickup_chat_messages values ($1,$2)', [seller, taker]);
    await db.exec(`
      update public.pickups set status = 'reserved' where id = '${pickup}';
      update public.pickups set collector_id = '${taker}' where id = '${pickup}';
      insert into public.web_push_subscriptions values ('${seller}');
    `);
    const changeState = async (action: string) => (await db.query<{ state: string }>(
      'select public.set_account_lifecycle($1,$2) as state', [seller, action],
    )).rows[0].state;
    assert.equal(await changeState('pause'), 'active_pickups');
    await db.exec("update public.pickups set status = 'open', collector_id = null");
    assert.equal(await changeState('pause'), 'paused');
    assert.equal((await db.query('select id from public.get_radar_pickups($1)', [taker])).rows.length, 0);
    assert.equal((await db.query('select user_id from public.web_push_subscriptions')).rows.length, 0);
    await assert.rejects(db.query("insert into public.pickup_requests values ($1,'pending',$2,$3)", [pickup, seller, taker]), { code: 'BF009' });
    assert.equal(await changeState('reactivate'), 'active');
    assert.equal((await db.query('select id from public.get_radar_pickups($1)', [taker])).rows.length, 1);
    assert.equal(await changeState('delete'), 'deleting');
    assert.equal(await changeState('reactivate'), 'deleting');
    await db.exec(`
      update public.pickups set status = 'completed', seller_name = 'Private', address_notes = 'Street', photo_jpeg = 'photo';
      delete from auth.users where id = '${seller}';
    `);
    const retained = await db.query('select seller_id,seller_name,address_notes,photo_jpeg from public.pickups');
    assert.deepEqual(retained.rows, [{ seller_id: null, seller_name: 'Deleted account', address_notes: null, photo_jpeg: null }]);
    await db.exec('set role authenticated');
    for (const table of ['pickup_reviews', 'pickup_favorites', 'marketplace_reports', 'marketplace_blocks', 'marketplace_paused_accounts']) {
      await assert.rejects(db.exec('select * from public.' + table), { code: '42501' });
    }
  } finally {
    await db.close();
  }
});
