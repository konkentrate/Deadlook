import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPath } from './finder.js';
const query = { account_ids: '123', hero_ids: '1', min_unix_timestamp: '1793908800', match_mode: 'ranked,unranked' };
test('analytics proxy builds a fixed, bounded upstream query', () => {
  const url = new URL(analyticsPath('item-stats', query), 'https://api.deadlock-api.com');
  assert.equal(url.pathname, '/v1/analytics/item-stats');
  assert.equal(url.searchParams.get('account_ids'), '123');
  assert.equal(url.searchParams.get('bucket'), 'no_bucket');
  assert.equal(url.searchParams.get('game_mode'), 'normal');
});
test('analytics proxy rejects arbitrary endpoints and malformed inputs', () => {
  for (const [kind, q] of [['other', query], ['item-stats', {...query, hero_ids: '1,2'}],
    ['item-stats', {...query, account_ids: '../secrets'}], ['item-stats', {...query, match_mode: 'other'}],
    ['item-stats', {...query, max_unix_timestamp: '1'}]]) {
    assert.throws(() => analyticsPath(kind, q));
  }
});
test('ability order uses the singular hero parameter', () => {
  assert.match(analyticsPath('ability-order-stats', {...query, hero_id: '1'}), /hero_id=1/);
});
