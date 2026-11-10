import { after } from 'next/server';
import { drainPush } from '@/lib/push-server';
import { canonicalAppointment, validateWindows } from '@/lib/pickup-schedule';
import { failure, pickupRestrictionResponse, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const db = pickupsDb;
  if (!db) return failure('Pickup scheduling is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to view your pickup arrangements.', 401);

  const listing = new URL(request.url).searchParams.get('listing');
  if (listing && !UUID.test(listing)) return failure('Invalid pickup listing.', 400);
  const select = () => db.from('pickup_requests')
    .select('id,pickup_id,seller_id,collector_id,proposed_by,proposed_at,kind,status,version,pickup:pickups(locality,status)')
    .or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).order('updated_at', { ascending: false });
  const result = listing ? [await select().eq('pickup_id', listing).limit(100)] : await Promise.all([
    select().in('status', ['pending', 'accepted']).limit(100),
    select().in('status', ['rejected', 'cancelled']).limit(30),
  ]);
  if (result.some(({ error }) => error)) return failure('Could not load pickup arrangements.', 503);
  return response({ requests: result.flatMap(({ data }) => data ?? []) });
}

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Pickup scheduling is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to arrange pickups.', 401);

  const body = await request.json().catch(() => null);
  const listing = body?.listingId;
  const action = body?.action;
  if (typeof listing !== 'string' || !UUID.test(listing)) return failure('Invalid pickup listing.', 400);
  if (!['availability', 'request', 'accept', 'reject', 'cancel', 'counter'].includes(action)) {
    return failure('Invalid scheduling action.', 400);
  }
  const windows = action === 'availability' ? validateWindows(body.availability) : null;
  if (action === 'availability' && !windows) return failure('Enter valid, non-overlapping pickup windows in Malta time.', 400);

  const id = body?.id;
  if (action !== 'availability' && (typeof id !== 'string' || !UUID.test(id))) return failure('Invalid pickup request.', 400);
  const at = action === 'request' || action === 'counter' ? canonicalAppointment(body.at) : null;
  if ((action === 'request' || action === 'counter') && !at) return failure('Choose a valid future pickup time.', 400);
  if (action === 'request' && !['available', 'alternative'].includes(body.kind)) return failure('Choose a pickup request type.', 400);
  const version = body?.version;
  if (action !== 'request' && (!Number.isInteger(version) || version < 0 || version > 2_147_483_646)) {
    return failure('Invalid pickup request version.', 400);
  }

  const { data, error } = await pickupsDb.rpc('manage_pickup_schedule', {
    listing_id: listing,
    actor_id: user.id,
    operation: action,
    request_key: action === 'availability' ? null : id,
    requested_at: at,
    request_kind: action === 'request' ? body.kind : null,
    expected_version: action === 'request' ? null : version,
    windows,
  });
  if (error?.code === 'BF001') return failure('BottleForMe is under maintenance. Try again shortly.', 503);
  if (error?.code === 'BF008') return failure('This pickup arrangement is unavailable.', 409);
  if (error?.code === 'BF007') return failure(error.message, 409);
  const restriction = pickupRestrictionResponse(error);
  if (restriction) return restriction;
  if (error?.code === '23514' || error?.code === '22008') return failure('Choose future pickup windows in Malta time.', 400);
  if (error) return failure('Could not save your pickup arrangement. Try again.', 503);
  if (!data) return failure('This arrangement is unavailable, has changed, or you already have a pending request. Refresh and try again.', 409);

  if (action !== 'availability') after(() => drainPush().catch(() => {}));
  return response({ ok: true });
}
