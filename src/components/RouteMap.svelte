<script lang="ts">
 import type { RoutePoint, MapAsset } from '../lib/analysis-types';
 let {points,start,end,cadence,map}:{points:RoutePoint[];start:number;end:number;cadence:number;map:MapAsset|null}=$props();
 let imageFailed=$state(false);
 let radius=$derived(map?.radius && map.radius>0 ? map.radius:12000);
 let visible=$derived(points.filter(p=>p.time>=start&&p.time<=end));
 const x=(n:number)=>(n+radius)/(2*radius)*500;
 const y=(n:number)=>(radius-n)/(2*radius)*500;
 let route=$derived.by(()=>{
  let path='',last:RoutePoint|null=null;
  for(const p of visible){
   if(!p.alive){last=null;continue;}
   const connect=last&&p.time-last.time<=cadence*1.5&&Math.hypot(p.x-last.x,p.y-last.y)<2500;
   path+=(connect?'L':'M')+x(p.x).toFixed(1)+','+y(p.y).toFixed(1)+' ';last=p;
  }
  return path;
 });
 let living=$derived(visible.filter(p=>p.alive));
 let background=$derived(map?.images.minimap||map?.images.plain);
</script>
<svg class="dl-route-map" viewBox="0 0 500 500" role="img" aria-label="Recorded two-dimensional movement route for the selected time window">
 <rect width="500" height="500" fill="var(--dl-bg)"/>
 {#if background&&!imageFailed}<image href={background} width="500" height="500" opacity="0.7" onerror={()=>imageFailed=true}/>{:else}{#each [100,200,300,400] as n}<line x1={n} x2={n} y1="0" y2="500" stroke="var(--dl-line)"/><line x1="0" x2="500" y1={n} y2={n} stroke="var(--dl-line)"/>{/each}{/if}
 <path d={route} fill="none" stroke="var(--dl-bg)" stroke-width="5" stroke-linejoin="round"/>
 <path d={route} fill="none" stroke="var(--dl-green)" stroke-width="2.5" stroke-linejoin="round"/>
 {#if living[0]}<circle cx={x(living[0].x)} cy={y(living[0].y)} r="6" fill="var(--dl-cream)"/><text x={x(living[0].x)+9} y={y(living[0].y)} fill="var(--dl-cream)" font-size="13">Start</text>{/if}
 {#if living.at(-1)}{@const last=living.at(-1)!}<circle cx={x(last.x)} cy={y(last.y)} r="6" fill="var(--dl-green)"/><text x={x(last.x)+9} y={y(last.y)+15} fill="var(--dl-green)" font-size="13">End</text>{/if}
</svg>
<p class="text-secondary small mt-2 mb-0">Recorded 2D positions, sampled every {cadence}s. Dead periods, recording gaps and large jumps break the route. No elevation or named-camp identification. {background&&!imageFailed?'Latest map artwork is a reference; historical layouts may differ.':'World-coordinate grid; map artwork is unavailable.'}</p>
