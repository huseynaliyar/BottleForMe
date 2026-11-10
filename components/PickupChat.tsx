'use client';

import { useLanguage } from '@/lib/language-context';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, MapPin, Package, Send, Wallet, Wine } from 'lucide-react';
import { PickupAvatar } from '@/components/PickupConversationCard';
import { pickupChatPattern, pickupConversationTitle, pickupDetails, pickupMoney } from '@/lib/pickup-conversation';
import type { PickupOffer } from '@/lib/types';
import { pickupRequest } from '@/lib/auth';
import { messageTime, usePickupChat, usePickupUnread as useUnread, type ChatAction, type ChatPage } from '@/lib/use-pickup-chat';

const path = '/chat';
const loadUnread = () => pickupRequest(path);
const visible = () => document.visibilityState === 'visible';
const createId = () => crypto.randomUUID();
function subscribe(listener: () => void) {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}
function loadChat(pickup: string, before?: number, signal?: AbortSignal): Promise<ChatPage> {
  return pickupRequest(path + '?pickup=' + encodeURIComponent(pickup) + (before ? '&before=' + before : ''), { signal });
}
function postChat(pickup: string, action: ChatAction, signal?: AbortSignal) {
  return pickupRequest(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickup, ...action }), signal,
  });
}

export function usePickupUnread(userId?: string) {
  return useUnread(userId, loadUnread, visible, subscribe);
}

const chatBackground = 'url("data:image/svg+xml,' + encodeURIComponent(pickupChatPattern('#60a5fa')) + '")';

export function PickupChatFallback({ message, onBack, action }: {
  message: string; onBack: () => void; action?: { label: string; run: () => void };
}) {
  const { t } = useLanguage();
  return <section className="flex min-h-0 flex-1 flex-col bg-[#080b12]" style={{ backgroundImage: chatBackground }}>
    <header className="flex shrink-0 items-center gap-2 border-b border-blue-400/20 bg-[#090f1d] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button type="button" aria-label={t('← All pickups')} onClick={onBack} className="grid size-11 place-items-center rounded-full text-blue-300 hover:bg-white/10">
        <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden="true" />
      </button>
      <h1 className="font-extrabold text-white">{t('Pickup chat')}</h1>
    </header>
    <div className="m-auto space-y-3 px-4 text-center">
      <p className="text-blue-200" role="status">{message}</p>
      {action && <button type="button" className="blue-btn rounded-xl px-3 py-2 text-white" onClick={action.run}>{action.label}</button>}
    </div>
  </section>;
}

const detailIcons = [MapPin, Package, Wallet];

export default function PickupChat({ offer, taker, onRead, onBack, onDetails }: {
  offer: PickupOffer; taker: boolean; onRead: () => void; onBack: () => void; onDetails: () => void;
}) {
  const { locale, t } = useLanguage();
  const pickupId = offer.id;
  const title = pickupConversationTitle(offer, taker, t);
  const [photo, setPhoto] = useState<string | null>(null);
  const detailsDialog = useRef<HTMLDialogElement>(null);
  const details = pickupDetails(offer, taker, locale, t);
  useEffect(() => {
    const controller = new AbortController();
    void pickupRequest('/' + encodeURIComponent(pickupId) + '/photo', { signal: controller.signal })
      .then(({ photo }) => { if (!controller.signal.aborted) setPhoto(photo); })
      .catch(() => {});
    return () => controller.abort();
  }, [pickupId]);
  const { current, messages, latest, draft, setDraft, sending, error, sendError, send, loadEarlier, loadingEarlier, hasEarlier }
    = usePickupChat(pickupId, onRead, loadChat, postChat, visible, subscribe, createId);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = scroller.current;
    if (list && latest) list.scrollTop = list.scrollHeight;
  }, [latest]);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#080b12]" style={{ backgroundImage: chatBackground }} aria-label={t("Pickup chat")}>
      <header className="flex shrink-0 items-center gap-2 border-b border-blue-400/20 bg-[#090f1d] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <button type="button" aria-label={t('← All pickups')} onClick={onBack} className="grid size-11 shrink-0 place-items-center rounded-full text-blue-300 hover:bg-white/10">
          <ChevronLeft className="size-6 rtl:rotate-180" aria-hidden="true" />
        </button>
        <PickupAvatar name={title} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-white">{title}</h1>
          <p className="truncate text-xs text-blue-200">{offer.locality} · {t('Pickup chat')}</p>
        </div>
        <button type="button" aria-haspopup="dialog" onClick={() => detailsDialog.current?.showModal()}
          className="min-h-11 shrink-0 rounded-xl bg-blue-950 px-2 text-xs font-semibold text-blue-100 sm:px-3">
          {t('Pickup details')}
        </button>
      </header>
      <div className="glass-navy mx-3 mt-3 grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl p-3 sm:mx-4 sm:gap-4">
        <div className="flex aspect-square w-16 items-center justify-center overflow-hidden rounded-xl bg-blue-950 text-blue-300 sm:w-24">
          {/* eslint-disable-next-line @next/next/no-img-element -- Private photo served as an authenticated data URL. */}
          {photo ? <img className="size-full object-cover" src={photo} alt={t('Bottles or bags for this pickup')} /> : <Package className="size-6" aria-hidden="true" />}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm font-extrabold text-white sm:text-lg">
            <span className="inline-flex items-center gap-1" aria-label={offer.estimated_bottles + ' ' + t('Containers')}>{offer.estimated_bottles} × <Wine className="size-4" aria-hidden="true" /></span>
            <span aria-label={t('Deposit value') + ' ' + pickupMoney(locale, offer.total_bcrs_value)}>{pickupMoney(locale, offer.total_bcrs_value)}</span>
          </div>
          <div aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-emerald-500">
            <span className="bg-blue-500" style={{ width: Math.max(0, Math.min(100, offer.split_percentage)) + '%' }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="min-w-0">
              <p className="text-blue-200">{t(taker ? 'You pay' : 'You receive')} · {offer.split_percentage}%</p>
              <p className="break-words font-extrabold text-blue-300">{pickupMoney(locale, offer.seller_payout)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-blue-200">{t(taker ? 'You earn' : 'Taker earns')} · {100 - offer.split_percentage}%</p>
              <p className="break-words font-extrabold text-[#00e599]">{pickupMoney(locale, offer.collector_profit)}</p>
            </div>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="px-4 pt-2 text-sm text-red-300">{error}</p>}
      {!current && !error && <p role="status" className="m-auto px-4 text-blue-200">{t('Loading chat…')}</p>}
      {current && <>
        {hasEarlier && current.messages.length === 50 && <button type="button" disabled={loadingEarlier} onClick={() => void loadEarlier()}
          className="shrink-0 self-center p-2 text-xs font-semibold text-blue-300">{loadingEarlier ? t('Loading…') : t('Load earlier messages')}</button>}
        <div ref={scroller} className={'min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 ' + (messages.length ? 'space-y-2' : 'grid place-items-center')}
          role="log" aria-label={t('Pickup messages')}>
          {!messages.length && <p className="rounded-full bg-[#090f1d] px-4 py-2 text-sm text-blue-200">{t('No messages yet.')}</p>}
          {messages.map((item) => <div key={item.seq} className={'w-fit max-w-[85%] rounded-2xl px-3 py-2 ' + (item.mine ? 'ms-auto bg-blue-950' : 'me-auto border border-blue-400/20 bg-[#090f1d]')}>
            <p className="text-xs font-semibold text-blue-200">{item.mine ? t('You') : title} · {messageTime.format(new Date(item.created_at))}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-white">{item.body}</p>
          </div>)}
        </div>
        {current.canSend ? <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
          <div className="flex items-end gap-2 rounded-[28px] border border-blue-400/30 bg-[#090f1d] p-1.5">
            <textarea aria-label={t('Message')} placeholder={t('Type your message…')} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} maxLength={1000} rows={1}
              className="min-h-11 max-h-28 min-w-0 flex-1 resize-none rounded-2xl bg-transparent px-3 py-2.5 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" />
            <button type="submit" disabled={sending || !draft.trim()} aria-label={sending ? t('Sending…') : t('Send message')}
              className="blue-btn grid size-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-50"><Send className="size-5 rtl:-scale-x-100" aria-hidden="true" /></button>
          </div>
          {sendError && <p role="alert" className="mt-1 text-sm text-red-300">{sendError}</p>}
        </form> : <p className="shrink-0 bg-[#090f1d] p-3 text-center text-sm text-blue-200">{t('This conversation is read-only.')}</p>}
      </>}
      <dialog ref={detailsDialog} aria-label={t('Pickup details')}
        className="fixed inset-x-0 bottom-0 top-auto mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-3xl overflow-y-auto rounded-t-[24px] border border-blue-400/25 bg-[#0d1527] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white backdrop:bg-black/50 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={'text-sm font-semibold ' + (offer.overdue || offer.status === 'cancelled' ? 'text-red-300' : 'text-emerald-400')}>{details.status}</span>
          <button type="button" autoFocus onClick={() => detailsDialog.current?.close()} className="min-h-11 rounded-xl bg-blue-950 px-3 text-xs font-semibold text-blue-100">
            {t('Back to chat')}
          </button>
        </div>
        <h2 className="mt-1 text-xl font-extrabold">{details.time ?? t('Time to be agreed')}</h2>
        {details.time && <p className="mt-1 text-sm text-blue-200">{t('Malta time')}</p>}
        <dl className="mt-3">
          {details.rows.map(({ label, value }, index) => {
            const Icon = detailIcons[index];
            return <div key={label} className="border-t border-blue-400/20 py-2.5">
              <dt className="flex items-center gap-2 text-sm text-blue-200"><Icon className="size-4" aria-hidden="true" />{label}</dt>
              <dd className="ms-6 mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd>
            </div>;
          })}
        </dl>
        <button type="button" onClick={() => { detailsDialog.current?.close(); onDetails(); }}
          className="min-h-11 w-full rounded-xl border border-blue-400/25 px-3 text-sm font-semibold text-blue-100">
          {t('Manage pickup')}
        </button>
      </dialog>
    </section>
  );
}
