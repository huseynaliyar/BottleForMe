import { randomUUID } from 'node:crypto';
import { MALTA_LOCALITIES } from '@/lib/types';
import { INITIAL_OFFERS } from '@/lib/mock-data';
import { validatePickup } from '@/lib/pickup-validation';
import { failure, pickupsDb, PRIVATE_COLUMNS, requestUser, response, UUID } from '@/lib/pickups-server';
import { participantPickup, PUBLIC_COLUMNS, publicPickup } from '@/lib/pickup-visibility';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mine = params.get('mine') === 'true';
  const locality = params.get('locality');
  const status = params.get('status');
  if (!mine && status && status !== 'open') return failure('Radar only lists open pickups.', 400);

  if (!pickupsDb) {
    if (process.env.NODE_ENV === 'development' && !mine) {
      const offers = INITIAL_OFFERS.filter((offer) => offer.status === 'open' &&
        (!locality || locality === 'all' || offer.locality.toLowerCase() === locality.toLowerCase())).map(publicPickup);
      return response({ count: offers.length, offers, source: 'demo' });
    }
    return failure('Pickup service is unavailable.', 503);
  }

  const client = pickupsDb;
  if (mine) {
    const user = await requestUser(request);
    if (!user) return failure('Sign in to view your pickups.', 401);
    const { data, error } = await client.from('pickups').select(PRIVATE_COLUMNS)
      .or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).order('updated_at', { ascending: false });
    if (error) return failure('Could not load your pickups.', 503);
    return response({ count: data.length, offers: data.map((row) => participantPickup(row, user.id)), source: 'supabase' });
  }

  let query = client.from('pickups').select(PUBLIC_COLUMNS)
    .eq('status', 'open').not('seller_id', 'is', null).order('created_at', { ascending: false });
  if (locality && locality !== 'all') {
    const canonical = MALTA_LOCALITIES.find((item) => item.name.toLowerCase() === locality.toLowerCase());
    if (!canonical) return response({ count: 0, offers: [], source: 'supabase' });
    query = query.eq('locality', canonical.name);
  }
  const { data, error } = await query;
  if (error) return failure('Could not load Radar listings.', 503);
  return response({ count: data.length, offers: data.map(publicPickup), source: 'supabase' });
}

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to publish a pickup.', 401);

  const body = await request.json().catch(() => null);
  const values = validatePickup(body);
  if (!values) return failure('Check container counts, bag count, seller split, location and payment details.', 400);
  const key = request.headers.get('idempotency-key');
  if (key !== null && !UUID.test(key)) return failure('Invalid idempotency key.', 400);
  const id = key ?? randomUUID();

  const metadata = user.user_metadata;
  const { data, error } = await pickupsDb.from('pickups').insert({
    ...values,
    id,
    seller_id: user.id,
    seller_name: typeof metadata.full_name === 'string' ? metadata.full_name.trim().slice(0, 100) || 'Giver' : 'Giver',
    seller_phone: typeof metadata.phone === 'string' ? metadata.phone.trim().slice(0, 40) : null,
    status: 'open',
  }).select(PRIVATE_COLUMNS).single();
  if (!error) return response(data, 201);
  if (error.code === '23505' && key) {
    const existing = await pickupsDb.from('pickups').select(PRIVATE_COLUMNS).eq('id', id).eq('seller_id', user.id).maybeSingle();
    if (existing.error) return failure('Could not verify the previous request.', 503);
    if (existing.data) {
      const row = existing.data;
      const sameRequest = row.locality === values.locality && row.bag_count === values.bag_count &&
        row.split_percentage === values.split_percentage && row.payout_method === values.payout_method &&
        row.address_notes === values.address_notes && row.seller_revolut_tag === values.seller_revolut_tag &&
        row.containers?.plastic_bottles === values.containers.plastic_bottles &&
        row.containers?.cans === values.containers.cans && row.containers?.glass_bottles === values.containers.glass_bottles;
      if (sameRequest) return response(row);
    }
    return failure('That request key is already in use.', 409);
  }
  return failure('Could not save the pickup.', 503);
}
