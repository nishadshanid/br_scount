import { useEffect, useState } from 'react';
import { GitHubStore } from '../lib/github';
import { SESSION_TYPES, type SessionType, type Settings } from '../lib/types';
import { notify, useInstall } from '../pwa';
import { useData } from '../state';

export default function SettingsPage() {
  const { config, setConfig, settings, saveSettings, syncNow, reload } = useData();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <InstallCard />
      <Connection config={config} onSave={setConfig} />
      {config && (
        <>
          <SyncCard syncNow={syncNow} reload={reload} />
          <Preferences key={JSON.stringify(settings)} settings={settings} onSave={saveSettings} />
          <NotificationsCard />
        </>
      )}
    </div>
  );
}

function Connection({ config, onSave }: { config: ReturnType<typeof useData>['config']; onSave: ReturnType<typeof useData>['setConfig'] }) {
  const [repo, setRepo] = useState(config?.repo ?? '');
  const [token, setToken] = useState(config?.token ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await new GitHubStore(token.trim(), repo.trim()).checkAccess();
      onSave({ token: token.trim(), repo: repo.trim() });
      setStatus('✓ Connected');
    } catch (err) {
      setStatus(`✗ ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3">
      <div>
        <h2 className="font-semibold">Private data repository</h2>
        <p className="text-sm text-slate-500">
          Your sessions are stored in your own private GitHub repo. The token stays in this browser only.
        </p>
      </div>
      <label className="block">
        <span className="label">Repository (owner/name)</span>
        <input className="input" required placeholder="your-username/scount-data" value={repo} onChange={(e) => setRepo(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Fine-grained personal access token</span>
        <input className="input font-mono" required type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} />
        <span className="mt-1 block text-xs text-slate-500">
          Repository access: only the data repo. Permissions: <b>Contents</b> read &amp; write, <b>Actions</b> read &amp; write.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Save & connect'}
        </button>
        {config && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (confirm('Remove the token from this browser?')) onSave(null);
            }}
          >
            Sign out
          </button>
        )}
        {status && <span className="text-sm">{status}</span>}
      </div>
    </form>
  );
}

function SyncCard({ syncNow, reload }: { syncNow: ReturnType<typeof useData>['syncNow']; reload: () => Promise<void> }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Calendar sync</h2>
        <p className="text-sm text-slate-500">Runs automatically every 3 hours. Use Sync now if you just changed the calendar.</p>
        {msg && (
          <p className={`mt-1 text-sm break-words ${msg.startsWith('✗') ? 'text-red-600 dark:text-red-400' : msg.startsWith('✓') ? 'text-green-600 dark:text-green-400' : ''}`}>
            {msg}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          className="btn-primary btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg('Starting sync…');
            try {
              setMsg(await syncNow(setMsg));
            } catch (e) {
              setMsg(`✗ ${e instanceof Error ? e.message : e}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Syncing…' : 'Sync now'}
        </button>
        <button className="btn-ghost btn-sm" onClick={reload} disabled={busy}>
          Refresh
        </button>
      </div>
    </div>
  );
}

function Preferences({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => Promise<void> }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!s.appUrl) set('appUrl', location.origin + location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean: Settings = {
      ...s,
      coordinators: s.coordinators
        .filter((c) => c.name.trim())
        .map((c) => ({ name: c.name.trim(), emails: c.emails.map((x) => x.trim().toLowerCase()).filter(Boolean) })),
      typeRules: s.typeRules.filter((r) => r.keyword.trim()),
    };
    await onSave(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={save} className="card space-y-5">
      <section className="space-y-3">
        <h2 className="font-semibold">Payment</h2>
        <div className="grid grid-cols-3 items-end gap-3">
          <label>
            <span className="label">Amount per count (₹)</span>
            <input type="number" min={0} className="input" value={s.ratePerCount} onChange={(e) => set('ratePerCount', Number(e.target.value))} />
          </label>
          <label>
            <span className="label">TDS %</span>
            <input type="number" min={0} max={100} step={0.5} className="input" value={s.tdsPercent} onChange={(e) => set('tdsPercent', Number(e.target.value))} />
          </label>
          <label>
            <span className="label">Remind after (hours)</span>
            <input type="number" min={0} className="input" value={s.reminderAfterHours} onChange={(e) => set('reminderAfterHours', Number(e.target.value))} />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Rate changes apply to sessions marked from now on. Already-marked sessions keep the rate they were marked with.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Coordinators</h2>
        <p className="text-xs text-slate-500">
          Add each coordinator's Google email so calendar events are matched to them automatically. Names in the event title or guest list also match.
        </p>
        {s.coordinators.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input !w-40"
              placeholder="Name"
              value={c.name}
              onChange={(e) => set('coordinators', s.coordinators.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              className="input"
              placeholder="email(s), comma separated"
              value={c.emails.join(', ')}
              onChange={(e) =>
                set('coordinators', s.coordinators.map((x, j) => (j === i ? { ...x, emails: e.target.value.split(',') } : x)))
              }
            />
            <button type="button" className="btn-ghost btn-sm" onClick={() => set('coordinators', s.coordinators.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost btn-sm" onClick={() => set('coordinators', [...s.coordinators, { name: '', emails: [] }])}>
          + Add coordinator
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Session type keywords</h2>
        <p className="text-xs text-slate-500">
          A calendar event is a teaching session when its title contains one of these words. Other events are ignored.
        </p>
        {s.typeRules.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input"
              value={r.keyword}
              onChange={(e) => set('typeRules', s.typeRules.map((x, j) => (j === i ? { ...x, keyword: e.target.value } : x)))}
            />
            <select
              className="input !w-40"
              value={r.type}
              onChange={(e) => set('typeRules', s.typeRules.map((x, j) => (j === i ? { ...x, type: e.target.value as SessionType } : x)))}
            >
              {SESSION_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <button type="button" className="btn-ghost btn-sm" onClick={() => set('typeRules', s.typeRules.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-ghost btn-sm" onClick={() => set('typeRules', [...s.typeRules, { keyword: '', type: 'Review' }])}>
          + Add keyword
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">App link for reminder emails</h2>
        <input className="input" value={s.appUrl} onChange={(e) => set('appUrl', e.target.value)} />
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary">Save settings</button>
        {saved && <span className="text-sm text-green-600">✓ Saved to your data repo</span>}
      </div>
    </form>
  );
}

function NotificationsCard() {
  const supported = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied');
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">Browser notifications</h2>
        <p className="text-sm text-slate-500">
          {!supported
            ? 'Not supported in this browser.'
            : perm === 'granted'
              ? 'On. You get an alert while SCount is open and sessions are waiting. Email reminders come from GitHub.'
              : perm === 'denied'
                ? 'Blocked. Allow notifications for this site in your browser settings.'
                : 'Get an alert while SCount is open and sessions are waiting.'}
        </p>
      </div>
      {supported && perm === 'default' && (
        <button className="btn-primary btn-sm" onClick={async () => setPerm(await Notification.requestPermission())}>
          Enable
        </button>
      )}
      {perm === 'granted' && (
        <button className="btn-ghost btn-sm" onClick={() => notify('SCount', 'Notifications are working 👍')}>
          Send test
        </button>
      )}
    </div>
  );
}

function InstallCard() {
  const { installed, canPrompt, ios, prompt } = useInstall();
  if (installed) return null;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-brand-500/40 bg-brand-50 dark:bg-brand-500/10">
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Install SCount on this device</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {canPrompt
            ? 'Adds SCount to your home screen and opens it like an app.'
            : ios
              ? 'In Safari, tap the Share button (□↑), then "Add to Home Screen".'
              : 'Open the browser menu (⋮) and choose "Install app" or "Add to Home screen".'}
        </p>
      </div>
      {canPrompt && (
        <button className="btn-primary btn-sm" onClick={prompt}>
          ⤓ Install app
        </button>
      )}
    </div>
  );
}
