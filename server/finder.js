import { createHash } from 'node:crypto';
import { ApiError, normalizeAccount } from './cache.js';

export function analyticsPath(kind, query) {
  if (!['item-stats', 'ability-order-stats'].includes(kind)) throw new ApiError('Unknown analytics endpoint.', 404);
  const account = normalizeAccount(query.account_ids || '');
  const hero = String(kind === 'item-stats' ? query.hero_ids : query.hero_id);
  if (!/^\d{1,5}$/.test(hero) || Number(hero) < 1) throw new ApiError('Choose one valid hero.', 400);
  const mode = String(query.match_mode || 'ranked,unranked');
  if (!['ranked', 'ranked,unranked'].includes(mode)) throw new ApiError('Invalid match mode.', 400);
  const params = new URLSearchParams({ account_ids: account, [kind === 'item-stats' ? 'hero_ids' : 'hero_id']: hero,
    game_mode: 'normal', match_mode: mode, min_matches: '1' });
  for (const key of ['min_unix_timestamp', 'max_unix_timestamp']) {
    if (query[key] !== undefined) {
      const value = String(query[key]);
      if (!/^\d{1,11}$/.test(value) || Number(value) > 4102444800) throw new ApiError('Invalid date boundary.', 400);
      params.set(key, value);
    }
  }
  if (!params.has('min_unix_timestamp')) throw new ApiError('A start date is required.', 400);
  if (params.has('max_unix_timestamp') && Number(params.get('max_unix_timestamp')) <= Number(params.get('min_unix_timestamp')))
    throw new ApiError('End date must follow start date.', 400);
  if (kind === 'item-stats') params.set('bucket', 'no_bucket');
  return '/v1/analytics/' + kind + '?' + params;
}
export function leaderboardPath(query) {
  const sort = String(query.sort_by || 'rank');
  if (!['rank', 'winrate', 'matches'].includes(sort)) throw new ApiError('Invalid leaderboard sort.', 400);
  const minimum = String(query.min_matches || '5');
  if (!['5', '10', '20'].includes(minimum)) throw new ApiError('Invalid minimum matches.', 400);
  const validated = new URL(analyticsPath('ability-order-stats', { ...query, account_ids: '1' }), 'https://api.deadlock-api.com');
  validated.searchParams.delete('account_ids');
  validated.searchParams.set('min_matches', minimum);
  validated.searchParams.set('sort_by', sort);
  validated.searchParams.set('sort_direction', 'desc');
  validated.searchParams.set('limit', '30');
  return '/v1/analytics/scoreboards/players?' + validated.searchParams;
}
export function registerFinder(app, cache) {
  app.get('/api/finder/leaderboard', async (req, res) => {
    const path = leaderboardPath(req.query);
    const key = 'leaderboard-' + createHash('sha256').update(path).digest('hex').slice(0, 32);
    const result = await cache.get(key, path, 5 * 60_000, req.query.refresh === '1');
    let profiles = [];
    let profileWarning = '';
    if (result.data.length) {
      const ids = [...new Set(result.data.map(p => p.account_id))].sort((a,b) => a-b).join(',');
      try {
        const profileKey = 'profiles-' + createHash('sha256').update(ids).digest('hex').slice(0,32);
        profiles = (await cache.get(profileKey, '/v1/players/steam?account_ids=' + ids, 60 * 60_000)).data;
      } catch { profileWarning = 'Some profile names are unavailable; account IDs are shown instead.'; }
    }
    const names = new Map(profiles.map(p => [p.account_id, p.personaname]));
    res.json({ ...result, profileWarning, sortBy: String(req.query.sort_by || 'rank'),
      data: result.data.map(p => ({ ...p, personaname: names.get(p.account_id) || 'Player ' + p.account_id })) });
  });
  app.get('/api/finder/items', async (_req, res) => {
    res.json(await cache.get('items', '/v1/assets/items', 24 * 60 * 60_000));
  });
  app.get('/api/finder/:kind', async (req, res) => {
    const path = analyticsPath(req.params.kind, req.query);
    const key = 'finder-' + createHash('sha256').update(path).digest('hex').slice(0, 32);
    res.json(await cache.get(key, path, 15 * 60_000));
  });
}
