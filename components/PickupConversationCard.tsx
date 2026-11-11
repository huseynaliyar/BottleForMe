'use client';

import { useEffect, useState } from 'react';
import { pickupRequest } from '@/lib/auth';
import { ChevronRight, Package, Wine } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { pickupCardDate, pickupConversationTitle, pickupInitials, pickupMoney } from '@/lib/pickup-conversation';
import { pickupStatusCss } from '@/lib/pickup-status';
import type { PickupOffer } from '@/lib/types';

export function PickupAvatar({ name, listing = false, pickupId }: { name: string; listing?: boolean; pickupId?: string }) {
  const [photo, setPhoto] = useState<{ id: string; avatar: string | null }>();
  useEffect(() => {
    if (!pickupId) return;
    const controller = new AbortController();
    pickupRequest('/' + pickupId + '/partner?avatar=1', { signal: controller.signal })
      .then(({ avatar }: { avatar: string | null }) => { if (!controller.signal.aborted) setPhoto({ id: pickupId, avatar }); }).catch(() => {});
    return () => controller.abort();
  }, [pickupId]);
  const avatar = photo?.id === pickupId ? photo?.avatar : undefined;
  return <span aria-hidden="true" className="bf-avatar flex size-11 shrink-0 overflow-hidden items-center justify-center rounded-full border border-blue-400/25 bg-blue-950 text-sm font-extrabold text-blue-100">
    {/* eslint-disable-next-line @next/next/no-img-element -- authenticated thumbnail is an inline image */}
    {avatar ? <img alt="" src={avatar} className="size-full object-cover" /> : listing ? <Package className="size-5" /> : pickupInitials(name)}
  </span>;
}

export default function PickupConversationCard({ offer, taker, status, unread = 0, onOpen }: {
  offer: PickupOffer; taker: boolean; status: string; unread?: number; onOpen: () => void;
}) {
  const { locale, t } = useLanguage();
  const assigned = !!(offer.collector_id && offer.seller_id);
  const title = pickupConversationTitle(offer, taker, t);
  return <button type="button" onClick={onOpen}
    className="bf-pickup-row glass-navy flex w-full items-center gap-3 rounded-[24px] p-3 text-start shadow-sm transition hover:border-blue-400/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:p-4">
    <PickupAvatar name={title} listing={!assigned} pickupId={assigned ? offer.id : undefined} />
    <span className="min-w-0 flex-1 space-y-1">
      <strong className="block truncate text-base font-extrabold text-white">{title}</strong>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-blue-200">
        <span className="inline-flex items-center gap-1" aria-label={offer.estimated_bottles + ' ' + t('Containers')}>
          {offer.estimated_bottles} × <Wine className="size-3.5" aria-hidden="true" />
        </span>
        <span className="font-bold text-[#00e599]">{t(assigned ? (taker ? 'You earn' : 'You receive') : 'Deposit value')}{' '}
          {pickupMoney(locale, assigned ? (taker ? offer.collector_profit : offer.seller_payout) : offer.total_bcrs_value)}</span>
      </span>
      <span className="bf-status block text-xs text-blue-200" style={{ color: pickupStatusCss(offer.overdue ? 'overdue' : offer.status) }}>{status}</span>
    </span>
    <span className="flex shrink-0 flex-col items-end gap-2 text-xs text-slate-400">
      <span>{pickupCardDate(locale, offer)}</span>
      {unread > 0 ? <span aria-label={unread + ' ' + t('Unread messages')} className="min-w-5 rounded-full bg-blue-600 px-1.5 py-0.5 text-center font-bold text-white">
        {unread}
      </span> : <ChevronRight className="size-4 text-blue-300 rtl:rotate-180" aria-hidden="true" />}
    </span>
  </button>;
}
