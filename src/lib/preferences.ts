import { api, type Profile } from '../types';
export function savedPlayer(): Profile | null {
 try {
   const p=JSON.parse(localStorage.getItem('deadlook.home') || localStorage.getItem('matchbook.home') || 'null');
   return p && Number.isInteger(p.account_id) && p.account_id>0 && typeof p.personaname==='string' ? p : null;
 } catch { return null; }
}
export async function defaultPlayer(): Promise<Profile | null> {
 const saved=savedPlayer(); if(saved)return saved;
 const config=await api<{defaultAccountId:string}>('/api/config');
 if(!config.defaultAccountId)return null;
 const result=await api<{data:Profile[]}>('/api/search?q='+encodeURIComponent(config.defaultAccountId));
 return result.data[0] ?? null;
}
export function savePlayer(profile: Profile) { localStorage.setItem('deadlook.home',JSON.stringify(profile)); }
