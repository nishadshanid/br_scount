import { useMemo, useState } from 'react';
import { useSessionForm } from '../App';
import { Empty, StatusBadge, Stat, TypeBadge } from '../components/ui';
import { sessionCount, sessionMinutes } from '../lib/count';
import { addMonths, fmtDate, fmtTime, monthKey, monthLabel } from '../lib/dates';
import { inr, summarize } from '../lib/payout';
import { UNASSIGNED } from '../lib/types';
import { useData } from '../state';

export default function Month() {
  const { settings, sessions } = useData();
  const openForm = useSessionForm();
  const tz = settings.timezone;
  const [month, setMonth] = useState(() => monthKey(new Date().toISOString(), tz));

  const list = useMemo(
    () =>
      sessions
        .filter((s) => monthKey(s.scheduledStart, tz) === month)
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
    [sessions, month, tz],
  );
  const sum = summarize(list, settings);
  const pending = list.filter((s) => s.status === 'pending' && new Date(s.scheduledEnd) < new Date()).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            ‹
          </button>
          <h1 className="min-w-36 text-center text-2xl font-semibold">{monthLabel(month)}</h1>
          <button className="btn-ghost btn-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => openForm({})}>
          + Add session not in calendar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sessions done" value={sum.doneSessions} sub={`${list.length} sessions listed`} />
        <Stat label="Counts" value={sum.counts} sub={pending ? `${pending} still to mark` : 'all marked'} />
        <Stat label="Gross" value={inr(sum.gross)} sub={`TDS ${settings.tdsPercent}%: −${inr(sum.tds)}`} />
        <Stat label="Net payable" value={inr(sum.net)} accent />
      </div>

      {list.length === 0 ? (
        <Empty>No sessions this month yet.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="th">Date</th>
                <th className="th">Time</th>
                <th className="th">Session</th>
                <th className="th">Coordinator</th>
                <th className="th">Status</th>
                <th className="th text-right">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => openForm({ session: s })}
                >
                  <td className="td whitespace-nowrap">{fmtDate(s.scheduledStart, tz)}</td>
                  <td className="td whitespace-nowrap text-slate-500">
                    {fmtTime(s.actualStart ?? s.scheduledStart, tz)} · {sessionMinutes(s)}m
                    {s.actualStart && <span title="Actual time differs from calendar"> ✎</span>}
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={s.type} />
                      <span className="truncate">{s.title}</span>
                      {s.source === 'manual' && <span className="text-xs text-slate-400">manual</span>}
                      {s.calendarState === 'removed' && <span className="text-xs text-orange-500">removed from calendar</span>}
                    </div>
                  </td>
                  <td className={`td ${s.coordinator === UNASSIGNED ? 'text-orange-600' : ''}`}>{s.coordinator}</td>
                  <td className="td">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="td text-right font-medium tabular-nums">{s.status === 'done' ? sessionCount(s) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">Click a row to change its status, timings, count or coordinator.</p>
    </div>
  );
}
