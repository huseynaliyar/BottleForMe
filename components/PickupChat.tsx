'use client';

import { useEffect, useRef } from 'react';
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

export default function PickupChat({ pickupId, onRead }: { pickupId: string; onRead: () => void }) {
  const { current, messages, latest, draft, setDraft, sending, error, sendError, send, loadEarlier, loadingEarlier, hasEarlier }
    = usePickupChat(pickupId, onRead, loadChat, postChat, visible, subscribe, createId);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = scroller.current;
    if (list && latest) list.scrollTop = list.scrollHeight;
  }, [latest]);

  return (
    <section className="space-y-3 rounded-xl border border-blue-400/20 p-3" aria-label="Pickup chat">
      <h3 className="font-bold text-white">Pickup chat</h3>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {!current && !error && <p role="status" className="text-blue-200">Loading chat…</p>}
      {current && <>
        {hasEarlier && current.messages.length === 50 && <button type="button" disabled={loadingEarlier} onClick={() => void loadEarlier()}
          className="text-xs font-semibold text-blue-300">{loadingEarlier ? 'Loading…' : 'Load earlier messages'}</button>}
        <div ref={scroller} className="max-h-[55dvh] min-h-36 space-y-2 overflow-y-auto" role="log" aria-label="Pickup messages">
          {!messages.length && <p className="text-blue-200">No messages yet.</p>}
          {messages.map((item) => <div key={item.seq} className={'rounded-lg px-3 py-2 ' + (item.mine ? 'ml-8 bg-blue-950' : 'mr-8 bg-white/10')}>
            <p className="text-xs font-bold text-blue-200">{item.mine ? 'You' : 'Pickup partner'} · {messageTime.format(new Date(item.created_at))}</p>
            <p className="whitespace-pre-wrap break-words text-white">{item.body}</p>
          </div>)}
        </div>
        {current.canSend ? <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="space-y-2">
          <label className="block text-blue-200">Message
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} maxLength={1000} rows={2}
              className="mt-1 block w-full rounded-xl bg-[#0b1220] p-2 text-base text-white" />
          </label>
          <button type="submit" disabled={sending || !draft.trim()}
            className="blue-btn rounded-xl px-3 py-2 font-bold text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send message'}</button>
          {sendError && <p role="alert" className="text-red-300">{sendError}</p>}
        </form> : <p className="text-blue-200">This conversation is read-only.</p>}
      </>}
    </section>
  );
}
