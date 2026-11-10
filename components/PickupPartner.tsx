'use client';

import { useLanguage } from '@/lib/language-context';
import { useState } from 'react';
import { accountRequest, pickupRequest } from '@/lib/auth';
import { blockPickupExplanation } from '@/lib/marketplace-blocks';
import type { PickupPartner as Partner, Review } from '@/lib/pickup-partner';
import { usePickupPartner } from '@/lib/use-pickup-partner';

const partnerPath = (id: string) => '/' + encodeURIComponent(id) + '/partner';
const loadPartner = (id: string, signal: AbortSignal): Promise<Partner> => pickupRequest(partnerPath(id), { signal });
const submitReview = (id: string, review: Review): Promise<Review> => pickupRequest(partnerPath(id), {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review),
});

export default function PickupPartner({ pickupId }: { pickupId: string }) {
  const { t } = useLanguage();
  const info = usePickupPartner(pickupId, loadPartner, submitReview);
  const { partner } = info;
  const [blocked, setBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState('');

  async function block() {
    if (blocking || !window.confirm(blockPickupExplanation)) return;
    setBlocking(true);
    setBlockError('');
    try {
      await accountRequest('/api/account/blocks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickupId }),
      });
      setBlocked(true);
    } catch (cause) {
      setBlockError(cause instanceof Error ? cause.message : 'Could not block the account.');
    } finally { setBlocking(false); }
  }

  const isBlocked = blocked || partner?.blockedByYou;

  return <section className="space-y-2 rounded-xl border border-blue-400/20 p-3 text-blue-100">
    <h4 className="font-bold text-white">{t("Pickup partner")}</h4>
    {partner ? <>
      <p>{partner.name} · {t(partner.role)}</p>
      <p className="text-xs">{partner.count ? `${partner.average}/5 · ${partner.count} ratings` : t("No ratings yet")}</p>
      {partner.phone && !isBlocked && <p className="break-words">Phone · {partner.phone}</p>}
      {isBlocked ? <p className="text-xs">You blocked this account. Manage it in Settings.</p>
        : <button type="button" disabled={blocking} onClick={() => void block()}
          className="rounded-lg bg-white/10 px-2 py-1 text-xs text-blue-100">{t("Block account")}</button>}
      {blockError && <p role="alert" className="text-xs text-red-300">{blockError}</p>}
      {partner.reviewReceived && <div className="space-y-1 text-sm">
        <p className="font-bold">Your partner’s review · {partner.reviewReceived.stars}/5</p>
        <p className="whitespace-pre-wrap break-words">{partner.reviewReceived.comment}</p>
      </div>}
      {partner.canReview && <form onSubmit={(event) => { event.preventDefault(); void info.save(); }} className="space-y-2">
        <label className="block">{t("Your rating")}<select value={info.stars} onChange={(event) => info.setStars(Number(event.target.value))}
            className="ml-2 rounded-lg bg-[#0b1220] p-2">
            {[5, 4, 3, 2, 1].map((number) => <option key={number} value={number}>{number} / 5</option>)}
          </select>
        </label>
        <label className="block">{t("Review (optional)")}<textarea maxLength={500} value={info.comment} onChange={(event) => info.setComment(event.target.value)}
            className="mt-1 block w-full rounded-lg bg-[#0b1220] p-2" />
        </label>
        <button type="submit" disabled={info.saving} className="blue-btn rounded-lg px-3 py-2 text-white disabled:opacity-50">
          {info.saving ? t("Saving…") : partner.reviewGiven ? t("Update review") : t("Submit review")}
        </button>
        {info.saved && <p role="status" className="text-xs">{t("Review saved.")}</p>}
      </form>}
    </> : !info.error && <p className="text-xs">Loading pickup partner…</p>}
    {info.error && <p role="alert" className="text-xs text-red-300">{info.error}</p>}
  </section>;
}
