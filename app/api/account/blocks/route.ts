import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

export async function GET(request: Request) {
  const db = pickupsDb;
  if (!db) return failure('Blocked accounts are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to manage blocked accounts.', 401);
  const { data, error } = await db.from('marketplace_blocks').select('blocked_id')
    .eq('blocker_id', user.id).order('created_at', { ascending: false }).limit(100);
  if (error) return failure('Could not load blocked accounts.', 503);
  const ids = data.map((row) => row.blocked_id);
  if (!ids.length) return response({ accounts: [] });
  const profiles = await db.from('profiles').select('id,full_name').in('id', ids);
  if (profiles.error) return failure('Could not load blocked accounts.', 503);
  const names = new Map(profiles.data.map((row) => [row.id, row.full_name]));
  return response({ accounts: ids.map((id) => ({ id, name: names.get(id) || 'BottleForMe account' })) });
}

export async function POST(request: Request) {
  const db = pickupsDb;
  if (!db) return failure('Account blocking is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to block a pickup partner.', 401);
  const body = await request.json().catch(() => null);
  if (typeof body?.pickupId !== 'string' || !UUID.test(body.pickupId)) return failure('Invalid pickup.', 400);
  const { data, error } = await db.from('pickups').select('seller_id,collector_id').eq('id', body.pickupId)
    .or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).maybeSingle();
  if (error) return failure('Could not look up the pickup partner.', 503);
  const other = data?.seller_id === user.id ? data.collector_id : data?.seller_id;
  if (!other || other === user.id) return failure('Pickup partner unavailable.', 404);
  const saved = await db.from('marketplace_blocks').upsert({ blocker_id: user.id, blocked_id: other }, {
    onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true,
  });
  return saved.error ? failure('Could not block the account.', 503) : response({ ok: true });
}

export async function DELETE(request: Request) {
  const db = pickupsDb;
  if (!db) return failure('Account blocking is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to unblock an account.', 401);
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== 'string' || !UUID.test(body.id)) return failure('Invalid blocked account.', 400);
  const { error } = await db.from('marketplace_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', body.id);
  return error ? failure('Could not unblock the account.', 503) : response({ ok: true });
}
