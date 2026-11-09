import { after } from 'next/server';
import { drainPush } from '@/lib/push-server';
import { adminPickupStatuses, isAdminUser } from '@/lib/admin-policy';
import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pageSize = 20;

async function authorize(request: Request) {
  if (!pickupsDb) return failure('The admin service is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to open the admin dashboard.', 401);
  if (!isAdminUser(user.id, process.env.BOTTLEFORME_ADMIN_USER_IDS)) {
    return failure('This account does not have admin access.', 403);
  }

  return { db: pickupsDb, user };
}

export async function GET(request: Request) {
  const access = await authorize(request);
  if (access instanceof Response) return access;
  const { db } = access;

  const params = new URL(request.url).searchParams;
  const view = params.get('view') ?? 'pickups';
  const page = Number(params.get('page') ?? 1);
  const status = params.get('status');
  if ((view !== 'pickups' && view !== 'profiles') || !Number.isInteger(page) || page < 1 || page > 10_000) {
    return failure('Invalid dashboard page.', 400);
  }
  if (status && !adminPickupStatuses.some((value) => value === status)) return failure('Invalid pickup status.', 400);

  const settings = await db.from('marketplace_settings').select('maintenance').eq('singleton', true).single();
  if (settings.error) return failure('Could not load maintenance settings.', 503);
  const maintenance = settings.data.maintenance;
  const first = (page - 1) * pageSize;
  const last = first + pageSize - 1;
  if (view === 'profiles') {
    const { data, count, error } = await db.from('profiles')
      .select('id,full_name,role,locality,created_at', { count: 'exact' })
      .order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).range(first, last);
    if (error) return failure('Could not load profiles. Try again.', 503);
    const ids = data.map((row) => row.id);
    const emails = new Map<string, string | null>();
    if (ids.length) {
      const lookup = await db.rpc('admin_profile_emails', { profile_ids: ids });
      if (lookup.error) return failure('Could not load profile emails. Try again.', 503);
      for (const row of lookup.data ?? []) emails.set(row.id, row.email);
    }
    const rows = data.map((row) => ({ ...row, email: emails.get(row.id) ?? null }));
    return response({ maintenance, view, rows, total: count ?? 0, pageSize });
  }

  let query = db.from('pickups')
    .select('id,locality,status,estimated_bottles,bag_count,created_at,updated_at', { count: 'exact' });
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query.order('created_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false }).range(first, last);
  if (error) return failure('Could not load pickups. Try again.', 503);
  return response({ maintenance, view, rows: data, total: count ?? 0, pageSize });
}

export async function POST(request: Request) {
  const access = await authorize(request);
  if (access instanceof Response) return access;

  const body = await request.json().catch(() => null);
  const key = request.headers.get('Idempotency-Key');
  const recipient = body?.recipient;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!key || !UUID.test(key) || (recipient !== null && (typeof recipient !== 'string' || !UUID.test(recipient)))) {
    return failure('Choose a valid notification recipient.', 400);
  }
  if (!title || title.length > 80 || !message || message.length > 500) {
    return failure('Enter a title of up to 80 characters and a message of up to 500 characters.', 400);
  }

  const { data, error } = await access.db.rpc('send_admin_notification', {
    batch_key: key, sender: access.user.id, recipient, notice_title: title, notice_message: message,
  });
  if (error?.code === '22023') return failure('That send request has already been used.', 409);
  if (error) return failure('Could not send the notification. Try again.', 503);
  if (data === 0) return failure('No confirmed accounts matched the selected audience.', 404);
  after(async () => {
    try {
      await drainPush(key);
    } catch {
      console.error('BottleForMe could not process queued push alerts.');
    }
  });
  return response({ sent: data });
}

export async function PATCH(request: Request) {
  const access = await authorize(request);
  if (access instanceof Response) return access;
  const body = await request.json().catch(() => null);
  if (typeof body?.maintenance !== 'boolean') return failure('Choose whether to enable maintenance mode.', 400);
  const { data, error } = await access.db.from('marketplace_settings').update({ maintenance: body.maintenance })
    .eq('singleton', true).select('maintenance').single();
  return error ? failure('Could not change maintenance mode.', 503) : response(data);
}
