'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { pickupRequest } from '@/lib/auth';

type Message = { seq: number; body: string; created_at: string; mine: boolean };
type ChatPage = { messages: Message[]; canSend: boolean };
type Unread = { pickup_id: string; unread: number; last_message: string };

const path = '/chat';
const noUnread: Unread[] = [];
const messageTime = new Intl.DateTimeFormat('en-MT', {
  timeZone: 'Europe/Malta', dateStyle: 'medium', timeStyle: 'short',
});

function postChat(pickup: string, action: object, signal?: AbortSignal) {
  return pickupRequest(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickup, ...action }), signal,
  });
}

export function usePickupUnread(userId?: string) {
  const [state, setState] = useState<{ userId: string; unread: Unread[] }>();
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId || document.visibilityState !== 'visible') return;
    const request = ++generation.current;
    try {
      const data: { unread: Unread[] } = await pickupRequest(path);
      if (request === generation.current) setState({ userId, unread: data.unread });
    } catch { /* Try again on the next refresh. */ }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 12_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      generation.current += 1;
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [userId, refresh]);
  return { unread: state?.userId === userId ? state?.unread ?? noUnread : noUnread, refresh };
}

export default function PickupChat({ pickupId, onRead }: { pickupId: string; onRead: () => void }) {
  const [current, setCurrent] = useState<ChatPage>();
  const [older, setOlder] = useState<Message[]>([]);
  const [hasEarlier, setHasEarlier] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const pending = useRef<{ message: string; id: string } | null>(null);
  const lastRead = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const latest = current?.messages.at(-1)?.seq;
  const query = path + '?pickup=' + encodeURIComponent(pickupId);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing || document.visibilityState !== 'visible') return;
      refreshing = true;
      try {
        const data: ChatPage = await pickupRequest(query, { signal: controller.signal });
        if (!controller.signal.aborted) { setCurrent(data); setError(''); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load pickup chat.');
      } finally { refreshing = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 5_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [query, refreshKey]);

  useEffect(() => {
    const list = scroller.current;
    if (list && latest) list.scrollTop = list.scrollHeight;
  }, [latest]);

  useEffect(() => {
    if (!latest || latest <= lastRead.current || document.visibilityState !== 'visible') return;
    const controller = new AbortController();
    void postChat(pickupId, { action: 'read', through: latest }, controller.signal).then(() => {
      if (!controller.signal.aborted) { lastRead.current = latest; onRead(); }
    }).catch(() => { /* Retry after the next chat refresh. */ });
    return () => controller.abort();
  }, [pickupId, latest, current, onRead]);

  async function loadEarlier() {
    const first = older[0]?.seq ?? current?.messages[0]?.seq;
    if (!first || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const data: ChatPage = await pickupRequest(query + '&before=' + first);
      setOlder((previous) => [...data.messages, ...previous]);
      setHasEarlier(data.messages.length === 50);
      setError('');
    } catch {
      setError('Could not load earlier messages.');
    } finally { setLoadingEarlier(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (sending || !current?.canSend || !message) return;
    if (pending.current?.message !== message) pending.current = { message, id: crypto.randomUUID() };
    setSending(true);
    setSendError('');
    try {
      await postChat(pickupId, { action: 'send', ...pending.current });
      pending.current = null;
      setDraft('');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Could not send your message.');
    } finally { setSending(false); }
  }

  const firstCurrent = current?.messages[0]?.seq;
  const messages = [...older.filter((item) => firstCurrent === undefined || item.seq < firstCurrent), ...(current?.messages ?? [])];
  return (
    <section className="space-y-3 rounded-xl border border-blue-400/20 p-3" aria-label="Pickup chat">
      <h3 className="font-bold text-white">Pickup chat</h3>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {!current && !error && <p role="status" className="text-blue-200">Loading chat…</p>}
      {current && <>
        {hasEarlier && current.messages.length === 50 && <button type="button" disabled={loadingEarlier} onClick={() => void loadEarlier()}
          className="text-xs font-semibold text-blue-300">{loadingEarlier ? 'Loading…' : 'Load earlier messages'}</button>}
        <div ref={scroller} className="max-h-80 space-y-2 overflow-y-auto" role="log" aria-label="Pickup messages">
          {!messages.length && <p className="text-blue-200">No messages yet.</p>}
          {messages.map((item) => <div key={item.seq} className={'rounded-lg px-3 py-2 ' + (item.mine ? 'ml-8 bg-blue-950' : 'mr-8 bg-white/10')}>
            <p className="text-xs font-bold text-blue-200">{item.mine ? 'You' : 'Pickup partner'} · {messageTime.format(new Date(item.created_at))}</p>
            <p className="whitespace-pre-wrap break-words text-white">{item.body}</p>
          </div>)}
        </div>
        {current.canSend ? <form onSubmit={send} className="space-y-2">
          <label className="block text-blue-200">Message
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} maxLength={1000} rows={2}
              className="mt-1 block w-full rounded-xl bg-[#0b1220] p-2 text-base text-white" />
          </label>
          <button type="submit" disabled={sending || !draft.trim()}
            className="blue-btn rounded-xl px-3 py-2 font-bold text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send message'}</button>
          {sendError && <p role="alert" className="text-red-300">{sendError}</p>}
        </form> : <p className="text-blue-200">This pickup has ended. Messages can be read here. You can send messages while a pickup is active.</p>}
      </>}
    </section>
  );
}
