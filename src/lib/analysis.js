// Shared pure calculations; exercised by Node tests, with no browser/API dependency.
const valid = n => typeof n === 'number' && Number.isFinite(n);
/** @param {Record<string, number|null>} row @param {string} suffix */
export function sources(row, suffix = '') {
  const sum = keys => keys.every(k => valid(row[k+suffix])) ? keys.reduce((n,k) => n+row[k+suffix],0) : null;
  return { lane: sum(['gold_lane_creep','gold_lane_creep_orbs']),
    jungle: sum(['gold_neutral_creep','gold_neutral_creep_orbs']),
    fights: sum(['gold_player','gold_player_orbs']), // Assists already included; do not add gold_assists.
    objectives: sum(['gold_boss','gold_boss_orb']),
    urn: sum(['gold_treasure']) };
}
/** @param {{time:number,duration:number|null}[]} deaths @param {number} start @param {number} end */
export function deadSeconds(deaths,start,end) {
  const ranges=deaths.filter(d => valid(d.duration)).map(d => [Math.max(start,d.time),Math.min(end,d.time+d.duration)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  let total=0,last=start;
  for(const [a,b] of ranges){total+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}
  return total;
}
/** @param {import('./analysis-types').Snapshot[]} stats @param {{time:number,duration:number|null}[]} deaths */
export function intervals(stats,deaths) {
  return stats.slice(1).flatMap((b,i) => {
    const a=stats[i],seconds=b.time-a.time;
    if(seconds<=0)return [];
    const diff=key=>valid(a[key])&&valid(b[key])&&b[key]>=a[key]?b[key]-a[key]:null;
    const sa=sources(a),sb=sources(b);
    const income=key=>valid(sa[key])&&valid(sb[key])&&sb[key]>=sa[key]?sb[key]-sa[key]:null;
    return [{start:a.time,end:b.time,rate:valid(a.net_worth)&&valid(b.net_worth)?(b.net_worth-a.net_worth)/(seconds/60):null,
      lane:income('lane'),jungle:income('jungle'),fights:income('fights'),
      creeps:diff('creep_kills'),neutrals:diff('neutral_kills'),damage:diff('player_damage'),
      dead:deadSeconds(deaths,a.time,b.time)}];
  });
}
/** @param {import('./analysis-types').RoutePoint[]} points @param {number} cadence @param {number} start @param {number} end */
export function activity(points,cadence,start,end) {
  const result={player:0,npc:0,neutral:0,out:0,unknown:0,dead:0,zipline:0,coverage:0};
  if(!valid(cadence)||cadence<=0)return result;
  for(const p of points){
    const seconds=Math.max(0,Math.min(end,p.time+cadence)-Math.max(start,p.time));
    if(!seconds)continue;
    result.coverage+=seconds;
    if(!p.alive){result.dead+=seconds;continue;}
    result[({0:'out',1:'player',2:'npc',3:'neutral'})[p.combat]||'unknown']+=seconds;
    if(p.move===6)result.zipline+=seconds;
  }
  return result;
}
/** @param {import('./analysis-types').Snapshot[]} stats @param {import('./analysis-types').CurvePoint[]} curve */
export function sharedCheckpoint(stats,curve) {
  const times=new Set(curve.filter(p=>p.samples>0).map(p=>p.game_time));
  return [...stats].reverse().find(p=>times.has(p.time))?.time ?? null;
}
/** Evidence-backed review prompts, never claims about causes or optimal paths.
 * @param {import('./analysis-types').AnalysisMatch|null} match
 * @param {import('./analysis-types').CurvePoint[]} curve
 */
export function focusSuggestions(match,curve) {
  if(!match)return [];
  const time=sharedCheckpoint(match.stats,curve);
  const own=match.stats.find(s=>s.time===time),peer=curve.find(s=>s.game_time===time);
  const suggestions=[];
  if(own&&peer&&peer.samples>=10){
    const a=sources(own),b=sources(peer,'_avg');
    for(const [key,label,action] of [
      ['lane','Review lane income','Review last hits and secured souls before changing your whole build.'],
      ['jungle','Review income between rotations','Look for safe waves or nearby neutral camps between rotations, without missing necessary fights.']]){
      if(valid(a[key])&&valid(b[key])&&b[key]>1000&&a[key]<b[key]*0.8)
        suggestions.push({title:label,evidence:Math.round(a[key]).toLocaleString()+' souls vs '+Math.round(b[key]).toLocaleString()+
          ' comparison mean at '+Math.round(time/60)+' min ('+peer.samples+' snapshots).',action});
    }
  }
  const known=match.deaths.filter(d=>valid(d.duration));
  if(known.length>=2&&deadSeconds(known,0,match.duration)>=90)
    suggestions.push({title:'Review repeated deaths',evidence:Math.round(deadSeconds(known,0,match.duration))+
      ' seconds of recorded death downtime in this game.',action:'Review the route and deaths before re-entering fights. These stats cannot establish whether a death was avoidable.'});
  return suggestions.slice(0,3);
}
