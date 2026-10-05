import { sessionCount } from './count';
import type { Session, Settings } from './types';

export interface Summary {
  sessions: number;
  doneSessions: number;
  counts: number;
  gross: number;
  tds: number;
  net: number;
}

export function sessionGross(s: Session, settings: Settings): number {
  return sessionCount(s) * (s.rateSnapshot ?? settings.ratePerCount);
}

export function summarize(sessions: Session[], settings: Settings): Summary {
  let counts = 0;
  let gross = 0;
  let doneSessions = 0;
  for (const s of sessions) {
    const c = sessionCount(s);
    if (s.status === 'done') doneSessions++;
    counts += c;
    gross += sessionGross(s, settings);
  }
  const tds = Math.round((gross * settings.tdsPercent) / 100);
  return { sessions: sessions.length, doneSessions, counts, gross, tds, net: gross - tds };
}

export function groupBy<K extends string>(sessions: Session[], key: (s: Session) => K): Map<K, Session[]> {
  const map = new Map<K, Session[]>();
  for (const s of sessions) {
    const k = key(s);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  return map;
}

export const inr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
