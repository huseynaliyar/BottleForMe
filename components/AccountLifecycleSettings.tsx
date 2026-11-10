'use client';

import { useLanguage } from '@/lib/language-context';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { accountRequest, signOutFromSupabase } from '@/lib/auth';
import { disableBrowserPush } from '@/lib/browser-push';
import { accountDeleteInfo, accountPauseInfo, type AccountLifecycle } from '@/lib/account-lifecycle';

export const loadAccountLifecycle = (signal: AbortSignal): Promise<AccountLifecycle> =>
  accountRequest('/api/account/lifecycle', { signal });

export default function AccountLifecycleSettings({ lifecycle, onUpdate }: {
  lifecycle: AccountLifecycle; onUpdate: (value: AccountLifecycle) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { paused, deleting } = lifecycle;

  async function apply(action: 'pause' | 'reactivate' | 'delete') {
    if (busy || action === 'delete' && !password) return;
    if (action === 'pause' && !window.confirm('Deactivate your BottleForMe account?')) return;
    if (action === 'delete' && !window.confirm('Permanently delete your BottleForMe account?')) return;
    setBusy(true);
    setError('');
    try {
      const result = await accountRequest('/api/account/lifecycle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'delete' ? { action, password } : { action }),
      });
      if (action === 'delete') {
        await disableBrowserPush().catch(() => {});
        await signOutFromSupabase().catch(() => {});
        router.replace('/');
      } else {
        if (action === 'pause') await disableBrowserPush().catch(() => {});
        onUpdate(result);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your account.');
    } finally {
      if (action === 'delete') setPassword('');
      setBusy(false);
    }
  }

  return <section className="glass-navy space-y-3 rounded-xl p-4">
    <h2 className="font-semibold">{t("Account access")}</h2>
    <p className="text-sm text-blue-200">{deleting ? t("Deletion is pending.") : paused ? t("Your account is deactivated.") : accountPauseInfo}</p>
    {!deleting && <button type="button" disabled={busy} onClick={() => void apply(paused ? 'reactivate' : 'pause')}
      className="rounded-lg bg-white/10 px-3 py-2 text-sm">{paused ? t("Reactivate account") : t("Deactivate account")}</button>}
    <details className="space-y-2 text-sm">
      <summary className="cursor-pointer font-semibold text-red-300">{deleting ? t("Retry account deletion") : t("Delete account")}</summary>
      <p>{accountDeleteInfo}</p>
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void apply('delete'); }}>
        <label className="block">{t("Current password")}<input type="password" autoComplete="current-password" maxLength={256} value={password}
            onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg bg-[#0b1220] p-2" />
        </label>
        <button type="submit" disabled={busy || !password} className="rounded-lg bg-red-800 px-3 py-2 text-white disabled:opacity-50">{t("Delete permanently")}</button>
      </form>
    </details>
    {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
    <Link href="/help" className="inline-block text-sm text-blue-300">{t("Help with your account")}</Link>
  </section>;
}
