import { failure, pickupsDb, requestUser, response } from '@/lib/pickups-server';

export async function GET(request: Request) {
  if (!pickupsDb) return failure('Account settings are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to open account settings.', 401);
  const { data, error } = await pickupsDb.from('profiles').select('share_pickup_phone').eq('id', user.id).maybeSingle();
  if (error) return failure('Could not load your settings.', 503);
  return response({ sharePhone: data?.share_pickup_phone === true });
}

export async function PATCH(request: Request) {
  if (!pickupsDb) return failure('Account settings are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to update account settings.', 401);
  const body = await request.json().catch(() => null);
  if (typeof body?.sharePhone !== 'boolean') return failure('Choose whether to share your phone number.', 400);
  const { data, error } = await pickupsDb.from('profiles').update({ share_pickup_phone: body.sharePhone })
    .eq('id', user.id).select('share_pickup_phone').maybeSingle();
  if (error || !data) return failure('Could not update your settings.', 503);
  return response({ sharePhone: data.share_pickup_phone === true });
}
