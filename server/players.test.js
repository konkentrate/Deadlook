import test from 'node:test';
import assert from 'node:assert/strict';
import { playerPath } from './players.js';

test('player endpoints construct fixed upstream paths and normalize account IDs', () => {
  assert.deepEqual(playerPath('rank', '[U:1:123]'), {
    id: '123', path: '/v1/players/123/rank', ttl: 15 * 60_000,
  });
  assert.equal(playerPath('hero-stats', '76561197960265851').path,
    '/v1/players/hero-stats?account_ids=123&game_mode=normal&match_mode=ranked%2Cunranked');
  assert.equal(playerPath('region', '123').path, '/v1/players/123/region');
});

test('player proxy rejects invalid accounts and unknown resources', () => {
  for (const bad of ['../1', '0', '4294967296', 'abc']) assert.throws(() => playerPath('rank', bad));
  assert.throws(() => playerPath('other', '123'));
});
