'use client';

import Link from 'next/link';
import { useState } from 'react';
import { accountRequest } from '@/lib/auth';

type Report = { id: string; target: string; reason: string; pickup_id: string | null;
  reporter_id: string | null; reported_user_id: string | null; created_at: string };

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(reviewedId?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (reviewedId) await accountRequest('/api/admin/reports', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: reviewedId }),
      });
      const payload = await accountRequest('/api/admin/reports', {});
      setReports(payload.reports);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load reports.');
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-2xl space-y-3 p-6 text-white">
    <Link href="/admin" className="text-blue-300">← Admin</Link>
    <h1 className="text-xl font-bold">Marketplace reports</h1>
    <button type="button" disabled={busy} className="blue-btn rounded-lg px-3 py-2" onClick={() => void load()}>Load reports</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {reports?.length === 0 && <p>No reports waiting for review.</p>}
    {reports?.map((item) => <article key={item.id} className="glass-navy space-y-2 rounded-xl p-4">
      <h2 className="font-bold capitalize">{item.target} report</h2>
      <p className="whitespace-pre-wrap break-words">{item.reason}</p>
      <dl className="break-all text-sm text-blue-200">
        <dt>Pickup ID</dt><dd>{item.pickup_id ?? 'Unavailable'}</dd>
        <dt>Reported account ID</dt><dd>{item.reported_user_id ?? 'Unavailable'}</dd>
        <dt>Reporter ID</dt><dd>{item.reporter_id ?? 'Unavailable'}</dd>
        <dt>Submitted</dt><dd>{new Date(item.created_at).toLocaleString('en-MT', { timeZone: 'Europe/Malta' })}</dd>
      </dl>
      <button type="button" disabled={busy} className="rounded-lg bg-white/10 px-3 py-2" onClick={() => void load(item.id)}>Mark reviewed</button>
    </article>)}
  </main>;
}
