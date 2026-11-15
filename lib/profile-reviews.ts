import { pickupTimezone } from './pickup-schedule';

export const profileReviewPageSize = 10;
export const profileReviewRoles = ['giver', 'taker'] as const;
export type ProfileReviewRole = (typeof profileReviewRoles)[number];

export type ProfileReviews = {
  average: number | null;
  count: number;
  reviews: { pickupId: string; stars: number; comment: string; pickupDate: string | null }[];
};

export function profileReviewsPath(role: ProfileReviewRole, page: number) {
  return '/api/account/reviews?role=' + role + '&page=' + page;
}

export function profileRating(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value) + '/5';
}

export function profileReviewDate(locale: string, value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: pickupTimezone }).format(date);
}
