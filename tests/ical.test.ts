import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeCalendar } from '../src/lib/merge';
import { DEFAULT_SETTINGS } from '../src/lib/types';
import { parseCalendar } from '../scripts/ical';

const ics = readFileSync(new URL('./fixtures/sample.ics', import.meta.url), 'utf8');

describe('parseCalendar', () => {
  const events = parseCalendar(ics, new Date('2026-09-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'));

  it('expands recurrences, applies overrides/exdates, skips cancelled and all-day', () => {
    const titles = events.map((e) => `${e.start} ${e.title}`).sort();
    expect(titles).toEqual([
      '2026-10-03T13:30:00.000Z Mentoring Session - Batch 12',
      '2026-10-05T14:30:00.000Z Lecturing Session: React basics',
      '2026-10-08T03:30:00.000Z Dentist',
      '2026-10-13T13:00:00.000Z Lecturing Session: React basics', // moved override
      '2026-10-26T14:30:00.000Z Lecturing Session: React basics',
    ]);
  });

  it('extracts organizer and meet link', () => {
    const m = events.find((e) => e.uid === 'single-mentoring@google.com')!;
    expect(m.organizer).toEqual({ name: 'Rubeena K', email: 'rubeena.k@example.com' });
    expect(m.meetLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(m.recurrenceId).toBeUndefined();
  });

  it('moved override keeps id of its original slot', () => {
    const moved = events.find((e) => e.start === '2026-10-13T13:00:00.000Z')!;
    expect(moved.recurrenceId).toBe('2026-10-12T14:30:00.000Z');
  });

  it('merges into sessions with types and coordinators', () => {
    const sessions = mergeCalendar([], events, DEFAULT_SETTINGS, { from: '2026-09-01T00:00:00Z', to: '2026-12-01T00:00:00Z' });
    expect(sessions).toHaveLength(4);
    expect(sessions.filter((s) => s.type === 'Lecturing').every((s) => s.coordinator === 'Sajitha')).toBe(true);
    expect(sessions.find((s) => s.type === 'Mentoring')!.coordinator).toBe('Rubeena');
  });
});
