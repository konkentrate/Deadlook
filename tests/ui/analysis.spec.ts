import { test, expect, type Page } from '@playwright/test';
const profile={account_id:123,personaname:'Fixture Player'};
const now=Math.floor(Date.now()/1000);
const history=[101,104].map((match_id,i)=>({match_id,account_id:123,hero_id:1,game_mode:1,match_mode:4,start_time:now-3600*(i+1),match_duration_s:1800,net_worth:30000,player_kills:8,player_deaths:4,player_assists:10,last_hits:100,denies:10,hero_level:20,player_match_outcome:1,ranked_delta:match_id===101?12:null}));
function snapshot(time:number){return {time,net_worth:time*8,gold_lane_creep:time*2,gold_lane_creep_orbs:time,gold_neutral_creep:time*0.4,gold_neutral_creep_orbs:0,gold_player:time,gold_player_orbs:0,gold_assists:time*0.3,gold_boss:time*0.1,gold_boss_orb:0,gold_treasure:0,creep_kills:Math.floor(time/20),neutral_kills:Math.floor(time/60),kills:Math.floor(time/100),deaths:Math.floor(time/500),assists:Math.floor(time/80),denies:Math.floor(time/150),player_damage:time*50,boss_damage:time*10};}
function details(id=101){return {matchId:id,accountId:123,heroId:1,duration:1800,kills:8,deathCount:2,assists:10,netWorth:id===104?90000:30000,stats:[180,360,540,720,900,1200,1500,1800].map(snapshot),deaths:[{time:400,duration:60},{time:900,duration:60}],routeInterval:1,routeVersion:1,
 route:Array.from({length:1801},(_,time)=>({time,x:Math.round(Math.sin(time/90)*7000),y:Math.round(Math.cos(time/120)*8000),alive:!(time>=400&&time<460||time>=900&&time<960),combat:Math.floor(time/100)%4,move:time<100?6:0}))};}
const rankAssets=[{tier:6,name:'Archon'},{tier:7,name:'Oracle'}];
async function fixtures(page:Page,saved=true){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 if(saved)await page.addInitScript(p=>localStorage.setItem('deadlook.home',JSON.stringify(p)),profile);
 const analysisRequests:string[]=[];
 page.on('request',r=>{if(/\/api\/analysis\/(match|curve|metrics|map)/.test(r.url()))analysisRequests.push(r.url());});
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  const envelope=(data:unknown)=>({data,fetchedAt:new Date().toISOString(),cached:false,stale:false});
  let data:unknown;
  if(path==='/api/heroes')data=[{id:1,name:'Infernus',playable:true,images:{icon_image_small_webp:'/deadlook-eye.svg'}},{id:2,name:'Seven',playable:true}];
  else if(path==='/api/seasons')data=[{class_name:'season_1',name:'Beta Season 1',ranked_type:'normal',intervals:[{interval:1,start_timestamp:now-120*86400,end_timestamp:now+86400}]}];
  else if(path==='/api/analysis/ranks')data=rankAssets;
  else if(path==='/api/search')data=url.searchParams.get('q')?.toLowerCase()==='friend'?[{account_id:456,personaname:'Fixture Friend'}]:[profile];
  else if(path.endsWith('/rank'))data={badge:82,rank:8,subrank:2,last_match:null};
  else if(path.endsWith('/hero-stats'))data=[];
  else if(path.endsWith('/region'))data={account_id:123,region:'eu_west',history:[]};
  else if(path.endsWith('/history'))data=history.map(m=>({...m,account_id:Number(path.split('/')[3])}));
  else if(path.startsWith('/api/analysis/match/'))data=details(Number(path.split('/').at(-1)));
  else if(path==='/api/analysis/curve'){
   const scale=url.searchParams.has('min_average_badge')||url.searchParams.get('account_ids')==='456'?2:1;
   data=[180,360,540,720,900,1200,1500,1800].map(game_time=>({game_time,game_time_avg:game_time,samples:25,net_worth_avg:game_time*12*scale,gold_lane_creep_avg:game_time*4*scale,gold_lane_creep_orbs_avg:game_time*2*scale,gold_neutral_creep_avg:game_time*scale,gold_neutral_creep_orbs_avg:game_time*0.2,gold_player_avg:game_time,gold_player_orbs_avg:0,gold_boss_avg:game_time*0.1,gold_boss_orb_avg:0,gold_treasure_avg:0}));
  }else if(path==='/api/analysis/metrics'){
   const metric=(v:number)=>({avg:v,percentile25:v*0.8,percentile50:v,percentile75:v*1.2});
   data=[{bucket:1,net_worth_per_min:metric(1200),deaths:metric(5),player_damage_per_min:metric(2000),boss_damage_per_min:metric(400)}];
  }else if(path==='/api/analysis/map')data={radius:10752,images:{minimap:'/deadlook-eye.svg'}};
  else return route.fulfill({status:404,json:{error:'Unknown fixture '+path}});
  return route.fulfill({json:envelope(data)});
 });
 return {errors,analysisRequests};
}
test('history match opens a compact report and automatically loads its analysis',async({page})=>{
 const {errors,analysisRequests}=await fixtures(page);await page.goto('/');
 await expect(page.getByRole('heading',{name:'Fixture Player'})).toBeVisible();
 expect(analysisRequests).toEqual([]);
 const button=page.getByRole('button',{name:'Details for match 101'});
 await button.click();await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.locator('.dl-match-summary').getByText('Net worth / min',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Performance comparison'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Income sources at a shared checkpoint'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Next-game focus'})).toBeVisible();
 await expect.poll(()=>analysisRequests.some(r=>r.includes('/api/analysis/match/101?account_ids=123'))).toBe(true);
 await expect.poll(()=>analysisRequests.some(r=>r.includes('/api/analysis/curve?'))).toBe(true);
 await expect.poll(()=>analysisRequests.some(r=>r.includes('/api/analysis/metrics?'))).toBe(true);
 await expect(page.getByRole('img',{name:/Recorded two-dimensional/})).toBeVisible();
 await page.getByRole('button',{name:'View route 3:00 to 6:00',exact:true}).click();
 await expect(page.locator('#route-start')).toHaveValue('180');await expect(page.locator('#route-end')).toHaveValue('360');
 await expect(page.getByText(/sampled coverage/)).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(button).toBeFocused();
 expect(errors).toEqual([]);
});
test('analysis controls compare with lobby ranks and another player',async({page})=>{
 const {analysisRequests}=await fixtures(page);await page.goto('/');
 await page.getByRole('button',{name:'Details for match 101'}).click();
 await expect(page.getByRole('heading',{name:'Performance comparison'})).toBeVisible();
 await page.locator('#analysis-compare').selectOption('rank');
 const rankRequest=page.waitForRequest(r=>r.url().includes('/api/analysis/curve?')&&r.url().includes('min_average_badge=61'));
 await page.locator('#analysis-rank').selectOption('6');const request=await rankRequest;
 expect(request.url()).toContain('max_average_badge=66');
 await expect(page.getByRole('columnheader',{name:'Archon-average lobbies median'})).toBeVisible();
 await page.locator('#analysis-compare').selectOption('player');
 await page.locator('#comparison-search').fill('Friend');await page.getByRole('dialog').getByRole('button',{name:'Find player',exact:true}).click();
 await page.getByRole('button',{name:/Fixture Friend Account 456/}).click();
 await expect(page.getByRole('columnheader',{name:'Fixture Friend median'})).toBeVisible();
 expect(analysisRequests.some(r=>r.includes('account_ids=456'))).toBe(true);
 expect(analysisRequests.filter(r=>r.includes('/api/analysis/match/101?'))).toHaveLength(1);
});
test('legacy analysis match links open the same History inspector and preserve filters',async({page})=>{
 await fixtures(page,false);await page.goto('/analysis.html?p=123&hero=1&match=104&days=90&mode=ranked&length=medium');
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Match report · #104'})).toBeVisible();
 await expect(page).toHaveURL(/\/?\?days=90&mode=ranked&length=medium&p=123&hero=1&match=104/);
 await expect(page.locator('#analysis-days')).toHaveValue('90');
 await expect(page.locator('#analysis-mode')).toHaveValue('ranked');
 await expect(page.locator('#analysis-length')).toHaveValue('medium');
 await expect(page.getByRole('link',{name:/Match Analysis/})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Match report · #104'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Fixture Player'})).toBeVisible();
 await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('legacy analysis URL without a match falls back to the requested History profile',async({page})=>{
 await fixtures(page,false);await page.goto('/analysis.html?p=123');
 await expect(page.getByRole('heading',{name:'Fixture Player'})).toBeVisible();
 await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('match analysis handles unavailable details while keeping the history summary usable',async({page})=>{
 await fixtures(page);await page.route('**/api/analysis/match/**',r=>r.fulfill({status:502,json:{error:'Metadata not stored'}}));
 await page.goto('/');await page.getByRole('button',{name:'Details for match 101'}).click();
 await expect(page.getByRole('alert')).toContainText('Detailed match data unavailable');
 await expect(page.locator('.dl-match-summary').getByText('Net worth / min',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Performance comparison'})).toBeVisible();
});
test('closing a match during a pending request prevents stale data from replacing the next match',async({page})=>{
 const {analysisRequests}=await fixtures(page);let release!:()=>void,started!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve}),firstRequest=new Promise<void>(resolve=>{started=resolve;});
 await page.route('**/api/analysis/match/101**',async route=>{started();await held;await route.fulfill({json:{data:details(101),fetchedAt:new Date().toISOString(),cached:false,stale:false}});});
 await page.goto('/');await page.getByRole('button',{name:'Details for match 101'}).click();await firstRequest;
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Details for match 104'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect.poll(()=>analysisRequests.some(r=>r.includes('/api/analysis/match/104?'))).toBe(true);
 release();await expect(page.getByRole('heading',{name:'Match report · #104'})).toBeVisible();
 await expect(page.getByText(/recorded position samples/)).toBeVisible();
});
test('match inspector and analysis fit a narrow mobile viewport',async({page})=>{
 await fixtures(page);await page.setViewportSize({width:375,height:812});await page.goto('/');
 await page.getByRole('button',{name:'Details for match 101'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Performance comparison'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
