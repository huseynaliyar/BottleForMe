'use client';

import { CalendarDays, ChevronRight, Clock3 } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { pickupMoney } from '@/lib/pickup-conversation';
import { formatPickupWindow, pickupTimezone } from '@/lib/pickup-schedule';
import type { PickupOffer } from '@/lib/types';

export function isAwaitingTaker(offer: PickupOffer) {
  return offer.status === 'open' && !offer.archived_at && !offer.collector_id;
}

const row = 'bf-waiting-panel border border-blue-400/20 text-white';

function AwaitingStatus() {
  const { t } = useLanguage();
  return <span className="bf-waiting-status inline-flex w-fit items-center gap-1 rounded-full bg-blue-950 px-2 py-1 text-xs font-semibold text-blue-200">
    <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />{t('Awaiting a Taker')}
  </span>;
}

export function AwaitingListingCard({ offer, replies, onOpen }: {
  offer: PickupOffer; replies: number; onOpen: () => void;
}) {
  const { t, locale } = useLanguage();
  const date = new Date(offer.created_at);
  const listed = Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, {
    month: 'short', day: 'numeric', timeZone: pickupTimezone,
  }).format(date);
  return <article className={row + ' grid gap-3.5 rounded-2xl p-4'}>
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-[17px] font-bold [overflow-wrap:anywhere]">{offer.locality}</h3>
        {listed && <p className="text-xs text-blue-200">{t('Listed')} <time dateTime={offer.created_at}>{listed}</time></p>}
      </div>
      <AwaitingStatus />
    </header>
    <dl className="grid grid-cols-2 gap-2 rounded-xl bg-blue-950 px-3 py-2 text-xs text-blue-200">
      <div className="min-w-0"><dt>{t('Containers')}</dt><dd className="text-lg font-bold tabular-nums text-white">{offer.estimated_bottles.toLocaleString(locale)}</dd></div>
      <div className="min-w-0 border-s border-blue-400/20 ps-3"><dt>{t('Deposit value')}</dt><dd className="break-words text-lg font-bold tabular-nums text-white"><bdi>{pickupMoney(locale, offer.total_bcrs_value)}</bdi></dd></div>
    </dl>
    {replies > 0 && <p className="text-xs text-blue-200">{t('Time requests awaiting your reply')} · {replies.toLocaleString(locale)}</p>}
    <button type="button" onClick={onOpen} aria-label={t('Manage listing') + ' · ' + offer.locality + ' · ' + offer.estimated_bottles + ' ' + t('Containers')}
      className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-blue-400/25 px-3 py-2 text-start text-sm font-semibold text-blue-300">
      {t('Manage listing')} <ChevronRight aria-hidden="true" className="size-4 shrink-0 rtl:rotate-180" />
    </button>
  </article>;
}

export function AwaitingListingSummary({ offer }: { offer: PickupOffer }) {
  const { t, locale } = useLanguage();
  const windows = offer.availability ?? [];
  const method = offer.payout_method === 'cash' ? t('Cash') : offer.payout_method === 'revolut' ? 'Revolut' : t('As agreed');
  return <>
    <AwaitingStatus />
    <section className={row + ' rounded-2xl p-4'}>
      <h3 className="text-lg font-bold [overflow-wrap:anywhere]">{offer.locality}</h3>
      <dl className="bf-fact-rows bf-waiting-facts mt-2">
        <div>
          <dt>{t('Containers')}</dt>
          <dd>{offer.estimated_bottles.toLocaleString(locale)} {t('Containers').toLocaleLowerCase(locale)} · {offer.bag_count.toLocaleString(locale)} {t(offer.bag_count === 1 ? 'Bag' : 'Bags').toLocaleLowerCase(locale)}</dd>
        </div>
        <div><dt>{t('Estimated deposit')}</dt><dd><bdi>{pickupMoney(locale, offer.total_bcrs_value)}</bdi></dd></div>
        <div><dt>{t('Your share')}</dt><dd><bdi>{pickupMoney(locale, offer.seller_payout)}</bdi>{offer.seller_payout > 0 && ' · ' + method}</dd></div>
      </dl>
      <div className="flex items-start gap-2 border-t border-blue-400/20 pt-3 text-sm text-blue-200">
        <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {windows.length ? <div className="min-w-0 space-y-1">
          <ul className="space-y-1">{windows.map((window) => <li key={window.start}>{formatPickupWindow(window)}</li>)}</ul>
          <p className="text-xs">{t('Malta time')}</p>
        </div> : <p>{t('No availability set')}</p>}
      </div>
    </section>
  </>;
}
