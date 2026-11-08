import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

const expoToken = /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{10,100}\]$/;

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Push settings are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to change push settings.', 401);

  const body = await request.json().catch(() => null);
  if (typeof body?.installationId !== 'string' || !UUID.test(body.installationId)) {
    return failure('Invalid device registration.', 400);
  }

  if (body.token === null) {
    const { error } = await pickupsDb.from('mobile_push_devices').delete()
      .eq('installation_id', body.installationId).eq('user_id', user.id);
    return error ? failure('Could not remove this device. Try again.', 503) : response({ ok: true });
  }

  if (typeof body.token !== 'string' || !expoToken.test(body.token)) {
    return failure('Invalid push token.', 400);
  }
  const { data, error } = await pickupsDb.rpc('register_mobile_push', {
    device_id: body.installationId, owner_id: user.id, expo_token: body.token,
  });
  if (error) return failure('Could not register this device. Try again.', 503);
  if (!data) return failure('This account has reached its device limit.', 409);
  return response({ ok: true });
}
