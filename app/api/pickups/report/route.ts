import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

export async function POST(request: Request) {
  if (!pickupsDb) return failure('Reporting is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to send a report.', 401);
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (typeof body?.pickupId !== 'string' || !UUID.test(body.pickupId) ||
    (body?.target !== 'listing' && body?.target !== 'user') || reason.length < 10 || reason.length > 500) {
    return failure('Enter a reason between 10 and 500 characters.', 400);
  }
  const { data: pickup, error: lookupError } = await pickupsDb.from('pickups').select('seller_id,collector_id,status,archived_at')
    .eq('id', body.pickupId).maybeSingle();
  if (lookupError) return failure('Could not look up this pickup.', 503);
  if (!pickup) return failure('Pickup unavailable.', 404);
  const participant = user.id === pickup.seller_id || user.id === pickup.collector_id;
  const reportedUser = user.id === pickup.seller_id ? pickup.collector_id : pickup.seller_id;
  if (!reportedUser || (body.target === 'user' && !participant) ||
    (body.target === 'listing' && (user.id === pickup.seller_id || !participant && (pickup.status !== 'open' || pickup.archived_at !== null)))) {
    return failure('This report is unavailable.', 404);
  }
  const { error } = await pickupsDb.from('marketplace_reports').upsert({
    reporter_id: user.id, pickup_id: body.pickupId, target: body.target, reason, reported_user_id: reportedUser,
  }, { onConflict: 'reporter_id,pickup_id,target', ignoreDuplicates: true });
  return error ? failure('Could not submit your report.', 503) : response({ ok: true });
}
