'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ClipboardList, PackageCheck, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { adminPickupStatuses, type AdminPage, type AdminPickupStatus } from '@/lib/admin-policy';
import { supabase } from '@/lib/supabase';

const statusLabels: Record<AdminPickupStatus, string> = {
  open: 'Open', reserved: 'Reserved', en_route: 'On the way', arrived: 'Arrived', completed: 'Completed', cancelled: 'Cancelled',
};
const statusColors: Record<AdminPickupStatus, string> = {
  open: 'border-blue-400/30 bg-blue-500/15 text-blue-200',
  reserved: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
  en_route: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  arrived: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  completed: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  cancelled: 'border-slate-400/30 bg-slate-500/15 text-slate-300',
};
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-[#111c30] px-3 py-2 text-sm font-bold text-blue-100 transition hover:bg-[#192844] disabled:opacity-40';
const input = 'w-full rounded-xl border border-blue-500/25 bg-[#0b1220] px-3 py-2.5 text-white';
const date = new Intl.DateTimeFormat('en-MT', { dateStyle: 'medium', timeZone: 'Europe/Malta' });

function displayDate(value: string | null) {
  return value ? date.format(new Date(value)) : '—';
}

function SignIn({ onError }: { onError: (error: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || pending.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get('email') ?? '').trim();
    const password = String(fields.get('password') ?? '');
    if (!email || !password) { onError('Enter your email and password.'); return; }
    pending.current = true;
    setBusy(true);
    onError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) onError(error.message);
      else form.reset();
    } catch {
      onError('Could not sign in. Check your connection and try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-5 grid max-w-sm gap-3">
    <label className="grid gap-1 text-sm font-semibold">Email
      <input autoComplete="username" name="email" type="email" className={input} required />
    </label>
    <label className="grid gap-1 text-sm font-semibold">Password
      <input autoComplete="current-password" name="password" type="password" className={input} required />
    </label>
    <button type="submit" disabled={busy || !supabase} className="blue-btn mt-1 min-h-11 rounded-xl px-4 py-2 font-bold disabled:opacity-50">
      {busy ? 'Signing in…' : 'Sign in'}
    </button>
  </form>;
}

export default function AdminDashboard() {
  const [account, setAccount] = useState<{ id: string; email?: string } | null>();
  const [view, setView] = useState<'pickups' | 'profiles'>('pickups');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [authError, setAuthError] = useState('');
  const [result, setResult] = useState<{ key: string; payload?: AdminPage; error?: string; forbidden?: boolean }>();
  const previousUserId = useRef<string | undefined>(undefined);
  const userId = account?.id;
  const query = new URLSearchParams({ view, page: String(page), ...(view === 'pickups' && status ? { status } : {}) }).toString();
  const key = userId + ':' + query + ':' + refresh;

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (previousUserId.current !== user?.id) {
        previousUserId.current = user?.id;
        setResult(undefined);
        setPage(1);
      }
      setAccount(user ? { id: user.id, email: user.email } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !supabase) return;
    const client = supabase;
    const controller = new AbortController();

    async function load() {
      const { data: { session }, error } = await client.auth.getSession();
      if (controller.signal.aborted) return;
      if (error || !session || session.user.id !== userId) {
        setResult({ key, error: 'Your session could not be verified. Sign in again.' });
        return;
      }
      const res = await fetch('/api/admin?' + query, {
        signal: controller.signal, headers: { Authorization: 'Bearer ' + session.access_token },
      });
      const payload = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) setResult({ key, error: payload.error || 'Could not load the dashboard.', forbidden: res.status === 403 });
      else setResult({ key, payload });
    }

    void load().catch(() => {
      if (!controller.signal.aborted) setResult({ key, error: 'Could not load the dashboard. Check your connection and try again.' });
    });
    return () => controller.abort();
  }, [key, query, userId]);

  async function logout() {
    if (!supabase) return;
    setAuthError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) setAuthError(error.message);
      else setResult(undefined);
    } catch {
      setAuthError('Could not log out. Try again.');
    }
  }

  const active = result?.key === key ? result : undefined;
  const data = active?.payload;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const range = data?.rows.length ? [(page - 1) * data.pageSize + 1, (page - 1) * data.pageSize + data.rows.length] : null;

  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-12 pt-6 sm:px-8 sm:pt-10">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-white">
      <ArrowLeft className="size-4" /> BottleForMe
    </Link>
    <header className="glass-navy mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] p-5 sm:p-7">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-300">
          <ShieldCheck className="size-4" /> Admin
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Marketplace dashboard</h1>
        <p className="mt-2 text-sm text-blue-100/75">Review pickups and account profiles.</p>
      </div>
      {account && <div className="flex flex-wrap items-center gap-3">
        <span className="max-w-56 break-all text-xs text-blue-100/70">{account.email}</span>
        <button type="button" onClick={logout} className={button}>Log out</button>
      </div>}
    </header>

    {authError && <p role="alert" className="mb-4 rounded-xl bg-red-950 p-3 text-sm text-red-200">{authError}</p>}
    {!supabase && <p role="alert" className="glass-navy rounded-2xl p-4 text-sm">Account service is unavailable.</p>}
    {supabase && account === undefined && <p role="status" className="glass-navy rounded-2xl p-4 text-sm">Checking your session…</p>}
    {supabase && account === null && <section className="glass-navy rounded-[28px] p-5 sm:p-7">
      <h2 className="text-lg font-extrabold">Sign in to Admin</h2>
      <p className="mt-1 text-sm text-blue-100/75">Use the BottleForMe account approved for admin access.</p>
      <SignIn onError={setAuthError} />
    </section>}
    {account && active?.forbidden && <section className="glass-navy rounded-[28px] p-5 sm:p-7">
      <h2 className="text-lg font-extrabold">Admin access required</h2>
      <p role="status" className="mt-2 text-sm text-blue-100/75">{active.error}</p>
    </section>}
    {account && !active?.forbidden && <section className="glass-navy overflow-hidden rounded-[28px]" aria-label="Marketplace records">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-500/20 p-4 sm:p-5">
        <div className="flex gap-2" aria-label="Record type">
          <button type="button" aria-pressed={view === 'pickups'} onClick={() => { setView('pickups'); setPage(1); }}
            className={button + (view === 'pickups' ? ' !border-blue-400/70 !bg-blue-700' : '')}><PackageCheck className="size-4" /> Pickups</button>
          <button type="button" aria-pressed={view === 'profiles'} onClick={() => { setView('profiles'); setPage(1); }}
            className={button + (view === 'profiles' ? ' !border-blue-400/70 !bg-blue-700' : '')}><Users className="size-4" /> Profiles</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === 'pickups' && <select aria-label="Filter pickups by status" value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={input + ' !w-auto'}>
            <option value="">All statuses</option>
            {adminPickupStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>}
          <button type="button" onClick={() => setRefresh((value) => value + 1)} className={button}>
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>
      </div>
      {!active && <p role="status" className="p-5 text-sm text-blue-100/75">Loading dashboard…</p>}
      {active?.error && <p role="alert" className="p-5 text-sm text-red-200">{active.error}</p>}
      {data && <>
        {data.rows.length === 0 ? <p className="flex items-center gap-2 p-5 text-sm text-blue-100/75">
          <ClipboardList className="size-4" /> No records on this page.
        </p> : <div className="overflow-x-auto">
          {data.view === 'pickups' ? <table className="w-full min-w-[42rem] text-left text-sm">
            <caption className="sr-only">Pickups</caption>
            <thead className="bg-[#0d1728] text-xs uppercase tracking-wide text-blue-200">
              <tr>{['Locality', 'Status', 'Containers', 'Bags', 'Updated', 'Pickup ID'].map((label) => <th key={label} scope="col" className="p-3.5">{label}</th>)}</tr>
            </thead>
            <tbody>{data.rows.map((row) => <tr key={row.id} className="border-t border-white/5">
              <th scope="row" className="p-3.5 font-bold">{row.locality}</th>
              <td className="p-3.5"><span className={'whitespace-nowrap rounded-full border px-2 py-1 text-xs font-bold ' + (row.status ? statusColors[row.status] : statusColors.cancelled)}>
                {row.status ? statusLabels[row.status] : 'Unknown'}
              </span></td>
              <td className="p-3.5 tabular-nums">{row.estimated_bottles}</td>
              <td className="p-3.5 tabular-nums">{row.bag_count}</td>
              <td className="whitespace-nowrap p-3.5">{displayDate(row.updated_at ?? row.created_at)}</td>
              <td className="p-3.5 font-mono text-xs text-blue-200/70" title={row.id}>{row.id.slice(0, 8)}</td>
            </tr>)}</tbody>
          </table> : <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Account profiles</caption>
            <thead className="bg-[#0d1728] text-xs uppercase tracking-wide text-blue-200">
              <tr>{['Name', 'Active role', 'Locality', 'Joined', 'Account ID'].map((label) => <th key={label} scope="col" className="p-3.5">{label}</th>)}</tr>
            </thead>
            <tbody>{data.rows.map((row) => <tr key={row.id} className="border-t border-white/5">
              <th scope="row" className="max-w-56 break-words p-3.5 font-bold">{row.full_name}</th>
              <td className="p-3.5 capitalize">{row.role === 'both' ? 'Giver' : row.role ?? '—'}</td>
              <td className="p-3.5">{row.locality || '—'}</td>
              <td className="whitespace-nowrap p-3.5">{displayDate(row.created_at)}</td>
              <td className="p-3.5 font-mono text-xs text-blue-200/70" title={row.id}>{row.id.slice(0, 8)}</td>
            </tr>)}</tbody>
          </table>}
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-500/20 p-4 sm:p-5">
          <p className="text-sm text-blue-100/75">{range ? range.join('–') + ' of ' + data.total : data.total + ' records'}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={button}>Previous</button>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className={button}>Next</button>
          </div>
        </div>
      </>}
    </section>}
  </main>;
}
