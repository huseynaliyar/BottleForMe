'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { accountRequest } from '@/lib/auth';
import { useLanguage } from '@/lib/language-context';
import { profileRating, profileReviewDate, profileReviewRoles, profileReviewsPath, type ProfileReviewRole, type ProfileReviews as ReviewPage } from '@/lib/profile-reviews';
import { useProfileReviews } from '@/lib/use-profile-reviews';

function loadReviews(role: ProfileReviewRole, page: number, signal: AbortSignal): Promise<ReviewPage> {
  return accountRequest(profileReviewsPath(role, page), { signal });
}

export default function ProfileReviews({ userId, activeRole }: { userId: string; activeRole: ProfileReviewRole }) {
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<ProfileReviewRole>();
  const role = selectedRole ?? activeRole;

  return <section className="glass-navy space-y-3 rounded-2xl p-4" aria-labelledby="profile-reviews-heading">
    <h3 id="profile-reviews-heading" className="font-bold text-white">{t('Reviews received')}</h3>
    <div className="bf-dialog-tabs flex flex-wrap gap-1" role="group" aria-label={t('Pickup role')}>
      {profileReviewRoles.map((option) => <button key={option} type="button" aria-pressed={role === option}
        className="min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold text-blue-200" onClick={() => setSelectedRole(option)}>
        {t(option === 'giver' ? 'Giver' : 'Taker')}
      </button>)}
    </div>
    <ReviewsForRole key={role} userId={userId} role={role} />
  </section>;
}

function ReviewsForRole({ userId, role }: { userId: string; role: ProfileReviewRole }) {
  const { t, locale } = useLanguage();
  const { data, loading, error, hasPrevious, hasNext, setPage, retry } = useProfileReviews(userId, role, loadReviews);

  if (loading) return <p role="status" className="text-sm text-blue-200">{t('Loading reviews…')}</p>;
  if (error || !data) return <div className="space-y-2">
    <p role="alert" className="text-sm text-red-300">{t('Could not load your reviews.')}</p>
    <button type="button" className="rounded-xl bg-blue-950 px-3 py-2 font-semibold text-blue-100" onClick={retry}>{t('Retry')}</button>
  </div>;
  if (!data.count) return <p className="text-sm text-blue-200">{t('No ratings yet')}</p>;

  return <>
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-950 px-3 py-2">
      <Star className="size-4 text-blue-300" aria-hidden="true" />
      {data.average !== null && <bdi className="font-bold text-white">{profileRating(locale, data.average)}</bdi>}
      <span className="text-sm text-blue-200">{t('Reviews')} · {data.count.toLocaleString(locale)}</span>
    </div>
    <ul className="divide-y divide-blue-400/20">
      {data.reviews.map((review) => <li key={review.pickupId} className="space-y-1 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <bdi className="font-semibold text-blue-300">{profileRating(locale, review.stars)}</bdi>
          {review.pickupDate && <span className="text-xs text-blue-200">{t('Pickup date')} <time dateTime={review.pickupDate}>{profileReviewDate(locale, review.pickupDate)}</time></span>}
        </div>
        {review.comment.trim() && <p className="whitespace-pre-wrap break-words text-sm text-blue-100" dir="auto">{review.comment}</p>}
      </li>)}
    </ul>
    {(hasPrevious || hasNext) && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!hasPrevious} onClick={() => setPage((value) => value - 1)}
        className="rounded-xl bg-blue-950 px-3 py-2 text-sm font-semibold text-blue-100">{t('Previous page')}</button>
      <button type="button" disabled={!hasNext} onClick={() => setPage((value) => value + 1)}
        className="rounded-xl bg-blue-950 px-3 py-2 text-sm font-semibold text-blue-100">{t('Next page')}</button>
    </div>}
  </>;
}
