import { createHash } from 'node:crypto';
import { ApiError, normalizeAccount } from './cache.js';

export function playerPath(resource, account) {
  const id = normalizeAccount(account);
  if (resource === 'rank') return { id, path: `/v1/players/${id}/rank`, ttl: 15 * 60_000 };
  if (resource === 'hero-stats') return { id, path: `/v1/players/hero-stats?account_ids=${id}&game_mode=normal&match_mode=ranked%2Cunranked`, ttl: 15 * 60_000 };
  if (resource === 'region') return { id, path: `/v1/players/${id}/region`, ttl: 24 * 60 * 60_000 };
  throw new ApiError('Unknown player resource.', 404);
}

export function registerPlayers(app, cache) {
  for (const resource of ['rank', 'hero-stats', 'region']) {
    app.get(`/api/players/:account/${resource}`, async (req, res) => {
      const { id, path, ttl } = playerPath(resource, req.params.account);
      const key = `player-${resource}-${createHash('sha256').update(id).digest('hex').slice(0, 32)}`;
      res.json(await cache.get(key, path, ttl, req.query.refresh === '1', false, true));
    });
  }
}
