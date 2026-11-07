<script lang="ts">
 import type { Snippet } from 'svelte';
 let { eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: Snippet } = $props();
</script>
<div class="page-header d-print-none"><div class="container-xl"><div class="row g-3 align-items-center">
 <div class="col"><div class="page-pretitle">{eyebrow}</div><h1 class="page-title">{title}</h1><p class="text-secondary mt-2 mb-0">{description}</p></div>
 {#if actions}<div class="col-12 col-md-auto ms-auto d-flex gap-2">{@render actions()}</div>{/if}
</div></div></div>
