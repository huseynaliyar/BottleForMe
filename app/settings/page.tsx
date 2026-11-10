'use client';

import { useLanguage } from '@/lib/language-context';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accountRequest } from '@/lib/auth';
import { useBlockedAccounts } from '@/lib/use-blocked-accounts';
import { pickupPhoneHelp } from '@/lib/pickup-partner';
import { supabase } from '@/lib/supabase';
import WebPushControl from '@/components/WebPushControl';
import ThemeSetting from '@/components/ThemeSetting';
import LanguageSetting from '@/components/LanguageSetting';
import AccountLifecycleSettings, { loadAccountLifecycle } from '@/components/AccountLifecycleSettings';
import { useAccountLifecycle } from '@/lib/use-account-lifecycle';

const loadBlocks = (signal: AbortSignal) => accountRequest('/api/account/blocks', { signal });
const unblock = (id: string) => accountRequest('/api/account/blocks', {
  method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
});

export default function SettingsPage() {
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string>();
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-8 text-white">
    <Link href="/?view=profile" className="text-blue-300">{t("← Profile")}</Link>
    <h1 className="text-2xl font-bold">{t("Settings")}</h1>
    <ThemeSetting />
    <LanguageSetting />
    {userId ? <Settings key={userId} userId={userId} />
      : authReady || !supabase ? <p className="text-blue-200">{t("Sign in to manage your account preferences.")}</p>
        : <p className="text-blue-200">{t("Loading settings…")}</p>}
  </main>;
}

function Settings({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const status = useAccountLifecycle(userId, loadAccountLifecycle);
  return <>
    {status.lifecycle ? <>
      {!status.lifecycle.paused && <ActiveSettings userId={userId} />}
      <AccountLifecycleSettings lifecycle={status.lifecycle} onUpdate={status.update} />
    </> : <p className="text-sm text-blue-200">{status.error || t("Loading account status…")}</p>}
  </>;
}

function ActiveSettings({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const blocks = useBlockedAccounts(loadBlocks, unblock);
  const [sharePhone, setSharePhone] = useState<boolean>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void accountRequest('/api/account/settings', { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSharePhone(result.sharePhone); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, []);

  async function change(value: boolean) {
    setSaving(true);
    setError('');
    try {
      const result = await accountRequest('/api/account/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sharePhone: value }),
      });
      setSharePhone(result.sharePhone);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <section className="glass-navy space-y-2 rounded-xl p-4">
      <h2 className="font-semibold">{t("Pickup privacy")}</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sharePhone ?? false} disabled={saving || sharePhone === undefined}
          onChange={(event) => void change(event.target.checked)} />{t("Share my phone number")}</label>
      <p className="text-sm text-blue-200">{t(pickupPhoneHelp)}</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </section>
    <section className="glass-navy space-y-2 rounded-xl p-4">
      <h2 className="font-semibold">{t("Notifications")}</h2>
      <WebPushControl userId={userId} />
    </section>
    <section className="glass-navy space-y-2 rounded-xl p-4">
      <h2 className="font-semibold">{t("Blocked accounts")}</h2>
      {blocks.accounts?.length === 0 && <p className="text-sm text-blue-200">{t("You haven’t blocked any accounts.")}</p>}
      {!blocks.accounts && !blocks.error && <p className="text-sm text-blue-200">{t("Loading blocked accounts…")}</p>}
      {blocks.accounts?.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="break-words">{account.name}</span>
        <button type="button" disabled={blocks.busy} onClick={() => void blocks.remove(account.id)}
          className="rounded-lg bg-white/10 px-3 py-2">{t("Unblock")}</button>
      </div>)}
      {blocks.error && <p role="alert" className="text-sm text-red-300">{blocks.error}</p>}
    </section>
  </>;
}
