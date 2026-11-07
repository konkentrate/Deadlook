import type { Profile } from '../types';
export function savedPlayer(): Profile | null {
 try {
   const p=JSON.parse(localStorage.getItem('deadlook.home') || localStorage.getItem('matchbook.home') || 'null');
   return p && Number.isInteger(p.account_id) && p.account_id>0 && p.account_id<=4294967295 && typeof p.personaname==='string' ? p : null;
 } catch { return null; }
}
// Defaults belong to this browser, never the deployment or a bundled account ID.
export function defaultPlayer(): Profile | null { return savedPlayer(); }
export function savePlayer(profile: Profile) { localStorage.setItem('deadlook.home',JSON.stringify(profile)); }
export function clearPlayer() {
 localStorage.removeItem('deadlook.home');
 localStorage.removeItem('matchbook.home');
}
