<script lang="ts">
 import { IconSearch, IconArrowUpRight } from '@tabler/icons-svelte';
 import { api, type Profile, type Result } from '../types';
 let { onselect, id='player-search', label='Find a player' }: { onselect: (profile: Profile) => void; id?:string; label?:string } = $props();
 let query = $state(''); let loading = $state(false); let error = $state(''); let searched = $state(false);
 let profiles = $state<Profile[]>([]); let sequence = 0;
 async function search() {
   const current = ++sequence; loading = true; error = ''; searched = false; profiles = [];
   const value = query.trim().match(/(?:profiles?\/)(\d+)/)?.[1] || query.trim();
   try { const result = await api<Result<Profile[]>>('/api/search?q=' + encodeURIComponent(value)); if(current === sequence) { profiles = result.data; searched = true; } }
   catch(e) { if(current === sequence) error = (e as Error).message; }
   finally { if(current === sequence) loading = false; }
 }
 function choose(p: Profile) { profiles = []; searched = false; onselect(p); }
</script>
<form onsubmit={(e)=>{e.preventDefault(); search();}} class="row g-2 align-items-end">
 <div class="col"><label for={id} class="form-label">{label}</label><div class="input-icon"><span class="input-icon-addon"><IconSearch size={18}/></span><input {id} class="form-control" bind:value={query} placeholder="Steam name, account ID, or profile link" minlength="2" maxlength="160" required/></div></div>
 <div class="col-auto"><button class="btn btn-primary" disabled={loading || query.trim().length < 2}>{#if loading}<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>{:else}<IconSearch size={17}/>{/if}<span class="d-none d-sm-inline">{loading ? 'Searching' : 'Find player'}</span><span class="d-sm-none">Find</span></button></div>
</form>
{#if error}<div class="alert alert-danger mt-3 mb-0" role="alert">{error}</div>{/if}
{#if profiles.length}<div class="list-group list-group-flush mt-3">
 {#each profiles as profile}<button class="list-group-item list-group-item-action d-flex align-items-center gap-3" onclick={()=>choose(profile)}>
 {#if profile.avatarmedium}<img class="avatar avatar-sm" src={profile.avatarmedium} alt="" referrerpolicy="no-referrer"/>{/if}
 <span class="text-start"><strong class="d-block">{profile.personaname}</strong><span class="text-secondary small">Account {profile.account_id}</span></span><IconArrowUpRight class="ms-auto text-secondary" size={18}/></button>{/each}
</div>{:else if searched}<p class="text-secondary small mt-3 mb-0" role="status">No indexed profiles found. Try a numeric account ID.</p>{/if}
