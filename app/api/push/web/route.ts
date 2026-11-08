import { failure, pickupsDb, requestUser, response } from '@/lib/pickups-server';
import { pushEndpoint, webPushKeys } from '@/lib/web-push-server';

export const dynamic = 'force-dynamic';

export function GET() {
  return response({ publicKey: webPushKeys()?.publicKey ?? null });
}

export async function POST(request: Request) {
  if (!pickupsDb || !webPushKeys()) return failure('Web alerts are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to enable alerts.', 401);

  const body = await request.json().catch(() => null);
  const endpoint = pushEndpoint(body?.endpoint);
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || typeof p256dh !== 'string' || !/^B[A-Za-z0-9_-]{86}$/.test(p256dh) ||
      typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(auth)) {
    return failure('Invalid browser subscription.', 400);
  }
  const { data, error } = await pickupsDb.rpc('register_web_push', {
    owner_id: user.id, push_endpoint: endpoint, public_key: p256dh, auth_key: auth,
  });
  if (error) return failure('Could not enable web alerts.', 503);
  if (!data) return failure('This account has reached the limit for browser alerts.', 409);
  return response({ enabled: true });
}

export async function DELETE(request: Request) {
  if (!pickupsDb) return failure('Web alerts are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to manage alerts.', 401);

  const body = await request.json().catch(() => null);
  const endpoint = pushEndpoint(body?.endpoint);
  if (!endpoint) return failure('Invalid browser subscription.', 400);
  const { error } = await pickupsDb.from('web_push_subscriptions').delete()
    .eq('endpoint', endpoint).eq('user_id', user.id);
  return error ? failure('Could not disable web alerts.', 503) : response({ enabled: false });
}
