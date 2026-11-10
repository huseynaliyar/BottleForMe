import { useCallback, useEffect, useRef, useState } from 'react';

export type ChatMessage = { seq: number; body: string; created_at: string; mine: boolean };
export type ChatPage = { messages: ChatMessage[]; canSend: boolean };
export type UnreadChat = { pickup_id: string; unread: number; last_message: string };
export type ChatAction = { action: 'read'; through: number } | { action: 'send'; message: string; id: string };

type LoadChat = (pickup: string, before?: number, signal?: AbortSignal) => Promise<ChatPage>;
type PostChat = (pickup: string, action: ChatAction, signal?: AbortSignal) => Promise<unknown>;
type Subscribe = (listener: () => void) => () => void;
const emptyUnread: UnreadChat[] = [];

export const messageTime = new Intl.DateTimeFormat('en-MT', {
  timeZone: 'Europe/Malta', dateStyle: 'medium', timeStyle: 'short',
});

export function usePickupUnread(userId: string | undefined, load: () => Promise<{ unread: UnreadChat[] }>,
  visible: () => boolean, subscribe: Subscribe) {
  const [state, setState] = useState<{ userId: string; unread: UnreadChat[] }>();
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId || !visible()) return;
    const request = ++generation.current;
    try {
      const data = await load();
      if (request === generation.current) setState({ userId, unread: data.unread });
    } catch { /* Try again on the next refresh. */ }
  }, [userId, load, visible]);

  useEffect(() => {
    if (!userId) return;
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 12_000);
    const unsubscribe = subscribe(refresh);
    return () => {
      generation.current += 1;
      clearTimeout(initial);
      clearInterval(timer);
      unsubscribe();
    };
  }, [userId, refresh, subscribe]);
  return { unread: state?.userId === userId ? state?.unread ?? emptyUnread : emptyUnread, refresh };
}

export function usePickupChat(pickupId: string, onRead: () => void, load: LoadChat, post: PostChat,
  visible: () => boolean, subscribe: Subscribe, createId: () => string) {
  const [current, setCurrent] = useState<ChatPage>();
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasEarlier, setHasEarlier] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const pending = useRef<{ message: string; id: string } | null>(null);
  const lastRead = useRef(0);
  const latest = current?.messages[current.messages.length - 1]?.seq;

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (refreshing || !visible()) return;
      refreshing = true;
      try {
        const data = await load(pickupId, undefined, controller.signal);
        if (!controller.signal.aborted) { setCurrent(data); setError(''); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load pickup chat.');
      } finally { refreshing = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 5_000);
    const unsubscribe = subscribe(refresh);
    return () => { controller.abort(); clearInterval(timer); unsubscribe(); };
  }, [pickupId, refreshKey, load, subscribe, visible]);

  useEffect(() => {
    if (!latest || latest <= lastRead.current || !visible()) return;
    const controller = new AbortController();
    void post(pickupId, { action: 'read', through: latest }, controller.signal).then(() => {
      if (!controller.signal.aborted) { lastRead.current = latest; onRead(); }
    }).catch(() => { /* Retry after the next chat refresh. */ });
    return () => controller.abort();
  }, [pickupId, latest, current, onRead, post, visible]);

  async function loadEarlier() {
    const first = older[0]?.seq ?? current?.messages[0]?.seq;
    if (!first || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const data = await load(pickupId, first);
      setOlder((previous) => [...data.messages, ...previous]);
      setHasEarlier(data.messages.length === 50);
      setError('');
    } catch {
      setError('Could not load earlier messages.');
    } finally { setLoadingEarlier(false); }
  }

  async function send() {
    const message = draft.trim();
    if (sending || !current?.canSend || !message) return;
    if (pending.current?.message !== message) pending.current = { message, id: createId() };
    setSending(true);
    setSendError('');
    try {
      await post(pickupId, { action: 'send', ...pending.current });
      pending.current = null;
      setDraft('');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Could not send your message.');
    } finally { setSending(false); }
  }

  const firstCurrent = current?.messages[0]?.seq;
  const messages = [...older.filter((item) => firstCurrent === undefined || item.seq < firstCurrent), ...(current?.messages ?? [])];
  return { current, messages, latest, draft, setDraft, sending, error, sendError, send, loadEarlier, loadingEarlier, hasEarlier };
}
