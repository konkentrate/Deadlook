import { createHash } from 'node:crypto';
import { ApiError, normalizeAccount } from './cache.js';

export function analysisPath(kind, query) {
  if (!['curve', 'metrics'].includes(kind)) throw new ApiError('Unknown analysis endpoint.', 404);
  const integer = (key, min, max, required = true) => {
    if (!required && query[key] === undefined) return undefined;
    const value = String(query[key] ?? '');
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max)
      throw new ApiError('Invalid ' + key + '.', 400);
    return value;
  };
  const hero = integer('hero_ids', 1, 99999);
  const from = integer('min_unix_timestamp', 0, 4102444800);
  const to = integer('max_unix_timestamp', 1, 4102444800);
  if (Number(to) <= Number(from) || Number(to) - Number(from) > 90 * 86400)
    throw new ApiError('Choose a date window between 1 second and 90 days.', 400);
  const mode = String(query.match_mode || 'ranked,unranked');
  if (!['ranked', 'unranked', 'ranked,unranked'].includes(mode)) throw new ApiError('Invalid match mode.', 400);
  const params = new URLSearchParams({ hero_ids: hero, game_mode: 'normal', match_mode: mode,
    min_unix_timestamp: from, max_unix_timestamp: to });
  if (query.account_ids !== undefined) params.set('account_ids', normalizeAccount(query.account_ids));
  for (const key of ['min_average_badge', 'max_average_badge']) {
    const value = integer(key, 1, 116, false);
    if (value !== undefined) params.set(key, value);
  }
  if (params.has('min_average_badge') !== params.has('max_average_badge') ||
      Number(params.get('min_average_badge')) > Number(params.get('max_average_badge')))
    throw new ApiError('Choose a complete, ordered lobby-rank range.', 400);
  for (const key of ['min_duration_s', 'max_duration_s']) {
    const value = integer(key, 0, 7000, false);
    if (value !== undefined) params.set(key, value);
  }
  if (params.has('min_duration_s') && params.has('max_duration_s') &&
      Number(params.get('min_duration_s')) > Number(params.get('max_duration_s')))
    throw new ApiError('Invalid duration range.', 400);
  params.set(kind === 'curve' ? 'resolution' : 'bucket', kind === 'curve' ? '0' : 'hero');
  return '/v1/analytics/' + (kind === 'curve' ? 'player-performance-curve' : 'player-stats/metrics') + '?' + params;
}
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const statFields = ['net_worth', 'gold_player', 'gold_player_orbs', 'gold_assists', 'gold_lane_creep',
  'gold_lane_creep_orbs', 'gold_neutral_creep', 'gold_neutral_creep_orbs', 'gold_boss', 'gold_boss_orb',
  'gold_treasure', 'gold_breakable', 'gold_team_bonus', 'gold_denied', 'gold_death_loss', 'creep_kills',
  'neutral_kills', 'kills', 'deaths', 'assists', 'denies', 'player_damage', 'boss_damage'];
export function normalizeMatch(raw, account) {
  const info = raw?.match_info;
  const player = info?.players?.find(p => p.account_id === Number(account));
  if (!player) throw new ApiError('Player not found in this match metadata.', 404);
  const duration = finite(info.duration_s);
  if (!duration || duration < 0 || duration > 86400) throw new ApiError('Unexpected match duration.');
  const stats = [...new Map((Array.isArray(player.stats) ? player.stats : []).filter(s =>
    finite(s.time_stamp_s) !== null && s.time_stamp_s >= 0 && s.time_stamp_s <= duration
  ).map(s => [s.time_stamp_s, { time: s.time_stamp_s,
    ...Object.fromEntries(statFields.map(key => [key, finite(s[key])])) }])).values()].sort((a,b) => a.time-b.time);
  const deaths = (Array.isArray(player.death_details) ? player.death_details : []).filter(d =>
    finite(d.game_time_s) !== null && d.game_time_s >= 0 && d.game_time_s <= duration
  ).map(d => ({ time: d.game_time_s, duration: finite(d.death_duration_s) === null || d.death_duration_s < 0 ? null :
    Math.max(0, Math.min(d.death_duration_s, duration-d.game_time_s)) }));
  const paths = info.match_paths;
  const path = paths?.paths?.find(p => p.player_slot === player.player_slot);
  let route = [];
  if (paths?.version === 1 && finite(paths.interval_s) > 0 && finite(paths.x_resolution) > 0 && finite(paths.y_resolution) > 0 &&
      path && Array.isArray(path.x_pos) && Array.isArray(path.y_pos) && [path.x_min,path.y_min,path.x_max,path.y_max].every(v => finite(v) !== null) &&
      path.x_max >= path.x_min && path.y_max >= path.y_min) {
    for (let i=0; i<Math.min(path.x_pos?.length || 0,path.y_pos?.length || 0,20000); i++) {
      const time = i*paths.interval_s;
      if (time > duration) break;
      const x=path.x_pos[i], y=path.y_pos[i];
      if (finite(x) === null || finite(y) === null || x<0 || y<0 || x>paths.x_resolution || y>paths.y_resolution) continue;
      const health = finite(path.health?.[i]);
      const dead = deaths.some(d => d.duration !== null && time >= d.time && time < d.time+d.duration);
      route.push({ time, x: Math.round(path.x_min+x/paths.x_resolution*(path.x_max-path.x_min)),
        y: Math.round(path.y_min+y/paths.y_resolution*(path.y_max-path.y_min)),
        alive: health === null ? !dead : health>0 && !dead,
        combat: finite(path.combat_type?.[i]), move: finite(path.move_type?.[i]) });
    }
  }
  return { matchId: info.match_id, accountId: Number(account), heroId: player.hero_id, duration,
    kills: finite(player.kills), deathCount: finite(player.deaths), assists: finite(player.assists),
    netWorth: finite(player.net_worth), stats, deaths, route, routeInterval: finite(paths?.interval_s),
    routeVersion: paths?.version ?? null };
}
export function registerAnalysis(app, cache) {
  app.get('/api/analysis/ranks', async (_req,res) =>
    res.json(await cache.get('analysis-ranks','/v1/assets/ranks',86400_000)));
  app.get('/api/analysis/map', async (_req,res) => {
    const result = await cache.get('analysis-map','/v1/assets/map',86400_000,false,false,true);
    if (!(finite(result.data.radius) > 0)) throw new ApiError('Map scale is unavailable.');
    const images = Object.fromEntries(['minimap','plain'].filter(k =>
      typeof result.data.images?.[k] === 'string' && result.data.images[k].startsWith('https://')
    ).map(k => [k,result.data.images[k]]));
    res.json({...result,data:{radius:result.data.radius,images}});
  });
  app.get('/api/analysis/match/:match', async (req,res) => {
    if (!/^\d{1,15}$/.test(req.params.match)) throw new ApiError('Invalid match ID.',400);
    const account = normalizeAccount(req.query.account_ids ?? '');
    // Do not spend the very small anonymous Steam-fetch quota for analysis.
    const result = await cache.get('metadata-'+req.params.match,
      '/v1/matches/'+req.params.match+'/metadata?disable_steam=true',86400_000);
    res.json({...result,data:normalizeMatch(result.data,account)});
  });
  app.get('/api/analysis/:kind', async (req,res) => {
    const path = analysisPath(req.params.kind,req.query);
    const key = 'analysis-'+createHash('sha256').update(path).digest('hex').slice(0,32);
    res.json(await cache.get(key,path,3600_000));
  });
}
