import { useMemo, useState } from 'react';
import { durationToCount, MAX_COUNT, minutesBetween } from '../lib/count';
import { fmtDateTime, toLocalInput } from '../lib/dates';
import { inr } from '../lib/payout';
import { SESSION_TYPES, STATUSES, UNASSIGNED, type Session, type SessionType, type Status } from '../lib/types';
import { useData } from '../state';
import { Modal } from './ui';

function combine(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}

/** Start/end ISO from a date and two times; an end before the start rolls into the next day. */
function toRange(date: string, start: string, end: string): [string, string] {
  const s = combine(date, start);
  const e = combine(date, end);
  if (e <= s) e.setDate(e.getDate() + 1);
  return [s.toISOString(), e.toISOString()];
}

export interface SessionFormProps {
  /** existing session to edit; omit to add a manual session */
  session?: Session;
  /** prefill for a new manual session */
  draft?: Partial<Session>;
  /** force the status picker to a value when opening (e.g. "done" from the inbox) */
  initialStatus?: Status;
  onClose: () => void;
}

export function SessionForm({ session, draft, initialStatus, onClose }: SessionFormProps) {
  const { settings, saveSession, deleteSession } = useData();
  const isNew = !session;
  const isCalendar = session?.source === 'calendar';

  const initStart = session ? (session.actualStart ?? session.scheduledStart) : draft?.scheduledStart;
  const initEnd = session ? (session.actualEnd ?? session.scheduledEnd) : draft?.scheduledEnd;
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const startLocal = toLocalInput(initStart ?? now.toISOString());
  const endLocal = toLocalInput(initEnd ?? new Date(now.getTime() + 30 * 60000).toISOString());

  const [type, setType] = useState<SessionType>(session?.type ?? draft?.type ?? 'Mentoring');
  const [coordinator, setCoordinator] = useState(session?.coordinator ?? draft?.coordinator ?? settings.coordinators[0]?.name ?? UNASSIGNED);
  const [title, setTitle] = useState(session?.title ?? draft?.title ?? '');
  const [date, setDate] = useState(startLocal.slice(0, 10));
  const [start, setStart] = useState(startLocal.slice(11));
  const [end, setEnd] = useState(endLocal.slice(11));
  const [useCount, setUseCount] = useState(session?.countOverride != null);
  const [count, setCount] = useState(session?.countOverride ?? 1);
  const [status, setStatus] = useState<Status>(initialStatus ?? session?.status ?? 'done');
  const [note, setNote] = useState(session?.note ?? '');
  const [saving, setSaving] = useState(false);

  const minutes = useMemo(() => {
    const [s, e] = toRange(date, start, end);
    return minutesBetween(s, e);
  }, [date, start, end]);
  const effectiveCount = status !== 'done' ? 0 : useCount ? count : durationToCount(minutes);
  const rate = session?.rateSnapshot ?? settings.ratePerCount;

  const coordinatorOptions = [...settings.coordinators.map((c) => c.name), UNASSIGNED];
  if (!coordinatorOptions.includes(coordinator)) coordinatorOptions.unshift(coordinator);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const [s, en] = toRange(date, start, end);
    const marked = status !== 'pending';
    const base: Session = session ?? {
      id: `manual-${crypto.randomUUID()}`,
      source: 'manual',
      title: '',
      type,
      coordinator,
      scheduledStart: s,
      scheduledEnd: en,
      calendarState: 'active',
      status,
    };
    const next: Session = {
      ...base,
      title: title.trim() || `${type} Session`,
      type,
      coordinator,
      coordinatorManual: isCalendar ? base.coordinatorManual || coordinator !== session!.coordinator : undefined,
      status,
      countOverride: useCount ? count : undefined,
      note: note.trim() || undefined,
      rateSnapshot: marked ? (base.rateSnapshot ?? settings.ratePerCount) : undefined,
      markedAt: marked ? new Date().toISOString() : undefined,
    };
    if (isCalendar) {
      // keep the calendar slot; store what actually happened separately
      const changed = s !== session!.scheduledStart || en !== session!.scheduledEnd;
      next.actualStart = changed ? s : undefined;
      next.actualEnd = changed ? en : undefined;
    } else {
      next.scheduledStart = s;
      next.scheduledEnd = en;
    }
    onClose();
    await saveSession(next, session);
  }

  async function remove() {
    if (!session || !confirm('Delete this manual session?')) return;
    onClose();
    await deleteSession(session);
  }

  return (
    <Modal title={isNew ? 'Add session' : isCalendar ? 'Mark session' : 'Edit session'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {isCalendar && (
          <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <div className="font-medium">{session!.title}</div>
            Calendar slot: {fmtDateTime(session!.scheduledStart, settings.timezone)} –{' '}
            {minutesBetween(session!.scheduledStart, session!.scheduledEnd)} min
            {session!.calendarState === 'removed' && <div className="mt-1 text-orange-600">No longer in the calendar.</div>}
          </div>
        )}

        <div>
          <span className="label">Status</span>
          <div className="grid grid-cols-4 gap-1.5">
            {STATUSES.map((st) => (
              <button
                type="button"
                key={st}
                onClick={() => setStatus(st)}
                className={`btn btn-sm capitalize ${status === st ? 'bg-brand-600 text-white' : 'btn-ghost'}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Type</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as SessionType)}>
              {SESSION_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Coordinator</span>
            <select className="input" value={coordinator} onChange={(e) => setCoordinator(e.target.value)}>
              {coordinatorOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        {!isCalendar && (
          <label className="block">
            <span className="label">Title (optional)</span>
            <input className="input" value={title} placeholder={`${type} Session`} onChange={(e) => setTitle(e.target.value)} />
          </label>
        )}

        {status === 'done' && (
          <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {[false, true].map((v) => (
              <button
                type="button"
                key={String(v)}
                onClick={() => setUseCount(v)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${useCount === v ? 'bg-white shadow dark:bg-slate-900' : 'text-slate-500'}`}
              >
                {v ? 'Enter count directly' : 'Enter actual timings'}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <label>
            <span className="label">Date</span>
            <input type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span className="label">{isCalendar ? 'Actual start' : 'Start'}</span>
            <input type="time" required className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            <span className="label">{isCalendar ? 'Actual end' : 'End'}</span>
            <input type="time" required className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        {status === 'done' && useCount && (
          <div>
            <span className="label">Count</span>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: MAX_COUNT }, (_, i) => i + 1).map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setCount(n)}
                  className={`btn ${count === n ? 'bg-brand-600 text-white' : 'btn-ghost'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className="label">Note (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. extended for doubts" />
        </label>

        <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
          <span className="text-slate-500">
            {status === 'done' ? (useCount ? 'Direct count' : `${minutes} min`) : 'Not counted'}
          </span>
          <span className="font-semibold tabular-nums">
            {effectiveCount} count{effectiveCount === 1 ? '' : 's'} · {inr(effectiveCount * rate)}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          {session?.source === 'manual' && (
            <button type="button" className="btn-ghost text-red-600" onClick={remove}>
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving || minutes <= 0}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
