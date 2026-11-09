import 'server-only';
import { sendNotification, WebPushError } from 'web-push';
import { pickupsDb } from './pickups-server';

type Job = {
  batch_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  attempts: number;
  lease_id: string;
  title: string;
  message: string;
  pickup_id: string | null;
};

export function webPushKeys() {
  const publicKey = process.env.BOTTLEFORME_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.BOTTLEFORME_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: 'https://www.bottleforme.com' };
}

export function pushEndpoint(input: unknown) {
  if (typeof input !== 'string' || input.length > 2048) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || url.pathname === '/') return null;
    const host = url.hostname;
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
      host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com') ? url.href : null;
  } catch {
    return null;
  }
}

async function deliver(job: Job, vapidDetails: NonNullable<ReturnType<typeof webPushKeys>>) {
  const db = pickupsDb;
  if (!db) return;
  let status = 'accepted';
  let retryAt: string | undefined;
  try {
    const endpoint = pushEndpoint(job.endpoint);
    if (!endpoint) throw new Error('Invalid push endpoint');
    const payload = JSON.stringify({ title: job.title, body: job.message, id: job.batch_id, pickupId: job.pickup_id });
    await sendNotification({ endpoint, keys: { p256dh: job.p256dh, auth: job.auth } },
      payload, { vapidDetails, TTL: 86_400, timeout: 5_000 });
  } catch (error) {
    const code = error instanceof WebPushError ? error.statusCode : undefined;
    if (code === 404 || code === 410) {
      const result = await db.from('web_push_subscriptions').delete().eq('id', job.subscription_id);
      if (result.error) throw new Error('Could not remove expired web push subscription');
      return;
    }
    if (job.attempts < 5 && (code === undefined || code === 429 || code >= 500)) {
      status = 'queued';
      retryAt = new Date(Date.now() + 2 ** job.attempts * 60_000).toISOString();
    } else {
      status = 'failed';
      if (code === 401 || code === 403) console.error('BottleForMe Web Push credentials were rejected.');
    }
  }
  const result = await db.from('web_push_jobs')
    .update({ status, ...(retryAt ? { next_attempt_at: retryAt } : {}) })
    .eq('batch_id', job.batch_id).eq('subscription_id', job.subscription_id).eq('lease_id', job.lease_id);
  if (result.error) throw new Error('Could not save web push result');
}

export async function drainWebPush(batch?: string) {
  const vapidDetails = webPushKeys();
  const db = pickupsDb;
  if (!vapidDetails || !db) return 0;

  const deadline = Date.now() + 40_000;
  let processed = 0;
  while (Date.now() < deadline) {
    const { data, error } = await db.rpc('claim_web_push', { target_batch: batch ?? null });
    if (error) throw new Error('Could not claim queued web alerts');
    const jobs = (data ?? []) as Job[];
    if (!jobs.length) break;
    await Promise.all(jobs.map((job) => deliver(job, vapidDetails)));
    processed += jobs.length;
  }
  return processed;
}
