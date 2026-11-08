import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('admin sends once and each recipient can only read and mark their own inbox', async () => {
  const db = new PGlite();
  const admin = '00000000-0000-0000-0000-000000000001';
  const recipient = '00000000-0000-0000-0000-000000000002';
  const unconfirmed = '00000000-0000-0000-0000-000000000003';
  const targeted = '00000000-0000-0000-0000-000000000004';
  const broadcast = '00000000-0000-0000-0000-000000000005';

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create table public.profiles (id uuid primary key references auth.users(id));
      create function auth.uid() returns uuid language sql
        as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      grant usage on schema auth to authenticated;
      insert into auth.users values
        ('${admin}', 'admin@example.test', now()),
        ('${recipient}', 'recipient@example.test', now()),
        ('${unconfirmed}', 'unconfirmed@example.test', null);
      insert into public.profiles select id from auth.users;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261108144637_admin_inbox.sql', import.meta.url), 'utf8'));

    await db.exec(await readFile(new URL('../supabase/migrations/20261108151118_mobile_push.sql', import.meta.url), 'utf8'));
    await db.exec('set role service_role');
    const installation = '00000000-0000-0000-0000-000000000006';
    const token = 'ExpoPushToken[fixture-token-123]';
    const register = (owner: string) => db.query(
      'select public.register_mobile_push($1, $2, $3) as registered', [installation, owner, token],
    );
    assert.deepEqual((await register(recipient)).rows, [{ registered: true }]);
    const emails = await db.query('select email from public.admin_profile_emails($1::uuid[])', [[recipient]]);
    assert.deepEqual(emails.rows, [{ email: 'recipient@example.test' }]);

    const send = (key: string, to: string | null, message: string) => db.query(
      'select public.send_admin_notification($1, $2, $3, $4, $5) as sent',
      [key, admin, to, 'BottleForMe', message],
    );
    assert.deepEqual((await send(targeted, recipient, 'Private')).rows, [{ sent: 1 }]);
    assert.deepEqual((await send(targeted, recipient, 'Private')).rows, [{ sent: 1 }]);
    await assert.rejects(send(targeted, recipient, 'Different text'), /already used/);
    assert.deepEqual((await send(broadcast, null, 'Announcement')).rows, [{ sent: 2 }]);

    const claim = (batch: string) => db.query(
      'select user_id, token from public.claim_mobile_push($1)', [batch],
    );
    assert.deepEqual((await claim(targeted)).rows, [{ user_id: recipient, token }]);
    assert.equal((await claim(targeted)).rows.length, 0);
    assert.deepEqual((await register(admin)).rows, [{ registered: true }]);
    assert.equal((await claim(broadcast)).rows.length, 0);

    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select title from public.account_notifications'), /permission denied/);

    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [recipient]);
    assert.deepEqual((await db.query('select message from public.account_notifications order by batch_id')).rows,
      [{ message: 'Private' }, { message: 'Announcement' }]);
    await assert.rejects(db.query('select * from public.admin_profile_emails($1::uuid[])', [[admin]]), /permission denied/);
    await assert.rejects(send(targeted, admin, 'Forbidden'), /permission denied/);
    await assert.rejects(claim(targeted), /permission denied/);
    await assert.rejects(register(admin), /permission denied/);
    await assert.rejects(db.query('select token from public.mobile_push_devices'), /permission denied/);
    await assert.rejects(db.query("update public.account_notifications set title = 'Tampered'"), /permission denied/);
    assert.equal((await db.query('update public.account_notifications set read_at = now() where user_id = $1', [admin])).affectedRows, 0);
    assert.equal((await db.query('update public.account_notifications set read_at = now()')).affectedRows, 2);

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    assert.deepEqual((await db.query('select message, read_at from public.account_notifications')).rows,
      [{ message: 'Announcement', read_at: null }]);
  } finally {
    await db.close();
  }
});
