<script lang="ts">
 import type { Snippet } from 'svelte';
 import { IconX } from '@tabler/icons-svelte';
 let { open, title, onclose, children }: { open: boolean; title: string; onclose: ()=>void; children: Snippet } = $props();
 let dialog: HTMLDialogElement;
 $effect(()=>{ if(dialog) { if(open && !dialog.open) dialog.showModal(); else if(!open && dialog.open) dialog.close(); } });
</script>
<dialog bind:this={dialog} class="dl-dialog card" aria-labelledby="dialog-title" onclose={onclose}>
 <div class="card-header"><h2 id="dialog-title" class="card-title">{title}</h2><button class="btn btn-icon btn-ghost-secondary ms-auto" aria-label="Close inspector" onclick={()=>dialog.close()}><IconX size={20}/></button></div>
 <div class="card-body">{@render children()}</div>
</dialog>
