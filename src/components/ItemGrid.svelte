<script lang="ts">
 import { itemImage, type Tile } from '../lib/build-types';
 let { tiles }: { tiles:Tile[] } = $props();
</script>
<div class="dl-item-grid">
 {#each tiles as tile,i}<div class="dl-item" class:dl-item-core={tile.core} class:dl-item-sold={tile.sold} title={tile.tooltip||tile.item?.name||'Item #'+tile.id}>
  <div class="dl-item-icon" data-slot={tile.item?.item_slot_type}>
   {#if itemImage(tile.item)}<img src={itemImage(tile.item)} alt="" loading="lazy"/>{:else}<span class="text-secondary small">?</span>{/if}
   {#if tile.item?.item_tier}<span class="dl-item-tier">T{tile.item.item_tier}</span>{/if}
  </div>
  <div class="dl-item-name">{tile.item?.name||'Item #'+tile.id}</div>
  <div class="small fw-semibold" class:text-primary={tile.core}>{tile.label}</div>
  {#if tile.time}<div class="text-secondary dl-item-time">{tile.time}</div>{/if}
 </div>{/each}
</div>
