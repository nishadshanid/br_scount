import { useSessionForm } from '../App';
import { Empty, TypeBadge } from '../components/ui';
import { durationToCount, minutesBetween } from '../lib/count';
import { fmtDateTime, fmtTime } from '../lib/dates';
import { UNASSIGNED, type Session, type Status } from '../lib/types';
import { useData } from '../state';

export default function Inbox({ pending }: { pending: Session[] }) {
  const { settings, sessions, saveSession, saveSessions } = useData();
  const openForm = useSessionForm();
  const tz = settings.timezone;
  const coordinators = settings.coordinators.map((c) => c.name);

  const mark = (s: Session, status: Status, extra: Partial<Session> = {}) => ({
    ...s,
    status,
    rateSnapshot: settings.ratePerCount,
    markedAt: new Date().toISOString(),
    ...extra,
  });

  const unassignedDone = sessions.filter((s) => s.status === 'done' && s.coordinator === UNASSIGNED);
  const upcoming = sessions
    .filter((s) => s.status === 'pending' && new Date(s.scheduledEnd) > new Date())
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    .slice(0, 5);

  async function reschedule(s: Session) {
    await saveSession(mark(s, 'rescheduled'));
    if (confirm('Marked as rescheduled. Was the new slot left out of the calendar? Add it manually now?')) {
      openForm({ draft: { type: s.type, coordinator: s.coordinator, title: s.title } });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sessions to mark</h1>
          <p className="text-sm text-slate-500">Past sessions from your calendar that still need a status.</p>
        </div>
        {pending.length > 1 && (
          <button
            className="btn-ghost"
            onClick={() => {
              if (confirm(`Mark all ${pending.length} sessions as done with their scheduled timings?`))
                saveSessions(pending.map((s) => mark(s, 'done')), `Mark ${pending.length} sessions done`);
            }}
          >
            ✓ All done as scheduled
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <Empty>🎉 All caught up. Nothing waiting to be marked.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map((s) => {
            const mins = minutesBetween(s.scheduledStart, s.scheduledEnd);
            return (
              <div key={s.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="mt-0.5 text-sm text-slate-500">
                      {fmtDateTime(s.scheduledStart, tz)} – {fmtTime(s.scheduledEnd, tz)} · {mins} min
                    </div>
                  </div>
                  <TypeBadge type={s.type} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Coordinator</span>
                  <select
                    className={`input !w-auto !py-1 ${s.coordinator === UNASSIGNED ? 'border-orange-400' : ''}`}
                    value={s.coordinator}
                    onChange={(e) => saveSession({ ...s, coordinator: e.target.value, coordinatorManual: true })}
                  >
                    {[...new Set([s.coordinator, ...coordinators, UNASSIGNED])].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary btn-sm" onClick={() => saveSession(mark(s, 'done'))}>
                    ✓ Done as scheduled ({durationToCount(mins)})
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => openForm({ session: s, initialStatus: 'done' })}>
                    Done, different time / count…
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => reschedule(s)}>
                    Rescheduled
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => saveSession(mark(s, 'cancelled'))}>
                    Cancelled
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unassignedDone.length > 0 && (
        <div className="card border-orange-300 text-sm">
          <b>{unassignedDone.length}</b> completed session(s) have no coordinator. Fix them in the <a className="underline" href="#/month">Month</a> view.
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Coming up</h2>
          <div className="card divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {upcoming.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="truncate">{s.title}</span>
                <span className="shrink-0 text-slate-500">
                  {fmtDateTime(s.scheduledStart, tz)} · {s.coordinator}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
