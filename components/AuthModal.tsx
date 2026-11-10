'use client';

import { useLanguage } from '@/lib/language-context';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { MALTA_LOCALITIES, UserProfile, UserRole } from '@/lib/types';
import Link from 'next/link';
import { draftTermsVersion } from '@/lib/draft-terms';
import { registerWithSupabase, requestPasswordReset, resendSignupCode, signInWithSupabase, updatePassword, verifySignupCode } from '@/lib/auth';
import { authErrorCode, signupCodeError } from '@/lib/signup-otp';
import { useSignupCode } from '@/lib/use-signup-code';
import { formatPhone, phoneCountries } from '@/lib/phone';
import { REVOLUT_TAG } from '@/lib/pickup-validation';

interface AuthModalProps {
  isOpen: boolean;
  recovery: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile, verified?: boolean) => void;
  onPasswordUpdated: () => void;
}

const inputClass = 'w-full rounded-xl border border-blue-500/25 bg-[#0d1527] px-3 py-2.5 text-white';
const buttonClass = 'rounded-xl px-3 py-2 text-sm font-bold text-blue-200 hover:bg-blue-900/40 disabled:opacity-50';
type AccountField = 'name' | 'email' | 'password' | 'confirm' | 'revolut' | 'code' | 'terms';

export default function AuthModal({ isOpen, recovery, onClose, onAuthSuccess, onPasswordUpdated }: AuthModalProps) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const otp = useSignupCode();
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot' | 'verify'>('signin');
  const [accountEmail, setAccountEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean; field?: AccountField } | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (isOpen && element && !element.open) element.showModal();
    if (!isOpen && element?.open) element.close();
  }, [isOpen]);

  function changeMode(next: typeof mode) {
    setMode(next);
    setNotice(null);
  }

  function fieldError(field: AccountField, text: string) {
    setNotice({ field, text, error: true });
  }

  function fieldFeedback(field: AccountField) {
    return notice?.field === field ? { 'aria-invalid': true, 'aria-describedby': 'account-notice' } : {};
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get('email') ?? '').trim();
    const password = String(fields.get('password') ?? '');
    const name = String(fields.get('name') ?? '').trim();
    if (!recovery && mode === 'register' && !fields.has('terms')) {
      return fieldError('terms', 'Accept the draft Terms & Conditions to register.');
    }
    const revolutTag = String(fields.get('revolut') ?? '').trim();
    if (!recovery && mode === 'register' && !name) return fieldError('name', 'Enter your full name.');
    if (!recovery) {
      const emailInput = form.elements.namedItem('email');
      if (!email) return fieldError('email', 'Enter your email address.');
      if (emailInput instanceof HTMLInputElement && emailInput.validity.typeMismatch) {
        return fieldError('email', 'Enter a valid email address.');
      }
    }
    if ((recovery || (mode !== 'forgot' && mode !== 'verify')) && !password) return fieldError('password', 'Enter your password.');
    if ((recovery || mode === 'register') && password.length < 6) {
      return fieldError('password', 'Use at least 6 characters for your password.');
    }
    if (recovery && password !== fields.get('confirm')) return fieldError('confirm', 'The passwords you entered are different.');
    if (!recovery && mode === 'forgot' && otp.resetSeconds > 0) return;
    if (!recovery && mode === 'register' && revolutTag && !REVOLUT_TAG.test(revolutTag)) {
      return fieldError('revolut', 'Enter a valid Revolut tag or leave it blank.');
    }
    const code = String(fields.get('code') ?? '').trim();
    if (!recovery && mode === 'verify' && !otp.canVerify()) return fieldError('code', 'Wait before trying another code.');
    if (!recovery && mode === 'verify' && !/^\d{6}$/.test(code)) return fieldError('code', 'Enter the six-digit code from your email.');
    submitting.current = true;
    setLoading(true);
    setNotice(null);

    try {
      if (recovery) {
        await updatePassword(password);
        form.reset();
        onPasswordUpdated();
      } else if (mode === 'verify') {
        onAuthSuccess(await verifySignupCode(email, code), true);
        form.reset();
      } else if (mode === 'forgot') {
        await requestPasswordReset(email);
        otp.resetRequested();
        setNotice({ text: 'If an account exists, a password reset link will be sent.' });
      } else if (mode === 'register') {
        await registerWithSupabase({
          terms_version: draftTermsVersion,
          full_name: name,
          email,
          password,
          role: fields.get('role') as UserRole,
          phone: formatPhone(String(fields.get('phoneCountry') ?? 'MT'), String(fields.get('phone') ?? '')),
          revolut_tag: revolutTag,
          locality: String(fields.get('locality') ?? ''),
        });
        form.reset();
        otp.sent();
        setMode('verify');
        setNotice({ text: 'Enter the six-digit code from your email within five minutes.' });
      } else {
        const user = await signInWithSupabase(email, password);
        form.reset();
        onAuthSuccess(user);
      }
    } catch (error) {
      if (mode === 'signin' && error && typeof error === 'object' && 'code' in error && error.code === 'email_not_confirmed') {
        setMode('verify');
        setNotice({ text: 'Enter the six-digit code from your email within five minutes.' });
        return;
      }
      if (mode === 'forgot' && authErrorCode(error) === 'over_request_rate_limit') otp.resetRequested(error);
      if (mode === 'verify' && !recovery) {
        otp.verificationFailed(error);
        fieldError('code', signupCodeError(error, 'verify'));
      } else {
        setNotice({ error: true, text: error instanceof Error ? error.message : 'Account request failed.' });
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  async function resend() {
    const email = accountEmail.trim();
    if (submitting.current || !otp.canResend()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fieldError('email', 'Enter a valid email address.');
    submitting.current = true;
    setLoading(true);
    setNotice(null);
    try {
      await resendSignupCode(email);
      otp.sent();
      setNotice({ text: 'If the account is awaiting confirmation, check your email for a new verification message.' });
    } catch (error) {
      if (['over_request_rate_limit', 'over_email_send_rate_limit'].includes(String(authErrorCode(error)))) otp.sent();
      setNotice({ error: true, text: signupCodeError(error, 'resend') });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="auth-title"
      onCancel={(event) => { event.preventDefault(); if (!loading) onClose(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-[390px] overflow-y-auto rounded-[28px] border border-blue-500/30 bg-[#090f1d] p-5 text-slate-100 backdrop:bg-black/80"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 id="auth-title" className="text-lg font-extrabold text-white">
          {recovery ? t("Choose a new password") : mode === 'register' ? 'Join BottleForMe' : mode === 'forgot' ? 'Reset password' : mode === 'verify' ? 'Confirm your email' : 'Log in to BottleForMe'}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close account dialog" disabled={loading} className={buttonClass}>
          <X className="size-4" />
        </button>
      </div>
      {!recovery && (
        <div className="mb-3 flex flex-wrap gap-1">
          <button type="button" disabled={loading} className={buttonClass} aria-pressed={mode === 'signin'} onClick={() => changeMode('signin')}>{t("Log in")}</button>
          <button type="button" disabled={loading} className={buttonClass} aria-pressed={mode === 'register'} onClick={() => changeMode('register')}>{t("Register")}</button>
          <button type="button" disabled={loading} className={buttonClass} aria-pressed={mode === 'forgot'} onClick={() => changeMode('forgot')}>{t("Forgot password")}</button>

        </div>
      )}
      <form noValidate onSubmit={handleSubmit} onChange={(event) => {
        if (event.target instanceof HTMLInputElement && event.target.name === notice?.field) setNotice(null);
      }} className="space-y-3 text-sm">
        {!recovery && mode === 'register' && (
          <label className="block">{t("Full name")}<input name="name" autoComplete="name" maxLength={100} required {...fieldFeedback('name')} className={inputClass} /></label>
        )}
        {!recovery && (
          <label className="block">{t("Email address")}<input name="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} type="email" autoComplete="email" required {...fieldFeedback('email')} className={inputClass} /></label>
        )}
        {(recovery || (mode !== 'forgot' && mode !== 'verify')) && (
          <label className="block">{t("Password")}<input name="password" type="password" required minLength={recovery || mode === 'register' ? 6 : undefined} autoComplete={recovery || mode === 'register' ? 'new-password' : 'current-password'} {...fieldFeedback('password')} className={inputClass} /></label>
        )}
        {recovery && <label className="block">{t("Confirm new password")}<input name="confirm" type="password" required autoComplete="new-password" {...fieldFeedback('confirm')} className={inputClass} /></label>}
        {!recovery && mode === 'register' && (
          <>
            <label className="block">{t("Starting role")}<select name="role" className={inputClass}><option value="giver">{t("Giver")}</option><option value="taker">{t("Taker")}</option></select></label>
            <label className="block">{t("Country calling code")}<select name="phoneCountry" defaultValue="MT" autoComplete="tel-country-code" className={inputClass}>
              {phoneCountries.map((country) => <option value={country.value} key={country.value}>{country.label}</option>)}
            </select></label>
            <label className="block">{t("Phone (optional)")}<input name="phone" type="tel" autoComplete="tel-national" maxLength={40} className={inputClass} /></label>
            <label className="block">{t("Revolut tag (optional)")}<input name="revolut" maxLength={51} {...fieldFeedback('revolut')} className={inputClass} /></label>
            <label className="block">{t("Locality")}<select name="locality" className={inputClass}>{MALTA_LOCALITIES.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
          </>
        )}
        {mode === 'verify' && !recovery && <>
          <label className="block">{t("Six-digit code")}<input name="code" inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} {...fieldFeedback('code')} className={inputClass} /></label>
          <button type="button" disabled={loading || otp.resendSeconds > 0} className={buttonClass} onClick={() => void resend()}>{otp.resendSeconds ? 'Resend in ' + otp.resendSeconds + 's' : t("Resend code")}</button>
          {otp.verifySeconds > 0 && <p role="status">Try another code in {otp.verifySeconds}s.</p>}
        </>}
        {notice && <p id="account-notice" role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}
        {!recovery && mode === 'register' && <div className="space-y-2">
          <Link href="/terms" target="_blank" rel="noreferrer" className="text-blue-300 underline">{t("Read the draft Terms & Conditions")}</Link>
          <label className="flex items-start gap-2"><input type="checkbox" name="terms" {...fieldFeedback('terms')} />{' ' + t("I accept the draft Terms & Conditions.")}</label>
        </div>}
        <button type="submit" disabled={loading || (!recovery && ((mode === 'verify' && otp.verifySeconds > 0) || (mode === 'forgot' && otp.resetSeconds > 0)))} className="blue-btn w-full rounded-xl px-3 py-3 font-extrabold text-white disabled:opacity-50">
          {loading ? 'Please wait…' : recovery ? 'Save password' : mode === 'register' ? 'Create account' : mode === 'forgot' ? otp.resetSeconds ? 'Send again in ' + otp.resetSeconds + 's' : 'Send reset link' : mode === 'verify' ? t("Verify code") : 'Sign in'}
        </button>
      </form>
    </dialog>
  );
}
