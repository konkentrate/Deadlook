import test from 'node:test';
import assert from 'node:assert/strict';
import { leaderboardPath } from './finder.js';
const q = {hero_id:'1',min_unix_timestamp:'1793908800',max_unix_timestamp:'1804802400',match_mode:'ranked',sort_by:'rank',min_matches:'5'};
test('leaderboard is bounded to a hero, dates and 30 exact account entries',()=>{
 const u=new URL(leaderboardPath(q),'https://api.deadlock-api.com');
 assert.equal(u.pathname,'/v1/analytics/scoreboards/players');
 for(const [k,v] of Object.entries(q))assert.equal(u.searchParams.get(k),v);
 assert.equal(u.searchParams.get('limit'),'30');
 assert.equal(u.searchParams.has('account_ids'),false);
});
test('leaderboard rejects unsupported sorts and unbounded game thresholds',()=>{
 assert.throws(()=>leaderboardPath({...q,sort_by:'arbitrary'}));
 assert.throws(()=>leaderboardPath({...q,min_matches:'0'}));
 assert.throws(()=>leaderboardPath({...q,hero_id:'1,2'}));
});
