'use client';

import { useLanguage } from '@/lib/language-context';
import { useEffect, useRef, useState } from 'react';
import { pickupRequest } from '@/lib/auth';

export default function ReportPickup({ pickupId, target, onClose }: {
  pickupId: string; target: 'listing' | 'user'; onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent || reason.trim().length < 10) return;
    setBusy(true);
    setError('');
    try {
      await pickupRequest('/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupId, target, reason }),
      });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the report.');
    } finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="report-title" onCancel={(event) => { event.preventDefault(); onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[#0e1626] p-5 text-white backdrop:bg-black/70">
    <h2 id="report-title" className="mb-3 font-bold">Report {target === 'user' ? 'pickup partner' : 'listing'}</h2>
    {sent ? <p role="status">{t("Report sent to the BottleForMe team.")}</p> :
      <form onSubmit={submit} className="space-y-3">
        <label className="block">{t("Describe the issue")}<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4}
            className="mt-1 block w-full rounded-xl bg-[#080b12] p-2" />
        </label>
        <p className="text-xs text-blue-200">Use 10–500 characters. Do not include passwords, handover codes or payment details.</p>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <button type="submit" className="blue-btn rounded-lg px-3 py-2 disabled:opacity-50" disabled={busy || reason.trim().length < 10}>{t("Submit report")}</button>
      </form>}
    <button type="button" className="mt-3 rounded-lg bg-white/10 px-3 py-2" onClick={onClose}>{t("Close")}</button>
  </dialog>;
}
