import { addressLookupEnabled, findGoogleAddresses } from '@/lib/google-addresses';
import { failure, requestUser, response } from '@/lib/pickups-server';

export const dynamic = 'force-dynamic';

export function GET() {
  return response({ enabled: addressLookupEnabled });
}

export async function POST(request: Request) {
  if (!addressLookupEnabled) return response({ suggestions: [] });
  const user = await requestUser(request);
  if (!user) return failure('Sign in to look up your pickup address.', 401);
  const body = await request.json().catch(() => null);
  const input = typeof body?.input === 'string' ? body.input.trim() : '';
  if (input.length < 3 || input.length > 240) return failure('Enter between 3 and 240 characters.', 400);
  try {
    return response({ suggestions: await findGoogleAddresses(input, user.id) });
  } catch {
    return failure('Address lookup is temporarily unavailable. Try again.', 503);
  }
}
