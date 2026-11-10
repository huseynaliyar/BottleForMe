import { isBagPolicy } from '@/lib/bag-policy';
import { randomUUID } from 'node:crypto';
import { hasConfirmedAddress } from '@/lib/google-addresses';
import { MALTA_LOCALITIES } from '@/lib/types';
import { validateWindows } from '@/lib/pickup-schedule';
import { validatePickup } from '@/lib/pickup-validation';
import { normalizePickupPhoto } from '@/lib/pickup-photo-server';
import { failure, pickupsDb, PRIVATE_COLUMNS, requestUser, response, takerAccess, UUID } from '@/lib/pickups-server';
import { isPickupPin } from '@/lib/pickup-location';
import { participantPickup, RADAR_COLUMNS, publicPickup } from '@/lib/pickup-visibility';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mine = params.get('mine') === 'true';
  const locality = params.get('locality');
  const status = params.get('status');
  if (!mine && status && status !== 'open') return failure('Radar only lists open pickups.', 400);

  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure(mine ? 'Sign in to view your pickups.' : 'Sign in as a Taker to view Radar.', 401);
  const client = pickupsDb;
  if (mine) {
    const { data, error } = await client.from('pickups').select(PRIVATE_COLUMNS)
      .or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).order('updated_at', { ascending: false });
    if (error) return failure('Could not load your pickups.', 503);
    const collectors = [...new Set(data.flatMap((row) => row.seller_id === user.id && row.collector_id ? [row.collector_id as string] : []))];
    const profiles = await Promise.all(Array.from({ length: Math.ceil(collectors.length / 100) }, (_, index) =>
      client.from('profiles').select('id,full_name').in('id', collectors.slice(index * 100, (index + 1) * 100)),
    ));
    const names = new Map(profiles.flatMap(({ data }) => (data ?? []).map(({ id, full_name }) => [id, full_name])));
    const offers = data.map((row) => participantPickup({
      ...row,
      collector_name: row.seller_id === user.id ? names.get(row.collector_id) : undefined,
    }, user.id));
    return response({ count: offers.length, offers, source: 'supabase' });
  }

  const blocked = await takerAccess(user.id);
  if (blocked) return blocked;
  let query = client.rpc('get_radar_pickups', { viewer: user.id }).select(RADAR_COLUMNS).order('created_at', { ascending: false });
  if (locality && locality !== 'all') {
    const canonical = MALTA_LOCALITIES.find((item) => item.name.toLowerCase() === locality.toLowerCase());
    if (!canonical) return response({ count: 0, offers: [], source: 'supabase' });
    query = query.eq('locality', canonical.name);
  }
  const { data, error } = await query;
  if (error || !Array.isArray(data)) return failure('Could not load Radar listings.', 503);
  return response({ count: data.length, offers: data.map(publicPickup), source: 'supabase' });
}

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to publish a pickup.', 401);

  const profile = await pickupsDb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile.error) return failure('Could not check your account role.', 503);
  if (profile.data?.role === 'taker') return failure('Switch to Giver to publish a pickup.', 403);
  const body = await request.json().catch(() => null);
  const values = validatePickup(body);
  const availability = body?.availability === undefined ? null : validateWindows(body.availability);
  if (body?.availability !== undefined && !availability) return failure('Enter valid, non-overlapping pickup windows in Malta time.', 400);
  if (!values) return failure('Check container counts, bag count, seller split, location and payment details.', 400);
  if (!hasConfirmedAddress(user.id, body.pickup_address, body.address_proof, values.address_notes)) {
    return failure('Choose your pickup address from the Google Maps suggestions.', 400);
  }
  const pin = body.pickup_pin ?? null;
  if ((pin !== null && !isPickupPin(pin)) || (body.share_exact_pin === true && !pin)) return failure('Choose a pickup pin in Malta.', 400);
  const key = request.headers.get('idempotency-key');
  if (key !== null && !UUID.test(key)) return failure('Invalid idempotency key.', 400);
  const id = key ?? randomUUID();

  const bagPolicy = body.bag_policy ?? null;
  if (bagPolicy !== null && !isBagPolicy(bagPolicy)) return failure('Choose a valid bag arrangement.', 400);

  const photo = await normalizePickupPhoto(body.photo);
  if (!photo) return failure('Add a photo of the bottles or bags before publishing.', 400);

  const metadata = user.user_metadata;
  const { data, error } = await pickupsDb.from('pickups').insert({
    ...values,
    pickup_lat: pin?.lat ?? null,
    pickup_lng: pin?.lng ?? null,
    share_exact_pin: body.share_exact_pin === true,
    bag_policy: bagPolicy,
    photo_jpeg: photo,
    availability,
    id,
    seller_id: user.id,
    seller_name: typeof metadata.full_name === 'string' ? metadata.full_name.trim().slice(0, 100) || 'Giver' : 'Giver',
    seller_phone: typeof metadata.phone === 'string' ? metadata.phone.trim().slice(0, 40) : null,
    status: 'open',
  }).select(PRIVATE_COLUMNS).single();
  if (!error) return response(participantPickup(data, user.id), 201);
  if (error.code === 'BF009') return failure('Reactivate your account before posting a listing.', 409);
  if (error.code === 'BF001') return failure('BottleForMe is under maintenance. Try again shortly.', 503);
  if (error.code === '23505' && key) {
    const existing = await pickupsDb.from('pickups').select(`${PRIVATE_COLUMNS},photo_jpeg`).eq('id', id).eq('seller_id', user.id).maybeSingle();
    if (existing.error) return failure('Could not verify the previous request.', 503);
    if (existing.data) {
      const { photo_jpeg: existingPhoto, ...row } = existing.data;
      const sameRequest = row.locality === values.locality && row.bag_count === values.bag_count && row.bag_policy === bagPolicy &&
        row.split_percentage === values.split_percentage && row.payout_method === values.payout_method &&
        row.pickup_lat === (pin?.lat ?? null) && row.pickup_lng === (pin?.lng ?? null) && row.share_exact_pin === (body.share_exact_pin === true) &&
        row.address_notes === values.address_notes && row.seller_revolut_tag === values.seller_revolut_tag &&
        row.containers?.plastic_bottles === values.containers.plastic_bottles &&
        row.containers?.cans === values.containers.cans && row.containers?.glass_bottles === values.containers.glass_bottles;
      const sameWindows = (row.availability ?? []).length === (availability ?? []).length &&
        (availability ?? []).every((window, index) => row.availability?.[index]?.start === window.start && row.availability?.[index]?.end === window.end);
      if (sameRequest && sameWindows && existingPhoto === photo) return response(participantPickup(row, user.id));
    }
    return failure('That request key is already in use.', 409);
  }
  if (error.code === '23514' || error.code === '22008') return failure('Choose future pickup windows in Malta time.', 400);
  return failure('Could not save the pickup.', 503);
}
