'use client';

import { useLanguage } from '@/lib/language-context';

export default function PickupCancellation({ busy, onCancel, onReport }: {
  busy: boolean; onCancel?: () => void; onReport?: () => void;
}) {
  const { t } = useLanguage();
  return <>
    {onCancel && <details className="bf-pickup-cancel">
      <summary>{t('Cancel pickup')}</summary>
      <div className="bf-cancel-confirm mt-2 space-y-2 rounded-xl border border-red-400/25 p-3">
        <p>{t('Cancelling closes this pickup for both people.')}</p>
        <button type="button" disabled={busy} onClick={onCancel}
          className="min-h-11 w-full rounded-lg bg-red-900 px-3 py-2 font-bold text-white disabled:opacity-50">{t('Confirm cancellation')}</button>
      </div>
    </details>}
    {onReport && <button type="button" onClick={onReport}
      className="min-h-11 w-full rounded-xl border border-blue-400/30 px-3 py-2 text-sm font-semibold text-blue-100">{t('Report pickup partner')}</button>}
  </>;
}
