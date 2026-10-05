import ical, { type VEvent } from 'node-ical';
import type { Person } from '../src/lib/classify';
import type { CalendarEvent } from '../src/lib/merge';

type Prop = string | { val: string; params?: Record<string, string> } | undefined;

function text(p: unknown): string {
  if (p == null) return '';
  if (typeof p === 'string') return p;
  if (typeof p === 'object' && 'val' in (p as object)) return String((p as { val: unknown }).val);
  return String(p);
}

function person(p: Prop): Person | undefined {
  if (!p) return undefined;
  const val = typeof p === 'string' ? p : p.val;
  const name = typeof p === 'string' ? undefined : p.params?.CN?.replace(/^"|"$/g, '');
  const email = val?.replace(/^mailto:/i, '').toLowerCase();
  return { name, email };
}

function meetLink(ev: VEvent): string | undefined {
  for (const v of Object.values(ev)) {
    const m = typeof v === 'string' && v.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
    if (m) return m[0];
  }
  return undefined;
}

/** Parse an iCal feed into teaching-agnostic event instances within [from, to). */
export function parseCalendar(icsText: string, from: Date, to: Date): CalendarEvent[] {
  const data = ical.sync.parseICS(icsText);
  const out: CalendarEvent[] = [];
  for (const comp of Object.values(data)) {
    if (!comp || (comp as { type?: string }).type !== 'VEVENT') continue;
    const base = comp as VEvent;
    const instances = ical.expandRecurringEvent(base, { from, to });
    for (const inst of instances) {
      const ev = inst.event;
      if (inst.isFullDay || ev.status === 'CANCELLED') continue;
      const start = new Date(inst.start);
      if (start < from || start >= to) continue;
      const original = inst.isOverride && ev.recurrenceid ? new Date(ev.recurrenceid) : start;
      const attendeesRaw = ev.attendee as Prop | Prop[] | undefined;
      const attendees = (Array.isArray(attendeesRaw) ? attendeesRaw : attendeesRaw ? [attendeesRaw] : [])
        .map(person)
        .filter((p): p is Person => !!p);
      out.push({
        uid: base.uid,
        recurrenceId: inst.isRecurring || inst.isOverride ? original.toISOString() : undefined,
        title: text(inst.summary).trim(),
        description: text(ev.description),
        start: start.toISOString(),
        end: new Date(inst.end).toISOString(),
        organizer: person(ev.organizer as Prop),
        attendees,
        meetLink: meetLink(ev),
      });
    }
  }
  return out;
}
