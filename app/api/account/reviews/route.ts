import { failure, pickupsDb, requestUser, response } from '@/lib/pickups-server';
import { profileReviewPageSize, type ProfileReviews } from '@/lib/profile-reviews';

export async function GET(request: Request) {
  const db = pickupsDb;
  if (!db) return failure('Reviews are unavailable.', 503);
  const user = await requestUser(request);
  if (!user) return failure('Sign in to see your reviews.', 401);

  const params = new URL(request.url).searchParams;
  const role = params.get('role');
  const rawPage = params.get('page') ?? '0';
  const page = Number(rawPage);
  if ((role !== 'giver' && role !== 'taker') || !/^\d+$/.test(rawPage) ||
    !Number.isSafeInteger(page) || page * profileReviewPageSize > 2_147_483_647) {
    return failure('Invalid review role or page.', 400);
  }
  const { data, error } = await db.rpc('pickup_profile_reviews', {
    recipient: user.id,
    pickup_role: role,
    skip_rows: page * profileReviewPageSize,
    page_size: profileReviewPageSize,
  }).single<ProfileReviews>();
  return error ? failure('Could not load your reviews.', 503) : response(data);
}
