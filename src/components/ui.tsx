import { useEffect, type ReactNode } from 'react';
import type { SessionType, Status } from '../lib/types';

const TYPE_STYLES: Record<SessionType, string> = {
  Review: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Mentoring: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  Lecturing: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
};

const STATUS_STYLES: Record<Status, string> = {
  pending: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  done: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  rescheduled: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
};

const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export const TypeBadge = ({ type }: { type: SessionType }) => <span className={`${pill} ${TYPE_STYLES[type]}`}>{type}</span>;

export const StatusBadge = ({ status }: { status: Status }) => (
  <span className={`${pill} ${STATUS_STYLES[status]} capitalize`}>{status}</span>
);

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-2xl leading-none text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={`card ${accent ? 'border-brand-500/40 bg-brand-50 dark:bg-brand-500/10' : ''}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card py-10 text-center text-sm text-slate-500">{children}</div>;
}
