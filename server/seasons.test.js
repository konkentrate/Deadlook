import test from 'node:test';
import assert from 'node:assert/strict';
import { inSeason, currentSeason } from '../src/seasons.js';

const seasons = [
  { class_name: 'season_1', intervals: [{ start_timestamp: 100, end_timestamp: 200 }] },
  { class_name: 'season_2', intervals: [{ start_timestamp: 200, end_timestamp: 300 }] },
];
test('season boundaries include start and exclude end', () => {
  assert.equal(inSeason(100, seasons[0]), true);
  assert.equal(inSeason(199, seasons[0]), true);
  assert.equal(inSeason(200, seasons[0]), false);
  assert.equal(inSeason(200, seasons[1]), true);
  assert.equal(inSeason(99, seasons[0]), false);
});
test('current season and all-time fallback', () => {
  assert.equal(currentSeason(seasons, 250), 'season_2');
  assert.equal(currentSeason(seasons, 300), '');
  assert.equal(currentSeason([], 250), '');
  assert.equal(inSeason(250, undefined), false);
});
test('multiple intervals do not include gaps', () => {
  const season = { intervals: [{ start_timestamp: 10, end_timestamp: 20 }, { start_timestamp: 30, end_timestamp: 40 }] };
  assert.equal(inSeason(25, season), false);
  assert.equal(inSeason(35, season), true);
});
