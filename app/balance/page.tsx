'use client';

import { useLanguage } from '@/lib/language-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { pickupRequest } from '@/lib/auth';
import { balanceNote, formatEuro, pickupBalance } from '@/lib/pickup-balance';
import type { PickupOffer } from '@/lib/types';

export default function BalancePage() {
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>();
  const [state, setState] = useState<{ userId: string; offers?: PickupOffer[]; error?: string }>();

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    pickupRequest('?mine=true', { signal: controller.signal }).then(({ offers }) => {
      if (!controller.signal.aborted) setState({ userId, offers });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ userId, error: 'Could not load pickup history. Refresh to try again.' });
    });
    return () => controller.abort();
  }, [userId]);

  const current = state?.userId === userId ? state : undefined;
  const balance = current?.offers && userId ? pickupBalance(current.offers, userId) : undefined;
  return <main className="bf-phone bf-reading mx-auto max-w-lg space-y-4 px-4 py-8 text-white">
    <Link href="/" className="text-blue-300">{t("← BottleForMe")}</Link>
    <h1 className="text-2xl font-bold">{t("Balance")}</h1>
    {(!supabase || userId === null) && <p>Log in to see your pickup estimates.</p>}
    {supabase && userId !== null && !balance && !current?.error && <p role="status">Loading pickup estimates…</p>}
    {current?.error && <p role="alert">{current.error}</p>}
    {balance && <>
      <div className="bf-balance-total glass-navy space-y-2 rounded-xl p-4">
        <p>{t("Estimated earnings") + ' '}<strong>{formatEuro(balance.earnings)}</strong></p>
        <p>{t("Total deposit value") + ' '}<strong>{formatEuro(balance.deposit)}</strong></p>
      </div>
      <p className="text-sm text-blue-200">{balanceNote}</p>
      <h2 className="font-bold">{t("Completed pickup history")}</h2>
      {!balance.entries.length && <p>{t("No completed pickups yet.")}</p>}
      <ul className="space-y-2">{balance.entries.map((entry) => <li key={entry.id} className="glass-navy rounded-xl p-3">
        <strong>{entry.locality} · {entry.role}</strong>
        <p>{new Date(entry.date).toLocaleDateString('en-MT', { timeZone: 'Europe/Malta' })}</p>
        <p>{t("Estimated earnings") + ' '}{formatEuro(entry.earnings)} · Deposit {formatEuro(entry.deposit)}</p>
      </li>)}</ul>
    </>}
  </main>;
}
