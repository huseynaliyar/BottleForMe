import 'server-only';
import { drainMobilePush } from './mobile-push-server';
import { drainWebPush } from './web-push-server';

export async function drainPush(batch?: string) {
  const [mobile, web] = await Promise.allSettled([drainMobilePush(batch), drainWebPush(batch)]);
  if (mobile.status === 'rejected' || web.status === 'rejected') {
    throw new Error('Could not process one or more push queues');
  }
  return mobile.value + web.value;
}
