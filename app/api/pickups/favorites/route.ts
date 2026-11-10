import { failure, pickupsDb, requestUser, response, takerAccess, UUID } from '@/lib/pickups-server';

export async function GET(request: Request) {
  if (!pickupsDb) return failure('Favorites are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to view favorites.', 401);
  const access = await takerAccess(user.id);
  if (access) return access;
  const saved = await pickupsDb.from('pickup_favorites').select('pickup_id').eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (saved.error) return failure('Could not load favorites.', 503);
  const ids = saved.data.map(({ pickup_id }) => pickup_id as string);
  return response({ ids });
}

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Favorites are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to manage favorites.', 401);
  const access = await takerAccess(user.id);
  if (access) return access;
  const body = await request.json().catch(() => null);
  if (typeof body?.pickupId !== 'string' || !UUID.test(body.pickupId) || typeof body?.saved !== 'boolean') {
    return failure('Invalid favorite.', 400);
  }

  if (!body.saved) {
    const { error } = await pickupsDb.from('pickup_favorites').delete().eq('user_id', user.id).eq('pickup_id', body.pickupId);
    return error ? failure('Could not remove this favorite.', 503) : response({ ok: true });
  }
  const listing = await pickupsDb.from('pickups').select('id').eq('id', body.pickupId)
    .eq('status', 'open').is('archived_at', null).is('collector_id', null).not('seller_id', 'is', null).neq('seller_id', user.id).maybeSingle();
  if (listing.error) return failure('Could not check this listing.', 503);
  if (!listing.data) return failure('This listing is no longer available.', 404);
  const { error } = await pickupsDb.from('pickup_favorites').upsert({ user_id: user.id, pickup_id: body.pickupId },
    { onConflict: 'user_id,pickup_id', ignoreDuplicates: true });
  return error ? failure('Could not save this favorite.', 503) : response({ ok: true });
}
