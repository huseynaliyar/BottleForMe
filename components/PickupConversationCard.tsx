'use client';

import { useEffect, useState } from 'react';
import { pickupRequest } from '@/lib/auth';
import { PickupPartnerProfile } from '@/components/PickupPartnerProfile';
import { ChevronRight, Package } from 'lucide-react';
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
  const avatar = <PickupAvatar name={title} listing={!assigned} pickupId={assigned ? offer.id : undefined} />;
  const amount = assigned ? (taker ? offer.collector_profit : offer.seller_payout) : offer.total_bcrs_value;
  return <article className="bf-pickup-row glass-navy flex w-full items-center gap-3 rounded-[24px] p-3 text-start shadow-sm transition hover:border-blue-400/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:p-4">
    {assigned ? <PickupPartnerProfile pickupId={offer.id} name={title}>{avatar}</PickupPartnerProfile> : avatar}
    <button type="button" onClick={onOpen} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-start">
      <span className="min-w-0 flex-1 space-y-1">
        <strong className="block text-base font-bold text-white [overflow-wrap:anywhere]">{title}</strong>
        <span className="block text-xs text-blue-200">
          {assigned ? offer.locality + ' · ' : ''}{offer.estimated_bottles} {t('Containers').toLocaleLowerCase(locale)}{' · '}{pickupCardDate(locale, offer)}
        </span>
        <span className="bf-status block text-xs text-blue-200" style={{ color: pickupStatusCss(offer.overdue ? 'overdue' : offer.status) }}>{status}</span>
      </span>
      <span className="bf-pickup-amount flex shrink-0 flex-col items-end gap-1 text-end text-xs text-slate-400">
        <strong className="text-base font-semibold tabular-nums text-white">{pickupMoney(locale, amount)}</strong>
        <span>{t(assigned ? (taker ? 'You earn' : 'You receive') : 'Deposit value')}</span>
        {unread > 0 ? <span aria-label={unread + ' ' + t('Unread messages')} className="min-w-5 rounded-full bg-blue-600 px-1.5 py-0.5 text-center font-bold text-white">
          {unread}
        </span> : <ChevronRight className="size-4 text-blue-300 rtl:rotate-180" aria-hidden="true" />}
      </span>
    </button>
  </article>;
}
