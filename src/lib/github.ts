import { monthKey } from './dates';
import { sessionsPath, type MonthFile, type Session } from './types';

// GITHUB_API_URL is set by GitHub Actions; both overrides also let tests point at a local mock.
const API =
  (typeof process !== 'undefined' && process.env?.GITHUB_API_URL) ||
  import.meta.env?.VITE_GITHUB_API_URL ||
  'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export interface Versioned<T> {
  data: T;
  sha?: string;
}

/** Minimal JSON-file store on top of the GitHub Contents API (works in browser and Node). */
export class GitHubStore {
  constructor(
    private token: string,
    /** "owner/name" */
    public repo: string,
  ) {}

  private async req(path: string, init: RequestInit = {}) {
    const res = await fetch(`${API}/repos/${this.repo}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = (await res.json()).message ?? msg;
      } catch {
        /* ignore */
      }
      throw new GitHubError(res.status, `GitHub ${res.status}: ${msg}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async checkAccess(): Promise<void> {
    await this.req('');
  }

  async getJSON<T>(path: string): Promise<Versioned<T> | null> {
    try {
      const r = await this.req(`/contents/${path}`);
      return { data: JSON.parse(decodeBase64(r.content)) as T, sha: r.sha };
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  /** Returns the new sha. Throws GitHubError 409/422 when `sha` is stale. */
  async putJSON(path: string, data: unknown, sha: string | undefined, message: string): Promise<string> {
    const r = await this.req(`/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: encodeBase64(JSON.stringify(data, null, 2) + '\n'), sha }),
    });
    return r.content.sha;
  }

  async listDir(path: string): Promise<string[]> {
    try {
      const r = (await this.req(`/contents/${path}`)) as { name: string; type: string }[];
      return r.filter((f) => f.type === 'file').map((f) => f.name);
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return [];
      throw e;
    }
  }

  async dispatchWorkflow(workflowFile: string, ref = 'main', inputs: Record<string, string> = {}) {
    await this.req(`/actions/workflows/${workflowFile}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref, inputs }),
    });
  }

  /**
   * Read-modify-write with retry: `mutate` gets the latest file contents (or the fallback)
   * and returns the new contents. Retries on sha conflicts so concurrent writers merge.
   */
  async updateJSON<T>(path: string, fallback: T, mutate: (cur: T) => T, message: string, tries = 4): Promise<T> {
    for (let i = 0; ; i++) {
      const cur = await this.getJSON<T>(path);
      const next = mutate(cur ? cur.data : structuredClone(fallback));
      try {
        await this.putJSON(path, next, cur?.sha, message);
        return next;
      } catch (e) {
        const conflict = e instanceof GitHubError && (e.status === 409 || e.status === 422);
        if (!conflict || i >= tries - 1) throw e;
      }
    }
  }

  // ---- session helpers -------------------------------------------------

  async listMonths(): Promise<string[]> {
    return (await this.listDir('data/sessions'))
      .filter((n) => /^\d{4}-\d{2}\.json$/.test(n))
      .map((n) => n.slice(0, 7))
      .sort();
  }

  async loadMonths(months: string[]): Promise<Session[]> {
    const files = await Promise.all(months.map((m) => this.getJSON<MonthFile>(sessionsPath(m))));
    return files.flatMap((f) => (f ? Object.values(f.data) : []));
  }

  /** Upsert (or delete with `remove`) one session, moving it between month files if its month changed. */
  async saveSession(s: Session, timeZone: string, opts: { previous?: Session; remove?: boolean } = {}) {
    const month = monthKey(s.scheduledStart, timeZone);
    const prevMonth = opts.previous ? monthKey(opts.previous.scheduledStart, timeZone) : month;
    if (prevMonth !== month || opts.remove) {
      await this.updateJSON<MonthFile>(
        sessionsPath(prevMonth),
        {},
        (f) => {
          delete f[s.id];
          return f;
        },
        `${opts.remove ? 'Delete' : 'Move'} session ${s.title}`,
      );
    }
    if (opts.remove) return;
    await this.updateJSON<MonthFile>(
      sessionsPath(month),
      {},
      (f) => ({ ...f, [s.id]: s }),
      `Update session: ${s.title} (${s.status})`,
    );
  }

  /** Upsert many sessions with one commit per month file. */
  async saveSessions(list: Session[], timeZone: string, message: string) {
    const byMonth = new Map<string, Session[]>();
    for (const s of list) {
      const m = monthKey(s.scheduledStart, timeZone);
      byMonth.set(m, [...(byMonth.get(m) ?? []), s]);
    }
    for (const [month, items] of byMonth) {
      await this.updateJSON<MonthFile>(
        sessionsPath(month),
        {},
        (f) => {
          for (const s of items) f[s.id] = s;
          return f;
        },
        message,
      );
    }
  }
}
