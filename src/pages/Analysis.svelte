<script lang="ts">
 import { onMount } from 'svelte';
 import { IconChartLine, IconRefresh, IconRoute, IconTarget } from '@tabler/icons-svelte';
 import PageHeader from '../components/PageHeader.svelte';
 import PlayerLookup from '../components/PlayerLookup.svelte';
 import EconomyChart, { type Series } from '../components/EconomyChart.svelte';
 import RouteMap from '../components/RouteMap.svelte';
 import { api, duration, outcome, type Profile, type Match, type Hero, type Result } from '../types';
 import { defaultPlayer } from '../lib/preferences';
 import { dateTime } from '../lib/format';
 import { intervals, sources, activity, deadSeconds, sharedCheckpoint, focusSuggestions } from '../lib/analysis.js';
 import type { AnalysisMatch, CurvePoint, Metrics, Metric, Rank, MapAsset } from '../lib/analysis-types';

 let player=$state<Profile|null>(null),other=$state<Profile|null>(null);
 let heroes=$state<Hero[]>([]),ranks=$state<Rank[]>([]),map=$state<MapAsset|null>(null),history=$state<Match[]>([]);
 let heroId=$state(0),days=$state('30'),mode=$state('ranked,unranked'),length=$state('any'),view=$state('match'),compare=$state('self'),rank=$state('');
 let selectedId=$state(0),match=$state<AnalysisMatch|null>(null),ownCurve=$state<CurvePoint[]>([]),peerCurve=$state<CurvePoint[]>([]);
 let ownMetrics=$state<Metrics|null>(null),peerMetrics=$state<Metrics|null>(null);
 let booting=$state(true),playerLoading=$state(false),loading=$state(false),metadataLoading=$state(false);
 let playerError=$state(''),metadataError=$state(''),historyWarning=$state(''),metadataWarning=$state('');
 let messages=$state<string[]>([]),fetched=$state(''),metadataFetched=$state('');
 let assetWarnings=$state<string[]>([]);
 let start=$state(0),end=$state(0);
 let playerSequence=0,analysisSequence=0,metadataSequence=0;
 const anchor=Math.floor(Date.now()/300000)*300;
 const number=(n:number|null|undefined,digits=0)=>n==null||!Number.isFinite(n)?'—':n.toLocaleString(undefined,{maximumFractionDigits:digits});
 const time=(n:number)=>duration(Math.round(n));
 let since=$derived(anchor-Number(days)*86400);
 let bounds=$derived(length==='short'?[0,1499]:length==='medium'?[1500,2399]:length==='long'?[2400,7000]:[0,7000]);
 let games=$derived(history.filter(m=>m.hero_id===heroId&&m.game_mode===1&&
   (mode==='ranked,unranked'?[1,4].includes(m.match_mode):m.match_mode===(mode==='ranked'?4:1))&&
   m.start_time>=since&&m.start_time<=anchor&&m.match_duration_s>=bounds[0]&&m.match_duration_s<=bounds[1]).sort((a,b)=>b.start_time-a.start_time));
 let selected=$derived(games.find(g=>g.match_id===selectedId));
 let hero=$derived(heroes.find(h=>h.id===heroId));
 let peerLabel=$derived(compare==='player'?(other?.personaname||'Selected player'):
   compare==='rank'?(ranks.find(r=>String(r.tier)===rank)?.name||'Selected rank')+'-average lobbies':'Your recent mean');
 let reference=$derived(compare==='self'?ownCurve:peerCurve);
 let rows=$derived(match?intervals(match.stats,match.deaths):[]);
 let selectedSnapshot=$derived(match?.stats.find(s=>s.time===sharedCheckpoint(match?.stats??[],reference)));
 let referenceSnapshot=$derived(selectedSnapshot?reference.find(p=>p.game_time===selectedSnapshot.time):undefined);
 let ownSources=$derived(selectedSnapshot?sources(selectedSnapshot):null);
 let peerSources=$derived(referenceSnapshot?sources(referenceSnapshot,'_avg'):null);
 let windowStats=$derived(match?activity(match.route,match.routeInterval??0,start,end):null);
 let suggestions=$derived(focusSuggestions(match,reference));
 let deathCoverage=$derived(!!match && match.deaths.length===match.deathCount && match.deaths.every(d=>d.duration!==null));
 let downtime=$derived(match&&deathCoverage?deadSeconds(match.deaths,0,match.duration):null);
 let series=$derived.by(()=>{
   const result:Series[]=[];
   if(view==='match'&&match)result.push({name:'Selected game',kind:'selected',points:match.stats.map(p=>({time:p.time,value:p.net_worth}))});
   if(ownCurve.length)result.push({name:'Your recent mean',kind:'personal',points:ownCurve.map(p=>({time:p.game_time,value:p.net_worth_avg,samples:p.samples}))});
   if(compare!=='self'&&peerCurve.length)result.push({name:peerLabel,kind:'comparison',points:peerCurve.map(p=>({time:p.game_time,value:p.net_worth_avg,samples:p.samples}))});
   return result;
 });
 function metric(data:Metrics|null,key:string):Metric|null{
   const value=data?.[key];return value&&typeof value==='object'?value:null;
 }
 function selectedMetric(key:string):number|null{
   if(!match)return null;
   if(key==='net_worth_per_min')return match.netWorth===null?null:match.netWorth/(match.duration/60);
   if(key==='deaths')return match.deathCount;
   const final=match.stats.find(s=>s.time===match!.duration);
   const value=final?.[key==='player_damage_per_min'?'player_damage':'boss_damage'];
   return value==null?null:value/(match.duration/60);
 }
 const metrics=[['net_worth_per_min','Final net worth / min'],['deaths','Deaths / game'],['player_damage_per_min','Hero damage / min'],['boss_damage_per_min','Objective damage / min']];
 function query(account?:number){
   return {hero_ids:String(heroId),min_unix_timestamp:String(since),max_unix_timestamp:String(anchor),match_mode:mode,
     min_duration_s:String(bounds[0]),max_duration_s:String(bounds[1]),...(account?{account_ids:String(account)}:{})};
 }
 function resetAnalysis(){
   ++analysisSequence;++metadataSequence;loading=false;metadataLoading=false;match=null;ownCurve=[];peerCurve=[];
   ownMetrics=null;peerMetrics=null;messages=[];metadataError='';metadataWarning='';metadataFetched='';fetched='';
 }
 async function loadPlayer(p:Profile){
   const seq=++playerSequence;resetAnalysis();player=p;history=[];playerLoading=true;playerError='';historyWarning='';
   try{
     const r=await api<Result<Match[]>>('/api/players/'+p.account_id+'/history');if(seq!==playerSequence)return;
     history=r.data;historyWarning=r.stale?'Showing saved history: '+r.warning:'';
     const params=new URLSearchParams(location.search);
     const requested=Number(params.get('hero'));
     if(!heroId || !history.some(m=>m.hero_id===heroId))heroId=history.some(m=>m.hero_id===requested)?requested:history.find(m=>m.game_mode===1)?.hero_id||0;
     const requestedMatch=Number(params.get('match'));
     selectedId=history.some(m=>m.match_id===requestedMatch)?requestedMatch:0;
     if(requestedMatch&&!games.some(g=>g.match_id===requestedMatch))historyWarning+=(historyWarning?' ':'')+'Linked match is outside the available hero/date/mode/duration filters. Showing an available game instead.';
     await loadAnalysis();
   }catch(e){if(seq===playerSequence)playerError=(e as Error).message;}
   finally{if(seq===playerSequence)playerLoading=false;}
 }
 async function loadGame(){
   const seq=++metadataSequence;match=null;metadataError='';metadataWarning='';metadataFetched='';metadataLoading=false;
   if(!player||!selected||view!=='match')return;
   const id=selected.match_id,account=player.account_id;metadataLoading=true;
   try{
     const r=await api<Result<AnalysisMatch>>('/api/analysis/match/'+id+'?account_ids='+account);
     if(seq!==metadataSequence)return;
     match=r.data;start=0;end=match.duration;metadataFetched=r.fetchedAt;
     metadataWarning=r.stale?'Showing saved match details: '+r.warning:'';
     window.history.replaceState(null,'','?'+new URLSearchParams({p:String(account),hero:String(heroId),match:String(id),days,mode,length}));
   }catch(e){if(seq===metadataSequence)metadataError=(e as Error).message;}
   finally{if(seq===metadataSequence)metadataLoading=false;}
 }
 async function loadAnalysis(){
   const seq=++analysisSequence;++metadataSequence;
   ownCurve=[];peerCurve=[];ownMetrics=null;peerMetrics=null;messages=[];fetched='';match=null;metadataLoading=false;metadataError='';metadataWarning='';metadataFetched='';
   if(!player||!heroId){loading=false;return;}
   if(!games.some(g=>g.match_id===selectedId))selectedId=games[0]?.match_id||0;
   void loadGame();
   loading=true;
   const ownQuery=new URLSearchParams(query(player.account_id));
   let peerQuery:URLSearchParams|null=null;
   if(compare==='player'&&other)peerQuery=new URLSearchParams(query(other.account_id));
   if(compare==='rank'&&rank)peerQuery=new URLSearchParams({...query(),min_average_badge:String(Number(rank)*10+1),max_average_badge:String(Number(rank)*10+6)});
   const tasks:{name:string;kind:'curve'|'metrics';peer:boolean;run:()=>Promise<Result<unknown[]>>}[]=[];
   for(const [params,isPeer] of [[ownQuery,false],[peerQuery,true]] as const){
     if(!params)continue;
     for(const kind of ['curve','metrics'] as const)tasks.push({name:(isPeer?peerLabel:'Your recent games')+' '+kind,kind,peer:isPeer,
       run:()=>api<Result<unknown[]>>('/api/analysis/'+kind+'?'+params)});
   }
   try{
     for(let i=0;i<tasks.length;i+=2){
       const batch=tasks.slice(i,i+2),results=await Promise.allSettled(batch.map(t=>t.run()));
       if(seq!==analysisSequence)return;
       results.forEach((result,j)=>{
         const task=batch[j];
         if(result.status==='rejected'){messages.push(task.name+': '+(result.reason as Error).message);return;}
         const r=result.value;fetched=r.fetchedAt;
         if(r.stale)messages.push(task.name+' · Showing saved data: '+r.warning);
         if(task.kind==='curve'){
           const points=(r.data as CurvePoint[]).filter(p=>p.samples>0&&Number.isFinite(p.game_time)&&p.game_time>=0&&
             (p.game_time<=900?p.game_time%180===0:p.game_time%300===0)).sort((a,b)=>a.game_time-b.game_time);
           if(task.peer)peerCurve=points;else ownCurve=points;
         }else{
           const data=(r.data as Metrics[]).find(p=>p.bucket===heroId)??null;
           if(task.peer)peerMetrics=data;else ownMetrics=data;
         }
       });
     }
   }finally{if(seq===analysisSequence)loading=false;}
 }
 function focusWindow(a:number,b:number){start=a;end=b;document.getElementById('route-section')?.scrollIntoView({block:'start'});}
 function changeView(){void loadGame();}
 onMount(()=>{(async()=>{
   const assets=await Promise.allSettled([api<Result<Hero[]>>('/api/heroes'),api<Result<Rank[]>>('/api/analysis/ranks'),api<Result<MapAsset>>('/api/analysis/map')]);
   if(assets[0].status==='fulfilled')heroes=assets[0].value.data.filter(h=>h.playable);
   if(assets[1].status==='fulfilled')ranks=assets[1].value.data.filter(r=>r.tier>0&&r.tier<=11);
   if(assets[2].status==='fulfilled')map=assets[2].value.data;
   assets.forEach((result,i)=>{
     const name=['Hero assets','Rank assets','Map artwork'][i];
     if(result.status==='rejected')assetWarnings.push(name+' unavailable. Reload the page to retry.');
     else if(result.value.stale)assetWarnings.push(name+' uses saved data: '+result.value.warning);
   });
   const params=new URLSearchParams(location.search);
   if(['14','30','90'].includes(params.get('days')||''))days=params.get('days')!;
   if(['ranked','unranked','ranked,unranked'].includes(params.get('mode')||''))mode=params.get('mode')!;
   if(['any','short','medium','long'].includes(params.get('length')||''))length=params.get('length')!;
   const p=params.get('p');
   let initial=defaultPlayer();
   if(p&&/^\d+$/.test(p)){
     try{initial=(await api<Result<Profile[]>>('/api/search?q='+encodeURIComponent(p))).data[0]??{account_id:Number(p),personaname:'Player '+p};}
     catch{initial={account_id:Number(p),personaname:'Player '+p};}
   }
   booting=false;if(initial)await loadPlayer(initial);
 })();});
</script>

<svelte:head><title>Match Analysis · Deadlook</title></svelte:head>
<PageHeader eyebrow="TURN DATA INTO A NEXT-GAME FOCUS" title="Match Analysis" description="Find when your economy changed, review your tempo, and compare like-for-like.">
 {#snippet actions()}{#if player}<button class="btn" disabled={loading||playerLoading} onclick={loadAnalysis}><IconRefresh size={18}/> Reload analysis</button>{/if}{/snippet}
</PageHeader>
<div class="page-body"><div class="container-xl">
 <section class="card mb-4"><div class="card-body"><PlayerLookup onselect={loadPlayer}/><p class="text-secondary small mt-2 mb-0">Uses your browser’s saved default if available. Searching here does not change it.</p></div></section>
 {#if playerError}<div class="alert alert-danger" role="alert">{playerError}</div>{/if}
 {#if historyWarning}<div class="alert alert-warning" role="status">{historyWarning}</div>{/if}
 {#each assetWarnings as warning}<div class="alert alert-warning" role="status">{warning}</div>{/each}
 {#if booting}<div class="card"><div class="empty" role="status">Loading analysis assets…</div></div>
 {:else if !player}<div class="card"><div class="empty"><IconChartLine size={36} class="text-secondary mb-3"/><p class="empty-title">Choose a player to analyze</p><p class="empty-subtitle text-secondary">Search above or save your default on Match history. No account is preset.</p></div></div>
 {:else}
 <section class="card mb-4"><div class="card-header"><h2 class="card-title">{player.personaname}</h2><span class="text-secondary small ms-auto">Account {player.account_id}</span></div><div class="card-body"><div class="row g-3">
  <div class="col-6 col-lg-2"><label class="form-label" for="analysis-hero">Hero</label><select class="form-select" id="analysis-hero" bind:value={heroId} onchange={loadAnalysis}><option value={0}>Choose hero</option>{#each heroes as h}<option value={h.id}>{h.name}</option>{/each}</select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="analysis-days">Period</label><select class="form-select" id="analysis-days" bind:value={days} onchange={loadAnalysis}><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="analysis-mode">Match mode</label><select class="form-select" id="analysis-mode" bind:value={mode} onchange={loadAnalysis}><option value="ranked,unranked">Ranked + unranked</option><option value="ranked">Ranked only</option><option value="unranked">Unranked only</option></select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="analysis-length">Duration</label><select class="form-select" id="analysis-length" bind:value={length} onchange={loadAnalysis}><option value="any">Any (up to 116m)</option><option value="short">Under 25 min</option><option value="medium">25–40 min</option><option value="long">40+ min</option></select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="analysis-view">View</label><select class="form-select" id="analysis-view" bind:value={view} onchange={changeView}><option value="match">Selected match</option><option value="recent">Recent matches</option></select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="analysis-compare">Compare with</label><select class="form-select" id="analysis-compare" bind:value={compare} onchange={loadAnalysis}><option value="self">My recent games</option><option value="rank">Lobby rank</option><option value="player">Another player</option></select></div>
 </div>
 {#if compare==='rank'}<div class="mt-3"><label class="form-label" for="analysis-rank">Average lobby rank</label><select class="form-select" id="analysis-rank" bind:value={rank} onchange={loadAnalysis}><option value="">Choose a bracket</option>{#each ranks as r}<option value={String(r.tier)}>{r.name}-average lobbies</option>{/each}</select><p class="text-secondary small mt-2 mb-0">Filters average lobby badges, not every individual’s rank. Unranked/unknown lobbies may be excluded. {#if !ranks.length}Rank assets unavailable; reload the page to retry.{/if}</p></div>
 {:else if compare==='player'}<div class="mt-3"><PlayerLookup label="Comparison player" id="comparison-search" onselect={(p)=>{other=p;loadAnalysis();}}/>{#if other}<p class="text-secondary small mt-2 mb-0">Comparing with {other.personaname} · same hero, dates, mode and duration filters.</p>{/if}</div>{/if}
 <p class="text-secondary small mt-3 mb-0">{games.length} available history games · {hero?.name||'Choose a hero'} · {new Date(since*1000).toLocaleDateString()}–{new Date(anchor*1000).toLocaleDateString()}. This date range may cross patches; it is not automatically patch-matched.</p>
 </div></section>
 {#if playerLoading}<p class="text-secondary" role="status">Loading player history…</p>{/if}
 {#if view==='match'}<div class="mb-4"><label class="form-label" for="analysis-game">Match to analyze</label><select class="form-select" id="analysis-game" bind:value={selectedId} onchange={loadGame}><option value={0}>Choose a match</option>{#each games as g}<option value={g.match_id}>#{g.match_id} · {dateTime(g.start_time)} · {outcome(g)} · {time(g.match_duration_s)}</option>{/each}</select>{#if !games.length&&!playerLoading}<p class="text-secondary small mt-2">No games match these filters. Choose another hero or period; API history may be incomplete.</p>{/if}</div>{/if}
 {#if loading}<div class="alert alert-info" role="status"><span class="spinner-border spinner-border-sm me-2"></span>Loading economy benchmarks…</div>{/if}
 {#each messages as message}<div class="alert alert-warning" role="status">{message}</div>{/each}
 {#if metadataWarning}<div class="alert alert-warning" role="status">{metadataWarning}</div>{/if}
 {#if metadataLoading}<p class="text-secondary" role="status">Loading recorded match details…</p>{/if}
 {#if metadataError}<div class="alert alert-warning" role="alert">Detailed match data unavailable: {metadataError}. Recent-game benchmarks can still be used. Analysis does not request missing metadata from Steam.</div>{/if}

 <section class="card mb-4"><div class="card-header"><h2 class="card-title"><IconChartLine size={19} class="me-2"/>Economy over game time</h2></div><div class="card-body">
  <EconomyChart {series} end={view==='match'?match?.duration:undefined}/>
  <p class="text-secondary small mt-3 mb-0">Your recent mean may include this game. Early samples are usually 3 minutes apart, then 5 minutes. Only scheduled benchmark checkpoints are shown. Net worth is not unspent cash or pure income; deaths can reduce it.</p>
 </div></section>

 <section class="card mb-4"><div class="card-header"><h2 class="card-title">Performance comparison</h2></div><div class="table-responsive"><table class="table table-vcenter card-table mb-0"><thead><tr><th>Metric</th>{#if view==='match'}<th>Selected game</th>{/if}<th>Your recent median</th>{#if compare!=='self'}<th>{peerLabel} median</th>{/if}</tr></thead><tbody>
 {#each metrics as [key,label]}{@const own=metric(ownMetrics,key)}{@const peer=metric(peerMetrics,key)}
 <tr><td>{label}</td>{#if view==='match'}<td>{number(selectedMetric(key))}</td>{/if}<td>{number(own?.percentile50)}{#if own?.percentile25!=null}<div class="text-secondary small">Middle 50%: {number(own.percentile25)}–{number(own.percentile75)}</div>{/if}</td>{#if compare!=='self'}<td>{number(peer?.percentile50)}{#if peer?.percentile25!=null}<div class="text-secondary small">Middle 50%: {number(peer.percentile25)}–{number(peer.percentile75)}</div>{/if}</td>{/if}</tr>{/each}
 </tbody></table></div><div class="card-footer text-secondary small">These are approximate distributions of individual games, not player rankings. Metric-distribution sample counts are not supplied by the API. An average player is not a “top X% player” based on these percentiles. Missing readings are —, not zero.</div></section>

 {#if view==='match'&&match}
 <div class="row row-cards mb-4"><div class="col-6"><div class="card"><div class="card-body"><div class="subheader">Recorded death downtime</div><div class="h1 mt-2 mb-1">{downtime===null?'—':time(downtime)}</div><p class="text-secondary small mb-0">{match.deaths.filter(d=>d.duration!==null).length} timed deaths / {number(match.deathCount)} reported deaths</p></div></div></div><div class="col-6"><div class="card"><div class="card-body"><div class="subheader">Detailed coverage</div><div class="h1 mt-2 mb-1">{match.stats.length} <span class="fs-3 text-secondary">checkpoints</span></div><p class="text-secondary small mb-0">{match.route.length.toLocaleString()} recorded position samples</p></div></div></div></div>
 <section class="card mb-4"><div class="card-header"><h2 class="card-title">Where the souls came from</h2></div><div class="card-body">
 {#if selectedSnapshot&&referenceSnapshot&&ownSources&&peerSources}<p class="text-secondary small">Same recorded checkpoint: <strong>{time(selectedSnapshot.time)}</strong> · {referenceSnapshot.samples} comparison snapshots. These categories are not a complete reconciliation of net worth.</p><div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Source</th><th>Your game</th><th>{peerLabel}</th></tr></thead><tbody>
 {#each [['lane','Lane creeps + secured orbs'],['jungle','Neutrals + secured orbs'],['fights','Heroes + assists + secured orbs'],['objectives','Objectives + secured orbs'],['urn','Urn']] as [key,label]}<tr><td>{label}</td><td>{number(ownSources[key as keyof typeof ownSources])}</td><td>{number(peerSources[key as keyof typeof peerSources])}</td></tr>{/each}
 </tbody></table></div>{:else}<p class="text-secondary mb-0">No shared recorded checkpoint with the comparison yet. Choose a comparison with data; values at different times are not substituted.</p>{/if}
 </div></section>
 <section class="card mb-4"><div class="card-header"><h2 class="card-title"><IconRoute size={19} class="me-2"/>Farming tempo by interval</h2></div><div class="card-body"><p class="text-secondary small mb-0">Interval net-worth growth, not exact minute-by-minute earned souls. Income/kill deltas are only shown when both endpoints are available and counters do not decrease. Select an interval to inspect the route.</p></div>
 {#if rows.length}<div class="table-responsive"><table class="table table-vcenter card-table mb-0"><thead><tr><th>Recorded interval</th><th>Net worth / min</th><th>Lane souls / creeps</th><th>Jungle souls / neutrals</th><th>Hero income</th><th>Recorded dead</th></tr></thead><tbody>
 {#each rows as row}<tr><td><button class="btn btn-sm" onclick={()=>focusWindow(row.start,row.end)} aria-label={'View route '+time(row.start)+' to '+time(row.end)}>{time(row.start)}–{time(row.end)}</button></td><td>{number(row.rate)}</td><td>{number(row.lane)} / {number(row.creeps)}</td><td>{number(row.jungle)} / {number(row.neutrals)}</td><td>{number(row.fights)}</td><td>{deathCoverage?time(row.dead):'—'}</td></tr>{/each}
 </tbody></table></div>{:else}<div class="card-body text-secondary">At least two valid snapshots are needed to calculate interval rates.</div>{/if}
 </section>
 <section class="card mb-4" id="route-section"><div class="card-header"><h2 class="card-title">Recorded route & combat tempo</h2><button class="btn btn-sm ms-auto" onclick={()=>focusWindow(0,match!.duration)}>Whole game</button></div><div class="card-body">
 {#if match.route.length}<div class="row g-4"><div class="col-12 col-lg-6"><RouteMap points={match.route} {start} {end} cadence={match.routeInterval||1} {map}/></div><div class="col-12 col-lg-6">
  <div class="row g-3 mb-3"><div class="col-6"><label class="form-label" for="route-start">From: {time(start)}</label><input class="form-range" type="range" id="route-start" min="0" max={Math.max(0,end-1)} step="1" bind:value={start}/></div><div class="col-6"><label class="form-label" for="route-end">To: {time(end)}</label><input class="form-range" type="range" id="route-end" min={start+1} max={match.duration} step="1" bind:value={end}/></div></div>
  {#if windowStats}<h3>Recorded states in this window</h3><dl class="row mb-3">{#each [['neutral','Neutral combat'],['npc','Enemy NPC combat (lane/objectives)'],['player','Hero combat'],['out','Out of combat'],['dead','Recorded dead'],['unknown','Unknown combat state']] as [key,label]}<dt class="col-8 text-secondary fw-normal">{label}</dt><dd class="col-4 text-end">{time(windowStats[key as keyof typeof windowStats])}</dd>{/each}<dt class="col-8 text-secondary fw-normal">Zipline movement (overlaps states)</dt><dd class="col-4 text-end">{time(windowStats.zipline)}</dd></dl><p class="text-secondary small">{time(windowStats.coverage)} sampled coverage / {time(end-start)} window. State duration reflects recorded samples, not a guaranteed continuous activity log.</p>{/if}
  <div class="alert alert-info mb-0">Use the route alongside income changes. Neutral combat does not identify a named camp or prove a clear; NPC combat may include objectives. Out of combat can be travel, setup or waiting—not automatically wasted time.</div>
 </div></div>{:else}<p class="text-secondary mb-0">No supported position samples were included in this match (path version {match.routeVersion??'unknown'}). Farming intervals above remain usable; no route is inferred from income.</p>{/if}
 </div></section>
 <section class="card mb-4"><div class="card-header"><h2 class="card-title"><IconTarget size={19} class="me-2"/>Next-game focus</h2></div><div class="card-body">
 {#if suggestions.length}<div class="row g-3">{#each suggestions as suggestion}<div class="col-12 col-lg-4"><div class="dl-phase h-100"><h3>{suggestion.title}</h3><p class="text-secondary small">{suggestion.evidence}</p><p class="mb-0">{suggestion.action}</p></div></div>{/each}</div>{:else}<p class="text-secondary mb-0">No clear review prompt from the available data. Compare a populated bracket or review your lowest-growth interval. Missing data is not evidence of good or bad play.</p>{/if}
 <p class="text-secondary small mt-3 mb-0">Prompts describe this game, not a proven recurring weakness. Economy prompts need at least 10 comparison snapshots and a material source gap. Review context; these statistics cannot establish the optimal route or the cause of a loss.</p>
 </div></section>
 <details class="mb-4"><summary>Recorded deaths</summary><ul class="list-group mt-2">{#each match.deaths as d}<li class="list-group-item d-flex justify-content-between"><span>At {time(d.time)}</span><span>{d.duration===null?'Duration unavailable':time(d.duration)+' downtime'}</span></li>{:else}<li class="list-group-item text-secondary">No timed death events available.</li>{/each}</ul></details>
 {/if}
 <p class="text-secondary small">Available community API data, not every played match. Benchmark snapshots thin out as games end; longer-game survivors are a different population. {#if fetched}Benchmark fetch: {new Date(fetched).toLocaleString()}. {/if}{#if metadataFetched}Match fetch: {new Date(metadataFetched).toLocaleString()}.{/if} Benchmarks cache for one hour; metadata for 24 hours.</p>
 {/if}
</div></div>
