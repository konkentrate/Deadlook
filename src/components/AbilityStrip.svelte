<script lang="ts">
 import { itemImage, type Item } from '../lib/build-types';
 let { ids, items }: { ids:number[]; items:Item[] } = $props();
 const countAt=(index:number)=>ids.slice(0,index+1).filter(id=>id===ids[index]).length;
</script>
<ol class="dl-ability-strip list-unstyled mb-0">
 {#each ids as id,i}<li class="dl-ability" title={(items.find(it=>it.id===id)?.name||'Ability #'+id)+' · '+(countAt(i)===1?'unlock':'upgrade '+(countAt(i)-1))}>
  {#if itemImage(items.find(it=>it.id===id))}<img src={itemImage(items.find(it=>it.id===id))} alt={items.find(it=>it.id===id)?.name||'Ability'} loading="lazy"/>{:else}<span aria-label={'Ability '+id}>?</span>{/if}
  <span class="dl-ability-step">{i+1}</span><span class="dl-ability-level">{countAt(i)===1?'★':countAt(i)-1}</span>
 </li>{/each}
</ol>
