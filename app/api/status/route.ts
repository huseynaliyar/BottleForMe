import { failure, pickupsDb, response } from '@/lib/pickups-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!pickupsDb) return failure('Could not check BottleForMe status.', 503);
  const { data, error } = await pickupsDb.from('marketplace_settings').select('maintenance').eq('singleton', true).single();
  return error ? failure('Could not check BottleForMe status.', 503) : response(data);
}
