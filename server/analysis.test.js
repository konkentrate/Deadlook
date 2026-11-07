import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analysisPath, normalizeMatch, registerAnalysis } from './analysis.js';
import { Cache } from './cache.js';
import { sources, intervals, deadSeconds, activity, sharedCheckpoint, focusSuggestions } from '../src/lib/analysis.js';

const query={hero_ids:'1',account_ids:'123',min_unix_timestamp:'1791417600',max_unix_timestamp:'1794009600'};
test('analysis proxies only fixed endpoints, absolute time and hero-bucketed distributions',()=>{
 const curve=new URL(analysisPath('curve',{...query,resolution:'90',url:'https://evil.invalid',game_mode:'street_brawl'}),'https://api.deadlock-api.com');
 assert.equal(curve.pathname,'/v1/analytics/player-performance-curve');
 assert.equal(curve.searchParams.get('resolution'),'0');assert.equal(curve.searchParams.get('game_mode'),'normal');
 assert.equal(curve.searchParams.get('url'),null);
 const metrics=new URL(analysisPath('metrics',query),'https://api.deadlock-api.com');
 assert.equal(metrics.searchParams.get('bucket'),'hero');
 assert.equal(metrics.searchParams.get('account_ids'),'123');
});
test('analysis rejects invalid accounts, unbounded dates, modes, duration and rank ranges',()=>{
 for(const params of [{account_ids:'1,2'},{hero_ids:'0'},{max_unix_timestamp:'1791417600'},{max_unix_timestamp:'1804009600'},
  {min_unix_timestamp:'yesterday'},{match_mode:'private_lobby'},{min_average_badge:'61'},{min_average_badge:'66',max_average_badge:'61'},
  {min_average_badge:'0',max_average_badge:'116'},{max_duration_s:'7001'},{min_duration_s:'100',max_duration_s:'50'}])
  assert.throws(()=>analysisPath('curve',{...query,...params}));
 assert.throws(()=>analysisPath('sql',query));
 const path=analysisPath('curve',{...query,account_ids:undefined,min_average_badge:'61',max_average_badge:'66'});
 assert.match(path,/min_average_badge=61/);assert.ok(!path.includes('account_ids'));
});
function raw(){return {match_info:{match_id:101,duration_s:360,players:[{account_id:123,player_slot:4,hero_id:1,deaths:1,
 stats:[{time_stamp_s:360,net_worth:200},{time_stamp_s:180,net_worth:100}],
 death_details:[{game_time_s:350,death_duration_s:50}]}],match_paths:{version:1,interval_s:180,x_resolution:100,y_resolution:100,
 paths:[{player_slot:4,x_min:-100,y_min:-200,x_max:100,y_max:200,x_pos:[0,50,100],y_pos:[100,50,0],health:[100,100,0],combat_type:[0,3,1],move_type:[6,0,0]}]}}};}
test('metadata normalizes snapshots, missing values, bounded deaths and quantized world positions',()=>{
 const result=normalizeMatch(raw(),'123');
 assert.deepEqual(result.stats.map(s=>s.time),[180,360]);assert.equal(result.stats[0].gold_lane_creep,null);
 assert.equal(result.deaths[0].duration,10);
 assert.deepEqual(result.route.map(p=>[p.time,p.x,p.y,p.alive]),[[0,-100,200,true],[180,0,0,true],[360,100,-200,false]]);
 assert.equal(result.route[1].combat,3);assert.equal(result.route[0].move,6);
 assert.throws(()=>normalizeMatch(raw(),'456'),/not found/);
});
test('unsupported or missing paths never produce an inferred route',()=>{
 const unknown=raw();unknown.match_info.match_paths.version=2;
 assert.equal(normalizeMatch(unknown,'123').route.length,0);
 delete unknown.match_info.match_paths;unknown.match_info.players[0].stats=[];
 assert.equal(normalizeMatch(unknown,'123').stats.length,0);
 assert.equal(normalizeMatch(unknown,'123').route.length,0);
});
test('source totals do not count assists twice or turn missing values into zero',()=>{
 const total=sources({gold_player:100,gold_player_orbs:50,gold_assists:40,gold_lane_creep:0,gold_lane_creep_orbs:0});
 assert.equal(total.fights,150);assert.equal(total.lane,0);assert.equal(total.jungle,null);
 assert.equal(sources({gold_boss_avg:10,gold_boss_orb_avg:20},'_avg').objectives,30);
});
test('interval rates use real elapsed time, preserve net-worth losses and reject counter resets',()=>{
 const rows=intervals([{time:180,net_worth:1000,gold_lane_creep:10,gold_lane_creep_orbs:20,creep_kills:10},
  {time:360,net_worth:700,gold_lane_creep:40,gold_lane_creep_orbs:50,creep_kills:3}],[]);
 assert.equal(rows[0].rate,-100);assert.equal(rows[0].lane,60);assert.equal(rows[0].creeps,null);assert.equal(rows[0].jungle,null);
});
test('death windows are clipped and unioned rather than counted twice',()=>{
 assert.equal(deadSeconds([{time:10,duration:20},{time:20,duration:40},{time:100,duration:null}],0,50),40);
 assert.equal(deadSeconds([{time:10,duration:20}],20,25),5);
});
test('combat tempo respects sample coverage and does not classify gaps as idle',()=>{
 const point=(time,combat,alive=true,move=0)=>({time,combat,alive,move,x:0,y:0});
 const result=activity([point(0,3),point(2,2,true,6),point(10,1,false),point(12,null)],2,1,14);
 assert.equal(result.coverage,7);assert.equal(result.neutral,1);assert.equal(result.npc,2);assert.equal(result.dead,2);
 assert.equal(result.unknown,2);assert.equal(result.zipline,2);assert.equal(result.out,0);
});
test('review prompts require a shared checkpoint, adequate coverage and a material gap',()=>{
 const stats=[{time:180,net_worth:100,gold_lane_creep:100,gold_lane_creep_orbs:0}];
 const match={stats,deaths:[],duration:180};
 const peer={game_time:180,samples:10,gold_lane_creep_avg:3000,gold_lane_creep_orbs_avg:0};
 assert.equal(sharedCheckpoint(stats,[{...peer,game_time:360}]),null);
 assert.equal(focusSuggestions(match,[{...peer,samples:9}]).length,0);
 assert.equal(focusSuggestions(match,[peer])[0].title,'Review lane income');
 assert.equal(focusSuggestions(null,[peer]).length,0);
});
test('analysis metadata skips Steam fallback and caches the raw match across players',async()=>{
 const routes=new Map();registerAnalysis({get:(path,handler)=>routes.set(path,handler)},{get:async(key,path)=>{
  assert.equal(key,'metadata-101');assert.equal(path,'/v1/matches/101/metadata?disable_steam=true');
  return {data:raw(),stale:false,fetchedAt:'now'};
 }});
 let response;await routes.get('/api/analysis/match/:match')({params:{match:'101'},query:{account_ids:'123'}},{json:r=>response=r});
 assert.equal(response.data.accountId,123);assert.equal(response.data.route.length,3);
});
test('object assets are opt-in to cache and retain stale fallback',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'deadlook-analysis-'));let fail=false;
 const cache=new Cache(dir,async()=>new Response(fail?'unavailable':JSON.stringify({radius:100}),{status:fail?503:200}));
 try{
  await assert.rejects(cache.get('array-only','/test',0),/Unexpected API response/);
  const result=await cache.get('map','/test',0,false,false,true);assert.equal(result.data.radius,100);
  fail=true;const stale=await cache.get('map','/test',0,false,false,true);assert.equal(stale.stale,true);assert.equal(stale.data.radius,100);
 }finally{await rm(dir,{recursive:true,force:true});}
});
