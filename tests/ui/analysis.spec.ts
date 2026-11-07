import { test, expect, type Page } from '@playwright/test';
const profile={account_id:123,personaname:'Fixture Player'};
const now=Math.floor(Date.now()/1000);
const history=[101,104].map((match_id,i)=>({match_id,account_id:123,hero_id:1,game_mode:1,match_mode:4,start_time:now-3600*(i+1),match_duration_s:1800,net_worth:14400,player_kills:4,player_deaths:2,player_assists:6,player_match_outcome:1}));
function snapshot(time:number){return {time,net_worth:time*8,gold_lane_creep:time*2,gold_lane_creep_orbs:time,gold_neutral_creep:time*0.4,gold_neutral_creep_orbs:0,gold_player:time,gold_player_orbs:0,gold_assists:time*0.3,gold_boss:time*0.1,gold_boss_orb:0,gold_treasure:0,creep_kills:Math.floor(time/20),neutral_kills:Math.floor(time/60),player_damage:time*50,boss_damage:time*10};}
function details(id=101){return {matchId:id,accountId:123,heroId:1,duration:1800,kills:4,deathCount:2,assists:6,netWorth:id===104?90000:14400,stats:[180,360,540,720,900,1200,1500,1800].map(snapshot),deaths:[{time:400,duration:60},{time:900,duration:60}],routeInterval:1,routeVersion:1,
 route:Array.from({length:1801},(_,time)=>({time,x:Math.round(Math.sin(time/90)*7000),y:Math.round(Math.cos(time/120)*8000),alive:!(time>=400&&time<460||time>=900&&time<960),combat:Math.floor(time/100)%4,move:time<100?6:0}))};}
async function fixtures(page:Page,saved=true){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 if(saved)await page.addInitScript(p=>localStorage.setItem('deadlook.home',JSON.stringify(p)),profile);
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  const envelope=(data:unknown)=>({data,fetchedAt:new Date().toISOString(),cached:false,stale:false});
  let data:unknown;
  if(path==='/api/heroes')data=[{id:1,name:'Infernus',playable:true},{id:2,name:'Seven',playable:true}];
  else if(path==='/api/analysis/ranks')data=[{tier:6,name:'Archon'},{tier:7,name:'Oracle'}];
  else if(path==='/api/analysis/map')data={radius:10752,images:{minimap:'/deadlook-eye.svg'}};
  else if(path==='/api/search')data=[url.searchParams.get('q')==='Friend'?{account_id:456,personaname:'Fixture Friend'}:profile];
  else if(path.endsWith('/history'))data=history;
  else if(path.startsWith('/api/analysis/match/'))data=details(Number(path.split('/').at(-1)));
  else if(path==='/api/analysis/curve'){
   const factor=url.searchParams.has('min_average_badge')||url.searchParams.get('account_ids')==='456'?2:1;
   data=[180,360,540,720,900,1200,1500,1800,1834].map(game_time=>({game_time,game_time_avg:game_time,samples:25,net_worth_avg:game_time*12*factor,gold_lane_creep_avg:game_time*4*factor,gold_lane_creep_orbs_avg:game_time*2*factor,gold_neutral_creep_avg:game_time*factor,gold_neutral_creep_orbs_avg:game_time*0.2,gold_player_avg:game_time,gold_player_orbs_avg:0,gold_boss_avg:game_time*0.1,gold_boss_orb_avg:0,gold_treasure_avg:0}));
  }else if(path==='/api/analysis/metrics'){
   const metric=(v:number)=>({avg:v,percentile25:v*0.8,percentile50:v,percentile75:v*1.2});
   data=[{bucket:Number(url.searchParams.get('hero_ids')),net_worth_per_min:metric(1200),deaths:metric(5),player_damage_per_min:metric(2000),boss_damage_per_min:metric(400)}];
  }else return route.fulfill({status:404,json:{error:'Unknown fixture '+path}});
  return route.fulfill({json:envelope(data)});
 });
 return errors;
}
test('analysis starts without a preset account or automatic player requests',async({page})=>{
 const errors=await fixtures(page,false);const requests:string[]=[];
 page.on('request',r=>{if(r.url().includes('/history')||r.url().includes('/analysis/curve'))requests.push(r.url());});
 await page.goto('/analysis.html');await expect(page.getByText('Choose a player to analyze')).toBeVisible();
 expect(requests).toEqual([]);expect(errors).toEqual([]);
 await expect(page.getByRole('link',{name:'Match Analysis',exact:true})).toHaveAttribute('aria-current','page');
});
test('analysis shows economy, source gaps, real route windows and actionable review prompts',async({page})=>{
 const errors=await fixtures(page);await page.goto('/analysis.html');
 await expect(page.getByRole('img',{name:/Net worth over/})).toBeVisible();
 await expect(page.getByRole('img',{name:/Recorded two-dimensional/})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Review lane income'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Review repeated deaths'})).toBeVisible();
 await expect(page.getByText('2 timed deaths / 2 reported deaths')).toBeVisible();
 await page.getByRole('button',{name:'View route 3:00 to 6:00',exact:true}).click();
 await expect(page.locator('#route-start')).toHaveValue('180');await expect(page.locator('#route-end')).toHaveValue('360');
 await page.locator('#route-start').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#route-start')).toHaveValue('181');
 await expect(page.getByText(/Out of combat can be travel/)).toBeVisible();
 await page.getByRole('button',{name:'Whole game',exact:true}).click();await expect(page.locator('#route-start')).toHaveValue('0');
 await page.getByRole('heading',{name:'Match Analysis',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/deadlook-analysis-desktop.png',fullPage:true});
 await page.locator('.dl-route-map').screenshot({path:'/tmp/deadlook-analysis-route.png'});
 expect(errors).toEqual([]);
});
test('rank benchmarks are explicitly lobby-ranked and comparison-player search has a unique input',async({page})=>{
 const errors=await fixtures(page);await page.goto('/analysis.html');
 await expect(page.locator('#analysis-game')).toHaveValue('101');
 await page.locator('#analysis-compare').selectOption('rank');
 const request=page.waitForRequest(r=>r.url().includes('/analysis/curve?')&&r.url().includes('min_average_badge=61'));
 await page.locator('#analysis-rank').selectOption('6');const sent=await request;
 expect(sent.url()).toContain('max_average_badge=66');expect(sent.url()).not.toContain('account_ids=');
 await expect(page.getByRole('columnheader',{name:'Archon-average lobbies median'})).toBeVisible();
 await page.locator('#analysis-compare').selectOption('player');
 await page.locator('#comparison-search').fill('Friend');await page.locator('#comparison-search').press('Enter');
 const friend=page.waitForRequest(r=>r.url().includes('/analysis/curve?')&&r.url().includes('account_ids=456'));
 await page.getByRole('button',{name:/Fixture Friend Account 456/}).click();await friend;
 await expect(page.getByRole('columnheader',{name:'Fixture Friend median'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('deadlook.home')!).account_id)).toBe(123);
 expect(errors).toEqual([]);
});
test('missing match data and failed curves do not hide available summary distributions',async({page})=>{
 const errors=await fixtures(page);
 await page.route('**/api/analysis/match/**',r=>r.fulfill({status:502,json:{error:'Metadata not stored'}}));
 await page.route('**/api/analysis/curve?**',r=>r.fulfill({status:503,json:{error:'Try again later'}}));
 await page.goto('/analysis.html');await expect(page.getByRole('alert')).toContainText('Detailed match data unavailable');
 await expect(page.getByRole('row',{name:/Final net worth/})).toContainText('1,200');
 await expect(page.getByText(/Your recent games curve: Try again later/)).toBeVisible();
 await page.locator('#analysis-view').selectOption('recent');
 await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('row',{name:/Final net worth/})).toContainText('1,200');
 expect(errors).toEqual([]);
});
test('stale and unsupported position data are disclosed without inventing routes',async({page})=>{
 const errors=await fixtures(page);
 await page.route('**/api/analysis/match/**',r=>r.fulfill({json:{data:{...details(),route:[],routeVersion:2},stale:true,warning:'Upstream unavailable',fetchedAt:new Date().toISOString()}}));
 await page.goto('/analysis.html');await expect(page.getByText(/Showing saved match details: Upstream unavailable/)).toBeVisible();
 await expect(page.getByText(/No supported position samples/)).toBeVisible();
 await expect(page.getByRole('img',{name:/Recorded two-dimensional/})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'View route 3:00 to 6:00',exact:true})).toBeVisible();
 await page.locator('#analysis-hero').selectOption('2');await expect(page.getByText(/No games match these filters/)).toBeVisible();
 expect(errors).toEqual([]);
});
test('late metadata cannot overwrite a more recently selected match',async({page})=>{
 const errors=await fixtures(page);
 await page.route('**/api/analysis/match/101?**',async r=>{await new Promise(resolve=>setTimeout(resolve,500));await r.fulfill({json:{data:details(),stale:false,fetchedAt:new Date().toISOString()}});});
 await page.goto('/analysis.html');await page.locator('#analysis-game').selectOption('104');
 await expect(page).toHaveURL(/match=104/);
 await expect(page.getByRole('row',{name:/Final net worth/})).toContainText('3,000');
 await page.waitForTimeout(600);await expect(page).toHaveURL(/match=104/);
 await expect(page.getByRole('row',{name:/Final net worth/})).toContainText('3,000');
 expect(errors).toEqual([]);
});
test('shared match links preserve filters without saving a player preset',async({page})=>{
 const errors=await fixtures(page,false);
 await page.goto('/analysis.html?p=123&hero=1&match=104&days=90&mode=ranked&length=medium');
 await expect(page.locator('#analysis-game')).toHaveValue('104');
 await expect(page.locator('#analysis-days')).toHaveValue('90');
 await expect(page.locator('#analysis-mode')).toHaveValue('ranked');
 await expect(page.locator('#analysis-length')).toHaveValue('medium');
 await expect(page).toHaveURL(/match=104/);
 expect(await page.evaluate(()=>localStorage.getItem('deadlook.home'))).toBeNull();
 expect(errors).toEqual([]);
});
test('analysis remains usable without horizontal page overflow on mobile',async({page})=>{
 const errors=await fixtures(page);await page.setViewportSize({width:375,height:812});await page.goto('/analysis.html');
 await expect(page.locator('.dl-route-map')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('heading',{name:'Match Analysis',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/deadlook-analysis-mobile.png',fullPage:true});
 expect(errors).toEqual([]);
});
