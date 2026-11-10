import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';
import type { PickupPartner, Review } from '@/lib/pickup-partner';

type Context = { params: Promise<{ id: string }> };

async function lookup(request: Request, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return failure('Pickup not found.', 404);
  const db = pickupsDb;
  if (!db) return failure('Pickup partner information is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to view your pickup partner.', 401);
  const { data, error } = await db.from('pickups').select('seller_id,collector_id,status,seller_name')
    .eq('id', id).or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).maybeSingle();
  if (error) return failure('Could not load the pickup.', 503);
  if (!data?.seller_id || !data.collector_id) return failure('Pickup partner unavailable.', 404);
  const otherIsGiver = data.collector_id === user.id;
  const partnerId = otherIsGiver ? data.seller_id : data.collector_id;
  if (partnerId === user.id) return failure('Pickup partner unavailable.', 404);
  return { db, user, id, partnerId, pickup: data, otherIsGiver };
}

export async function GET(request: Request, context: Context) {
  const found = await lookup(request, context);
  if (found instanceof Response) return found;
  const { db, user, id, partnerId, pickup, otherIsGiver } = found;
  const active = ['reserved', 'en_route', 'arrived'].includes(pickup.status);
  const [profile, aggregate, reviews] = await Promise.all([
    db.from('profiles').select('full_name,phone,share_pickup_phone').eq('id', partnerId).maybeSingle(),
    db.rpc('pickup_review_summary', { subject: partnerId }).maybeSingle<{ average: number | null; count: number }>(),
    db.from('pickup_reviews').select('author_id,stars,comment').eq('pickup_id', id).in('author_id', [user.id, partnerId]),
  ]);
  if (profile.error || aggregate.error || reviews.error) return failure('Could not load your pickup partner.', 503);
  const role = otherIsGiver ? 'Giver' : 'Taker';
  const review = (author: string): Review | null => {
    const item = reviews.data.find((row) => row.author_id === author);
    return item ? { stars: item.stars, comment: item.comment } : null;
  };
  const data: PickupPartner = {
    name: profile.data?.full_name?.trim() || (otherIsGiver && pickup.seller_name) || role,
    role, phone: active && profile.data?.share_pickup_phone ? profile.data.phone || null : null,
    average: aggregate.data?.average ?? null, count: aggregate.data?.count ?? 0,
    canReview: pickup.status === 'completed',
    reviewGiven: review(user.id), reviewReceived: review(partnerId),
  };
  return response(data);
}

export async function PUT(request: Request, context: Context) {
  const found = await lookup(request, context);
  if (found instanceof Response) return found;
  const { db, user, id, partnerId, pickup } = found;
  if (pickup.status !== 'completed') return failure('You can review your partner after completing the pickup.', 409);
  const body = await request.json().catch(() => null);
  if (!Number.isInteger(body?.stars) || body.stars < 1 || body.stars > 5 ||
      typeof body.comment !== 'string' || body.comment.trim().length > 500) {
    return failure('Choose 1–5 stars and enter up to 500 characters.', 400);
  }
  const review = { stars: body.stars as number, comment: body.comment.trim() as string };
  const { error } = await db.from('pickup_reviews').upsert({
    pickup_id: id, author_id: user.id, subject_id: partnerId, ...review,
  }, { onConflict: 'pickup_id,author_id' });
  return error ? failure('Could not save your review.', 503) : response(review);
}
