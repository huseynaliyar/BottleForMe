'use client';

import { useLanguage } from '@/lib/language-context';
import { pickupRestriction, type PickupRestriction } from '@/lib/pickup-restriction';
import { pickupStatusCss } from '@/lib/pickup-status';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { pickupRequest } from '@/lib/auth';
import {
  formatAppointment, formatPickupDate, formatPickupTime, formatPickupWindow, maltaDateTime, maltaToday,
  maxPickupWindows, newWindow, parseWindowDrafts, pickupTimeOptions, windowDrafts,
  type ScheduleAction, type ScheduleRequest, type WindowDraft,
} from '@/lib/pickup-schedule';
import type { PickupOffer } from '@/lib/types';

const field = 'block box-border w-full min-w-0 max-w-full appearance-none rounded-lg border border-blue-400/20 bg-[#0b1220] p-2 text-base text-white';
const button = 'rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white disabled:opacity-50';
const primary = 'blue-btn ' + button;
const windowsError = 'Enter future Malta times on the same date. Start must be before end, and windows cannot overlap.';

function ScheduleButton({ children, onClick, busy, main = false }: {
  children: React.ReactNode; onClick: () => void; busy?: boolean; main?: boolean;
}) {
  return <button type="button" className={main ? primary : button} disabled={busy} onClick={onClick}>{children}</button>;
}

export function AvailabilityEditor({ drafts, onChange, disabled }: {
  drafts: WindowDraft[]; onChange: (drafts: WindowDraft[]) => void; disabled?: boolean;
}) {
  const { t } = useLanguage();
  return <fieldset disabled={disabled} className="min-w-0 space-y-2 rounded-xl border border-blue-400/20 p-3">
    <legend className="px-1 font-bold text-white">{t("Pickup availability · Malta time")}</legend>
    {drafts.map((draft, index) => <div key={index} className="grid min-w-0 grid-cols-1 gap-2">
      {(['date', 'start', 'end'] as const).map((key) => <label key={key} className="text-sm text-blue-100">
        {key === 'date' ? 'Date' : key === 'start' ? t("From") : t("Until")}
        <input type={key === 'date' ? 'date' : 'time'} min={key === 'date' ? maltaToday() : undefined}
          aria-label={'Window ' + (index + 1) + ' ' + key} value={draft[key]} className={field}
          onChange={(event) => onChange(drafts.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} />
      </label>)}
      {drafts.length > 1 && <ScheduleButton onClick={() => onChange(drafts.filter((_, i) => i !== index))}>{t("Remove")}</ScheduleButton>}
    </div>)}
    <ScheduleButton busy={drafts.length >= maxPickupWindows} onClick={() => onChange([...drafts, newWindow()])}>{t("Add a window")}</ScheduleButton>
  </fieldset>;
}

export function PickupAvailability({ offer }: { offer: PickupOffer }) {
  const { t } = useLanguage();
  const windows = offer.availability ?? [];
  if (!windows.length && !offer.confirmed_at) return null;
  return <div className="space-y-1 text-sm text-blue-100">
    <p className="flex items-center gap-2 font-bold"><CalendarDays size={16} />{' ' + t("Pickup schedule · Malta time")}</p>
    {offer.confirmed_at && offer.status !== 'cancelled'
      ? <p>{t("Confirmed for") + ' '}{formatAppointment(offer.confirmed_at)}</p>
      : <ul className="space-y-1">{windows.map((window) => <li key={window.start}>{formatPickupWindow(window)}</li>)}</ul>}
  </div>;
}

function DateAndTime({ date, time, setDate, setTime }: {
  date: string; time: string; setDate: (value: string) => void; setTime: (value: string) => void;
}) {
  const { t } = useLanguage();
  return <div className="grid min-w-0 grid-cols-1 gap-2">
    <label className="text-sm">{t("Pickup date")}<input className={field} type="date" min={maltaToday()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
    <label className="text-sm">{t("Pickup time")}<input className={field} type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
  </div>;
}

function useScheduleSubmit(listingId: string, onSaved: () => void, onRestriction?: (value: PickupRestriction) => void) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(action: ScheduleAction, success: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await pickupRequest('/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, ...action }),
      });
      setNotice(success);
      onSaved();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save the arrangement.';
      setError(message);
      const restriction = pickupRestriction(cause);
      if (restriction) onRestriction?.(restriction);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { submit, busy, error, setError, notice };
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  return <>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}</>;
}

export function RequestPickupTime({ offer, onSaved, onRestriction }: {
  offer: PickupOffer; onSaved: () => void; onRestriction?: (value: PickupRestriction) => void;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'available' | 'alternative'>('available');
  const [availableDate, setAvailableDate] = useState('');
  const [selected, setSelected] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const key = useRef<{ selection: string; id: string } | null>(null);
  const { submit, busy, error, setError, notice } = useScheduleSubmit(offer.id, onSaved, onRestriction);
  const slots = pickupTimeOptions(offer.availability ?? []);
  const dates = [...new Set(slots.map(formatPickupDate))];
  const day = dates.includes(availableDate) ? availableDate : dates[0] || '';
  const daySlots = slots.filter((slot) => formatPickupDate(slot) === day);

  async function requestTime() {
    const at = mode === 'available' ? (daySlots.includes(selected) ? selected : '') : maltaDateTime(date, time);
    if (!at) {
      setError('Choose a future pickup time. Avoid the repeated or skipped hour when the clocks change.');
      return;
    }
    const selection = mode + ':' + at;
    if (key.current?.selection !== selection) key.current = { selection, id: crypto.randomUUID() };
    await submit({ action: 'request', id: key.current.id, at, kind: mode }, 'Request sent. The owner needs to respond.');
  }

  return <details className="w-full rounded-xl border border-blue-400/25 p-3 text-blue-100">
    <summary className="cursor-pointer font-bold text-white">{t("Request pickup")}</summary>
    <fieldset disabled={busy} className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <ScheduleButton onClick={() => setMode('available')} main={mode === 'available'}>{t("Available time")}</ScheduleButton>
        <ScheduleButton onClick={() => setMode('alternative')} main={mode === 'alternative'}>{t("Propose another time")}</ScheduleButton>
      </div>
      <p className="text-sm">{t("Times are in Europe/Malta.")}</p>
      {mode === 'available' ? dates.length ? <div className="grid min-w-0 grid-cols-1 gap-2">
        <label className="text-sm">{t("Available date")}<select className={field} value={day}
          onChange={(event) => { setAvailableDate(event.target.value); setSelected(''); }}>
          {dates.map((value) => <option key={value}>{value}</option>)}
        </select></label>
        <label className="text-sm">{t("Available time")}<select className={field} value={daySlots.includes(selected) ? selected : ''} onChange={(event) => setSelected(event.target.value)}>
          <option value="">{t("Choose a time")}</option>
          {daySlots.map((value) => <option key={value} value={value}>{formatPickupTime(value)}</option>)}
        </select></label>
      </div> : <p className="text-sm">{t("No upcoming windows. You can propose another time.")}</p>
        : <DateAndTime date={date} time={time} setDate={setDate} setTime={setTime} />}
      <ScheduleButton onClick={() => void requestTime()} main>{t("Send request")}</ScheduleButton>
      <Feedback error={error} notice={notice} />
    </fieldset>
  </details>;
}

export function EditPickupAvailability({ offer, onSaved }: { offer: PickupOffer; onSaved: () => void }) {
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState(() => {
    const current = windowDrafts(offer.availability ?? []);
    return current.length ? current : [newWindow()];
  });
  const { submit, busy, error, setError, notice } = useScheduleSubmit(offer.id, onSaved);
  function save() {
    const availability = parseWindowDrafts(drafts);
    if (!availability) { setError(windowsError); return; }
    void submit({ action: 'availability', availability, version: offer.availability_version ?? 0 }, 'Availability saved.');
  }
  return <details className="rounded-xl border border-blue-400/25 p-3">
    <summary className="cursor-pointer font-bold text-white">{t("Edit availability")}</summary>
    <div className="mt-3 space-y-2">
      <AvailabilityEditor drafts={drafts} onChange={setDrafts} disabled={busy} />
      <ScheduleButton busy={busy} onClick={save} main>{t("Save availability")}</ScheduleButton>
      <Feedback error={error} notice={notice} />
    </div>
  </details>;
}

function Arrangement({ item, userId, onSaved }: { item: ScheduleRequest; userId: string; onSaved: () => void }) {
  const { t } = useLanguage();
  const [counter, setCounter] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const { submit, busy, error, setError, notice } = useScheduleSubmit(item.pickup_id, onSaved);
  const pending = item.status === 'pending';
  const canRespond = pending && item.proposed_by !== userId;
  const [now, setNow] = useState(Date.now);
  const future = Date.parse(item.proposed_at) > now;
  useEffect(() => {
    if (!pending || !future) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [pending, future]);
  const canCancel = pending || (item.status === 'accepted' && ['reserved', 'en_route', 'arrived'].includes(item.pickup?.status ?? ''));
  const base = { id: item.id, version: item.version };
  return <li className="space-y-2 rounded-xl bg-[#0b1220] p-3">
    <p className="font-bold">{item.pickup?.locality ?? 'Pickup'} · {item.status === 'accepted' ? 'Confirmed' : item.status === 'pending' ? t("Pending") : item.status === 'rejected' ? 'Declined' : t("Cancelled")}</p>
    <p className="text-sm">{formatAppointment(item.proposed_at)} · Malta time</p>
    {pending && <p className="text-sm">{future ? (canRespond ? 'Your response is needed.' : 'Waiting for the other person.') : 'This proposed time has passed.'}</p>}
    <div className="flex flex-wrap gap-2">
      {canRespond && <>
        <ScheduleButton main busy={busy || !future} onClick={() => void submit({ ...base, action: 'accept' }, 'Pickup confirmed.')}>{t("Accept")}</ScheduleButton>
        <ScheduleButton busy={busy} onClick={() => void submit({ ...base, action: 'reject' }, 'Request declined.')}>{t("Decline")}</ScheduleButton>
        <ScheduleButton busy={busy} onClick={() => setCounter(!counter)}>{t("Suggest another time")}</ScheduleButton>
      </>}
      {canCancel && <ScheduleButton busy={busy} onClick={() => {
        if (window.confirm('Cancel this pickup arrangement?')) void submit({ ...base, action: 'cancel' }, 'Arrangement cancelled.');
      }}>{t("Cancel arrangement")}</ScheduleButton>}
    </div>
    {canRespond && counter && <fieldset disabled={busy} className="space-y-2">
      <DateAndTime date={date} time={time} setDate={setDate} setTime={setTime} />
      <ScheduleButton main onClick={() => {
        const at = maltaDateTime(date, time);
        if (!at || Date.parse(at) <= Date.now()) { setError('Choose a valid future time in Malta.'); return; }
        void submit({ ...base, action: 'counter', at }, 'New time proposed. Waiting for a response.').then((saved) => { if (saved) setCounter(false); });
      }}>{t("Send new time")}</ScheduleButton>
    </fieldset>}
    <Feedback error={error} notice={notice} />
  </li>;
}

export function PickupArrangements({ userId, listingId, revision, onSaved, onOpen, excludeAcceptedFor, participantKey, onSwitchRole }: {
  userId: string; listingId?: string; revision: number; onSaved: () => void; onOpen?: (id: string) => void;
  excludeAcceptedFor?: ReadonlySet<string>; participantKey: 'seller_id' | 'collector_id'; onSwitchRole?: () => void;
}) {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ScheduleRequest[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    pickupRequest('/schedule' + (listingId ? '?listing=' + encodeURIComponent(listingId) : ''), { signal: controller.signal }).then((result: { requests: ScheduleRequest[] }) => {
      if (!controller.signal.aborted) { setRequests(result.requests); setError(''); }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load your pickup arrangements.');
    });
    return () => controller.abort();
  }, [revision, userId, listingId]);
  const inRole = requests?.filter((item) => item[participantKey] === userId);
  const visible = inRole?.filter((item) => item.status !== 'accepted' || !excludeAcceptedFor?.has(item.pickup_id));
  const belongsToOtherRole = Boolean(listingId && requests?.length && !inRole?.length);
  return <section className="space-y-2 rounded-xl border border-blue-400/20 p-3 text-blue-100">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-bold text-white">{t("Pickup arrangements")}</h3>
      <ScheduleButton onClick={onSaved}>{t("Refresh")}</ScheduleButton>
    </div>
    <Feedback error={error} notice="" />
    {visible?.length ? <ul className="space-y-2">{visible.map((item) =>
      onOpen ? <li key={item.id}><button type="button" onClick={() => onOpen(item.pickup_id)} className="block w-full rounded-lg bg-white/5 p-2 text-left hover:bg-white/10">
        <strong>{item.pickup?.locality ?? 'Pickup request'} · <span className="capitalize" style={{ color: pickupStatusCss(item.status) }}>{t(item.status.charAt(0).toUpperCase() + item.status.slice(1))}</span></strong>
        <span className="block text-xs">{formatAppointment(item.proposed_at)}</span>
      </button></li> : <Arrangement key={item.id} item={item} userId={userId} onSaved={onSaved} />)}</ul>
      : !error && (belongsToOtherRole ? <p className="text-sm">
        This time request belongs to your other role.{' '}
        <button type="button" onClick={onSwitchRole} className="font-bold text-blue-300 underline">{t("Switch role")}</button>
      </p> : <p className="text-sm">{requests ? 'No requests yet in this role.' : 'Loading arrangements…'}</p>)}
  </section>;
}
