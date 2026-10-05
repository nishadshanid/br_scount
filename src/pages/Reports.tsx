import { useMemo, useState } from 'react';
import { BarChart } from '../components/BarChart';
import { Empty, StatusBadge, Stat, TypeBadge } from '../components/ui';
import { sessionCount, sessionMinutes } from '../lib/count';
import { addMonths, fmtDate, fmtTime, monthKey, monthLabel, monthsInRange } from '../lib/dates';
import { groupBy, inr, sessionGross, summarize, type Summary } from '../lib/payout';
import { SESSION_TYPES, STATUSES, UNASSIGNED, type Session } from '../lib/types';
import { useData } from '../state';

const ALL = 'All';

function fyStart(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${m >= 4 ? y : y - 1}-04`;
}

export default function Reports() {
  const { settings, sessions } = useData();
  const tz = settings.timezone;
  const thisMonth = monthKey(new Date().toISOString(), tz);

  const [from, setFrom] = useState(thisMonth);
  const [to, setTo] = useState(thisMonth);
  const [type, setType] = useState(ALL);
  const [coordinator, setCoordinator] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);

  const coordinatorNames = useMemo(
    () => [...new Set([...settings.coordinators.map((c) => c.name), ...sessions.map((s) => s.coordinator), UNASSIGNED])],
    [settings, sessions],
  );

  const filtered = useMemo(
    () =>
      sessions
        .filter((s) => {
          const m = monthKey(s.scheduledStart, tz);
          return (
            m >= from &&
            m <= to &&
            (type === ALL || s.type === type) &&
            (coordinator === ALL || s.coordinator === coordinator) &&
            (status === ALL || s.status === status) &&
            (source === ALL || s.source === source)
          );
        })
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
    [sessions, from, to, type, coordinator, status, source, tz],
  );

  const total = summarize(filtered, settings);
  const months = from <= to ? monthsInRange(from, to) : [];
  const byMonth = groupBy(filtered, (s) => monthKey(s.scheduledStart, tz));
  const range = from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`;

  const presets: [string, string, string][] = [
    ['This month', thisMonth, thisMonth],
    ['Last month', addMonths(thisMonth, -1), addMonths(thisMonth, -1)],
    ['Last 3 months', addMonths(thisMonth, -2), thisMonth],
    ['This FY', fyStart(thisMonth), thisMonth],
  ];

  function exportCsv() {
    const header = ['Date', 'Start', 'End', 'Minutes', 'Type', 'Coordinator', 'Title', 'Status', 'Source', 'Count', 'Rate', 'Gross', 'Note'];
    const rows = filtered.map((s) => [
      fmtDate(s.scheduledStart, tz),
      fmtTime(s.actualStart ?? s.scheduledStart, tz),
      fmtTime(s.actualEnd ?? s.scheduledEnd, tz),
      sessionMinutes(s),
      s.type,
      s.coordinator,
      s.title,
      s.status,
      s.source,
      sessionCount(s),
      s.rateSnapshot ?? settings.ratePerCount,
      sessionGross(s, settings),
      s.note ?? '',
    ]);
    rows.push([], ['', '', '', '', '', '', '', '', 'Total', total.counts, '', total.gross], ['', '', '', '', '', '', '', '', `TDS ${settings.tdsPercent}%`, '', '', -total.tds], ['', '', '', '', '', '', '', '', 'Net', '', '', total.net]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `scount-${from}${from !== to ? `_to_${to}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const select = (label: string, value: string, set: (v: string) => void, options: readonly string[]) => (
    <label className="min-w-32 flex-1">
      <span className="label">{label}</span>
      <select className="input capitalize" value={value} onChange={(e) => set(e.target.value)}>
        {[ALL, ...options].map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Report</h1>
          <p className="text-sm text-slate-500">{range}</p>
        </div>
        <div className="no-print flex gap-2">
          <button className="btn-ghost btn-sm" onClick={exportCsv} disabled={!filtered.length}>
            Export CSV
          </button>
          <button className="btn-ghost btn-sm" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      <div className="card no-print space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map(([label, f, t]) => (
            <button
              key={label}
              className={`btn btn-sm ${from === f && to === t ? 'bg-brand-600 text-white' : 'btn-ghost'}`}
              onClick={() => {
                setFrom(f);
                setTo(t);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="min-w-32 flex-1">
            <span className="label">From</span>
            <input type="month" className="input" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="min-w-32 flex-1">
            <span className="label">To</span>
            <input type="month" className="input" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
          {select('Type', type, setType, SESSION_TYPES)}
          {select('Coordinator', coordinator, setCoordinator, coordinatorNames)}
          {select('Status', status, setStatus, STATUSES)}
          {select('Source', source, setSource, ['calendar', 'manual'])}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Sessions done" value={total.doneSessions} sub={`of ${total.sessions} listed`} />
        <Stat label="Total counts" value={total.counts} />
        <Stat label="Gross amount" value={inr(total.gross)} sub={`${total.counts} × ${inr(settings.ratePerCount)}`} />
        <Stat label={`TDS (${settings.tdsPercent}%)`} value={total.tds ? `−${inr(total.tds)}` : inr(0)} />
        <Stat label="Net payable" value={inr(total.net)} accent />
      </div>

      <div className="card text-sm">
        <div className="mb-2 font-semibold">Calculation</div>
        <div className="grid max-w-md grid-cols-[1fr_auto] gap-y-1 tabular-nums">
          <span className="text-slate-500">
            {total.counts} counts × {inr(settings.ratePerCount)}
          </span>
          <span className="text-right">{inr(total.gross)}</span>
          <span className="text-slate-500">Less TDS @ {settings.tdsPercent}%</span>
          <span className="text-right">−{inr(total.tds)}</span>
          <span className="border-t border-slate-200 pt-1 font-semibold dark:border-slate-700">Net amount receivable</span>
          <span className="border-t border-slate-200 pt-1 text-right font-semibold dark:border-slate-700">{inr(total.net)}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty>No sessions match these filters.</Empty>
      ) : (
        <>
          {months.length > 1 && (
            <div className="card">
              <div className="mb-3 font-semibold">Net payable per month</div>
              <BarChart
                format={inr}
                bars={months.map((m) => {
                  const s = summarize(byMonth.get(m) ?? [], settings);
                  return { label: monthLabel(m), value: s.net, detail: `${s.counts} counts · ${s.doneSessions} sessions` };
                })}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown title="By session type" groups={groupBy(filtered, (s) => s.type)} settings={settings} />
            <Breakdown title="By coordinator" groups={groupBy(filtered, (s) => s.coordinator)} settings={settings} />
          </div>
          {months.length > 1 && <Breakdown title="By month" groups={new Map([...byMonth].sort())} settings={settings} label={monthLabel} />}

          <div className="card overflow-x-auto p-0">
            <div className="px-4 pt-4 font-semibold">Sessions ({filtered.length})</div>
            <table className="mt-2 w-full min-w-[720px]">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Time</th>
                  <th className="th">Type</th>
                  <th className="th">Title</th>
                  <th className="th">Coordinator</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Count</th>
                  <th className="th text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((s: Session) => (
                  <tr key={s.id}>
                    <td className="td whitespace-nowrap">{fmtDate(s.scheduledStart, tz)}</td>
                    <td className="td whitespace-nowrap text-slate-500">
                      {fmtTime(s.actualStart ?? s.scheduledStart, tz)}–{fmtTime(s.actualEnd ?? s.scheduledEnd, tz)}
                    </td>
                    <td className="td">
                      <TypeBadge type={s.type} />
                    </td>
                    <td className="td">
                      {s.title}
                      {s.source === 'manual' && <span className="ml-1 text-xs text-slate-400">manual</span>}
                    </td>
                    <td className="td">{s.coordinator}</td>
                    <td className="td">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="td text-right tabular-nums">{sessionCount(s) || '–'}</td>
                    <td className="td text-right tabular-nums">{sessionGross(s, settings) ? inr(sessionGross(s, settings)) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Breakdown({
  title,
  groups,
  settings,
  label = (k) => k,
}: {
  title: string;
  groups: Map<string, Session[]>;
  settings: Parameters<typeof summarize>[1];
  label?: (k: string) => string;
}) {
  const rows: [string, Summary][] = [...groups].map(([k, list]) => [k, summarize(list, settings)]);
  return (
    <div className="card overflow-x-auto p-0">
      <div className="px-4 pt-4 font-semibold">{title}</div>
      <table className="mt-2 w-full">
        <thead className="border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="th"></th>
            <th className="th text-right">Done</th>
            <th className="th text-right">Counts</th>
            <th className="th text-right">Gross</th>
            <th className="th text-right">TDS</th>
            <th className="th text-right">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 whitespace-nowrap tabular-nums dark:divide-slate-800">
          {rows.map(([k, s]) => (
            <tr key={k}>
              <td className="td font-medium">{label(k)}</td>
              <td className="td text-right">{s.doneSessions}</td>
              <td className="td text-right">{s.counts}</td>
              <td className="td text-right">{inr(s.gross)}</td>
              <td className="td text-right text-slate-500">{s.tds ? `−${inr(s.tds)}` : '–'}</td>
              <td className="td text-right font-medium">{inr(s.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
