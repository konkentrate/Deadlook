<script lang="ts">
 import { onDestroy, onMount } from 'svelte';
 import { IconRoute, IconTarget } from '@tabler/icons-svelte';
 import EconomyChart, { type Series } from './EconomyChart.svelte';
 import PlayerLookup from './PlayerLookup.svelte';
 import RouteMap from './RouteMap.svelte';
 import { api, duration, type Profile, type Match, type Result } from '../types';
 import { intervals, sources, activity, deadSeconds, sharedCheckpoint, focusSuggestions } from '../lib/analysis.js';
 import type { AnalysisMatch, CurvePoint, Metrics, Metric, Rank, MapAsset } from '../lib/analysis-types';

 let { player, selected, history, ranks }: { player:Profile; selected:Match; history:Match[]; ranks:Rank[] } = $props();
 let other=$state<Profile|null>(null),compare=$state('self'),rank=$state('');
 const initialParams=new URLSearchParams(location.search);
 let days=$state(['14','30','90'].includes(initialParams.get('days')||'')?initialParams.get('days')!:'30');
 let mode=$state(['ranked','unranked','ranked,unranked'].includes(initialParams.get('mode')||'')?initialParams.get('mode')!:'ranked,unranked');
 let length=$state(['any','short','medium','long'].includes(initialParams.get('length')||'')?initialParams.get('length')!:'any');
 let match=$state<AnalysisMatch|null>(null),map=$state<MapAsset|null>(null),ownCurve=$state<CurvePoint[]>([]),peerCurve=$state<CurvePoint[]>([]);
 let ownMetrics=$state<Metrics|null>(null),peerMetrics=$state<Metrics|null>(null);
 let loading=$state(true),metadataLoading=$state(true),mapLoading=$state(false),metadataError=$state(''),mapError=$state('');
 let messages=$state<string[]>([]),fetched=$state(''),metadataFetched=$state(''),metadataWarning=$state('');
 let start=$state(0),end=$state(0),matchSequence=0,benchmarkSequence=0;
 const anchor=Math.floor(Date.now()/300000)*300;
 const number=(n:number|null|undefined,digits=0)=>n==null||!Number.isFinite(n)?'—':n.toLocaleString(undefined,{maximumFractionDigits:digits});
 const time=(n:number)=>duration(Math.round(n));
 let since=$derived(anchor-Number(days)*86400);
 let bounds=$derived(length==='short'?[0,1499]:length==='medium'?[1500,2399]:length==='long'?[2400,7000]:[0,7000]);
 let games=$derived(history.filter(m=>m.hero_id===selected.hero_id&&m.game_mode===1&&
   (mode==='ranked,unranked'?[1,4].includes(m.match_mode):m.match_mode===(mode==='ranked'?4:1))&&
   m.start_time>=since&&m.start_time<=anchor&&m.match_duration_s>=bounds[0]&&m.match_duration_s<=bounds[1]).sort((a,b)=>b.start_time-a.start_time));
 let peerLabel=$derived(compare==='player'?(other?.personaname||'Selected player'):
   compare==='rank'?(ranks.find(r=>String(r.tier)===rank)?.name||'Selected rank')+'-average lobbies':'Your recent mean');
 let reference=$derived(compare==='self'?ownCurve:peerCurve);
 let rows=$derived(match?intervals(match.stats,match.deaths):[]);
 let sharedTime=$derived(match?sharedCheckpoint(match.stats,reference):null);
 let selectedSnapshot=$derived(match&&sharedTime!==null?match.stats.find(s=>s.time===sharedTime):undefined);
 let referenceSnapshot=$derived(sharedTime!==null?reference.find(p=>p.game_time===sharedTime):undefined);
 let ownSources=$derived(selectedSnapshot?sources(selectedSnapshot):null);
 let peerSources=$derived(referenceSnapshot?sources(referenceSnapshot,'_avg'):null);
 let windowStats=$derived(match?activity(match.route,match.routeInterval??0,start,end):null);
 let suggestions=$derived(focusSuggestions(match,reference));
 let deathCoverage=$derived(!!match && match.deaths.length===match.deathCount && match.deaths.every(d=>d.duration!==null));
 let downtime=$derived(match&&deathCoverage?deadSeconds(match.deaths,0,match.duration):null);
 let series=$derived.by(()=>{
   const result:Series[]=[];
   if(match)result.push({name:'Selected game',kind:'selected',points:match.stats.map(p=>({time:p.time,value:p.net_worth}))});
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
   return {hero_ids:String(selected.hero_id),min_unix_timestamp:String(since),max_unix_timestamp:String(anchor),match_mode:mode,
     min_duration_s:String(bounds[0]),max_duration_s:String(bounds[1]),...(account?{account_ids:String(account)}:{})};
 }
 function pushMessage(message:string){messages=[...messages,message];}
 async function loadSelectedMatch(seq:number){
   metadataLoading=true;metadataError='';metadataWarning='';metadataFetched='';
   try{
     const result=await api<Result<AnalysisMatch>>(`/api/analysis/match/${selected.match_id}?account_ids=${player.account_id}`);
     if(seq!==matchSequence)return;
     match=result.data;start=0;end=match.duration;metadataFetched=result.fetchedAt;
     metadataWarning=result.stale?'Showing saved match details: '+result.warning:'';
     if(result.data.route.length&&!map){mapLoading=true;try{const asset=await api<Result<MapAsset>>('/api/analysis/map');if(seq===matchSequence){map=asset.data;if(asset.stale)pushMessage('Map artwork uses saved data: '+asset.warning);}}catch(e){if(seq===matchSequence)mapError=(e as Error).message;}finally{if(seq===matchSequence)mapLoading=false;}}
   }catch(e){if(seq===matchSequence)metadataError=(e as Error).message;}
   finally{if(seq===matchSequence)metadataLoading=false;}
 }
 async function loadAnalysis(){
   const seq=++benchmarkSequence;ownCurve=[];peerCurve=[];ownMetrics=null;peerMetrics=null;messages=[];fetched='';
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
       if(seq!==benchmarkSequence)return;
       results.forEach((result,j)=>{
         const task=batch[j];
         if(result.status==='rejected'){pushMessage(task.name+': '+(result.reason as Error).message);return;}
         const r=result.value;fetched=r.fetchedAt;if(r.stale)pushMessage(task.name+' · Showing saved data: '+r.warning);
         if(task.kind==='curve'){
           const points=(r.data as CurvePoint[]).filter(p=>p.samples>0&&Number.isFinite(p.game_time)&&p.game_time>=0&&
             (p.game_time<=900?p.game_time%180===0:p.game_time%300===0)).sort((a,b)=>a.game_time-b.game_time);
           if(task.peer)peerCurve=points;else ownCurve=points;
         }else{
           const data=(r.data as Metrics[]).find(p=>p.bucket===selected.hero_id)??null;
           if(task.peer)peerMetrics=data;else ownMetrics=data;
         }
       });
     }
   }finally{if(seq===benchmarkSequence)loading=false;}
 }
 function focusWindow(a:number,b:number){start=a;end=b;document.getElementById('route-section')?.scrollIntoView({block:'nearest'});}
 function selectPlayer(p:Profile){other=p;void loadAnalysis();}
 function selectFilters(){const params=new URLSearchParams(location.search);params.set('days',days);params.set('mode',mode);params.set('length',length);window.history.replaceState(null,'','/'+(params.size?'?'+params:''));void loadAnalysis();}
 onMount(()=>{void loadSelectedMatch(++matchSequence);void loadAnalysis();});
 onDestroy(()=>{++matchSequence;++benchmarkSequence;});
</script>

<section class="card mb-3"><div class="card-header"><h3 class="card-title">Compare against recent games</h3><span class="badge bg-secondary-lt ms-auto">{games.length} matching history games</span></div><div class="card-body"><div class="row g-3">
 <div class="col-6 col-lg-3"><label class="form-label" for="analysis-days">Period</label><select class="form-select" id="analysis-days" bind:value={days} onchange={selectFilters}><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
 <div class="col-6 col-lg-3"><label class="form-label" for="analysis-mode">Match mode</label><select class="form-select" id="analysis-mode" bind:value={mode} onchange={selectFilters}><option value="ranked,unranked">Ranked + unranked</option><option value="ranked">Ranked only</option><option value="unranked">Unranked only</option></select></div>
 <div class="col-6 col-lg-3"><label class="form-label" for="analysis-length">Duration</label><select class="form-select" id="analysis-length" bind:value={length} onchange={selectFilters}><option value="any">Any duration</option><option value="short">Under 25 min</option><option value="medium">25–40 min</option><option value="long">40+ min</option></select></div>
 <div class="col-6 col-lg-3"><label class="form-label" for="analysis-compare">Compare with</label><select class="form-select" id="analysis-compare" bind:value={compare} onchange={selectFilters}><option value="self">My recent games</option><option value="rank">Average lobby rank</option><option value="player">Another player</option></select></div>
 </div>
 {#if compare==='rank'}<div class="mt-3"><label class="form-label" for="analysis-rank">Average lobby rank</label><select class="form-select" id="analysis-rank" bind:value={rank} onchange={selectFilters}><option value="">Choose a bracket</option>{#each ranks as r}<option value={String(r.tier)}>{r.name}-average lobbies</option>{/each}</select><p class="text-secondary small mt-2 mb-0">Filters average lobby badges, not each player’s personal rank. Unranked/unknown lobbies may be excluded.</p></div>
 {:else if compare==='player'}<div class="mt-3"><PlayerLookup label="Comparison player" id="comparison-search" onselect={selectPlayer}/>{#if other}<p class="text-secondary small mt-2 mb-0">Comparing against {other.personaname} · same hero, dates, mode and duration filters.</p>{/if}</div>{/if}
 <p class="text-secondary small mt-3 mb-0">Selected hero: {selected.hero_id} · {new Date(since*1000).toLocaleDateString()}–{new Date(anchor*1000).toLocaleDateString()}. This range may cross patches and the selected match may be outside it. Your recent comparison can include this game.</p>
 </div></section>
{#if loading}<div class="alert alert-info" role="status"><span class="spinner-border spinner-border-sm me-2"></span>Loading match benchmarks…</div>{/if}
{#if metadataLoading}<p class="text-secondary" role="status">Loading recorded match details…</p>{/if}
{#if metadataError}<div class="alert alert-warning" role="alert">Detailed match data unavailable: {metadataError}. The history summary remains available; no Steam fallback is requested.</div>{/if}
{#if metadataWarning}<div class="alert alert-warning" role="status">{metadataWarning}</div>{/if}
{#if mapError}<div class="alert alert-warning" role="status">Map artwork unavailable: {mapError}. The route uses a coordinate grid.</div>{/if}
{#each messages as message}<div class="alert alert-warning" role="status">{message}</div>{/each}

<section class="card mb-3"><div class="card-header"><h3 class="card-title">Economy over game time</h3></div><div class="card-body"><EconomyChart {series} end={match?.duration}/><p class="text-secondary small mt-3 mb-0">Net worth is not unspent cash or pure income; deaths can reduce it. Comparisons use scheduled checkpoints and may include different surviving-game populations.</p></div></section>
<section class="card mb-3"><div class="card-header"><h3 class="card-title">Performance comparison</h3></div><div class="table-responsive"><table class="table table-vcenter card-table mb-0"><thead><tr><th>Metric</th><th>Selected match</th><th>Your recent median</th>{#if compare!=='self'}<th>{peerLabel} median</th>{/if}</tr></thead><tbody>
 {#each metrics as [key,label]}{@const own=metric(ownMetrics,key)}{@const peer=metric(peerMetrics,key)}<tr><td>{label}</td><td class="font-monospace">{number(selectedMetric(key))}</td><td>{number(own?.percentile50)}{#if own?.percentile25!=null}<div class="text-secondary small">Middle 50%: {number(own.percentile25)}–{number(own.percentile75)}</div>{/if}</td>{#if compare!=='self'}<td>{number(peer?.percentile50)}{#if peer?.percentile25!=null}<div class="text-secondary small">Middle 50%: {number(peer.percentile25)}–{number(peer.percentile75)}</div>{/if}</td>{/if}</tr>{/each}
 </tbody></table></div><div class="card-footer text-secondary small">Per-game percentiles are approximate distributions, not player ranks; API sample counts aren’t supplied. Missing values are unavailable, not zero.</div></section>
{#if match}
<div class="row row-cards mb-3"><div class="col-6"><div class="card"><div class="card-body"><div class="subheader">Recorded death downtime</div><div class="h2 mt-2 mb-1">{downtime===null?'—':time(downtime)}</div><p class="text-secondary small mb-0">{match.deaths.filter(d=>d.duration!==null).length} timed deaths / {number(match.deathCount)} reported deaths</p></div></div></div><div class="col-6"><div class="card"><div class="card-body"><div class="subheader">Detailed coverage</div><div class="h2 mt-2 mb-1">{match.stats.length} <span class="fs-3 text-secondary">checkpoints</span></div><p class="text-secondary small mb-0">{match.route.length.toLocaleString()} recorded position samples</p></div></div></div></div>
<section class="card mb-3"><div class="card-header"><h3 class="card-title">Income sources at a shared checkpoint</h3></div><div class="card-body">
 {#if selectedSnapshot&&referenceSnapshot&&ownSources&&peerSources}<p class="text-secondary small">Same recorded checkpoint: <strong>{time(selectedSnapshot.time)}</strong> · {referenceSnapshot.samples} comparison snapshots. These categories are not a complete reconciliation of net worth.</p><div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Source</th><th>Selected match</th><th>{peerLabel}</th></tr></thead><tbody>{#each [['lane','Lane creeps + secured orbs'],['jungle','Neutrals + secured orbs'],['fights','Heroes + secured orbs'],['objectives','Objectives + secured orbs'],['urn','Urn']] as [key,label]}<tr><td>{label}</td><td>{number(ownSources[key as keyof typeof ownSources])}</td><td>{number(peerSources[key as keyof typeof peerSources])}</td></tr>{/each}</tbody></table></div>
 {:else}<p class="text-secondary mb-0">No shared recorded checkpoint. Values at different times are not substituted.</p>{/if}
</div></section>
<section class="card mb-3"><div class="card-header"><h3 class="card-title"><IconRoute size={19} class="me-2"/>Farming tempo by interval</h3></div><div class="card-body"><p class="text-secondary small mb-0">Interval net-worth growth is not exact earned souls. Source/kill deltas need both valid endpoints. Select an interval to inspect its route.</p></div>
 {#if rows.length}<div class="table-responsive"><table class="table table-vcenter card-table mb-0"><thead><tr><th>Recorded interval</th><th>Net worth / min</th><th>Lane souls / creeps</th><th>Jungle souls / neutrals</th><th>Hero income</th><th>Recorded dead</th></tr></thead><tbody>{#each rows as row}<tr><td><button class="btn btn-sm" onclick={()=>focusWindow(row.start,row.end)} aria-label={'View route '+time(row.start)+' to '+time(row.end)}>{time(row.start)}–{time(row.end)}</button></td><td>{number(row.rate)}</td><td>{number(row.lane)} / {number(row.creeps)}</td><td>{number(row.jungle)} / {number(row.neutrals)}</td><td>{number(row.fights)}</td><td>{deathCoverage?time(row.dead):'—'}</td></tr>{/each}</tbody></table></div>{:else}<div class="card-body text-secondary">At least two valid snapshots are needed to calculate intervals.</div>{/if}
</section>
<section class="card mb-3" id="route-section"><div class="card-header"><h3 class="card-title">Recorded route & combat tempo</h3><button class="btn btn-sm ms-auto" onclick={()=>focusWindow(0,match!.duration)}>Whole game</button></div><div class="card-body">
 {#if match.route.length}<div class="row g-4"><div class="col-12 col-lg-6"><RouteMap points={match.route} {start} {end} cadence={match.routeInterval||1} {map}/></div><div class="col-12 col-lg-6">
 <div class="row g-3 mb-3"><div class="col-6"><label class="form-label" for="route-start">From: {time(start)}</label><input class="form-range" type="range" id="route-start" min="0" max={Math.max(0,end-1)} step="1" bind:value={start}/></div><div class="col-6"><label class="form-label" for="route-end">To: {time(end)}</label><input class="form-range" type="range" id="route-end" min={start+1} max={match.duration} step="1" bind:value={end}/></div></div>
 {#if windowStats}<h4>Recorded states in this window</h4><dl class="row mb-3">{#each [['neutral','Neutral combat'],['npc','Enemy NPC combat (lane/objectives)'],['player','Hero combat'],['out','Out of combat'],['dead','Recorded dead'],['unknown','Unknown combat state']] as [key,label]}<dt class="col-8 text-secondary fw-normal">{label}</dt><dd class="col-4 text-end">{time(windowStats[key as keyof typeof windowStats])}</dd>{/each}<dt class="col-8 text-secondary fw-normal">Zipline movement (overlaps states)</dt><dd class="col-4 text-end">{time(windowStats.zipline)}</dd></dl><p class="text-secondary small">{time(windowStats.coverage)} sampled coverage / {time(end-start)} window. Gaps aren’t counted as idle time.</p>{/if}
 <div class="alert alert-info mb-0">Neutral combat doesn’t identify a named camp or prove a clear. Out of combat can mean travel or setup, not wasted time.</div>
 </div></div>{:else}<p class="text-secondary mb-0">No supported position samples were included (path version {match.routeVersion??'unknown'}). No route is inferred from income.</p>{/if}
</div></section>
<section class="card mb-3"><div class="card-header"><h3 class="card-title"><IconTarget size={19} class="me-2"/>Next-game focus</h3></div><div class="card-body">
 {#if suggestions.length}<div class="row g-3">{#each suggestions as suggestion}<div class="col-12 col-lg-4"><div class="dl-phase h-100"><h4>{suggestion.title}</h4><p class="text-secondary small">{suggestion.evidence}</p><p class="mb-0">{suggestion.action}</p></div></div>{/each}</div>{:else}<p class="text-secondary mb-0">No clear review prompt from the available data. Missing data is not evidence of good or bad play.</p>{/if}
 <p class="text-secondary small mt-3 mb-0">Prompts describe this game, not a proven recurring weakness. They cannot establish an optimal route or cause of a loss.</p>
</div></section>
<details class="mb-3"><summary>Recorded deaths</summary><ul class="list-group mt-2">{#each match.deaths as d}<li class="list-group-item d-flex justify-content-between"><span>At {time(d.time)}</span><span>{d.duration===null?'Duration unavailable':time(d.duration)+' downtime'}</span></li>{:else}<li class="list-group-item text-secondary">No recorded death events.</li>{/each}</ul></details>
{/if}
<p class="text-secondary small">Available API data, not every played match. Benchmark checkpoints and match metadata can have different coverage. {#if fetched}Benchmark fetch: {new Date(fetched).toLocaleString()}. {/if}{#if metadataFetched}Match fetch: {new Date(metadataFetched).toLocaleString()}.{/if}</p>
