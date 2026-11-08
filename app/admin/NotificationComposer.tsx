'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const field = 'w-full rounded-xl border border-blue-500/25 bg-[#0b1220] px-3 py-2.5 text-white';

export default function NotificationComposer({ userId, recipient, onClear }: {
  userId: string;
  recipient: { id: string; label: string } | null;
  onClear: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const inFlight = useRef(false);
  const request = useRef<{ id: string; body: string }>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !supabase) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get('title') ?? '').trim();
    const message = String(values.get('message') ?? '').trim();
    if (!title || !message) {
      setNotice({ text: 'Enter a title and message.', error: true });
      return;
    }
    if (!recipient && !window.confirm('Send this notification to all confirmed accounts?')) return;

    const body = JSON.stringify({ title, message, recipient: recipient?.id ?? null });
    if (request.current?.body !== body) request.current = { id: crypto.randomUUID(), body };
    const key = request.current.id;
    inFlight.current = true;
    setSending(true);
    setNotice(undefined);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== userId) throw new Error('Sign in again to send a notification.');
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) request.current = null;
        throw new Error(result.error || 'Could not send the notification.');
      }
      request.current = null;
      form.reset();
      setNotice({ text: 'Sent to ' + result.sent + (result.sent === 1 ? ' account.' : ' accounts.') });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Could not send the notification.', error: true });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return <section className="glass-navy mb-5 rounded-[28px] p-4 sm:p-5" aria-labelledby="admin-notification-title">
    <h2 id="admin-notification-title" className="flex items-center gap-2 font-extrabold">
      <Bell className="size-4" /> Send an in-app notification
    </h2>
    <p className="my-2 break-words text-sm text-blue-100/75">
      To: {recipient?.label ?? 'All confirmed accounts'}
      {recipient && <button type="button" onClick={onClear} disabled={sending}
        className="ml-2 text-blue-300 underline disabled:opacity-50">Send to all instead</button>}
    </p>
    <form onSubmit={send} className="grid max-w-2xl gap-3">
      <label className="grid gap-1 text-sm font-semibold">Title
        <input name="title" className={field} maxLength={80} required disabled={sending} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Message
        <textarea name="message" className={field} maxLength={500} rows={3} required disabled={sending} />
      </label>
      {notice && <p role={notice.error ? 'alert' : 'status'}
        className={notice.error ? 'text-sm text-red-200' : 'text-sm text-emerald-300'}>{notice.text}</p>}
      <button type="submit" disabled={sending} className="blue-btn min-h-11 justify-self-start rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">
        {sending ? 'Sending…' : 'Send notification'}
      </button>
    </form>
  </section>;
}
