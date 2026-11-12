<script lang="ts">
 import { onMount } from 'svelte';
 import { IconBulb, IconShield, IconHeart, IconBolt, IconTarget, IconRefresh } from '@tabler/icons-svelte';
 import PageHeader from '../components/PageHeader.svelte';
 import { api, type Hero, type Result } from '../types';
 import type { Item } from '../lib/build-types';

 type Concern = 'healing'|'durability'|'burst'|'control'|'mobility';
 const concerns:{id:Concern;label:string;description:string;icon:typeof IconHeart}[]=[
  {id:'healing',label:'Sustain / healing',description:'They are healing or sustaining through fights.',icon:IconHeart},
  {id:'durability',label:'Hard to kill',description:'Their frontline is absorbing too much damage.',icon:IconShield},
  {id:'burst',label:'High burst',description:'You are getting deleted before you can respond.',icon:IconBolt},
  {id:'control',label:'Crowd control',description:'Stuns and disables are deciding fights.',icon:IconTarget},
  {id:'mobility',label:'High mobility',description:'They are escaping or reaching your backline easily.',icon:IconRefresh}
 ];
 let heroes=$state<Hero[]>([]);let items=$state<Item[]>([]);let heroId=$state(0);let enemyIds=$state<number[]>(Array(6).fill(0));let selected=$state<Concern[]>([]);let loading=$state(true);let error=$state('');
 let ownHero=$derived(heroes.find(h=>h.id===heroId));
 let enemyHeroes=$derived(enemyIds.map(id=>heroes.find(h=>h.id===id)).filter((h):h is Hero=>!!h));
 let path=$derived.by(()=>{
  const result:{phase:string;title:string;detail:string;reason:string}[]=[
   {phase:'Start',title:'Use your hero’s established core',detail:'Begin with the core items and ability plan you already trust for this hero.',reason:'This helper does not have enough lineup-conditioned match data to replace a proven core.'}
  ];
  const plans:Record<Concern,{title:string;detail:string;reason:string}>={
   healing:{title:'Prioritize an anti-healing option',detail:'Look for an item that reduces healing or regeneration; buy it before the next decisive fight if sustain is stopping kills.',reason:'Selected concern: enemy sustain / healing.'},
   durability:{title:'Add a sustained-damage answer',detail:'Favor damage that remains effective against durable targets rather than spending every slot on burst.',reason:'Selected concern: durable frontline.'},
   burst:{title:'Add survivability before greed',detail:'Consider a defensive or escape option that lets you survive their initial burst and continue fighting.',reason:'Selected concern: high burst.'},
   control:{title:'Protect against disables',detail:'Prioritize a defensive answer to crowd control or adjust positioning and engagement timing.',reason:'Selected concern: crowd control.'},
   mobility:{title:'Add reliable reach or catch',detail:'Consider a mobility, slow, or lockdown option so opponents cannot disengage freely.',reason:'Selected concern: high mobility.'}
  };
  for(const concern of selected){const p=plans[concern];result.push({phase:'Adapt',...p});}
  result.push({phase:'Later',title:'Reassess and fill the remaining slot',detail:'Re-check the enemy build and match state before completing another situational item.',reason:'Adapt as the match develops; this is not a fixed purchase script.'});
  return result;
 });
 async function load(){loading=true;error='';try{const [h,it]=await Promise.all([api<Result<Hero[]>>('/api/heroes'),api<Result<Item[]>>('/api/finder/items')]);heroes=h.data.filter(x=>x.playable!==false).sort((a,b)=>a.name.localeCompare(b.name));items=it.data;if(!heroId)heroId=heroes[0]?.id||0;}catch(e){error=(e as Error).message;}finally{loading=false;}}
 function setEnemy(index:number,value:string){const next=[...enemyIds];next[index]=Number(value);enemyIds=next;}
 function toggle(id:Concern){selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];}
 onMount(load);
</script>

<svelte:head><title>Build Helper · Deadlook</title></svelte:head>
<PageHeader eyebrow="MATCHUP PLANNING" title="Build Helper" description="Set the enemy lineup and what they’re doing to organize your next item decisions.">
 {#snippet actions()}<a class="btn" href="/builds.html"><IconTarget size={18}/> Open Build Finder</a>{/snippet}
</PageHeader>
<div class="page-body"><div class="container-xl">
 {#if error}<div class="alert alert-warning" role="alert">{error} <button class="btn btn-sm ms-2" onclick={load}>Retry</button></div>{/if}
 <div class="alert alert-info" role="note"><strong>Evidence note:</strong> available item assets and the current Build Finder’s player-specific analytics are not indexed by enemy lineup. Recommendations here are transparent, situational planning prompts—not matchup statistics or guaranteed counter-builds. We do not infer what an enemy team is doing from hero picks alone.</div>
 <section class="card mb-4" aria-labelledby="lineup-heading"><div class="card-header"><h2 class="card-title" id="lineup-heading">Set the matchup</h2></div><div class="card-body"><div class="row g-3 mb-4">
  <div class="col-12 col-md-4"><label class="form-label" for="your-hero">Your hero</label><select id="your-hero" class="form-select" bind:value={heroId} disabled={loading}><option value={0}>Choose your hero</option>{#each heroes as h}<option value={h.id}>{h.name}</option>{/each}</select></div>
 </div>
 <h3 class="h4">Enemy team <span class="text-secondary small fw-normal">Select up to six heroes</span></h3><div class="row g-3">{#each enemyIds as id,i}<div class="col-6 col-md-4 col-lg-2"><label class="form-label" for={'enemy-'+i}>Enemy {i+1}</label><select id={'enemy-'+i} class="form-select" value={id} onchange={e=>setEnemy(i,e.currentTarget.value)} disabled={loading}><option value={0}>Not selected</option>{#each heroes as h}<option value={h.id}>{h.name}</option>{/each}</select></div>{/each}</div>
 {#if enemyHeroes.length}<p class="text-secondary small mt-3 mb-0">Lineup entered: {enemyHeroes.map(h=>h.name).join(' · ')}{enemyHeroes.length<6?' · '+(6-enemyHeroes.length)+' unselected':''}</p>{/if}
 </div></section>
 <section class="card mb-4" aria-labelledby="threat-heading"><div class="card-header"><h2 class="card-title" id="threat-heading">What are they doing?</h2></div><div class="card-body"><p class="text-secondary">Select only what you have observed in the match. These choices drive the response priorities below; hero picks alone do not.</p><div class="row g-3">{#each concerns as concern}<div class="col-12 col-md-6 col-lg-4"><label class="form-check form-selectgroup-item h-100"><input class="form-check-input" type="checkbox" checked={selected.includes(concern.id)} onchange={()=>toggle(concern.id)}/><span class="form-selectgroup-label d-flex align-items-start gap-2 h-100"><concern.icon size={19}/><span><strong class="d-block">{concern.label}</strong><span class="text-secondary small">{concern.description}</span></span></span></label></div>{/each}</div></div></section>
 <section class="card mb-4" aria-labelledby="path-heading"><div class="card-header"><h2 class="card-title" id="path-heading"><IconBulb size={19} class="me-2"/>Suggested build path</h2><span class="badge bg-secondary-lt ms-auto">Planning prompts</span></div><div class="card-body"><p class="text-secondary">{ownHero?'For '+ownHero.name+'. ':''}{enemyHeroes.length?'Enemy lineup is recorded as context. ':''}Choose observed threats above to add targeted priorities.</p>
  <ol class="list-group list-group-numbered">{#each path as step,i}<li class="list-group-item d-flex flex-wrap gap-2 align-items-start"><div class="flex-fill"><span class="badge bg-primary-lt me-2">{step.phase}</span><strong>{step.title}</strong><p class="mb-1 mt-2">{step.detail}</p><small class="text-secondary">{step.reason}</small></div><span class="text-secondary small">Priority {i+1}</span></li>{/each}</ol>
  <div class="alert alert-secondary mt-3 mb-0"><strong>Item data loaded:</strong> {items.length} item assets available for reference. There is not currently enough public API data in this app to rank actual purchases by enemy composition, so no item-specific pick rates or purchase timings are implied.</div>
 </div></section>
 <p class="text-secondary small">This helper does not submit or store your lineup. For observed player builds and available purchase timelines, use the <a href="/builds.html">Build Finder</a>. Recommendations should be adapted to your hero, match state, and item availability.</p>
</div></div>
