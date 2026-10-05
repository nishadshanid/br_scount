/** YYYY-MM of an instant in the given time zone (sessions are bucketed by local month). */
export function monthKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(
    new Date(iso),
  );
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone, hour: 'numeric', minute: '2-digit' });
}

export function fmtDate(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone, day: '2-digit', month: 'short', year: 'numeric' });
}

/** ISO -> value for <input type="datetime-local"> in the browser's local zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}
