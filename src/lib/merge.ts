import { classifyType, matchCoordinator, type Person } from './classify';
import type { Session, Settings } from './types';

/** A calendar event instance, normalized from the iCal feed. */
export interface CalendarEvent {
  uid: string;
  recurrenceId?: string;
  title: string;
  description?: string;
  start: string; // ISO
  end: string; // ISO
  organizer?: Person;
  attendees: Person[];
  meetLink?: string;
}

export const eventId = (ev: Pick<CalendarEvent, 'uid' | 'recurrenceId'>) =>
  ev.recurrenceId ? `${ev.uid}|${ev.recurrenceId}` : ev.uid;

/**
 * Merge calendar events into stored sessions without losing anything the user entered.
 * - new teaching events are added as `pending`
 * - known events get fresh title / times / link (handles small time shifts and moves)
 * - calendar sessions inside the window that vanished from the feed are dropped if still
 *   pending, or flagged `removed` if already marked
 * Sessions outside [from, to) and manual sessions are never touched.
 */
export function mergeCalendar(
  existing: Session[],
  events: CalendarEvent[],
  settings: Settings,
  window: { from: string; to: string },
): Session[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const seen = new Set<string>();

  for (const ev of events) {
    const type = classifyType(ev.title, settings.typeRules);
    if (!type) continue;
    const id = eventId(ev);
    seen.add(id);
    const prev = byId.get(id);
    const coordinator = matchCoordinator(ev, settings.coordinators);
    if (!prev) {
      byId.set(id, {
        id,
        source: 'calendar',
        title: ev.title,
        type,
        coordinator,
        scheduledStart: ev.start,
        scheduledEnd: ev.end,
        meetLink: ev.meetLink,
        calendarState: 'active',
        status: 'pending',
      });
    } else {
      byId.set(id, {
        ...prev,
        title: ev.title,
        type,
        coordinator: prev.coordinatorManual ? prev.coordinator : coordinator,
        scheduledStart: ev.start,
        scheduledEnd: ev.end,
        meetLink: ev.meetLink ?? prev.meetLink,
        calendarState: 'active',
      });
    }
  }

  for (const s of existing) {
    if (s.source !== 'calendar' || seen.has(s.id)) continue;
    if (s.scheduledStart < window.from || s.scheduledStart >= window.to) continue;
    if (s.status === 'pending') byId.delete(s.id);
    else byId.set(s.id, { ...s, calendarState: 'removed' });
  }

  return [...byId.values()];
}

/** Past sessions still waiting to be marked. */
export function pendingSessions(sessions: Session[], now: Date, graceHours = 0): Session[] {
  const cutoff = now.getTime() - graceHours * 3600_000;
  return sessions
    .filter((s) => s.status === 'pending' && new Date(s.scheduledEnd).getTime() <= cutoff)
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
}
