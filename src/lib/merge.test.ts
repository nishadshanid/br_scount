import { describe, expect, it } from 'vitest';
import { classifyType, matchCoordinator } from './classify';
import { mergeCalendar, pendingSessions, type CalendarEvent } from './merge';
import { DEFAULT_SETTINGS, UNASSIGNED, type Settings } from './types';

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  coordinators: [
    { name: 'Rubeena', emails: ['rubeena.k@example.com'] },
    { name: 'Sajitha', emails: [] },
  ],
};
const window = { from: '2026-09-01T00:00:00Z', to: '2026-12-01T00:00:00Z' };

const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  uid: 'u1',
  title: 'Mentoring Session',
  start: '2026-10-03T13:30:00.000Z',
  end: '2026-10-03T14:00:00.000Z',
  attendees: [],
  ...over,
});

describe('classify', () => {
  it('types from title', () => {
    expect(classifyType('Review Session - B12', settings.typeRules)).toBe('Review');
    expect(classifyType('MENTORING session', settings.typeRules)).toBe('Mentoring');
    expect(classifyType('Lecture: hooks', settings.typeRules)).toBe('Lecturing');
    expect(classifyType('Dentist', settings.typeRules)).toBeNull();
  });
  it('coordinator by email then name', () => {
    expect(matchCoordinator({ title: 'x', organizer: { email: 'rubeena.k@example.com' }, attendees: [] }, settings.coordinators)).toBe('Rubeena');
    expect(matchCoordinator({ title: 'x', attendees: [{ name: 'Sajitha M', email: 's@x.com' }] }, settings.coordinators)).toBe('Sajitha');
    expect(matchCoordinator({ title: 'Review - sajitha batch', attendees: [] }, settings.coordinators)).toBe('Sajitha');
    expect(matchCoordinator({ title: 'x', attendees: [] }, settings.coordinators)).toBe(UNASSIGNED);
  });
});

describe('mergeCalendar', () => {
  it('adds new teaching events as pending and skips others', () => {
    const out = mergeCalendar([], [ev(), ev({ uid: 'u2', title: 'Dentist' })], settings, window);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'u1', status: 'pending', type: 'Mentoring', source: 'calendar' });
  });

  it('time change keeps user status and fields', () => {
    const [s] = mergeCalendar([], [ev()], settings, window);
    const marked = { ...s, status: 'done' as const, countOverride: 2, coordinator: 'Sajitha', coordinatorManual: true };
    const [out] = mergeCalendar([marked], [ev({ start: '2026-10-03T14:00:00.000Z', end: '2026-10-03T14:45:00.000Z' })], settings, window);
    expect(out).toMatchObject({ status: 'done', countOverride: 2, coordinator: 'Sajitha', scheduledStart: '2026-10-03T14:00:00.000Z' });
  });

  it('vanished events: pending dropped, marked flagged removed, manual untouched', () => {
    const [p] = mergeCalendar([], [ev()], settings, window);
    const done = { ...p, id: 'u9', status: 'done' as const };
    const manual = { ...p, id: 'm1', source: 'manual' as const, status: 'done' as const };
    const outside = { ...p, id: 'old', scheduledStart: '2026-01-01T00:00:00Z' };
    const out = mergeCalendar([p, done, manual, outside], [], settings, window);
    expect(out.map((s) => s.id).sort()).toEqual(['m1', 'old', 'u9']);
    expect(out.find((s) => s.id === 'u9')!.calendarState).toBe('removed');
  });

  it('pendingSessions respects grace period', () => {
    const [s] = mergeCalendar([], [ev()], settings, window);
    expect(pendingSessions([s], new Date('2026-10-03T15:00:00Z'), 0)).toHaveLength(1);
    expect(pendingSessions([s], new Date('2026-10-03T15:00:00Z'), 12)).toHaveLength(0);
  });
});
