<script lang="ts">
  import { onMount } from 'svelte';
  import { IconRefresh, IconDownload, IconStar, IconArrowUpRight, IconChevronLeft, IconChevronRight, IconDatabase, IconTrophy, IconTarget, IconClock, IconFilterOff, IconChartLine, IconMapPin, IconAward } from '@tabler/icons-svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import PlayerLookup from '../components/PlayerLookup.svelte';
  import MatchResult from '../components/MatchResult.svelte';
  import Modal from '../components/Modal.svelte';
  import MatchAnalysis from '../components/MatchAnalysis.svelte';
  import { api, duration, type Profile, type Hero, type Match, type Result, type Season } from '../types';
  import { currentSeason, inSeason } from '../seasons.js';
  import { defaultPlayer, savePlayer, clearPlayer } from '../lib/preferences';
  import { dateTime, shortDate, rankName } from '../lib/format';
  import type { PlayerHeroStats, PlayerRank, PlayerRegion, RankAsset } from '../lib/profile-types';
  let player = $state<Profile|null>(null); let home = $state<Profile|null>(null);
  let matches = $state<Match[]>([]); let heroes = $state<Hero[]>([]); let seasons = $state<Season[]>([]);let rankAssets=$state<RankAsset[]>([]);
  let seasonFilter=$state(''); let heroFilter=$state(''); let resultFilter=$state(''); let matchFilter=$state('');
  let page=$state(1); let loading=$state(true); let error=$state(''); let notice=$state(''); let seasonWarning=$state(''); let fetchedAt=$state('');
  let selected=$state<Match|null>(null);
  let rankResult=$state<Result<PlayerRank>|null>(null);let heroStatsResult=$state<Result<PlayerHeroStats[]>|null>(null);let heroSeasonResult=$state<Result<PlayerHeroStats[]>|null>(null);let regionResult=$state<Result<PlayerRegion>|null>(null);
  let heroSeasonFilter=$state('');let heroSeasonError=$state('');let heroSeasonLoading=$state(false);let heroStatsSequence=0;
  let rankError=$state('');let heroStatsError=$state('');let regionError=$state('');let profileLoading=$state(false);
  let sequence=0;let profileSequence=0;
  const heroName=(id:number)=>heroes.find(h=>h.id===id)?.name ?? 'Hero #'+id;
  const heroImage=(id:number)=>heroes.find(h=>h.id===id)?.images?.icon_image_small_webp;
  let activeSeason=$derived(seasons.find(s=>s.class_name===seasonFilter));
  let seasonMatches=$derived(matches.filter(m=>!seasonFilter || inSeason(m.start_time,activeSeason)));
  let availableHeroes=$derived(heroes.filter(h=>seasonMatches.some(m=>m.hero_id===h.id)).sort((a,b)=>a.name.localeCompare(b.name)));
  let filtered=$derived(seasonMatches.filter(m=>(!heroFilter || String(m.hero_id)===heroFilter)&&(!resultFilter || String(m.player_match_outcome)===resultFilter)&&(!matchFilter || String(m.match_id).includes(matchFilter))));
  let pages=$derived(Math.max(1,Math.ceil(filtered.length/25))); let visible=$derived(filtered.slice((page-1)*25,page*25));
  let wins=$derived(filtered.filter(m=>m.player_match_outcome===1).length); let losses=$derived(filtered.filter(m=>m.player_match_outcome===2).length);
  let winRate=$derived(wins+losses?Math.round(wins/(wins+losses)*100):null);
  let kda=$derived(filtered.length?(filtered.reduce((n,m)=>n+(m.player_kills+m.player_assists)/Math.max(1,m.player_deaths),0)/filtered.length).toFixed(2):'—');
  let hours=$derived((filtered.reduce((n,m)=>n+m.match_duration_s,0)/3600).toFixed(1));
  let heroStats=$derived((heroSeasonFilter?heroSeasonResult:heroStatsResult)?.data||[]);
  let activeHeroStatsSeason=$derived(seasons.find(s=>s.class_name===heroSeasonFilter));
  let overviewStats=$derived(heroStatsResult?.data||[]);
  let heroStatsMatches=$derived(overviewStats.reduce((n,h)=>n+h.matches_played,0));
  let heroStatsWins=$derived(overviewStats.reduce((n,h)=>n+h.wins,0));
  let heroStatsKda=$derived(((overviewStats.reduce((n,h)=>n+h.kills+h.assists,0))/Math.max(1,overviewStats.reduce((n,h)=>n+h.deaths,0))).toFixed(2));
  let recentMatches=$derived([...matches].sort((a,b)=>b.start_time-a.start_time).slice(0,5));
  let latestRankedHistory=$derived(matches.filter(m=>m.match_mode===4&&m.ranked_delta!==undefined&&m.ranked_delta!==null).sort((a,b)=>b.start_time-a.start_time)[0]);
  let currentRankAsset=$derived(rankAssets.find(r=>r.tier===rankResult?.data.rank));
  let currentRankName=$derived(currentRankAsset?.name||(rankResult?rankName(rankResult.data.badge):'Rank unavailable'));
  let currentRankImage=$derived.by(()=>{
    const rank=rankResult?.data;if(!rank)return undefined;
    return currentRankAsset?.images?.['large_subrank'+rank.subrank+'_webp']||currentRankAsset?.images?.large_webp||currentRankAsset?.images?.large;
  });
  let totalMvpRanked=$derived(overviewStats.reduce((n,h)=>n+(h.mvp_rank_counts?.[0]||0),0));
  let totalMvpTop3=$derived(overviewStats.reduce((n,h)=>n+(h.mvp_rank_counts||[]).reduce((a,b)=>a+b,0),0));
  let totalMvpSamples=$derived(overviewStats.reduce((n,h)=>n+(h.mvp_rated_matches||0),0));
  function heroWinRate(stat:PlayerHeroStats){return stat.matches_played?Math.round(stat.wins/stat.matches_played*100):null;}
  function regionSampleCount(data:PlayerRegion){return data.region_month===undefined||data.region_month===null?0:(data.history||[]).filter(m=>m.month===data.region_month&&m.region).reduce((n,m)=>n+m.matches,0);}
  function heroKda(stat:PlayerHeroStats){return ((stat.kills+stat.assists)/Math.max(1,stat.deaths)).toFixed(2);}
  function clearFilters(){heroFilter='';resultFilter='';matchFilter='';page=1;}
  function defaultHeroSeason(){return seasons.find(s=>s.class_name.toLowerCase()==='season_2'||s.name.trim().toLowerCase()==='beta season 2')?.class_name||currentSeason(seasons,Date.now()/1000);}
  async function loadHeroSeason(){
    if(!player)return;const seq=++heroStatsSequence;const selected=seasons.find(s=>s.class_name===heroSeasonFilter);
    heroSeasonError='';
    if(!selected){heroSeasonResult=heroStatsResult;heroSeasonLoading=false;return;}
    const intervals=selected.intervals||[];if(!intervals.length){heroSeasonResult=null;heroSeasonError='Season dates are unavailable.';heroSeasonLoading=false;return;}
    const min=Math.min(...intervals.map(i=>i.start_timestamp));const max=Math.max(...intervals.map(i=>i.end_timestamp))-1;
    heroSeasonResult=null;heroSeasonLoading=true;
    try{const result=await api<Result<PlayerHeroStats[]>>(`/api/players/${player.account_id}/hero-stats?min_unix_timestamp=${min}&max_unix_timestamp=${max}`);if(seq===heroStatsSequence)heroSeasonResult=result;}
    catch(e){if(seq===heroStatsSequence)heroSeasonError=(e as Error).message;}
    finally{if(seq===heroStatsSequence)heroSeasonLoading=false;}
  }
  async function loadProfile(profile:Profile,refresh=false){
    const seq=++profileSequence;++heroStatsSequence;if(!refresh){heroSeasonFilter=defaultHeroSeason();heroSeasonResult=null;heroSeasonError='';heroSeasonLoading=false;}profileLoading=true;rankError='';heroStatsError='';regionError='';
    if(!refresh){rankResult=null;heroStatsResult=null;regionResult=null;}
    const suffix=refresh?'?refresh=1':'';
    if(heroSeasonFilter)void loadHeroSeason();
    const tasks=[
      api<Result<PlayerRank>>('/api/players/'+profile.account_id+'/rank'+suffix).then(result=>{if(seq===profileSequence)rankResult=result;}).catch(e=>{if(seq===profileSequence)rankError=(e as Error).message;}),
      api<Result<PlayerHeroStats[]>>('/api/players/'+profile.account_id+'/hero-stats'+suffix).then(result=>{if(seq===profileSequence){heroStatsResult=result;if(!heroSeasonFilter)heroSeasonResult=result;}}).catch(e=>{if(seq===profileSequence)heroStatsError=(e as Error).message;}),
      api<Result<PlayerRegion>>('/api/players/'+profile.account_id+'/region'+suffix).then(result=>{if(seq===profileSequence)regionResult=result;}).catch(e=>{if(seq===profileSequence)regionError=(e as Error).message;})
    ];
    await Promise.all(tasks);
    if(seq===profileSequence)profileLoading=false;
  }
  async function load(profile:Profile,refresh=false){
    const seq=++sequence;if(player?.account_id!==profile.account_id)selected=null;player=profile;loading=true;error='';notice='';loadProfile(profile,refresh);
    const params=new URLSearchParams(location.search);if(params.has('p')){params.set('p',String(profile.account_id));params.delete('match');params.delete('hero');window.history.replaceState(null,'','/'+(params.size?'?'+params:''));}
    if(!refresh){matches=[];fetchedAt='';clearFilters();}
    try{const result=await api<Result<Match[]>>('/api/players/'+profile.account_id+'/history'+(refresh?'?refresh=1':''));if(seq!==sequence)return;
      matches=result.data;fetchedAt=result.fetchedAt;notice=result.stale?'Showing saved data: '+result.warning:refresh&&result.cached?'Using the recent snapshot. Refresh has a one-minute cooldown.':'';
    }catch(e){if(seq===sequence)error=(e as Error).message;}finally{if(seq===sequence)loading=false;}
  }
  function remember(){if(!player)return;try{savePlayer(player);home=player;notice='Default player saved for this browser.';}catch{notice='Browser storage is unavailable; default could not be saved.';}}
  function forget(){try{clearPlayer();++sequence;++profileSequence;++heroStatsSequence;selected=null;home=null;player=null;matches=[];rankResult=null;heroStatsResult=null;heroSeasonResult=null;heroSeasonFilter='';heroSeasonError='';heroSeasonLoading=false;regionResult=null;profileLoading=false;fetchedAt='';loading=false;error='';clearFilters();notice='Default player cleared for this browser.';}catch{notice='Browser storage is unavailable; default could not be cleared.';}}
  function exportHistory(){const url=URL.createObjectURL(new Blob([JSON.stringify(matches,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='deadlook-'+player?.account_id+'-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function openMatch(match:Match){
    if(!player)return;selected=match;
    const existing=new URLSearchParams(location.search),params=new URLSearchParams();
    const filters:{[key:string]:string[]}={days:['14','30','90'],mode:['ranked','unranked','ranked,unranked'],length:['any','short','medium','long']};
    for(const [key,allowed] of Object.entries(filters)){const value=existing.get(key);if(value&&allowed.includes(value))params.set(key,value);}
    params.set('p',String(player.account_id));params.set('hero',String(match.hero_id));params.set('match',String(match.match_id));
    window.history.replaceState(null,'','/?'+params);
  }
  function closeMatch(){selected=null;const params=new URLSearchParams(location.search);params.delete('match');params.delete('hero');window.history.replaceState(null,'','/'+(params.size?'?'+params:''));}
  function accountId(value:string|null):number|null{if(!value||!/^\d{1,20}$/.test(value))return null;try{let id=BigInt(value);if(id>=76561197960265728n)id-=76561197960265728n;return id>0n&&id<=4294967295n?Number(id):null;}catch{return null;}}
  onMount(()=>{(async()=>{
    const assets=await Promise.allSettled([api<Result<Hero[]>>('/api/heroes'),api<Result<Season[]>>('/api/seasons'),api<Result<RankAsset[]>>('/api/analysis/ranks')]);
    if(assets[0].status==='fulfilled')heroes=assets[0].value.data;
    if(assets[1].status==='fulfilled'){seasons=assets[1].value.data.filter(s=>s.ranked_type==='normal'&&s.intervals.length).sort((a,b)=>b.intervals[0].start_timestamp-a.intervals[0].start_timestamp);seasonFilter=currentSeason(seasons,Date.now()/1000);if(assets[1].value.stale)seasonWarning='Using cached season dates.';}
    else seasonWarning='Season dates are unavailable. All-time history remains available.';
    if(assets[2].status==='fulfilled')rankAssets=assets[2].value.data;
    const params=new URLSearchParams(location.search);const requestedAccount=accountId(params.get('p'));
    const hasMatchLink=location.pathname==='/analysis.html'||params.has('match');
    const requestedMatch=hasMatchLink&&requestedAccount&&/^\d{1,15}$/.test(params.get('match')||'')?Number(params.get('match')):0;
    try{try{home=await defaultPlayer();}catch(e){if(!requestedAccount)throw e;}let initial=requestedAccount?{account_id:requestedAccount,personaname:'Player '+requestedAccount}:home;
      if(requestedAccount){try{const found=(await api<Result<Profile[]>>('/api/search?q='+requestedAccount)).data.find(p=>p.account_id===requestedAccount);if(found)initial=found;}catch{}}
      if(initial){await load(initial);if(requestedMatch){const match=matches.find(m=>m.match_id===requestedMatch);if(match)openMatch(match);else notice='The linked match is not present in this player’s available history.';}}
    }catch(e){error=(e as Error).message;}finally{loading=false;}
  })();});
</script>

<svelte:head><title>{player?player.personaname+' · ':''}Deadlook</title></svelte:head>
<PageHeader eyebrow="PLAYER INTELLIGENCE" title="Player Profile" description="Rank, hero performance and recent matches from available API data.">
 {#snippet actions()}{#if player}<button class="btn" onclick={exportHistory} disabled={!matches.length}><IconDownload size={18}/> Export JSON</button><button class="btn btn-primary" disabled={loading||profileLoading} onclick={()=>load(player!,true)}><IconRefresh size={18} class={loading||profileLoading?'spin':''}/> {loading||profileLoading?'Syncing…':'Sync profile'}</button>{/if}{/snippet}
</PageHeader>
<div class="page-body"><div class="container-xl">
 <div class="card mb-4"><div class="card-body"><PlayerLookup onselect={(p)=>{load(p);}}/><p class="text-secondary small mt-2 mb-0">Names aren’t unique. Use an account ID for an exact match.</p></div></div>
 {#if error}<div class="alert alert-danger" role="alert">{error}</div>{/if}
 {#if notice}<div class="alert alert-info" role="status">{notice}</div>{/if}
 {#if loading && !matches.length}<div class="card"><div class="empty" role="status"><div class="spinner-border text-primary mb-3"></div><p class="empty-title">Loading match history</p><p class="empty-subtitle text-secondary">Retrieving available games from Deadlock API.</p></div></div>
 {:else if player}
  <div class="d-flex flex-wrap gap-3 align-items-center mb-4">
   {#if player.avatarmedium}<img class="avatar avatar-lg" src={player.avatarmedium} alt="" referrerpolicy="no-referrer"/>{/if}
   <div><h2 class="mb-1">{player.personaname}</h2><div class="text-secondary small font-monospace">Account {player.account_id}</div></div>
   <div class="ms-auto"><button class="btn btn-sm" disabled={home?.account_id===player.account_id} onclick={remember}><IconStar size={16}/> {home?.account_id===player.account_id?'Default player':'Make my default'}</button>{#if home && home.account_id!==player.account_id}<button class="btn btn-sm ms-2" onclick={()=>load(home!)}>My player</button>{/if}{#if home}<button class="btn btn-sm ms-2" onclick={forget}>Clear default</button>{/if}</div>
  </div>
  <div class="row row-cards mb-4" aria-label="Player overview">
   <div class="col-12 col-md-6 col-xl-3"><section class="card h-100"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Current rank</div><IconTrophy class="text-primary" size={19}/></div>
    {#if rankResult}<div class="d-flex align-items-center gap-2 mt-2 mb-1">{#if currentRankImage}<img class="dl-rank-badge" src={currentRankImage} alt="" loading="lazy"/>{/if}<div class="h2 mb-0">{currentRankName}</div></div><div class="text-secondary small">API badge {rankResult.data.badge} · not MMR</div><div class="text-secondary dl-micro mt-1">Data fetched {new Date(rankResult.fetchedAt).toLocaleDateString()}</div>
     {#if rankResult.data.last_match}<div class="text-secondary small mt-2">Latest ranked match {dateTime(rankResult.data.last_match.start_time)}</div>{#if latestRankedHistory?.match_id===rankResult.data.last_match.match_id}<div class="small mt-1">Latest match rank progress: {(latestRankedHistory.ranked_delta??0)>0?'+':''}{latestRankedHistory.ranked_delta??'—'} points</div>{/if}
     {:else}<div class="text-secondary small mt-2">No recent ranked match with a reported rank; may be unranked or in placements.</div>{/if}
     {#if rankResult.stale}<div class="text-warning small mt-2">Using cached rank: {rankResult.warning}</div>{/if}{#if rankError}<div class="text-warning small mt-2">Refresh failed: {rankError}</div>{/if}
    {:else if rankError}<div class="text-secondary small mt-2" role="status">Rank unavailable: {rankError}</div>
    {:else if profileLoading}<div class="text-secondary small mt-2" role="status">Loading rank…</div>{:else}<div class="text-secondary small mt-2">No rank data available.</div>{/if}
   </div></section></div>
   <div class="col-6 col-md-6 col-xl-3"><section class="card h-100"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Recent server region</div><IconMapPin class="text-secondary" size={19}/></div>
    {#if regionResult}<div class="h2 mt-2 mb-1 text-break">{regionResult.data.region?.replaceAll('_',' ')||'Unavailable'}</div><div class="text-secondary small">{regionResult.data.region_month?'Most matches in '+new Date(regionResult.data.region_month*1000).toLocaleDateString(undefined,{month:'short',year:'numeric'})+' · '+regionSampleCount(regionResult.data)+' matches with a known region':'No known server region in available match data.'}</div><div class="text-secondary dl-micro mt-2">API fetched {new Date(regionResult.fetchedAt).toLocaleDateString()}</div>{#if regionResult.stale}<div class="text-warning small mt-2">Using cached region data: {regionResult.warning}</div>{/if}{#if regionError}<div class="text-warning small mt-2">Refresh failed: {regionError}</div>{/if}
    {:else if regionError}<div class="text-secondary small mt-2" role="status">Region unavailable: {regionError}</div>
    {:else if profileLoading}<div class="text-secondary small mt-2" role="status">Loading region…</div>{:else}<div class="text-secondary small mt-2">No region data available.</div>{/if}
   </div></section></div>
   <div class="col-6 col-md-6 col-xl-3"><section class="card h-100"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">API hero stats · all dates</div><IconChartLine class="text-secondary" size={19}/></div>
    {#if heroStatsResult}<div class="h2 mt-2 mb-1">{heroStatsMatches.toLocaleString()} matches</div><div class="text-secondary small">{overviewStats.length} heroes · aggregate KDA {overviewStats.length?heroStatsKda:'—'} · {heroStatsWins.toLocaleString()} wins</div><div class="text-secondary dl-micro mt-2">API fetched {new Date(heroStatsResult.fetchedAt).toLocaleDateString()}</div>{#if heroStatsResult.stale}<div class="text-warning small mt-2">Using cached hero stats: {heroStatsResult.warning}</div>{/if}{#if heroStatsError}<div class="text-warning small mt-2">Refresh failed: {heroStatsError}</div>{/if}
    {:else if heroStatsError}<div class="text-secondary small mt-2" role="status">Hero stats unavailable: {heroStatsError}</div>
    {:else if profileLoading}<div class="text-secondary small mt-2" role="status">Loading hero stats…</div>{:else}<div class="text-secondary small mt-2">No hero stats available.</div>{/if}
   </div></section></div>
   <div class="col-6 col-md-6 col-xl-3"><section class="card h-100"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">MVP placements</div><IconAward class="text-secondary" size={19}/></div>
    {#if heroStatsResult&&totalMvpSamples}<div class="h2 mt-2 mb-1">{totalMvpRanked} MVP · {totalMvpTop3} top 3</div><div class="text-secondary small">Across {totalMvpSamples} MVP-rated hero games across all available dates; older data may be missing.</div>
    {:else if heroStatsResult}<div class="text-secondary small mt-2">No MVP-rated match data available.</div>
    {:else if profileLoading}<div class="text-secondary small mt-2" role="status">Loading MVP stats…</div>{:else}<div class="text-secondary small mt-2">MVP stats unavailable.</div>{/if}
   </div></section></div>
  </div>
  <div class="row row-cards mb-2" aria-label="Statistics for filtered matches"><div class="col-12"><h2 class="h3 mb-0">History summary <span class="text-secondary fw-normal fs-4">· current filters</span></h2></div></div>
  <div class="row row-cards mb-4" aria-label="Statistics for filtered matches">
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Recorded matches</div><IconDatabase class="text-secondary" size={19}/></div><div class="h1 mt-2 mb-1">{filtered.length.toLocaleString()}</div><div class="text-secondary small">{matches.length.toLocaleString()} retained all time</div></div></div></div>
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Scored win rate</div><IconTrophy class="text-primary" size={19}/></div><div class="h1 mt-2 mb-1 text-primary">{winRate===null?'—':winRate+'%'}</div><div class="text-secondary small">{wins} wins · {losses} losses</div></div></div></div>
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Average KDA</div><IconTarget class="text-secondary" size={19}/></div><div class="h1 mt-2 mb-1">{kda}</div><div class="text-secondary small" title="Mean of each match’s (kills + assists) / max(1, deaths)">Per-match KDA average</div></div></div></div>
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Time in matches</div><IconClock class="text-secondary" size={19}/></div><div class="h1 mt-2 mb-1">{hours}<span class="text-secondary fs-3 ms-1">h</span></div><div class="text-secondary small">In the filtered history</div></div></div></div>
  </div>
  <section class="card mb-4" aria-labelledby="hero-stats-heading"><div class="card-header d-flex flex-wrap gap-3 align-items-center"><div><h2 class="card-title" id="hero-stats-heading">Hero performance</h2><div class="text-secondary small">Deadlock API aggregate · normal mode · ranked + unranked · {heroSeasonFilter?'selected season date range':'all available API dates'}</div></div><div class="ms-auto"><label class="form-label" for="hero-season-filter">Hero stats season</label><select class="form-select" id="hero-season-filter" bind:value={heroSeasonFilter} onchange={loadHeroSeason}><option value="">All available dates</option>{#each seasons as s}<option value={s.class_name}>{s.name}</option>{/each}</select></div></div>
   {#if (activeHeroStatsSeason?.intervals.length??0)>1}<div class="card-body text-secondary small border-bottom">This season has multiple intervals; API stats use their outer date bounds and may include gaps between intervals.</div>{/if}
   {#if heroSeasonError&&!heroStats.length}<div class="card-body"><div class="alert alert-warning mb-0" role="status">Hero performance couldn’t be loaded: {heroSeasonError}</div></div>
   {:else if heroSeasonLoading}<div class="card-body" role="status"><span class="spinner-border spinner-border-sm me-2"></span>Loading hero statistics…</div>
   {:else if heroStatsError&&!heroStatsResult}<div class="card-body"><div class="alert alert-warning mb-0" role="status">Hero performance couldn’t be loaded: {heroStatsError}</div></div>
   {:else if profileLoading&&!heroStatsResult}<div class="card-body" role="status"><span class="spinner-border spinner-border-sm me-2"></span>Loading hero statistics…</div>
   {:else if heroStats.length}<div class="table-responsive"><table class="table table-vcenter card-table table-hover mb-0"><thead><tr><th>Hero</th><th>Games</th><th>Win rate</th><th>Aggregate KDA</th><th>Kills / min</th><th>Deaths / min</th><th>Assists / min</th><th>Souls / min</th><th>Damage / min</th><th>Objective damage / min</th></tr></thead><tbody>
    {#each [...heroStats].sort((a,b)=>b.matches_played-a.matches_played) as stat}<tr>
     <td><div class="d-flex align-items-center gap-2">{#if heroImage(stat.hero_id)}<img class="avatar avatar-sm" loading="lazy" src={heroImage(stat.hero_id)} alt=""/>{/if}<span class="fw-semibold text-nowrap">{heroName(stat.hero_id)}</span></div></td>
     <td class="font-monospace">{stat.matches_played}</td><td>{heroWinRate(stat)===null?'—':heroWinRate(stat)+'%'}<div class="text-secondary small">{stat.wins} wins</div></td>
     <td class="font-monospace" title="Aggregate (kills + assists) / max(1, deaths)">{heroKda(stat)}</td><td class="font-monospace">{stat.kills_per_min?.toFixed(2)??'—'}</td><td class="font-monospace">{stat.deaths_per_min?.toFixed(2)??'—'}</td><td class="font-monospace">{stat.assists_per_min?.toFixed(2)??'—'}</td><td class="font-monospace">{stat.networth_per_min?.toFixed(0)??'—'}</td><td class="font-monospace">{stat.damage_per_min?.toFixed(0)??'—'}</td><td class="font-monospace">{stat.obj_damage_per_min?.toFixed(0)??'—'}</td>
    </tr>{/each}</tbody></table></div><div class="card-body text-secondary small">Win rate and aggregate KDA use API hero-stat totals. A hero’s sample size is shown; this dataset can differ in coverage from the match history below.</div>
   {:else if heroSeasonFilter&&heroSeasonResult}<div class="empty"><p class="empty-title">No hero statistics for this season</p><p class="empty-subtitle text-secondary">The API returned no hero data in {activeHeroStatsSeason?.name??'the selected season'}.</p></div>
   {:else if heroStatsResult}<div class="empty"><p class="empty-title">No hero statistics available</p><p class="empty-subtitle text-secondary">The API returned no hero data for this player.</p></div>
   {:else}<div class="empty"><p class="empty-title">Hero statistics unavailable</p><p class="empty-subtitle text-secondary">Try syncing again later.</p></div>{/if}
  </section>
  <section class="card mb-4" aria-labelledby="recent-heading"><div class="card-header"><h2 class="card-title" id="recent-heading">Latest recorded matches</h2><span class="text-secondary small ms-auto">Quick preview · click to inspect</span></div>
   {#if recentMatches.length}<div class="card-body"><div class="dl-recent-matches">{#each recentMatches as match}<button class="btn dl-recent-match" onclick={()=>openMatch(match)} aria-label={'Inspect '+(match.player_match_outcome===1?'win':match.player_match_outcome===2?'loss':'match')+' as '+heroName(match.hero_id)+', '+match.player_kills+' kills '+match.player_deaths+' deaths '+match.player_assists+' assists'}><span class="d-flex justify-content-between align-items-center w-100"><MatchResult {match}/><span class="text-secondary dl-micro">{dateTime(match.start_time)}</span></span><strong class="mt-2">{heroName(match.hero_id)}</strong><span class="font-monospace small">{match.player_kills}/{match.player_deaths}/{match.player_assists}</span><span class="text-secondary small">{(match.net_worth/1000).toFixed(1)}k souls · {duration(match.match_duration_s)}</span>{#if match.ranked_delta!==undefined&&match.ranked_delta!==null}<span class="badge bg-secondary-lt mt-2" title="Rank progress change, not MMR">Rank progress {match.ranked_delta>0?'+':''}{match.ranked_delta}</span>{/if}</button>{/each}</div></div>
   {:else if loading}<div class="card-body text-secondary" role="status">Loading recent matches…</div>{:else}<div class="empty"><p class="empty-title">No recent match previews</p><p class="empty-subtitle text-secondary">No available match-history records to preview.</p></div>{/if}
  </section>
  <section class="card" aria-labelledby="history-heading">
   <div class="card-header"><h2 class="card-title" id="history-heading">Matches</h2><span class="badge bg-primary-lt ms-2">{filtered.length}</span><span class="ms-auto text-secondary small d-none d-md-inline">Newest first</span></div>
   <div class="card-body border-bottom"><div class="row g-3">
    <div class="col-6 col-lg-3"><label class="form-label" for="season">Season</label><select class="form-select" id="season" bind:value={seasonFilter} onchange={clearFilters}><option value="">All time</option>{#each seasons as s}<option value={s.class_name}>{s.name}</option>{/each}</select></div>
    <div class="col-6 col-lg-3"><label class="form-label" for="hero-filter">Hero</label><select class="form-select" id="hero-filter" bind:value={heroFilter} onchange={()=>page=1}><option value="">All heroes</option>{#each availableHeroes as h}<option value={h.id}>{h.name}</option>{/each}</select></div>
    <div class="col-6 col-lg-2"><label class="form-label" for="result-filter">Result</label><select class="form-select" id="result-filter" bind:value={resultFilter} onchange={()=>page=1}><option value="">All results</option><option value="1">Win</option><option value="2">Loss</option><option value="3">Penalized</option><option value="4">Party penalty</option><option value="5">Not scored</option><option value="0">Unknown</option></select></div>
    <div class="col-6 col-lg-4"><label class="form-label" for="match-filter">Match ID</label><div class="input-group"><input class="form-control" id="match-filter" bind:value={matchFilter} oninput={()=>page=1} placeholder="Search match IDs…" inputmode="numeric"/><button class="btn btn-icon" title="Clear filters" aria-label="Clear hero, result and match filters" onclick={clearFilters}><IconFilterOff size={18}/></button></div></div>
   </div><p class="text-secondary small mt-3 mb-0">{#if activeSeason}{activeSeason.intervals.map(i=>shortDate(i.start_timestamp)+' – '+shortDate(i.end_timestamp)).join(' · ')} · All game modes within season dates.{:else}All available matches, including games before ranked seasons.{/if}{#if seasonWarning} {seasonWarning}{/if}</p></div>
   {#if visible.length}<div class="table-responsive"><table class="table table-vcenter card-table table-hover mb-0"><thead><tr><th>Result / Match</th><th>Hero</th><th>K / D / A</th><th>Souls</th><th>Duration</th><th>Played</th><th><span class="visually-hidden">Details</span></th></tr></thead><tbody>
    {#each visible as match}<tr class:dl-win={match.player_match_outcome===1} class:dl-loss={match.player_match_outcome===2}>
     <td><MatchResult {match}/><div class="text-secondary small font-monospace mt-1">#{match.match_id}</div></td>
     <td><div class="d-flex align-items-center gap-2">{#if heroImage(match.hero_id)}<img class="avatar avatar-sm" loading="lazy" src={heroImage(match.hero_id)} alt=""/>{/if}<div><span class="fw-semibold text-nowrap">{heroName(match.hero_id)}</span><div class="text-secondary small">Level {match.hero_level}</div></div></div></td>
     <td class="font-monospace text-nowrap">{match.player_kills}<span class="text-secondary px-1">/</span>{match.player_deaths}<span class="text-secondary px-1">/</span>{match.player_assists}</td>
     <td class="font-monospace">{(match.net_worth/1000).toFixed(1)}k</td><td class="font-monospace">{duration(match.match_duration_s)}</td><td class="text-secondary text-nowrap small" title={shortDate(match.start_time)}>{dateTime(match.start_time)}</td><td><button class="btn btn-sm btn-icon btn-ghost-secondary" aria-label={'Details for match '+match.match_id} onclick={()=>openMatch(match)}><IconArrowUpRight size={18}/></button></td>
    </tr>{/each}</tbody></table></div>
    <div class="card-footer d-flex flex-wrap align-items-center justify-content-between gap-3"><span class="text-secondary small">{(page-1)*25+1}–{Math.min(page*25,filtered.length)} of {filtered.length} matches</span><div class="d-flex align-items-center gap-3"><button class="btn btn-sm" disabled={page<=1} onclick={()=>page--}><IconChevronLeft size={16}/> Previous</button><span class="text-secondary small">{page} / {pages}</span><button class="btn btn-sm" disabled={page>=pages} onclick={()=>page++}>Next <IconChevronRight size={16}/></button></div></div>
   {:else}<div class="empty"><p class="empty-title">No matches in this view</p><p class="empty-subtitle text-secondary">Try another season or clear your filters. Only available API matches are shown.</p></div>{/if}
  </section>
  {#if fetchedAt}<p class="text-secondary small mt-3">Last successful API fetch: {new Date(fetchedAt).toLocaleString()}.</p>{/if}
 {:else}<div class="card"><div class="empty"><p class="empty-title">Start with a player</p><p class="empty-subtitle text-secondary">Search above, then save your player as the default for this browser.</p></div></div>{/if}
</div></div>
<Modal open={!!selected} title={'Match report · #'+(selected?.match_id??'')} onclose={closeMatch}>
 {#if selected&&player}<div class="dl-match-summary mb-4"><div class="d-flex flex-wrap gap-3 align-items-center mb-3"><div>{#if heroImage(selected.hero_id)}<img class="avatar avatar-md me-2" src={heroImage(selected.hero_id)} alt=""/>{/if}<strong>{heroName(selected.hero_id)}</strong><div class="text-secondary small">{dateTime(selected.start_time)} · {duration(selected.match_duration_s)}</div></div><MatchResult match={selected}/><span class="badge bg-secondary-lt">Level {selected.hero_level}</span><span class="font-monospace ms-auto">K/D/A {selected.player_kills}/{selected.player_deaths}/{selected.player_assists}</span></div>
  <div class="row g-2"><div class="col-6 col-md-3"><div class="card"><div class="card-body"><div class="subheader">KDA ratio</div><strong>{((selected.player_kills+selected.player_assists)/Math.max(1,selected.player_deaths)).toFixed(2)}</strong></div></div></div><div class="col-6 col-md-3"><div class="card"><div class="card-body"><div class="subheader">Net worth / min</div><strong>{selected.match_duration_s>0?(selected.net_worth/(selected.match_duration_s/60)).toFixed(0):'—'}</strong></div></div></div><div class="col-6 col-md-3"><div class="card"><div class="card-body"><div class="subheader">Last hits / min</div><strong>{selected.match_duration_s>0?(selected.last_hits/(selected.match_duration_s/60)).toFixed(1):'—'}</strong></div></div></div><div class="col-6 col-md-3"><div class="card"><div class="card-body"><div class="subheader">Denies / min</div><strong>{selected.match_duration_s>0?(selected.denies/(selected.match_duration_s/60)).toFixed(1):'—'}</strong></div></div></div></div>
  {#if selected.ranked_delta!==undefined&&selected.ranked_delta!==null}<p class="text-secondary small mt-3 mb-0">Rank progress {selected.ranked_delta>0?'+':''}{selected.ranked_delta} points · not MMR</p>{/if}
 </div>
 {#key selected.match_id}<MatchAnalysis player={player} {selected} history={matches} ranks={rankAssets.filter(r=>r.tier>0&&r.tier<=11).map(r=>({tier:r.tier,name:r.name}))}/>{/key}
 <details class="mt-3"><summary>Raw history entry</summary><pre class="dl-code">{JSON.stringify(selected,null,2)}</pre></details>{/if}
</Modal>
