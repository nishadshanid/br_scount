/**
 * Pull teaching sessions from the Google Calendar iCal feed into the private data repo.
 *
 * env: GITHUB_TOKEN, DATA_REPO (owner/name), GCAL_ICAL_URL or ICS_FILE, DRY_RUN=1 (optional)
 */
import { readFileSync } from 'node:fs';
import { addMonths, monthKey, monthsInRange } from '../src/lib/dates';
import { mergeCalendar } from '../src/lib/merge';
import { sessionsPath, type MonthFile, type Session } from '../src/lib/types';
import { loadSettings, requireEnv, storeFromEnv } from './env';
import { parseCalendar } from './ical';

const dryRun = !!process.env.DRY_RUN;

async function fetchIcs(): Promise<string> {
  if (process.env.ICS_FILE) return readFileSync(process.env.ICS_FILE, 'utf8');
  const res = await fetch(requireEnv('GCAL_ICAL_URL'));
  if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
  return res.text();
}

function startOfMonthIso(month: string, timeZone: string): string {
  // Midnight on the 1st in `timeZone`; good enough via offset probing at noon UTC.
  const [y, m] = month.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, 1, 12));
  const local = new Date(probe.toLocaleString('en-US', { timeZone }));
  const offsetMs = local.getTime() - probe.getTime();
  return new Date(Date.UTC(y, m - 1, 1) - offsetMs).toISOString();
}

async function main() {
  const store = storeFromEnv();
  const settings = await loadSettings(store);
  const tz = settings.timezone;

  // Window: start of previous month .. end of next month
  const thisMonth = monthKey(new Date().toISOString(), tz);
  const months = monthsInRange(addMonths(thisMonth, -1), addMonths(thisMonth, 1));
  const window = { from: startOfMonthIso(months[0], tz), to: startOfMonthIso(addMonths(thisMonth, 2), tz) };

  const events = parseCalendar(await fetchIcs(), new Date(window.from), new Date(window.to));
  console.log(`Calendar: ${events.length} timed events in ${months[0]}..${months.at(-1)}`);

  const existing = await store.loadMonths(months);
  const merged = mergeCalendar(existing, events, settings, window);

  // Re-bucket and write only months that changed.
  const buckets = new Map<string, MonthFile>(months.map((m) => [m, {}]));
  for (const s of merged) {
    const m = monthKey(s.scheduledStart, tz);
    if (!buckets.has(m)) buckets.set(m, {});
    buckets.get(m)![s.id] = s;
  }
  for (const [month, file] of buckets) {
    const sorted = (f: MonthFile) =>
      Object.values(f)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => JSON.stringify(s))
        .join();
    const prevFile = Object.fromEntries(
      existing.filter((s) => monthKey(s.scheduledStart, tz) === month).map((s) => [s.id, s]),
    );
    if (sorted(prevFile) === sorted(file)) continue;
    const typeCounts = summarizeTypes(Object.values(file));
    console.log(`${month}: ${Object.keys(file).length} sessions (${typeCounts})${dryRun ? ' [dry run]' : ''}`);
    if (dryRun) {
      for (const s of Object.values(file)) console.log(`  ${s.scheduledStart} ${s.type} · ${s.coordinator} · ${s.title}`);
      continue;
    }
    // Merge against the latest file so edits made in the app meanwhile are kept.
    await store.updateJSON<MonthFile>(
      sessionsPath(month),
      {},
      (latest) => {
        const out: MonthFile = {};
        for (const [id, s] of Object.entries(file)) {
          const l = latest[id];
          // user fields from the latest copy win over our snapshot
          out[id] = l ? { ...s, ...pickUserFields(l) } : s;
        }
        // sessions added to this month by the app after we loaded (e.g. manual) are kept
        for (const [id, l] of Object.entries(latest)) {
          if (!(id in out) && !prevFile[id]) out[id] = l;
        }
        return out;
      },
      `Sync calendar ${month}`,
    );
  }
  console.log('Sync done.');
}

function pickUserFields(s: Session): Partial<Session> {
  const { status, actualStart, actualEnd, countOverride, note, rateSnapshot, markedAt, coordinatorManual } = s;
  const out: Partial<Session> = { status, actualStart, actualEnd, countOverride, note, rateSnapshot, markedAt };
  if (coordinatorManual) Object.assign(out, { coordinator: s.coordinator, coordinatorManual });
  return out;
}

function summarizeTypes(list: Session[]): string {
  const c: Record<string, number> = {};
  for (const s of list) c[s.type] = (c[s.type] ?? 0) + 1;
  return Object.entries(c)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
