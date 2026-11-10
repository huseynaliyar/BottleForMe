import { useEffect, useState } from 'react';
import type { PickupPartner, Review } from './pickup-partner';

export function usePickupPartner(id: string, load: (id: string, signal: AbortSignal) => Promise<PickupPartner>,
  submit: (id: string, review: Review) => Promise<Review>) {
  const [partner, setPartner] = useState<PickupPartner>();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void load(id, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setPartner(result);
      setStars(result.reviewGiven?.stars ?? 5);
      setComment(result.reviewGiven?.comment ?? '');
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load your pickup partner.');
    });
    return () => controller.abort();
  }, [id, load]);

  async function save() {
    if (saving || !partner?.canReview) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const review = await submit(id, { stars, comment });
      setPartner({ ...partner, reviewGiven: review });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your review.');
    } finally {
      setSaving(false);
    }
  }
  return { partner, stars, comment, setStars, setComment, saving, saved, error, save };
}
