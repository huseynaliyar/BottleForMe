import { failure, pickupsDb, requestUser, response, UUID } from '@/lib/pickups-server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return failure('Pickup not found.', 404);
  if (!pickupsDb) return failure('Pickup service is unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to view the handover code.', 401);
  const { data, error } = await pickupsDb.rpc('get_handover_code', { listing_id: id, actor_id: user.id });
  if (error) return failure('Could not load the handover code.', 503);
  return data ? response({ code: data }) : failure('Only the Giver can view the code for an active pickup.', 403);
}
