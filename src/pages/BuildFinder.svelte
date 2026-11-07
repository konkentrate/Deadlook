<script lang="ts">
 import { onMount } from 'svelte';
 import { IconRefresh, IconUsers, IconStack2, IconChevronLeft, IconChevronRight, IconExternalLink, IconTarget, IconClock, IconTrophy, IconSearch } from '@tabler/icons-svelte';
 import PageHeader from '../components/PageHeader.svelte';
 import PlayerLookup from '../components/PlayerLookup.svelte';
 import MatchResult from '../components/MatchResult.svelte';
 import ItemGrid from '../components/ItemGrid.svelte';
 import AbilityStrip from '../components/AbilityStrip.svelte';
 import { api,duration,type Profile,type Hero,type Season,type Match,type Result } from '../types';
 import { currentSeason,inSeason } from '../seasons.js';
 import { defaultPlayer } from '../lib/preferences';
 import { dateTime,rankName } from '../lib/format';
 import type { Item,RankedPlayer,LeaderboardResult,ItemStat,AbilityOrder,MatchMetadata,Purchase,Tile } from '../lib/build-types';

 let heroes=$state<Hero[]>([]);let seasons=$state<Season[]>([]);let items=$state<Item[]>([]);
 let heroId=$state(1);let seasonId=$state('');let days=$state('30');let mode=$state('both');let sort=$state('rank');let minimum=$state('5');let heroQuery=$state('');
 let rankings=$state<RankedPlayer[]>([]);let listLoading=$state(false);let listError=$state('');let fetchedAt=$state('');let stale=$state(false);let listWarning=$state('');let assetWarning=$state('');let booting=$state(true);
 let preferenceNotice=$state('');let player=$state<Profile|null>(null);let history=$state<Match[]>([]);let playerLoading=$state(false);let playerError=$state('');
 let stats=$state<ItemStat[]>([]);let orders=$state<AbilityOrder[]>([]);let analyticsLoading=$state(false);let itemError=$state('');let abilityError=$state('');
 let gameIndex=$state(0);let purchases=$state<Purchase[]>([]);let metadataLoading=$state(false);let metadataError=$state('');
 let listSequence=0;let playerSequence=0;let matchSequence=0;
 const phases=[{name:'Early game',range:'0–10 min'},{name:'Mid game',range:'10–25 min'},{name:'Late game',range:'25 min +'}];
 const phase=(seconds:number)=>seconds<600?0:seconds<1500?1:2;
 const getItem=(id:number)=>items.find(it=>it.id===id);
 const heroImage=(h:Hero)=>h.images?.icon_hero_card_webp||h.images?.icon_image_small_webp;
 let hero=$derived(heroes.find(h=>h.id===heroId));
 let displayedHeroes=$derived(heroes.filter(h=>h.name.toLowerCase().includes(heroQuery.toLowerCase())));
 let activeSeason=$derived(seasons.find(s=>s.class_name===seasonId));
 let since=$derived(activeSeason?Math.min(...activeSeason.intervals.map(i=>i.start_timestamp)):Math.floor(Date.now()/300000)*300-Number(days)*86400);
 let until=$derived(activeSeason?Math.max(...activeSeason.intervals.map(i=>i.end_timestamp)):undefined);
 let period=$derived(activeSeason?.name||'Last '+days+' days');
 let games=$derived(history.filter(m=>m.hero_id===heroId&&m.game_mode===1&&(mode==='ranked'?m.match_mode===4:[1,4].includes(m.match_mode))&&(activeSeason?inSeason(m.start_time,activeSeason):m.start_time>=since)).sort((a,b)=>b.start_time-a.start_time));
 let wins=$derived(games.filter(m=>m.player_match_outcome===1).length);let losses=$derived(games.filter(m=>m.player_match_outcome===2).length);
 let kda=$derived(((games.reduce((n,m)=>n+m.player_kills+m.player_assists,0))/Math.max(1,games.reduce((n,m)=>n+m.player_deaths,0))).toFixed(1));
 let selectedGame=$derived(games[gameIndex]);
 let selectedPlayerIndex=$derived(rankings.findIndex(p=>p.account_id===player?.account_id));
 let denominator=$derived(Math.max(games.length,...stats.map(s=>s.matches),0));
 let typical=$derived(stats.filter(s=>getItem(s.item_id)?.type==='upgrade'&&denominator&&s.matches/denominator>=0.2).sort((a,b)=>a.avg_buy_time_s-b.avg_buy_time_s));
 let abilitySummary=$derived.by(()=>{
   const counts=new Map<string,number>();const valid=orders.filter(o=>o.abilities?.length>=6);
   for(const order of valid){const key=order.abilities.slice(0,12).join(',');counts.set(key,(counts.get(key)||0)+order.matches);}
   const best=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
   return {ids:best?best[0].split(',').map(Number):[],matches:best?.[1]||0,total:valid.reduce((n,o)=>n+o.matches,0)};
 });
 let exactItems=$derived(purchases.filter(p=>getItem(p.item_id)?.type!=='ability'));
 let exactAbilities=$derived(purchases.filter(p=>getItem(p.item_id)?.type==='ability').map(p=>p.item_id));
 function typicalTiles(index:number):Tile[]{return typical.filter(s=>phase(s.avg_buy_time_s)===index).map(s=>({item:getItem(s.item_id),id:s.item_id,label:Math.round(s.matches/denominator*100)+'%',time:duration(Math.round(s.avg_buy_time_s)),core:s.matches/denominator>=0.6}));}
 function exactTiles(index:number):Tile[]{return exactItems.filter(p=>phase(p.game_time_s)===index).map(p=>({item:getItem(p.item_id),id:p.item_id,label:duration(p.game_time_s),time:p.sold_time_s?'Sold '+duration(p.sold_time_s):undefined,sold:!!p.sold_time_s}));}
 function score(p:RankedPlayer){return sort==='winrate'?(p.value<=1?p.value*100:p.value).toFixed(1)+'%':Math.round(p.value).toLocaleString();}
 function query(){return {hero_id:String(heroId),min_unix_timestamp:String(since),...(until?{max_unix_timestamp:String(until)}:{}),match_mode:mode==='ranked'?'ranked':'ranked,unranked'};}
 function share(){if(player)window.history.replaceState(null,'','#hero='+heroId+'&p='+player.account_id);}
 async function loadRankings(keepPlayer=true,refresh=false){
   const seq=++listSequence;const retained=keepPlayer?player:null;++playerSequence;++matchSequence;
   listLoading=true;listError='';listWarning='';rankings=[];history=[];stats=[];orders=[];purchases=[];gameIndex=0;playerLoading=false;analyticsLoading=false;metadataLoading=false;
   const params=new URLSearchParams({...query(),sort_by:sort,min_matches:minimum,...(refresh?{refresh:'1'}:{})});
   try{const r=await api<LeaderboardResult>('/api/finder/leaderboard?'+params);if(seq!==listSequence)return;
     rankings=r.data;fetchedAt=r.fetchedAt;stale=r.stale;listWarning=[r.warning,r.profileWarning].filter(Boolean).join(' ');
     if(retained)loadPlayer(retained);else if(rankings[0])loadPlayer(rankings[0]);else player=null;
   }catch(e){if(seq===listSequence){listError=(e as Error).message;if(retained)loadPlayer(retained);else player=null;}}
   finally{if(seq===listSequence)listLoading=false;}
 }
 async function chooseHero(id:number){heroId=id;await loadRankings(false);}
 async function loadPlayer(p:Profile){
   const seq=++playerSequence;++matchSequence;preferenceNotice='';player=p;share();playerLoading=true;playerError='';history=[];stats=[];orders=[];purchases=[];gameIndex=0;itemError='';abilityError='';metadataError='';analyticsLoading=false;metadataLoading=false;
   try{const r=await api<Result<Match[]>>('/api/players/'+p.account_id+'/history');if(seq!==playerSequence)return;
    history=r.data;if(r.stale)playerError='Showing saved history: '+r.warning;
    if(games.length){loadGame(0);loadAnalytics(p.account_id,seq);}
   }catch(e){if(seq===playerSequence)playerError=(e as Error).message;}finally{if(seq===playerSequence)playerLoading=false;}
 }
 async function loadAnalytics(id:number,seq:number){
   analyticsLoading=true;const common={...query(),account_ids:String(id)};
   const [itemResult,abilityResult]=await Promise.allSettled([
     api<Result<ItemStat[]>>('/api/finder/item-stats?'+new URLSearchParams({...common,hero_ids:String(heroId)})),
     api<Result<AbilityOrder[]>>('/api/finder/ability-order-stats?'+new URLSearchParams(common))
   ]);if(seq!==playerSequence)return;
   if(itemResult.status==='fulfilled'){stats=itemResult.value.data;if(itemResult.value.stale)itemError='Using cached item analytics: '+itemResult.value.warning;}else itemError=itemResult.reason.message;
   if(abilityResult.status==='fulfilled'){orders=abilityResult.value.data;if(abilityResult.value.stale)abilityError='Using cached ability analytics: '+abilityResult.value.warning;}else abilityError=abilityResult.reason.message;
   analyticsLoading=false;
 }
 async function loadGame(index:number){
   if(index<0||index>=games.length||!player)return;
   const match=games[index];const account=player.account_id;const seq=++matchSequence;
   gameIndex=index;purchases=[];metadataLoading=true;metadataError='';
   try{const r=await api<Result<MatchMetadata>>('/api/matches/'+match.match_id+'/metadata');if(seq!==matchSequence)return;
     const info=r.data.match_info||r.data;const participant=info.players?.find(p=>p.account_id===account);
     if(!participant)throw new Error('This player was not found in the available match metadata.');
     purchases=[...(participant.items||[])].sort((a,b)=>a.game_time_s-b.game_time_s);
     if(r.stale)metadataError='Using saved metadata: '+r.warning;
   }catch(e){if(seq===matchSequence)metadataError=(e as Error).message;}finally{if(seq===matchSequence)metadataLoading=false;}
 }
 function directPlayer(p:Profile){++listSequence;listLoading=false;loadPlayer(p);}
 async function myPlayer(){try{const p=await defaultPlayer();if(p)directPlayer(p);else preferenceNotice='Save a default player on Match history first.';}catch(e){preferenceNotice=(e as Error).message;}}
 function keyboard(e:KeyboardEvent){
   if(e.target instanceof Element&&e.target.closest('input,textarea,select,button,a'))return;
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.key==='ArrowRight'&&rankings[selectedPlayerIndex+1]){e.preventDefault();loadPlayer(rankings[selectedPlayerIndex+1]);}
   if(e.key==='ArrowLeft'&&selectedPlayerIndex>0){e.preventDefault();loadPlayer(rankings[selectedPlayerIndex-1]);}
   if(e.key==='.')loadGame(gameIndex+1);if(e.key===',')loadGame(gameIndex-1);
 }
 onMount(()=>{(async()=>{
   const results=await Promise.allSettled([api<Result<Hero[]>>('/api/heroes'),api<Result<Season[]>>('/api/seasons'),api<Result<Item[]>>('/api/finder/items')]);
   if(results[0].status==='fulfilled')heroes=results[0].value.data.filter(h=>h.playable!==false);
   else assetWarning='Hero assets unavailable; refresh to retry.';
   if(results[1].status==='fulfilled'){seasons=results[1].value.data.filter(s=>s.ranked_type==='normal'&&s.intervals.length).sort((a,b)=>b.intervals[0].start_timestamp-a.intervals[0].start_timestamp);seasonId=currentSeason(seasons,Date.now()/1000);}
   else assetWarning+=' Season dates unavailable; using recent matches.';
   if(results[2].status==='fulfilled')items=results[2].value.data;else assetWarning+=' Item assets unavailable; item IDs will be shown.';
   const hash=new URLSearchParams(location.hash.slice(1));const hid=Number(hash.get('hero'));heroId=heroes.some(h=>h.id===hid)?hid:heroes[0]?.id||1;
   const pid=Number(hash.get('p'));if(Number.isInteger(pid)&&pid>0&&pid<=4294967295)player={account_id:pid,personaname:'Player '+pid};
   booting=false;if(heroes.length)loadRankings(!!player);
 })();});
</script>

<svelte:head><title>Build Finder · Deadlook</title></svelte:head>
<svelte:window onkeydown={keyboard}/>
<PageHeader eyebrow="BUILD INTELLIGENCE" title="Build Finder" description="Follow the players. Understand the choices. Find your next build.">
 {#snippet actions()}<button class="btn" onclick={myPlayer} disabled={booting}><IconTarget size={18}/> My player</button><button class="btn btn-primary" disabled={booting||listLoading} onclick={()=>loadRankings(true,true)}><IconRefresh size={18} class={listLoading?'spin':''}/> Refresh players</button>{/snippet}
</PageHeader>
<div class="page-body"><div class="container-xl">
 {#if preferenceNotice}<div class="alert alert-info" role="status">{preferenceNotice}</div>{/if}
 {#if assetWarning}<div class="alert alert-warning" role="status">{assetWarning}</div>{/if}
 <div class="card mb-4"><div class="card-body"><div class="row g-3">
  <div class="col-6 col-lg-3"><label class="form-label" for="season">Season</label><select id="season" class="form-select" bind:value={seasonId} onchange={()=>loadRankings()} disabled={booting}><option value="">Recent time window</option>{#each seasons as s}<option value={s.class_name}>{s.name}</option>{/each}</select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="days">Time window</label><select id="days" class="form-select" bind:value={days} onchange={()=>{seasonId='';loadRankings();}} disabled={booting||!!seasonId}><option value="14">14 days</option><option value="30">30 days</option><option value="60">60 days</option></select></div>
  <div class="col-6 col-lg-3"><label class="form-label" for="mode">Match type</label><select id="mode" class="form-select" bind:value={mode} onchange={()=>loadRankings()} disabled={booting}><option value="both">Ranked + unranked</option><option value="ranked">Ranked only</option></select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="sort">Rank players by</label><select id="sort" class="form-select" bind:value={sort} onchange={()=>loadRankings()} disabled={booting}><option value="rank">Rank points</option><option value="winrate">Win rate</option><option value="matches">Matches played</option></select></div>
  <div class="col-6 col-lg-2"><label class="form-label" for="minimum">Minimum games</label><select id="minimum" class="form-select" bind:value={minimum} onchange={()=>loadRankings()} disabled={booting}><option value="5">5 games</option><option value="10">10 games</option><option value="20">20 games</option></select></div>
 </div></div></div>

 <section class="card mb-4" aria-labelledby="hero-heading"><div class="card-header flex-wrap gap-2"><h2 id="hero-heading" class="card-title">Choose your hero</h2><span class="badge bg-primary-lt">{hero?.name||'Loading'}</span><div class="ms-auto input-icon"><span class="input-icon-addon"><IconSearch size={17}/></span><input class="form-control form-control-sm" aria-label="Filter heroes" placeholder="Filter heroes…" bind:value={heroQuery}/></div></div>
 <div class="card-body"><div class="dl-hero-grid">
  {#each displayedHeroes as h}<button class="dl-hero" class:active={heroId===h.id} aria-pressed={heroId===h.id} aria-label={h.name} onclick={()=>chooseHero(h.id)}>{#if heroImage(h)}<img src={heroImage(h)} alt="" loading="lazy"/>{/if}<span>{h.name}</span></button>{/each}
  {#if !displayedHeroes.length}<p class="text-secondary mb-0">{booting?'Loading heroes…':'No heroes match this search.'}</p>{/if}
 </div></div></section>

 <div class="row row-cards align-items-start">
  <aside class="col-12 col-lg-4">
   <section class="card mb-4" aria-labelledby="rankings-heading"><div class="card-header"><div><h2 id="rankings-heading" class="card-title"><IconUsers size={19} class="me-2"/> Top players</h2><div class="text-secondary small mt-1">{hero?.name} · {period}</div></div><span class="badge bg-primary-lt ms-auto">LIVE API</span></div>
    <div class="card-body py-3 border-bottom"><div class="text-secondary small">{sort==='rank'?'Reported ranked progress, not a hero skill rating.':sort==='winrate'?'Win rate in the observed games. Small samples can mislead.':'Most observed matches for this hero.'}</div>{#if fetchedAt}<div class="text-secondary dl-micro mt-1">{stale?'STALE · ':''}Fetched {new Date(fetchedAt).toLocaleString()}</div>{/if}</div>
    {#if listLoading}<div class="empty" role="status"><div class="spinner-border text-primary mb-3"></div><p class="empty-title">Finding players</p></div>
    {:else if listError}<div class="card-body"><div class="alert alert-danger mb-0" role="alert">{listError}</div></div>
    {:else if rankings.length}<div class="list-group list-group-flush dl-player-list" id="players">
     {#each rankings as p,i}<button class="list-group-item list-group-item-action d-flex gap-3 align-items-center" class:active={player?.account_id===p.account_id} aria-current={player?.account_id===p.account_id?'true':undefined} onclick={()=>loadPlayer(p)}>
      <span class="text-secondary font-monospace small dl-position">{i+1}</span><span class="flex-fill text-start dl-min-width"><strong class="d-block text-truncate">{p.personaname}</strong><span class="text-secondary small">{sort==='rank'?rankName(p.badge)+' · ':''}{p.matches} games</span></span><span class="font-monospace small text-primary">{score(p)}</span>
     </button>{/each}</div>
    {:else}<div class="empty"><p class="empty-title">No players meet these filters</p><p class="empty-subtitle text-secondary">Try a wider window, fewer minimum games, or look up a player directly.</p></div>{/if}
   </section>
   <div class="card"><div class="card-body"><PlayerLookup onselect={directPlayer}/><p class="text-secondary small mb-0 mt-2">Look up any player, even if they aren’t in the top 30.</p></div></div>
  </aside>

  <div class="col-12 col-lg-8">
   {#if player}<section class="card mb-4"><div class="card-header flex-wrap gap-2"><div class="dl-min-width"><h2 class="card-title text-break">{player.personaname}</h2><div class="text-secondary small">{hero?.name} · {period}</div></div><div class="ms-auto d-flex gap-1">
     <button class="btn btn-sm btn-icon" disabled={selectedPlayerIndex<=0} aria-label="Previous player" onclick={()=>loadPlayer(rankings[selectedPlayerIndex-1])}><IconChevronLeft size={17}/></button>
     <button class="btn btn-sm btn-icon" disabled={selectedPlayerIndex<0||selectedPlayerIndex>=rankings.length-1} aria-label="Next player" onclick={()=>loadPlayer(rankings[selectedPlayerIndex+1])}><IconChevronRight size={17}/></button>
     <a class="btn btn-sm btn-icon ms-1" href={'https://statlocker.gg/profile/'+player.account_id} target="_blank" rel="noreferrer" aria-label="View player on Statlocker"><IconExternalLink size={16}/></a>
    </div></div><div class="card-body">
    {#if playerError}<div class="alert alert-warning" role="status">{playerError}</div>{/if}
    {#if playerLoading}<div class="d-flex gap-2 align-items-center text-secondary" role="status"><span class="spinner-border spinner-border-sm"></span> Loading games…</div>
    {:else if games.length}<div class="row g-3" id="facts"><div class="col-6 col-sm-3"><div class="subheader">Available games</div><div class="h2 mb-0 mt-1">{games.length}</div></div><div class="col-6 col-sm-3"><div class="subheader">Win rate</div><div class="h2 text-primary mb-0 mt-1">{wins+losses?Math.round(wins/(wins+losses)*100)+'%':'—'}</div><div class="text-secondary small">{wins}W · {losses}L</div></div><div class="col-6 col-sm-3"><div class="subheader">Aggregate KDA</div><div class="h2 mb-0 mt-1">{kda}</div></div><div class="col-6 col-sm-3"><div class="subheader">Avg. souls</div><div class="h2 mb-0 mt-1">{(games.reduce((n,m)=>n+m.net_worth,0)/games.length/1000).toFixed(1)}k</div></div></div>
    {:else}<div class="empty py-4"><p class="empty-title">No available games in this view</p><p class="empty-subtitle text-secondary">Choose another hero, season, or time window.</p></div>{/if}
   </div></section>{:else}<div class="card mb-4"><div class="empty"><IconStack2 size={36} class="text-secondary mb-3"/><p class="empty-title">{listLoading?'Loading players…':'Start with a player'}</p><p class="empty-subtitle text-secondary">Choose a hero and player, or look up an account.</p></div></div>{/if}

   {#if player && games.length}
    <section class="card mb-4" id="typical"><div class="card-header"><h2 class="card-title"><IconStack2 size={19} class="me-2"/> Typical build</h2><span class="badge bg-secondary-lt ms-auto">20%+ usage</span></div><div class="card-body">
     <p class="text-secondary small">Estimated usage across {denominator} available games. Items bought in at least 20%; green highlights 60%+. History and analytics coverage may differ.</p>
     {#if analyticsLoading}<div class="text-secondary" role="status"><span class="spinner-border spinner-border-sm me-2"></span> Loading item analytics…</div>{/if}
     {#if itemError}<div class="alert alert-warning" role="status">{itemError}</div>{/if}
     {#if typical.length}<div class="row g-3">{#each phases as phaseInfo,i}<div class="col-12 col-md-4"><div class="dl-phase h-100"><div class="subheader mb-1">{phaseInfo.name}</div><div class="text-secondary small mb-3">{phaseInfo.range}</div><ItemGrid tiles={typicalTiles(i)}/>{#if !typicalTiles(i).length}<span class="text-secondary small">No common items</span>{/if}</div></div>{/each}</div>{:else if !analyticsLoading && !itemError}<p class="text-secondary mb-0">Not enough item analytics are available for this view.</p>{/if}
     <div class="d-flex flex-wrap gap-3 small text-secondary mt-3"><span><i class="dl-dot dl-weapon"></i> Weapon</span><span><i class="dl-dot dl-vitality"></i> Vitality</span><span><i class="dl-dot dl-spirit"></i> Spirit</span><span>Times are average purchase times.</span></div>
    </div></section>
    <section class="card mb-4" id="abilities"><div class="card-header"><h2 class="card-title"><IconTarget size={19} class="me-2"/> Ability order</h2></div><div class="card-body">
     {#if abilityError}<div class="alert alert-warning" role="status">{abilityError}</div>{/if}
     {#if abilitySummary.ids.length}<p class="text-secondary small">Most common first 12 points · {abilitySummary.matches} of {abilitySummary.total} analyzed games. Hover for ability names and upgrades.</p><AbilityStrip ids={abilitySummary.ids} {items}/>{:else}<p class="text-secondary mb-0">{analyticsLoading?'Loading ability analytics…':'No ability-order data is available for this view.'}</p>{/if}
    </div></section>
    <section class="card mb-4" id="game-build"><div class="card-header"><h2 class="card-title"><IconClock size={19} class="me-2"/> Game by game</h2><div class="ms-auto d-flex gap-1"><button class="btn btn-sm btn-icon" disabled={gameIndex===0} onclick={()=>loadGame(gameIndex-1)} aria-label="Previous game"><IconChevronLeft size={17}/></button><button class="btn btn-sm btn-icon" disabled={gameIndex>=games.length-1} onclick={()=>loadGame(gameIndex+1)} aria-label="Next game"><IconChevronRight size={17}/></button></div></div>
     <div class="card-body border-bottom"><div class="dl-game-strip">{#each games as game,i}<button class="btn dl-game" class:active={gameIndex===i} aria-current={gameIndex===i?'true':undefined} onclick={()=>loadGame(i)}><MatchResult match={game}/><span class="small mt-2">{game.player_kills}/{game.player_deaths}/{game.player_assists} · {duration(game.match_duration_s)}</span><span class="text-secondary dl-micro">{dateTime(game.start_time)}</span></button>{/each}</div></div>
     <div class="card-body" id="timeline">
      {#if selectedGame}<div class="d-flex flex-wrap align-items-center gap-2 mb-3"><a href={'https://statlocker.gg/match/'+selectedGame.match_id} target="_blank" rel="noreferrer" class="fw-semibold">Match #{selectedGame.match_id} <IconExternalLink size={14}/></a><span class="text-secondary small">{dateTime(selectedGame.start_time)} · {exactItems.length} items bought</span></div>{/if}
      {#if metadataLoading}<div class="text-secondary" role="status"><span class="spinner-border spinner-border-sm me-2"></span> Loading exact build…</div>{/if}
      {#if metadataError}<div class="alert alert-warning" role="status">{metadataError}</div>{/if}
      {#if purchases.length}<div class="row g-3">{#each phases as phaseInfo,i}<div class="col-12 col-md-4"><div class="dl-phase h-100"><div class="subheader mb-1">{phaseInfo.name}</div><div class="text-secondary small mb-3">{phaseInfo.range}</div><ItemGrid tiles={exactTiles(i)}/>{#if !exactTiles(i).length}<span class="text-secondary small">No items</span>{/if}</div></div>{/each}</div>{#if exactAbilities.length}<h3 class="mt-4">Ability points this game</h3><AbilityStrip ids={exactAbilities} {items}/>{/if}
      {:else if !metadataLoading && !metadataError}<p class="text-secondary mb-0">No item events were included in the available metadata.</p>{/if}
     </div>
    </section>
   {/if}
   {#if listWarning}<div class="alert alert-warning" role="status">{listWarning}</div>{/if}
  </div>
 </div>
 <div class="text-secondary small mt-4">Rankings use observed API matches, not a complete global dataset or Statlocker’s rating. Rankings cache for 5 minutes; manual refresh has a 1-minute cooldown. Metadata availability varies. Keyboard: ←/→ players, comma/period games.</div>
</div></div>
