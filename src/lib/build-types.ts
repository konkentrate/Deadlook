import type { Profile, Result } from '../types';
export interface RankedPlayer extends Profile { rank: number; value: number; matches: number; badge?: number | null; }
export interface LeaderboardResult extends Result<RankedPlayer[]> { profileWarning?: string; }
export interface Item {
 id:number; name:string; type:string; item_slot_type?:string; item_tier?:number; cost?:number;
 shop_image_small_webp?:string; shop_image_webp?:string; shop_image_small?:string; shop_image?:string;
 image_webp?:string; image?:string;
}
export interface ItemStat { item_id:number; matches:number; avg_buy_time_s:number; }
export interface AbilityOrder { abilities:number[]; matches:number; }
export interface Purchase { item_id:number; game_time_s:number; sold_time_s?:number; }
export interface MatchMetadata { match_info?: {players?: {account_id:number; items?:Purchase[]}[]}; players?: {account_id:number; items?:Purchase[]}[]; }
export interface Tile { item?:Item; id:number; label:string; time?:string; core?:boolean; sold?:boolean; tooltip?:string; }
export const itemImage=(item?:Item)=>item?.shop_image_small_webp||item?.shop_image_webp||item?.shop_image_small||item?.shop_image||item?.image_webp||item?.image;
