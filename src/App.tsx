import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { SessionForm, type SessionFormProps } from './components/SessionForm';
import { pendingSessions } from './lib/merge';
import Inbox from './pages/Inbox';
import Month from './pages/Month';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import { useData } from './state';

type FormRequest = Omit<SessionFormProps, 'onClose'>;
const FormCtx = createContext<(req: FormRequest) => void>(() => {});
export const useSessionForm = () => useContext(FormCtx);

const NOTIFY_KEY = 'scount.lastNotified';

/** Browser reminder: badge in the tab title plus a system notification at most once an hour. */
function usePendingReminder(count: number) {
  useEffect(() => {
    document.title = count ? `(${count}) SCount` : 'SCount';
    if (!count || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const check = () => {
      let last = 0;
      try {
        last = Number(localStorage.getItem(NOTIFY_KEY) ?? 0);
      } catch {
        /* ignore */
      }
      if (Date.now() - last < 3600_000) return;
      new Notification('SCount', {
        body: `${count} session${count > 1 ? 's are' : ' is'} waiting to be marked.`,
        tag: 'scount-pending',
      });
      try {
        localStorage.setItem(NOTIFY_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    check();
    const t = setInterval(check, 5 * 60_000);
    return () => clearInterval(t);
  }, [count]);
}

export default function App() {
  const { config, sessions, loading, error, clearError, settingsExists } = useData();
  const [form, setForm] = useState<FormRequest | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const pending = useMemo(() => pendingSessions(sessions, now), [sessions, now]);
  usePendingReminder(pending.length);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'
    }`;

  return (
    <FormCtx.Provider value={setForm}>
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="mr-auto flex items-center gap-2 font-semibold sm:mr-2">
            <span className="text-xl">📚</span> SCount
          </div>
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            <NavLink to="/inbox" className={navCls}>
              To mark
              {pending.length > 0 && (
                <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>
              )}
            </NavLink>
            <NavLink to="/month" className={navCls}>
              Month
            </NavLink>
            <NavLink to="/reports" className={navCls}>
              Reports
            </NavLink>
            <NavLink to="/settings" className={navCls}>
              Settings
            </NavLink>
          </nav>
          {config && (
            <button className="btn-primary btn-sm" onClick={() => setForm({})}>
              + Add session
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div className="no-print mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <span>{error}</span>
            <button onClick={clearError} className="font-bold">
              ×
            </button>
          </div>
        )}
        {config && !settingsExists && !loading && (
          <div className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Your data repo has no settings yet. Open <NavLink to="/settings" className="underline">Settings</NavLink> and press{' '}
            <b>Save settings</b> to initialise it.
          </div>
        )}
        {loading && <div className="mb-4 text-sm text-slate-500">Loading from GitHub…</div>}

        <Routes>
          <Route path="/" element={<Navigate to={config ? '/inbox' : '/settings'} replace />} />
          <Route path="/inbox" element={config ? <Inbox pending={pending} /> : <Navigate to="/settings" />} />
          <Route path="/month" element={config ? <Month /> : <Navigate to="/settings" />} />
          <Route path="/reports" element={config ? <Reports /> : <Navigate to="/settings" />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {form && <SessionForm {...form} onClose={() => setForm(null)} />}
    </FormCtx.Provider>
  );
}
