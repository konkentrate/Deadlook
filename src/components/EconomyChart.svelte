<script lang="ts">
 export interface Series { name:string; points:{time:number;value:number|null;samples?:number}[]; kind:'selected'|'personal'|'comparison'; }
 let { series, end }: {series:Series[];end?:number}=$props();
 const colors={selected:'var(--dl-green)',personal:'var(--dl-cream)',comparison:'var(--dl-gold)'};
 let limit=$derived(end || Math.max(1,...series.flatMap(s=>s.points.map(p=>p.time))));
 let top=$derived(Math.max(1000,...series.flatMap(s=>s.points.filter(p=>p.time<=limit).map(p=>p.value??0)))*1.1);
 const x=(t:number)=>54+t/limit*640;
 const y=(n:number)=>218-n/top*194;
 function path(points:Series['points']){
  let pen=false;
  return points.filter(p=>p.time<=limit).map(p=>{
   if(p.value===null||!Number.isFinite(p.value)){pen=false;return '';}
   const command=(pen?'L':'M')+x(p.time).toFixed(1)+','+y(p.value).toFixed(1);pen=true;return command;
  }).join(' ');
 }
 let times=$derived([...new Set(series.flatMap(s=>s.points.filter(p=>p.time<=limit).map(p=>p.time)))].sort((a,b)=>a-b));
</script>
{#if series.some(s=>s.points.some(p=>p.value!==null))}
 <svg class="dl-economy-chart" viewBox="0 0 720 260" role="img" aria-label="Net worth over recorded game time; exact values in the checkpoint table below">
  {#each [0,0.25,0.5,0.75,1] as fraction}
   <line x1="54" x2="694" y1={y(top*fraction)} y2={y(top*fraction)} stroke="var(--dl-line)"/>
   <text x="46" y={y(top*fraction)+4} text-anchor="end" fill="var(--dl-muted)" font-size="11">{Math.round(top*fraction/1000)}k</text>
  {/each}
  {#each [0,0.25,0.5,0.75,1] as fraction}<text x={x(limit*fraction)} y="243" text-anchor="middle" fill="var(--dl-muted)" font-size="11">{Math.round(limit*fraction/60)}m</text>{/each}
  {#each series as line}
   <path d={path(line.points)} fill="none" stroke={colors[line.kind]} stroke-width={line.kind==='selected'?3:2} stroke-dasharray={line.kind==='comparison'?'7 4':line.kind==='personal'?'3 3':undefined}/>
   {#each line.points.filter(p=>p.time<=limit&&p.value!==null) as point}
    <circle cx={x(point.time)} cy={y(point.value!)} r="3" fill={colors[line.kind]}><title>{line.name}: {Math.round(point.value!).toLocaleString()} souls at {(point.time/60).toFixed(1)} min{point.samples!==undefined?' · '+point.samples+' snapshots':''}</title></circle>
   {/each}
  {/each}
 </svg>
 <div class="d-flex flex-wrap gap-3 small mb-3">{#each series as line}<span><span class="dl-chart-key" style:background={colors[line.kind]}></span>{line.name} · {line.kind==='selected'?'solid':line.kind==='personal'?'dotted':'dashed'}</span>{/each}</div>
 <p class="text-secondary small">Dots are recorded checkpoints; connecting lines are visual guides, not minute-by-minute readings. Comparison means can include a different population at each checkpoint.</p>
 <details><summary class="small">Checkpoint values and snapshot coverage</summary><div class="table-responsive mt-2"><table class="table table-sm mb-0"><thead><tr><th>Game time</th>{#each series as line}<th>{line.name}</th>{/each}</tr></thead><tbody>{#each times as time}<tr><td>{(time/60).toFixed(1)} min</td>{#each series as line}{@const point=line.points.find(p=>p.time===time)}<td>{point?.value==null?'—':Math.round(point.value).toLocaleString()}{#if point?.samples!==undefined}<div class="text-secondary small">{point.samples} snapshots</div>{/if}</td>{/each}</tr>{/each}</tbody></table></div></details>
{:else}<p class="text-secondary mb-0">No net-worth checkpoints are available for this selection.</p>{/if}
