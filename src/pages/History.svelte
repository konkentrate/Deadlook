<script lang="ts">
  import { onMount } from 'svelte';
  import { IconRefresh, IconDownload, IconStar, IconArrowUpRight, IconChevronLeft, IconChevronRight, IconDatabase, IconTrophy, IconTarget, IconClock, IconFilterOff } from '@tabler/icons-svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import PlayerLookup from '../components/PlayerLookup.svelte';
  import MatchResult from '../components/MatchResult.svelte';
  import Modal from '../components/Modal.svelte';
  import { api, duration, type Profile, type Hero, type Match, type Result, type Season } from '../types';
  import { currentSeason, inSeason } from '../seasons.js';
  import { defaultPlayer, savePlayer } from '../lib/preferences';
  import { dateTime, shortDate } from '../lib/format';
  let player = $state<Profile|null>(null); let home = $state<Profile|null>(null);
  let matches = $state<Match[]>([]); let heroes = $state<Hero[]>([]); let seasons = $state<Season[]>([]);
  let seasonFilter=$state(''); let heroFilter=$state(''); let resultFilter=$state(''); let matchFilter=$state('');
  let page=$state(1); let loading=$state(true); let error=$state(''); let notice=$state(''); let seasonWarning=$state(''); let fetchedAt=$state('');
  let selected=$state<Match|null>(null); let metadata=$state(''); let metadataError=$state(''); let metadataLoading=$state(false);
  let sequence=0; let detailSequence=0;
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
  function clearFilters(){heroFilter='';resultFilter='';matchFilter='';page=1;}
  async function load(profile:Profile,refresh=false){
    const seq=++sequence; player=profile;loading=true;error='';notice='';
    if(!refresh){matches=[];fetchedAt='';clearFilters();}
    try{const result=await api<Result<Match[]>>('/api/players/'+profile.account_id+'/history'+(refresh?'?refresh=1':''));if(seq!==sequence)return;
      matches=result.data;fetchedAt=result.fetchedAt;notice=result.stale?'Showing saved data: '+result.warning:refresh&&result.cached?'Using the recent snapshot. Refresh has a one-minute cooldown.':'';
    }catch(e){if(seq===sequence)error=(e as Error).message;}finally{if(seq===sequence)loading=false;}
  }
  function remember(){if(!player)return;try{savePlayer(player);home=player;notice='Default player saved for this browser.';}catch{notice='Browser storage is unavailable; default could not be saved.';}}
  function exportHistory(){const url=URL.createObjectURL(new Blob([JSON.stringify(matches,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='deadlook-'+player?.account_id+'-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function openMatch(match:Match){++detailSequence;selected=match;metadata='';metadataError='';metadataLoading=false;}
  async function getMetadata(){if(!selected)return;const seq=++detailSequence;metadataLoading=true;metadataError='';
    try{const result=await api<Result<unknown>>('/api/matches/'+selected.match_id+'/metadata');if(seq===detailSequence)metadata=JSON.stringify(result.data,null,2);}catch(e){if(seq===detailSequence)metadataError=(e as Error).message;}finally{if(seq===detailSequence)metadataLoading=false;}}
  onMount(()=>{(async()=>{
    const assets=await Promise.allSettled([api<Result<Hero[]>>('/api/heroes'),api<Result<Season[]>>('/api/seasons')]);
    if(assets[0].status==='fulfilled')heroes=assets[0].value.data;
    if(assets[1].status==='fulfilled'){seasons=assets[1].value.data.filter(s=>s.ranked_type==='normal'&&s.intervals.length).sort((a,b)=>b.intervals[0].start_timestamp-a.intervals[0].start_timestamp);seasonFilter=currentSeason(seasons,Date.now()/1000);if(assets[1].value.stale)seasonWarning='Using cached season dates.';}
    else seasonWarning='Season dates are unavailable. All-time history remains available.';
    try{home=await defaultPlayer();if(home)await load(home);}catch(e){error=(e as Error).message;}finally{loading=false;}
  })();});
</script>

<svelte:head><title>{player?player.personaname+' · ':''}Deadlook</title></svelte:head>
<PageHeader eyebrow="PLAYER INTELLIGENCE" title="Match history" description="A closer look at every game. Find your form, follow your progress.">
 {#snippet actions()}{#if player}<button class="btn" onclick={exportHistory} disabled={!matches.length}><IconDownload size={18}/> Export JSON</button><button class="btn btn-primary" disabled={loading} onclick={()=>load(player!,true)}><IconRefresh size={18} class={loading?'spin':''}/> {loading?'Syncing…':'Sync history'}</button>{/if}{/snippet}
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
   <div class="ms-auto"><button class="btn btn-sm" disabled={home?.account_id===player.account_id} onclick={remember}><IconStar size={16}/> {home?.account_id===player.account_id?'Default player':'Make my default'}</button>{#if home && home.account_id!==player.account_id}<button class="btn btn-sm ms-2" onclick={()=>load(home!)}>My player</button>{/if}</div>
  </div>
  <div class="row row-cards mb-4" aria-label="Statistics for filtered matches">
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Recorded matches</div><IconDatabase class="text-secondary" size={19}/></div><div class="h1 mt-2 mb-1">{filtered.length.toLocaleString()}</div><div class="text-secondary small">{matches.length.toLocaleString()} retained all time</div></div></div></div>
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Scored win rate</div><IconTrophy class="text-primary" size={19}/></div><div class="h1 mt-2 mb-1 text-primary">{winRate===null?'—':winRate+'%'}</div><div class="text-secondary small">{wins} wins · {losses} losses</div></div></div></div>
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Average KDA</div><IconTarget class="text-secondary" size={19}/></div><div class="h1 mt-2 mb-1">{kda}</div><div class="text-secondary small" title="Mean of each match’s (kills + assists) / max(1, deaths)">Per-match KDA average</div></div></div></div>
   <div class="col-6 col-lg-3"><div class="card"><div class="card-body"><div class="d-flex align-items-center justify-content-between"><div class="subheader">Time in matches</div><IconClock class="text-secondary" size={19}/></div><div class="h1 mt-2 mb-1">{hours}<span class="text-secondary fs-3 ms-1">h</span></div><div class="text-secondary small">In the filtered history</div></div></div></div>
  </div>
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
<Modal open={!!selected} title={'Match inspector · #'+(selected?.match_id??'')} onclose={()=>{++detailSequence;selected=null;}}>
 {#if selected}<p class="text-secondary">Raw player history entry. Detailed metadata is fetched only when requested.</p><pre class="dl-code">{JSON.stringify(selected,null,2)}</pre><button class="btn btn-primary" disabled={metadataLoading||!!metadata} onclick={getMetadata}>{metadataLoading?'Fetching metadata…':metadata?'Metadata loaded':'Fetch detailed metadata'}</button><p class="text-secondary small mt-2">A history entry does not guarantee detailed metadata is available.</p>{#if metadataError}<div class="alert alert-danger" role="alert">{metadataError}</div>{/if}{#if metadata}<pre class="dl-code">{metadata}</pre>{/if}{/if}
</Modal>
