import { createHash } from 'node:crypto';
import { ApiError, normalizeAccount } from './cache.js';

export function playerPath(resource, account, range = {}) {
  const id = normalizeAccount(account);
  if (resource === 'rank') return { id, path: `/v1/players/${id}/rank`, ttl: 15 * 60_000 };
  if (resource === 'hero-stats') {
    let dates = '';
    if (range.min_unix_timestamp !== undefined || range.max_unix_timestamp !== undefined) {
      const valid = value => typeof value === 'string' && /^\d{1,10}$/.test(value);
      const min = Number(range.min_unix_timestamp), max = Number(range.max_unix_timestamp);
      if (!valid(range.min_unix_timestamp) || !valid(range.max_unix_timestamp) || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 1 || max <= min || max - min > 2 * 366 * 24 * 60 * 60 || max > 4102444800) throw new ApiError('Invalid hero-stat date range.', 400);
      dates = `&min_unix_timestamp=${min}&max_unix_timestamp=${max}`;
    }
    return { id, path: `/v1/players/hero-stats?account_ids=${id}&game_mode=normal&match_mode=ranked%2Cunranked${dates}`, ttl: 15 * 60_000 };
  }
  if (resource === 'region') return { id, path: `/v1/players/${id}/region`, ttl: 24 * 60 * 60_000 };
  throw new ApiError('Unknown player resource.', 404);
}

export function registerPlayers(app, cache) {
  for (const resource of ['rank', 'hero-stats', 'region']) {
    app.get(`/api/players/:account/${resource}`, async (req, res) => {
      const { id, path, ttl } = playerPath(resource, req.params.account, req.query);
      const key = `player-${resource}-${createHash('sha256').update(id + (resource === 'hero-stats' && path.includes('&min_unix_timestamp=') ? path : '')).digest('hex').slice(0, 32)}`;
      res.json(await cache.get(key, path, ttl, req.query.refresh === '1', false, true));
    });
  }
}
