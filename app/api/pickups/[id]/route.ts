import type { PickupOffer } from '@/lib/types';
import { INITIAL_OFFERS } from '@/lib/mock-data';
import { failure, pickupsDb, PRIVATE_COLUMNS, requestUser, response, UUID } from '@/lib/pickups-server';
import { participantPickup, PUBLIC_COLUMNS, publicPickup } from '@/lib/pickup-visibility';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!pickupsDb && process.env.NODE_ENV === 'development') {
    const fixture = INITIAL_OFFERS.find((offer) => offer.id === id && offer.status === 'open');
    if (fixture) return response(publicPickup(fixture));
  }
  if (!UUID.test(id)) return failure('Pickup not found.', 404);
  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const user = await requestUser(request);
  if (user) {
    const { data, error } = await pickupsDb.from('pickups').select(PRIVATE_COLUMNS).eq('id', id)
      .or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).maybeSingle();
    if (error) return failure('Could not load the pickup.', 503);
    if (data) return response(participantPickup(data, user.id));
  }
  const { data, error } = await pickupsDb.from('pickups').select(PUBLIC_COLUMNS).eq('id', id)
    .eq('status', 'open').not('seller_id', 'is', null).maybeSingle();
  if (error) return failure('Could not load the pickup.', 503);
  return data ? response(publicPickup(data)) : failure('Pickup not found.', 404);
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return failure('Pickup not found.', 404);
  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to update a pickup.', 401);
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== 'reserved' && status !== 'en_route' && status !== 'arrived' &&
      status !== 'completed' && status !== 'cancelled') return failure('Invalid pickup status.', 400);

  const { data, error } = await pickupsDb.rpc('transition_pickup', {
    pickup_id: id, actor_id: user.id, next_status: status,
  }).maybeSingle();
  if (error) return failure('Could not update the pickup.', 503);
  if (data) return response(participantPickup(data as PickupOffer & { status: string }, user.id));
  return failure('Pickup is unavailable or this change is no longer allowed.', 409);
}
