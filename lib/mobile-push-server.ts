import 'server-only';
import { pickupsDb } from './pickups-server';

type Job = {
  batch_id: string;
  installation_id: string;
  user_id: string;
  token: string;
  attempts: number;
  ticket_id: string | null;
  lease_id: string;
  title: string;
  message: string;
  pickup_id: string | null;
};
type ExpoResult = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };

const minute = 60_000;
const nextAttempt = (delay: number) => new Date(Date.now() + delay).toISOString();

async function expoRequest<T>(path: 'send' | 'getReceipts', payload: unknown): Promise<T> {
  const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
  const res = await fetch('https://exp.host/--/api/v2/push/' + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error('Expo Push Service returned HTTP ' + res.status);
  const result = await res.json();
  if (!result.data) throw new Error('Expo Push Service returned no results');
  return result.data as T;
}

async function updateJob(job: Job, patch: Record<string, unknown>) {
  if (!pickupsDb) return;
  const { error } = await pickupsDb.from('mobile_push_jobs').update(patch)
    .eq('batch_id', job.batch_id).eq('installation_id', job.installation_id).eq('lease_id', job.lease_id);
  if (error) throw new Error('Could not save push delivery result');
}

function retry(job: Job) {
  return updateJob(job, job.attempts >= 5
    ? { status: 'failed' }
    : { next_attempt_at: nextAttempt(2 ** job.attempts * minute) });
}

async function processResult(job: Job, result?: ExpoResult) {
  if (!result) return retry(job);
  if (result.status === 'ok') {
    if (job.ticket_id) return updateJob(job, { status: 'accepted' });
    if (!result.id) return retry(job);
    return updateJob(job, { ticket_id: result.id, attempts: 0, next_attempt_at: nextAttempt(15 * minute) });
  }
  if (result.details?.error === 'DeviceNotRegistered' && pickupsDb) {
    const { error } = await pickupsDb.from('mobile_push_devices').delete()
      .eq('installation_id', job.installation_id).eq('user_id', job.user_id).eq('token', job.token);
    if (error) throw new Error('Could not remove an expired device');
  } else if (result.details?.error === 'MessageRateExceeded' && !job.ticket_id) {
    return retry(job);
  }
  if (result.details?.error === 'InvalidCredentials') {
    console.error('BottleForMe push requires valid APNs or FCM credentials.');
  }
  return updateJob(job, { status: 'failed' });
}

async function send(jobs: Job[]) {
  if (!jobs.length) return;
  let results: ExpoResult[];
  try {
    results = await expoRequest<ExpoResult[]>('send', jobs.map((job) => ({
      to: job.token,
      title: job.title,
      body: job.message,
      data: { type: 'admin_message', pickupId: job.pickup_id },
      channelId: 'bottleforme-messages',
      sound: 'default',
      ttl: 86_400,
    })));
    if (!Array.isArray(results) || results.length !== jobs.length) throw new Error('Unexpected ticket count');
  } catch {
    await Promise.all(jobs.map(retry));
    return;
  }
  await Promise.all(jobs.map((job, index) => processResult(job, results[index])));
}

async function checkReceipts(jobs: Job[]) {
  if (!jobs.length) return;
  let receipts: Record<string, ExpoResult>;
  try {
    receipts = await expoRequest<Record<string, ExpoResult>>('getReceipts', { ids: jobs.map((job) => job.ticket_id) });
  } catch {
    await Promise.all(jobs.map(retry));
    return;
  }
  await Promise.all(jobs.map((job) => processResult(job, receipts[job.ticket_id ?? ''])));
}

export async function drainMobilePush(batch?: string) {
  if (!pickupsDb) throw new Error('Push storage is unavailable');
  const deadline = Date.now() + 40_000;
  let processed = 0;
  while (Date.now() < deadline) {
    const { data, error } = await pickupsDb.rpc('claim_mobile_push', { target_batch: batch ?? null });
    if (error) throw new Error('Could not claim queued alerts');
    const jobs = (data ?? []) as Job[];
    if (!jobs.length) break;
    await Promise.all([
      send(jobs.filter((job) => !job.ticket_id)),
      checkReceipts(jobs.filter((job) => job.ticket_id)),
    ]);
    processed += jobs.length;
  }
  return processed;
}
