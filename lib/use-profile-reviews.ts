import { useEffect, useState } from 'react';
import { profileReviewPageSize, type ProfileReviewRole, type ProfileReviews } from './profile-reviews';

type LoadReviews = (role: ProfileReviewRole, page: number, signal: AbortSignal) => Promise<ProfileReviews>;

export function useProfileReviews(userId: string, role: ProfileReviewRole, load: LoadReviews) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: ProfileReviews }>();
  const key = [userId, role, page, revision].join(':');

  useEffect(() => {
    const controller = new AbortController();
    void load(role, page, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key });
    });
    return () => controller.abort();
  }, [key, load, page, role]);

  const current = result?.key === key ? result : undefined;
  const data = current?.data;
  return {
    data,
    loading: !current,
    error: !!current && !data,
    hasNext: !!data && (page + 1) * profileReviewPageSize < data.count,
    hasPrevious: page > 0,
    setPage,
    retry: () => setRevision((value) => value + 1),
  };
}
