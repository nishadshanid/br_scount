import { describe, expect, it } from 'vitest';
import { durationToCount, sessionCount } from './count';
import { summarize } from './payout';
import { DEFAULT_SETTINGS, type Session } from './types';

const base: Session = {
  id: 'x',
  source: 'manual',
  title: 't',
  type: 'Review',
  coordinator: 'Rubeena',
  scheduledStart: '2026-10-01T13:30:00.000Z',
  scheduledEnd: '2026-10-01T14:00:00.000Z',
  calendarState: 'active',
  status: 'done',
};

describe('durationToCount', () => {
  it.each([
    [10, 1],
    [30, 1],
    [44, 1],
    [45, 2],
    [60, 2],
    [74, 2],
    [75, 3],
    [120, 3],
    [180, 3],
  ])('%i min -> %i', (min, count) => expect(durationToCount(min)).toBe(count));
});

describe('sessionCount', () => {
  it('uses actual times over scheduled', () => {
    expect(sessionCount({ ...base, actualStart: '2026-10-01T13:30:00Z', actualEnd: '2026-10-01T14:20:00Z' })).toBe(2);
  });
  it('override wins', () => expect(sessionCount({ ...base, countOverride: 3 })).toBe(3));
  it('non-done is zero', () => {
    expect(sessionCount({ ...base, status: 'pending' })).toBe(0);
    expect(sessionCount({ ...base, status: 'rescheduled' })).toBe(0);
    expect(sessionCount({ ...base, status: 'cancelled' })).toBe(0);
  });
});

describe('summarize', () => {
  it('10 counts -> 3000 gross, 300 TDS, 2700 net', () => {
    const list = [
      { ...base, countOverride: 3 },
      { ...base, countOverride: 3 },
      { ...base, countOverride: 2 },
      { ...base, countOverride: 1 },
      { ...base },
      { ...base, status: 'cancelled' as const },
    ];
    expect(summarize(list, DEFAULT_SETTINGS)).toEqual({
      sessions: 6,
      doneSessions: 5,
      counts: 10,
      gross: 3000,
      tds: 300,
      net: 2700,
    });
  });
  it('uses rate snapshot', () => {
    expect(summarize([{ ...base, rateSnapshot: 250 }], DEFAULT_SETTINGS).gross).toBe(250);
  });
});
