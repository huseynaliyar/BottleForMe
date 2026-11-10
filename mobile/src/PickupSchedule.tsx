import { useLanguage } from '../../lib/language-context';
import { pickupRestriction, type PickupRestriction } from '../../lib/pickup-restriction';
import { pickupStatusColor, pickupStatusLightColor } from '../../lib/pickup-status';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import {
  formatAppointment, formatPickupDate, formatPickupTime, formatPickupWindow, maltaDateTime, maltaToday,
  maxPickupWindows, newWindow, parseWindowDrafts, pickupTimeOptions, windowDrafts,
  type ScheduleAction, type ScheduleRequest, type WindowDraft,
} from '../../lib/pickup-schedule';
import type { PickupOffer } from '../../lib/types';
import { errorMessage, listScheduleRequests, saveSchedule } from './backend';
import { Button, ErrorText, Field, Select, Text, useUi } from './ui';

const calendarMonth = new Intl.DateTimeFormat('en-MT', { year: 'numeric', month: 'long', timeZone: 'UTC' });
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Calendar({ date, onChange, disabled }: {
  date: string; onChange: (date: string) => void; disabled?: boolean;
}) {
  const { colors, styles } = useUi();
  const [open, setOpen] = useState(false);
  const today = maltaToday();
  const [month, setMonth] = useState(() => (date || today).slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leading = (firstDay.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const changeMonth = (offset: number) => setMonth(new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7));

  return <View style={{ gap: 6, minWidth: 0, width: '100%' }}>
    <Button label={date ? 'Date · ' + date : 'Choose a pickup date'} kind="secondary" disabled={disabled}
      onPress={() => { setMonth((date || today).slice(0, 7)); setOpen(!open); }} />
    {open && <View style={styles.inset}>
      <View style={styles.between}>
        <Button label="‹" kind="quiet" disabled={disabled || month <= today.slice(0, 7)} onPress={() => changeMonth(-1)} />
        <Text weight="bold" style={[styles.small, { flexShrink: 1, textAlign: 'center' }]}>{calendarMonth.format(firstDay)}</Text>
        <Button label="›" kind="quiet" disabled={disabled} onPress={() => changeMonth(1)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {weekdays.map((day) => <Text key={day} style={[styles.muted, { width: '14.28%', textAlign: 'center' }]}>{day}</Text>)}
        {Array.from({ length: leading }, (_, index) => <View key={'blank-' + index} style={{ width: '14.28%' }} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const value = month + '-' + String(day).padStart(2, '0');
          const unavailable = disabled || value < today;
          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={value}
            accessibilityState={{ disabled: unavailable, selected: value === date }} disabled={unavailable}
            onPress={() => { onChange(value); setOpen(false); }}
            style={{ width: '14.28%', minHeight: 40, justifyContent: 'center', borderRadius: 8,
              backgroundColor: value === date ? colors.chip : undefined, opacity: unavailable ? 0.35 : 1 }}>
            <Text style={[styles.body, { textAlign: 'center' }]}>{day}</Text>
          </Pressable>;
        })}
      </View>
    </View>}
  </View>;
}

function TimeField({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <Field label={label + ' (HH:MM)'} value={value} placeholder="14:00" keyboardType="numbers-and-punctuation"
    maxLength={5} editable={!disabled} onChangeText={(text) => {
      const digits = text.replace(/\D/g, '').slice(0, 4);
      onChange(digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits);
    }} />;
}

export function AvailabilityEditor({ drafts, onChange, disabled }: {
  drafts: WindowDraft[]; onChange: (drafts: WindowDraft[]) => void; disabled?: boolean;
}) {
  const { t } = useLanguage();
  const { styles } = useUi();
  return <View style={{ gap: 8 }}>
    <Text weight="bold" style={styles.body}>{t("Pickup availability · Malta time")}</Text>
    {drafts.map((draft, index) => {
      const change = (key: keyof WindowDraft, value: string) =>
        onChange(drafts.map((item, i) => i === index ? { ...item, [key]: value } : item));
      return <View key={index} style={styles.inset}>
        <Calendar date={draft.date} onChange={(value) => change('date', value)} disabled={disabled} />
        <TimeField label={t("From")} value={draft.start} onChange={(value) => change('start', value)} disabled={disabled} />
        <TimeField label={t("Until")} value={draft.end} onChange={(value) => change('end', value)} disabled={disabled} />
        {drafts.length > 1 && <Button label={t("Remove window")} kind="quiet" disabled={disabled}
          onPress={() => onChange(drafts.filter((_, i) => i !== index))} />}
      </View>;
    })}
    <Button label={t("Add a window")} kind="secondary" disabled={disabled || drafts.length >= maxPickupWindows}
      onPress={() => onChange([...drafts, newWindow()])} />
  </View>;
}

export function PickupAvailability({ offer }: { offer: PickupOffer }) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const windows = offer.availability ?? [];
  if (!windows.length && !offer.confirmed_at) return null;
  return <View style={{ gap: 3 }}>
    <Text weight="bold" style={styles.small}>{t("Pickup schedule · Malta time")}</Text>
    {offer.confirmed_at && offer.status !== 'cancelled'
      ? <Text style={styles.small}>{t("Confirmed for") + ' '}{formatAppointment(offer.confirmed_at)}</Text>
      : windows.map((window) => <Text key={window.start} style={styles.small}>{formatPickupWindow(window)}</Text>)}
  </View>;
}

function useSubmit(listingId: string, onSaved: () => void, onRestriction?: (value: PickupRestriction) => void) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function submit(action: ScheduleAction, success: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await saveSchedule(listingId, action);
      setNotice(success);
      onSaved();
      return true;
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      const restriction = pickupRestriction(cause);
      if (restriction) onRestriction?.(restriction);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { submit, busy, notice, error, setError };
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  const { colors, styles } = useUi();
  return <><ErrorText message={error} />
    {!!notice && <Text accessibilityLiveRegion="polite" style={[styles.small, { color: colors.green }]}>{notice}</Text>}</>;
}

export function RequestPickupTime({ offer, onSaved, onRestriction }: {
  offer: PickupOffer; onSaved: () => void; onRestriction?: (value: PickupRestriction) => void;
}) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'available' | 'alternative'>('available');
  const [availableDate, setAvailableDate] = useState('');
  const [slot, setSlot] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const key = useRef<{ selection: string; id: string } | null>(null);
  const { submit, busy, notice, error, setError } = useSubmit(offer.id, onSaved, onRestriction);
  const slots = pickupTimeOptions(offer.availability ?? []);
  const days = [...new Set(slots.map(formatPickupDate))];
  const day = days.includes(availableDate) ? availableDate : days[0] || '';

  const daySlots = slots.filter((value) => formatPickupDate(value) === day);
  function requestTime() {
    const at = mode === 'available' ? (daySlots.includes(slot) ? slot : '') : maltaDateTime(date, time);
    if (!at || Date.parse(at) <= Date.now()) { setError('Choose a valid future pickup time in Malta.'); return; }
    const selection = mode + ':' + at;
    if (key.current?.selection !== selection) key.current = { selection, id: randomUUID() };
    void submit({ action: 'request', id: key.current.id, at, kind: mode }, 'Request sent. The owner needs to respond.');
  }
  return <View style={{ gap: 8 }}>
    <Button label={open ? 'Close time picker' : 'Request a pickup time'} kind="secondary" disabled={busy} onPress={() => setOpen(!open)} />
    {open && <>
      <View style={styles.row}>
        <Button label={t("Available time")} kind={mode === 'available' ? 'primary' : 'quiet'} disabled={busy} onPress={() => setMode('available')} />
        <Button label={t("Propose another time")} kind={mode === 'alternative' ? 'primary' : 'quiet'} disabled={busy} onPress={() => setMode('alternative')} />
      </View>
      {mode === 'available' ? days.length ? <>
        <Select label={t("Available date")} options={days.map((value) => ({ value, label: value }))}
          value={day} onChange={(value) => { setAvailableDate(value); setSlot(''); }} disabled={busy} />
        <Select label={t("Available time")} options={daySlots
          .map((value) => ({ value, label: formatPickupTime(value) }))} value={daySlots.includes(slot) ? slot : ''} onChange={setSlot} disabled={busy} />
      </> : <Text style={styles.small}>{t("No upcoming windows. You can propose another time.")}</Text> : <>
        <Calendar date={date} onChange={setDate} disabled={busy} />
        <TimeField label="Pickup time · Malta" value={time} onChange={setTime} disabled={busy} />
      </>}
      <Button label={t("Send request")} disabled={busy} onPress={requestTime} />
      <Feedback error={error} notice={notice} />
    </>}
  </View>;
}

export function EditPickupAvailability({ offer, onSaved }: { offer: PickupOffer; onSaved: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState(() => {
    const current = windowDrafts(offer.availability ?? []);
    return current.length ? current : [newWindow()];
  });
  const { submit, busy, notice, error, setError } = useSubmit(offer.id, onSaved);
  return <View style={{ gap: 8 }}>
    <Button label={open ? 'Close availability editor' : t("Edit availability")} kind="secondary" disabled={busy} onPress={() => setOpen(!open)} />
    {open && <>
      <AvailabilityEditor drafts={drafts} onChange={setDrafts} disabled={busy} />
      <Button label={t("Save availability")} disabled={busy} onPress={() => {
        const availability = parseWindowDrafts(drafts);
        if (!availability) { setError('Add future, non-overlapping pickup windows in Malta time.'); return; }
        void submit({ action: 'availability', availability, version: offer.availability_version ?? 0 }, 'Availability saved.');
      }} />
      <Feedback error={error} notice={notice} />
    </>}
  </View>;
}

function Arrangement({ item, userId, onSaved }: { item: ScheduleRequest; userId: string; onSaved: () => void }) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const [counter, setCounter] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const { submit, busy, error, setError, notice } = useSubmit(item.pickup_id, onSaved);
  const pending = item.status === 'pending';
  const canRespond = pending && item.proposed_by !== userId;
  const future = Date.parse(item.proposed_at) > Date.now();
  const canCancel = pending || (item.status === 'accepted' && ['reserved', 'en_route', 'arrived'].includes(item.pickup?.status ?? ''));
  const base = { id: item.id, version: item.version };
  return <View style={styles.inset}>
    <Text weight="bold" style={styles.body}>{item.pickup?.locality ?? 'Pickup'} · {
      item.status === 'accepted' ? 'Confirmed' : item.status === 'pending' ? t("Pending") : item.status === 'rejected' ? 'Declined' : t("Cancelled")}</Text>
    <Text style={styles.small}>{formatAppointment(item.proposed_at)} · Malta time</Text>
    {pending && <Text style={styles.small}>{future ? (canRespond ? 'Your response is needed.' : 'Waiting for the other person.') : 'This proposed time has passed.'}</Text>}
    <View style={styles.row}>
      {canRespond && <>
        <Button label={t("Accept")} disabled={busy || !future} onPress={() => void submit({ ...base, action: 'accept' }, 'Pickup confirmed.')} />
        <Button label={t("Decline")} kind="secondary" disabled={busy} onPress={() => void submit({ ...base, action: 'reject' }, 'Request declined.')} />
        <Button label={t("Suggest another time")} kind="quiet" disabled={busy} onPress={() => setCounter(!counter)} />
      </>}
      {canCancel && <Button label={t("Cancel arrangement")} kind="quiet" disabled={busy} onPress={() =>
        Alert.alert('Cancel this arrangement?', undefined, [
          { text: 'Go back', style: 'cancel' },
          { text: 'Cancel arrangement', style: 'destructive', onPress: () => void submit({ ...base, action: 'cancel' }, 'Arrangement cancelled.') },
        ])} />}
    </View>
    {canRespond && counter && <>
      <Calendar date={date} onChange={setDate} disabled={busy} />
      <TimeField label="Pickup time · Malta" value={time} onChange={setTime} disabled={busy} />
      <Button label={t("Send new time")} disabled={busy} onPress={() => {
        const at = maltaDateTime(date, time);
        if (!at || Date.parse(at) <= Date.now()) { setError('Choose a valid future time in Malta.'); return; }
        void submit({ ...base, action: 'counter', at }, 'New time proposed. Waiting for a response.').then((saved) => { if (saved) setCounter(false); });
      }} />
    </>}
    <Feedback error={error} notice={notice} />
  </View>;
}

export function PickupArrangements({ userId, participantKey, listingId, revision, onSaved, onOpen }: {
  userId: string; participantKey: 'seller_id' | 'collector_id'; listingId?: string; revision: number; onSaved: () => void; onOpen?: (id: string) => void;
}) {
  const { t } = useLanguage();
  const { styles, theme } = useUi();
  const [requests, setRequests] = useState<ScheduleRequest[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    listScheduleRequests(controller.signal, listingId).then(({ requests: result }) => {
      if (!controller.signal.aborted) { setRequests(result); setError(''); }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load your pickup arrangements.');
    });
    return () => controller.abort();
  }, [revision, userId, listingId]);
  const visible = requests?.filter((item) => item[participantKey] === userId);
  return <View style={{ gap: 8 }}>
    <Text accessibilityRole="header" weight="bold" style={styles.body}>{t("Pickup arrangements")}</Text>
    <ErrorText message={error} />
    {visible?.length ? visible.map((item) => onOpen ? <Pressable accessibilityRole="button" key={item.id} style={styles.inset}
      onPress={() => onOpen(item.pickup_id)}>
      <Text weight="bold" style={styles.body}>{item.pickup?.locality ?? 'Pickup request'} · <Text style={{ color: (theme === 'light' ? pickupStatusLightColor : pickupStatusColor)[item.status] }}>{t(item.status.charAt(0).toUpperCase() + item.status.slice(1))}</Text></Text>
      <Text style={styles.small}>{formatAppointment(item.proposed_at)}</Text>
    </Pressable> : <Arrangement key={item.id} item={item} userId={userId} onSaved={onSaved} />)
      : !error && <Text style={styles.small}>{requests ? 'No requests yet.' : 'Loading arrangements…'}</Text>}
  </View>;
}
