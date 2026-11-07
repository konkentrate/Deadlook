import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

export class ApiError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}
export function normalizeAccount(value) {
  const input = String(value).trim();
  const bracket = input.match(/^\[U:1:(\d+)\]$/);
  const digits = bracket ? bracket[1] : input;
  if (!/^\d+$/.test(digits)) throw new ApiError('Enter a numeric Steam account ID, SteamID64, or [U:1:ID].', 400);
  let id = BigInt(digits);
  if (id >= 76561197960265728n) id -= 76561197960265728n;
  if (id < 1n || id > 4294967295n) throw new ApiError('Steam account ID is outside the valid range.', 400);
  return String(id);
}
export class Cache {
  constructor(directory, fetcher = fetch) {
    this.directory = directory; this.fetcher = fetcher;
    this.pending = new Map();
  }
  async read(key) {
    try { return JSON.parse(await readFile(join(this.directory, key + '.json'), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) return null; throw e; }
  }
  async get(key, path, ttl, refresh = false, mergeHistory = false, allowObject = false) {
    if (this.pending.has(key)) return this.pending.get(key);
    const task = this.load(key, path, ttl, refresh, mergeHistory, allowObject);
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }
  async load(key, path, ttl, refresh, mergeHistory, allowObject) {
    const old = await this.read(key);
    const age = old ? Date.now() - Date.parse(old.fetchedAt) : Infinity;
    // Manual refresh still respects a one-minute shared cooldown.
    if (old && age < (refresh ? 60_000 : ttl)) return { ...old, stale: false, cached: true };
    try {
      const headers = { 'User-Agent': 'deadlook-selfhosted/0.1', Accept: 'application/json' };
      if (process.env.DEADLOCK_API_KEY) headers['X-API-Key'] = process.env.DEADLOCK_API_KEY;
      const response = await this.fetcher('https://api.deadlock-api.com' + path, {
        headers, signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new ApiError(
        response.status === 429 ? 'Upstream rate limit reached. Try again later.' : 'Deadlock API returned HTTP ' + response.status,
        response.status === 429 ? 429 : 502);
      const raw = await response.json();
      if (!Array.isArray(raw) && !((allowObject || key.startsWith('metadata-')) && raw && typeof raw === 'object')) throw new ApiError('Unexpected API response.');
      let data = raw;
      if (mergeHistory) {
        if (raw.some(m => !Number.isSafeInteger(m.match_id) || !Number.isFinite(m.start_time)))
          throw new ApiError('Unexpected match-history format.');
        const all = new Map((old?.data ?? []).map(m => [m.match_id, m]));
        for (const match of raw) all.set(match.match_id, match);
        data = [...all.values()].sort((a, b) => b.start_time - a.start_time);
      }
      const entry = { data, fetchedAt: new Date().toISOString(), latestResponseCount: Array.isArray(raw) ? raw.length : null };
      await mkdir(this.directory, { recursive: true });
      const destination = join(this.directory, key + '.json');
      const tmp = destination + '.tmp';
      await writeFile(tmp, JSON.stringify(entry), { mode: 0o600 });
      await rename(tmp, destination);
      return { ...entry, stale: false, cached: false };
    } catch (error) {
      if (old) return { ...old, stale: true, cached: true, warning: error.message };
      if (error instanceof ApiError) throw error;
      throw new ApiError(error.name === 'TimeoutError' ? 'Deadlock API timed out. Try again.' : 'Unable to retrieve API data. Try again later.');
    }
  }
}
