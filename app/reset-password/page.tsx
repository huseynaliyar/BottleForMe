'use client';

import { useLanguage } from '@/lib/language-context';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { emailAuthRequest } from '@/lib/email-auth-request';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);

  const [valid, setValid] = useState<boolean>();
  useEffect(() => {
    let active = true;
    const hash = new URL(window.location.href).searchParams.get('token_hash');
    const check = hash ? emailAuthRequest<{ valid: boolean }>('', { action: 'inspect', hash }) : Promise.resolve({ valid: false });
    void check.then((result) => {
      if (active) setValid(result.valid);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Could not check this link.');
    });
    return () => { active = false; };
  }, []);

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved) return;
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get('password') ?? '');
    if (password !== fields.get('confirm')) { setMessage('The passwords you entered are different.'); return; }
    if (password.length < 6) { setMessage('Use at least 6 characters for your password.'); return; }
    const hash = new URL(window.location.href).searchParams.get('token_hash');
    setBusy(true);
    setMessage('');
    try {
      if (!hash) throw new Error('This password reset link is no longer valid. Request a new link.');
      await emailAuthRequest('', { action: 'recover', hash, password });
      window.history.replaceState(null, '', '/reset-password');
      setSaved(true);
      setMessage('Password updated. You can now sign in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="bf-phone bf-reading mx-auto max-w-sm space-y-4 p-5 text-white">
    <h1 className="text-xl font-bold">{t("Choose a new password")}</h1>
    {valid === false && !saved && <p role="alert">{t("This password reset link is no longer valid. Request a new link.")}</p>}
    {valid === undefined && !message && <p role="status">Checking your password reset link…</p>}
    {!saved && valid === true && <form className="space-y-3" onSubmit={reset}>
      <label className="block">{t("New password")}<input className="block w-full rounded-xl bg-slate-900 p-3" type="password" name="password" autoComplete="new-password" minLength={6} required /></label>
      <label className="block">{t("Confirm new password")}<input className="block w-full rounded-xl bg-slate-900 p-3" type="password" name="confirm" autoComplete="new-password" minLength={6} required /></label>
      <button className="blue-btn w-full rounded-xl p-3" disabled={busy}>{busy ? t("Saving…") : 'Save password'}</button>
    </form>}
    {message && <p role={saved ? 'status' : 'alert'}>{message}</p>}
    <Link href="/" className="text-blue-300">Return to BottleForMe</Link>
  </main>;
}
