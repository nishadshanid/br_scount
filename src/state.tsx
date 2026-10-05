import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GitHubError, GitHubStore } from './lib/github';
import { DEFAULT_SETTINGS, SETTINGS_PATH, type Session, type Settings } from './lib/types';

const CONFIG_KEY = 'scount.config';
export const WORKFLOW_FILE = 'sync-remind.yml';

export interface Config {
  token: string;
  repo: string;
}

function readConfig(): Config | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null');
    return c?.token && c?.repo ? c : null;
  } catch {
    return null;
  }
}

interface DataState {
  config: Config | null;
  setConfig: (c: Config | null) => void;
  store: GitHubStore | null;
  settings: Settings;
  settingsExists: boolean;
  sessions: Session[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  reload: () => Promise<void>;
  saveSession: (s: Session, previous?: Session) => Promise<void>;
  saveSessions: (list: Session[], message: string) => Promise<void>;
  deleteSession: (s: Session) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<Config | null>(readConfig);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsExists, setSettingsExists] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = useMemo(() => (config ? new GitHubStore(config.token, config.repo) : null), [config]);

  const setConfig = (c: Config | null) => {
    try {
      if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
      else localStorage.removeItem(CONFIG_KEY);
    } catch {
      /* storage blocked; keep in memory only */
    }
    setConfigState(c);
  };

  const fail = (e: unknown) => {
    const msg =
      e instanceof GitHubError && e.status === 401
        ? 'GitHub token is invalid or expired. Update it in Settings.'
        : e instanceof Error
          ? e.message
          : String(e);
    setError(msg);
  };

  const reload = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [s, months] = await Promise.all([store.getJSON<Partial<Settings>>(SETTINGS_PATH), store.listMonths()]);
      setSettingsExists(!!s);
      setSettings({ ...DEFAULT_SETTINGS, ...(s?.data ?? {}) });
      setSessions(await store.loadMonths(months));
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Optimistic local update, then persist; revert by reloading on failure. */
  const persist = async (apply: (list: Session[]) => Session[], write: () => Promise<void>) => {
    setSessions(apply);
    try {
      await write();
    } catch (e) {
      fail(e);
      await reload();
    }
  };

  const value: DataState = {
    config,
    setConfig,
    store,
    settings,
    settingsExists,
    sessions,
    loading,
    error,
    clearError: () => setError(null),
    reload,
    saveSession: (s, previous) =>
      persist(
        (list) => [...list.filter((x) => x.id !== s.id), s],
        () => store!.saveSession(s, settings.timezone, { previous }),
      ),
    saveSessions: (items, message) => {
      const ids = new Set(items.map((s) => s.id));
      return persist(
        (list) => [...list.filter((x) => !ids.has(x.id)), ...items],
        () => store!.saveSessions(items, settings.timezone, message),
      );
    },
    deleteSession: (s) =>
      persist(
        (list) => list.filter((x) => x.id !== s.id),
        () => store!.saveSession(s, settings.timezone, { remove: true }),
      ),
    saveSettings: async (next) => {
      try {
        await store!.updateJSON(SETTINGS_PATH, next, () => next, 'Update settings');
        setSettings(next);
        setSettingsExists(true);
      } catch (e) {
        fail(e);
        throw e;
      }
    },
    syncNow: async () => {
      try {
        await store!.dispatchWorkflow(WORKFLOW_FILE, 'main', { remind: 'false' });
      } catch (e) {
        fail(e);
        throw e;
      }
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData outside DataProvider');
  return v;
}
