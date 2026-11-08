import { adminPickupStatuses, isAdminUser } from '@/lib/admin-policy';
import { failure, pickupsDb, requestUser, response } from '@/lib/pickups-server';

export const dynamic = 'force-dynamic';

const pageSize = 20;

export async function GET(request: Request) {
  if (!pickupsDb) return failure('The admin service is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to open the admin dashboard.', 401);
  if (!isAdminUser(user.id, process.env.BOTTLEFORME_ADMIN_USER_IDS)) {
    return failure('This account does not have admin access.', 403);
  }

  const params = new URL(request.url).searchParams;
  const view = params.get('view') ?? 'pickups';
  const page = Number(params.get('page') ?? 1);
  const status = params.get('status');
  if ((view !== 'pickups' && view !== 'profiles') || !Number.isInteger(page) || page < 1 || page > 10_000) {
    return failure('Invalid dashboard page.', 400);
  }
  if (status && !adminPickupStatuses.some((value) => value === status)) return failure('Invalid pickup status.', 400);

  const first = (page - 1) * pageSize;
  const last = first + pageSize - 1;
  if (view === 'profiles') {
    const { data, count, error } = await pickupsDb.from('profiles')
      .select('id,full_name,role,locality,created_at', { count: 'exact' })
      .order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).range(first, last);
    if (error) return failure('Could not load profiles. Try again.', 503);
    return response({ view, rows: data, total: count ?? 0, pageSize });
  }

  let query = pickupsDb.from('pickups')
    .select('id,locality,status,estimated_bottles,bag_count,created_at,updated_at', { count: 'exact' });
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query.order('created_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false }).range(first, last);
  if (error) return failure('Could not load pickups. Try again.', 503);
  return response({ view, rows: data, total: count ?? 0, pageSize });
}
