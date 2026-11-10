import { isAdminUser } from '@/lib/admin-policy';
import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

async function authorize(request: Request) {
  if (!pickupsDb) return failure('Reports are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to review reports.', 401);
  if (!isAdminUser(user.id, process.env.BOTTLEFORME_ADMIN_USER_IDS)) return failure('Admin access required.', 403);
  return pickupsDb;
}

export async function GET(request: Request) {
  const db = await authorize(request);
  if (db instanceof Response) return db;
  const { data, error } = await db.from('marketplace_reports')
    .select('id,target,reason,pickup_id,reporter_id,reported_user_id,created_at')
    .is('reviewed_at', null).order('created_at').order('id').limit(50);
  return error ? failure('Could not load reports.', 503) : response({ reports: data });
}

export async function PATCH(request: Request) {
  const db = await authorize(request);
  if (db instanceof Response) return db;
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== 'string' || !UUID.test(body.id)) return failure('Invalid report.', 400);
  const { error } = await db.from('marketplace_reports').update({ reviewed_at: new Date().toISOString() })
    .eq('id', body.id).is('reviewed_at', null);
  return error ? failure('Could not mark this report reviewed.', 503) : response({ ok: true });
}
