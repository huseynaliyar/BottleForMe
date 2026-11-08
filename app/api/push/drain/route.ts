import { timingSafeEqual } from 'node:crypto';
import { failure, response } from '@/lib/pickups-server';
import { drainMobilePush } from '@/lib/mobile-push-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.BOTTLEFORME_PUSH_JOB_SECRET;
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from('Bearer ' + secret);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return failure('Unauthorized.', 401);
  }

  try {
    return response({ processed: await drainMobilePush() });
  } catch {
    return failure('Could not process queued push alerts.', 503);
  }
}
