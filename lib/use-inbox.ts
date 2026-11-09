import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationItem } from './types';

type InboxRow = {
  batch_id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  pickup_id: string | null;
};

export function useInbox(client: SupabaseClient | null, userId: string | undefined, open: boolean) {
  const [inbox, setInbox] = useState<{ userId: string; rows: InboxRow[] }>();
  const [error, setError] = useState<{ userId: string; message: string }>();
  const generation = useRef(0);
  const activeAccount = useRef(userId);
  const rows = inbox?.userId === userId ? inbox?.rows ?? [] : [];

  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    const request = ++generation.current;
    try {
      const { data, error: queryError } = await client.from('account_notifications')
        .select('batch_id,title,message,created_at,read_at,pickup_id').eq('user_id', userId)
        .order('created_at', { ascending: false }).order('batch_id', { ascending: false }).limit(50);
      if (queryError) throw queryError;
      if (request !== generation.current) return;
      setInbox({ userId, rows: data });
      setError(undefined);
    } catch {
      if (request === generation.current) setError({ userId, message: 'Could not load your inbox. Try reopening notifications.' });
    }
  }, [client, userId]);

  useEffect(() => {
    activeAccount.current = userId;
    if (!userId) return;
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      generation.current += 1;
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [open, refresh]);

  async function markRead() {
    if (!client || !userId) return;
    const ids = rows.filter((row) => !row.read_at).map((row) => row.batch_id);
    if (ids.length === 0) return;
    try {
      const { error: updateError } = await client.from('account_notifications')
        .update({ read_at: new Date().toISOString() }).eq('user_id', userId)
        .in('batch_id', ids).is('read_at', null);
      if (updateError) throw updateError;
      if (activeAccount.current === userId) await refresh();
    } catch {
      if (activeAccount.current === userId) setError({ userId, message: 'Could not mark your inbox as read. Try again.' });
    }
  }

  const notifications = rows.map<NotificationItem>((row) => ({
    id: 'admin:' + row.batch_id,
    title: row.title,
    message: row.message,
    timestamp: new Date(row.created_at).toLocaleString(),
    read: !!row.read_at,
    type: 'system',
    pickupId: row.pickup_id ?? undefined,
  }));

  return { notifications, markRead, error: error?.userId === userId ? error?.message : undefined };
}
