import { GitHubStore } from '../src/lib/github';
import { DEFAULT_SETTINGS, SETTINGS_PATH, type Settings } from '../src/lib/types';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing environment variable ${name}`);
    process.exit(1);
  }
  return v;
}

export function storeFromEnv(): GitHubStore {
  return new GitHubStore(requireEnv('GITHUB_TOKEN'), requireEnv('DATA_REPO'));
}

export async function loadSettings(store: GitHubStore): Promise<Settings> {
  const s = await store.getJSON<Partial<Settings>>(SETTINGS_PATH);
  return { ...DEFAULT_SETTINGS, ...(s?.data ?? {}) };
}
