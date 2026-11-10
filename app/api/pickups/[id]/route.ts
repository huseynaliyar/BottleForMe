import { after } from 'next/server';
import { drainPush } from '@/lib/push-server';
import type { PickupOffer } from '@/lib/types';
import { failure, pickupRestrictionResponse, pickupsDb, PRIVATE_COLUMNS, requestUser, response, takerAccess, UUID } from '@/lib/pickups-server';
import { participantPickup, RADAR_COLUMNS, publicPickup } from '@/lib/pickup-visibility';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return failure('Pickup not found.', 404);
  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const user = await requestUser(request);
  if (user) {
    const { data, error } = await pickupsDb.from('pickups').select(PRIVATE_COLUMNS).eq('id', id)
      .or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).maybeSingle();
    if (error) return failure('Could not load the pickup.', 503);
    if (data) return response(participantPickup(data, user.id));
  }
  if (!user) return failure('Sign in as a Taker to view Radar.', 401);
  const blocked = await takerAccess(user.id);
  if (blocked) return blocked;
  const { data, error } = await pickupsDb.rpc('get_radar_pickups', { viewer: user.id }).select(RADAR_COLUMNS).eq('id', id).maybeSingle();
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

  if (status === 'reserved') {
    const blocked = await takerAccess(user.id);
    if (blocked) return blocked;
  }

  if (status === 'completed') {
    if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) return failure('Enter the six-digit code shown by the Giver.', 400);
    const result = await pickupsDb.rpc('complete_handover', { listing_id: id, actor_id: user.id, supplied_code: body.code });
    if (result.error?.code === 'BF001') return failure('BottleForMe is under maintenance. Try again shortly.', 503);
    if (result.error) return failure('Could not verify the handover. Try again.', 503);
    if (result.data === 'locked') return failure('Too many incorrect codes. Try again in 30 minutes.', 429);
    if (result.data === 'incorrect') return failure('The handover code is incorrect.', 400);
    if (result.data === 'no_code') return failure('Ask the Giver to open and show the handover code first.', 409);
    if (result.data !== 'completed') return failure('This handover is not available.', 409);
    after(() => drainPush().catch(() => {}));
    const updated = await pickupsDb.from('pickups').select(PRIVATE_COLUMNS).eq('id', id).eq('collector_id', user.id).single();
    return updated.data ? response(participantPickup(updated.data, user.id)) : failure('Could not reload the completed pickup.', 503);
  }

  const { data, error } = await pickupsDb.rpc('transition_pickup', {
    pickup_id: id, actor_id: user.id, next_status: status,
  }).maybeSingle();
  if (error?.code === 'BF009') return failure('This pickup is unavailable.', 409);
  if (error?.code === 'BF001') return failure('BottleForMe is under maintenance. Try again shortly.', 503);
  if (error?.code === 'BF008') return failure('This pickup is unavailable.', 409);
  if (error?.code === 'BF007') return failure(error.message, 409);
  const restriction = pickupRestrictionResponse(error);
  if (restriction) return restriction;
  if (error?.code === '23514') return failure('Request a pickup time and wait for the owner to accept.', 409);
  if (error) return failure('Could not update the pickup.', 503);
  if (data) {
    if (status === 'cancelled' || status === 'reserved') after(() => drainPush().catch(() => {}));
    const pickup = { ...(data as PickupOffer & { photo_jpeg?: string }) };
    delete pickup.photo_jpeg;
    return response(participantPickup(pickup, user.id));
  }
  return failure('Pickup is unavailable or this change is no longer allowed.', 409);
}
