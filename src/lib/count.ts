import type { Session } from './types';

export const MAX_COUNT = 3;

/** Under 45 min = 1, 45 min to under 1h15 = 2, 1h15 or more = 3 (capped). */
export function durationToCount(minutes: number): number {
  if (minutes < 45) return 1;
  if (minutes < 75) return 2;
  return MAX_COUNT;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

/** Minutes actually taught: actual times if entered, otherwise the scheduled slot. */
export function sessionMinutes(s: Session): number {
  return minutesBetween(s.actualStart ?? s.scheduledStart, s.actualEnd ?? s.scheduledEnd);
}

/** Only sessions marked done earn counts; a direct count entry wins over timings. */
export function sessionCount(s: Session): number {
  if (s.status !== 'done') return 0;
  if (s.countOverride != null) return s.countOverride;
  return durationToCount(sessionMinutes(s));
}
