'use client';

import { useLanguage } from '@/lib/language-context';
import { useState } from 'react';
import { pickupRequest } from '@/lib/auth';

export default function PickupPhoto({ pickupId }: { pickupId: string }) {
  const { t } = useLanguage();
  const [photo, setPhoto] = useState<string | null>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function show() {
    setLoading(true);
    setError('');
    try {
      const result = await pickupRequest('/' + encodeURIComponent(pickupId) + '/photo');
      setPhoto(result.photo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the listing photo.');
    } finally {
      setLoading(false);
    }
  }

  if (photo === null) return <p className="text-xs text-blue-200">{t("This listing has no photo.")}</p>;
  // eslint-disable-next-line @next/next/no-img-element -- Authenticated data URL with stripped metadata.
  if (photo) return <img className="max-h-72 w-full rounded-xl object-contain" src={photo} alt="Bottles or bags for this pickup" />;
  return <div>
    <button type="button" disabled={loading} onClick={() => void show()}
      className="rounded-lg bg-white/10 px-3 py-2 text-sm text-blue-100 disabled:opacity-50">
      {loading ? t("Loading photo…") : t("Show listing photo")}
    </button>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
