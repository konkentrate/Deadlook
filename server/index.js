import express from 'express';
import { registerFinder } from './finder.js';
import { registerAnalysis } from './analysis.js';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cache, ApiError, normalizeAccount } from './cache.js';

const app = express();
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cache = new Cache(resolve(process.env.DATA_DIR || join(root, 'data')));
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'" });
  next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2 || query.length > 80) throw new ApiError('Search must be 2–80 characters.', 400);
  // Numeric lookups avoid ambiguous display names.
  let id;
  try { id = normalizeAccount(query); } catch {}
  const path = id ? '/v1/players/steam?account_ids=' + id
    : '/v1/players/steam-search?search_query=' + encodeURIComponent(query) + '&limit=8&min_matches_played_last_30d=0';
  const key = 'search-' + Buffer.from(query).toString('hex');
  try { res.json(await cache.get(key, path, 15 * 60_000)); }
  catch (e) { if (id && e.message.includes('404')) res.json({ data: [{ account_id: Number(id), personaname: 'Player ' + id }] }); else throw e; }
});
app.get('/api/heroes', async (_req, res) => {
  const result = await cache.get('heroes', '/v1/assets/heroes', 24 * 60 * 60_000);
  res.json({ ...result, data: result.data.map(h => ({ id: h.id, name: h.name, images: h.images, playable: h.player_selectable && !h.disabled })) });
});
app.get('/api/seasons', async (_req, res) => {
  res.json(await cache.get('ranked-seasons', '/v1/assets/ranked-seasons', 60 * 60_000));
});
app.get('/api/players/:account/history', async (req, res) => {
  const id = normalizeAccount(req.params.account);
  res.json(await cache.get('history-' + id, '/v1/players/' + id + '/match-history', 5 * 60_000, req.query.refresh === '1', true));
});
app.get('/api/matches/:match/metadata', async (req, res) => {
  if (!/^\d{1,15}$/.test(req.params.match)) throw new ApiError('Invalid match ID.', 400);
  res.json(await cache.get('metadata-' + req.params.match, '/v1/matches/' + req.params.match + '/metadata', 24 * 60 * 60_000));
});
registerFinder(app, cache);
registerAnalysis(app, cache);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use(express.static(join(root, 'dist')));
app.use((error, _req, res, _next) => {
  console.error(error.message);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Unexpected server error.' });
});
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log('Deadlook listening on http://' + host + ':' + port));
