import { UNASSIGNED, type Coordinator, type SessionType, type TypeRule } from './types';

export interface Person {
  name?: string;
  email?: string;
}

/** Session type from the event title; null means "not a teaching session" and the event is skipped. */
export function classifyType(title: string, rules: TypeRule[]): SessionType | null {
  const t = title.toLowerCase();
  for (const r of rules) {
    if (r.keyword && t.includes(r.keyword.toLowerCase())) return r.type;
  }
  return null;
}

/**
 * Coordinator by (1) exact email match on organizer/guests, then (2) name appearing in a
 * guest/organizer display name, the title or the description.
 */
export function matchCoordinator(
  ev: { title: string; description?: string; organizer?: Person; attendees: Person[] },
  coordinators: Coordinator[],
): string {
  const people = [ev.organizer, ...ev.attendees].filter(Boolean) as Person[];
  const emails = new Set(people.map((p) => p.email?.toLowerCase()).filter(Boolean));
  for (const c of coordinators) {
    if (c.emails.some((e) => emails.has(e.toLowerCase()))) return c.name;
  }
  const haystack = [ev.title, ev.description ?? '', ...people.map((p) => `${p.name ?? ''} ${p.email ?? ''}`)]
    .join(' ')
    .toLowerCase();
  for (const c of coordinators) {
    if (c.name && haystack.includes(c.name.toLowerCase())) return c.name;
  }
  return UNASSIGNED;
}
