export const pickupTimezone = 'Europe/Malta';
export const maxPickupWindows = 8;

export type PickupWindow = { start: string; end: string };
export type WindowDraft = { date: string; start: string; end: string };
export type ScheduleRequest = {
  id: string;
  pickup_id: string;
  seller_id: string;
  collector_id: string;
  proposed_by: string;
  proposed_at: string;
  kind: 'available' | 'alternative';
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  version: number;
  pickup?: { locality: string; status: string };
};
export type ScheduleAction =
  | { action: 'request'; id: string; kind: ScheduleRequest['kind']; at: string }
  | { action: 'accept' | 'reject' | 'cancel'; id: string; version: number }
  | { action: 'counter'; id: string; version: number; at: string }
  | { action: 'availability'; availability: PickupWindow[]; version: number };

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: pickupTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dateLabel = new Intl.DateTimeFormat('en-MT', {
  timeZone: pickupTimezone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});
const timeLabel = new Intl.DateTimeFormat('en-MT', {
  timeZone: pickupTimezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dateTime(value: number | Date) {
  const p = Object.fromEntries(parts.formatToParts(value).map(({ type, value: text }) => [type, text]));
  return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
}

export function maltaToday() {
  return dateTime(Date.now()).date;
}

export function maltaDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const target = date + 'T' + time;
  const wallTime = Date.parse(target + ':00Z');
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 16) !== target) return null;
  // Malta uses UTC+1 or UTC+2. A transition can produce zero or two matches.
  const matches = [1, 2].map((offset) => wallTime - offset * 3_600_000).filter((candidate) => {
    const local = dateTime(candidate);
    return local.date === date && local.time === time;
  });
  return matches.length === 1 ? new Date(matches[0]).toISOString() : null;
}

export function canonicalAppointment(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? value : null;
}

export function validateWindows(input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > maxPickupWindows) return null;
  const windows: PickupWindow[] = [];
  for (const item of input) {
    const start = canonicalAppointment(item?.start);
    const end = canonicalAppointment(item?.end);
    if (!start || !end || start >= end || dateTime(new Date(start)).date !== dateTime(new Date(end)).date) return null;
    windows.push({ start, end });
  }
  windows.sort((a, b) => a.start.localeCompare(b.start));
  return windows.some((item, index) => index > 0 && windows[index - 1].end > item.start) ? null : windows;
}

export function parseWindowDrafts(drafts: WindowDraft[]) {
  const windows = validateWindows(drafts.map(({ date, start, end }) => ({
    start: maltaDateTime(date, start), end: maltaDateTime(date, end),
  })));
  if (!windows || windows.some(({ start }) => Date.parse(start) <= Date.now())) return null;
  return windows;
}

export function windowDrafts(windows: PickupWindow[]) {
  return windows.filter(({ start }) => Date.parse(start) > Date.now()).map((window) => {
    const start = dateTime(new Date(window.start));
    return { date: start.date, start: start.time, end: dateTime(new Date(window.end)).time };
  });
}

export function newWindow(): WindowDraft {
  return { date: '', start: '', end: '' };
}

export function pickupTimeOptions(windows: PickupWindow[]) {
  const now = Date.now();
  const values = new Set<string>();
  for (const { start, end } of windows) {
    const from = Date.parse(start);
    const to = Date.parse(end);
    for (let time = from; time < to; time += 15 * 60_000) {
      if (time > now) values.add(new Date(time).toISOString());
    }
  }
  return [...values].sort();
}

export const formatPickupDate = (value: string) => dateLabel.format(new Date(value));
export function formatPickupTime(value: string) {
  const time = Date.parse(value);
  const label = timeLabel.format(time);
  // Label both occurrences of the repeated hour when Malta's clocks go back.
  if (label === timeLabel.format(time + 3_600_000)) return label + ' (UTC+2)';
  if (label === timeLabel.format(time - 3_600_000)) return label + ' (UTC+1)';
  return label;
}
export const formatAppointment = (value: string) => formatPickupDate(value) + ' at ' + formatPickupTime(value);
export const formatPickupWindow = ({ start, end }: PickupWindow) =>
  formatPickupDate(start) + ' · ' + formatPickupTime(start) + '–' + formatPickupTime(end);
