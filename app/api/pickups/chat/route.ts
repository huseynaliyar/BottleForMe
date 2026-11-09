import { after } from 'next/server';
import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';
import { drainWebPush } from '@/lib/web-push-server';

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!pickupsDb) return failure('Pickup chat is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to use pickup chat.', 401);

  const params = new URL(request.url).searchParams;
  const pickup = params.get('pickup');
  if (!pickup) {
    const { data, error } = await pickupsDb.rpc('pickup_chat_unread', { actor: user.id });
    return error ? failure('Could not load unread messages.', 503) : response({ unread: data });
  }

  const before = params.has('before') ? Number(params.get('before')) : null;
  if (!UUID.test(pickup) || before !== null && (!Number.isSafeInteger(before) || before < 1)) {
    return failure('Invalid pickup or message reference.', 400);
  }
  const { data, error } = await pickupsDb.rpc('read_pickup_chat', { listing: pickup, actor: user.id, before_seq: before });
  if (error) return failure('Could not load pickup chat.', 503);
  return data ? response(data) : failure('Pickup chat is not available.', 404);
}

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Pickup chat is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to use pickup chat.', 401);

  const body = await request.json().catch(() => null);
  if (typeof body?.pickup !== 'string' || !UUID.test(body.pickup)) return failure('Invalid pickup.', 400);
  const scope = { listing: body.pickup, actor: user.id };

  if (body.action === 'read') {
    if (!Number.isSafeInteger(body.through) || body.through < 1) return failure('Invalid message reference.', 400);
    const { error } = await pickupsDb.rpc('mark_pickup_chat_read', { ...scope, through_seq: body.through });
    return error ? failure('Could not mark messages as read.', 503) : response({ ok: true });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (body.action !== 'send' || typeof body.id !== 'string' || !UUID.test(body.id) || !message || message.length > 1000) {
    return failure('Enter a message of up to 1,000 characters.', 400);
  }
  const { data, error } = await pickupsDb.rpc('send_pickup_chat', { ...scope, message_id: body.id, content: message });
  if (error) return failure('Could not send your message. Try again.', 503);
  if (data === 'limited') return failure('Too many messages. Try again in a minute.', 429);
  if (data !== 'sent') return failure('This pickup chat is closed or unavailable.', 409);
  after(() => drainWebPush(body.id).catch(() => { console.error('Could not process pickup chat web push.'); }));
  return response({ ok: true });
}
