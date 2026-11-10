import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Listing archive is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to archive listings.', 401);
  const body = await request.json().catch(() => null);
  if (typeof body?.pickupId !== 'string' || !UUID.test(body.pickupId) || typeof body?.archived !== 'boolean') {
    return failure('Invalid listing archive request.', 400);
  }
  const { data, error } = await pickupsDb.from('pickups')
    .update({ archived_at: body.archived ? new Date().toISOString() : null })
    .eq('id', body.pickupId).eq('seller_id', user.id).select('id,archived_at').maybeSingle();
  if (error?.code === 'BF007') return failure(error.message, 409);
  if (error?.code === 'BF001') return failure('BottleForMe is under maintenance. Try again shortly.', 503);
  if (error) return failure('Could not update the listing archive.', 503);
  return data ? response(data) : failure('Listing unavailable.', 404);
}
