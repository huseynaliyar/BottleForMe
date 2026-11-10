import { failure, pickupsDb, requestUser, response, takerAccess, UUID } from '@/lib/pickups-server';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return failure('Pickup not found.', 404);
  if (!pickupsDb) return failure('Listing photos are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to view this photo.', 401);
  const own = await pickupsDb.from('pickups').select('photo_jpeg').eq('id', id)
    .or('seller_id.eq.' + user.id + ',collector_id.eq.' + user.id).maybeSingle();
  if (own.error) return failure('Could not load the listing photo.', 503);
  if (own.data) return response({ photo: photoUrl(own.data.photo_jpeg) });

  const denied = await takerAccess(user.id);
  if (denied) return denied;
  const listing = await pickupsDb.from('pickups').select('photo_jpeg').eq('id', id)
    .eq('status', 'open').is('archived_at', null).is('collector_id', null).not('seller_id', 'is', null).maybeSingle();
  if (listing.error) return failure('Could not load the listing photo.', 503);
  return listing.data ? response({ photo: photoUrl(listing.data.photo_jpeg) }) : failure('Pickup not found.', 404);
}

function photoUrl(photo: string | null) {
  return photo ? 'data:image/jpeg;base64,' + photo : null;
}
