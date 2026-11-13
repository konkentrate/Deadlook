export interface LastRankedMatch {
 match_id:number;
 start_time:number;
 player_rank_initial_display_rank:number;
 player_rank_desired_progress_change?:number|null;
 player_rank_final_flat_progress?:number|null;
 player_rank_initial_flat_progress?:number|null;
 player_rank_initial_calibration_games?:number|null;
 player_rank_initial_win_streak?:number|null;
}
export interface RankAsset { tier:number; name:string; images?:Record<string,string>; color?:string; }
export interface PlayerRank {
 badge:number;
 rank:number;
 subrank:number;
 last_match?:LastRankedMatch|null;
}
export interface PlayerHeroStats {
 account_id:number;
 hero_id:number;
 matches_played:number;
 wins:number;
 time_played:number;
 last_played:number;
 kills:number;
 deaths:number;
 assists:number;
 kills_per_min?:number;
 deaths_per_min?:number;
 assists_per_min?:number;
 ending_level?:number;
 damage_per_min?:number;
 damage_per_soul?:number;
 damage_taken_per_min?:number;
 damage_mitigated_per_min?:number;
 networth_per_min?:number;
 last_hits_per_min?:number;
 denies_per_match?:number;
 creeps_per_min?:number;
 obj_damage_per_min?:number;
 accuracy?:number;
 crit_shot_rate?:number;
 mvp_rank_counts?:number[];
 mvp_rated_matches?:number;
 permanent_buffs?:number;
 permanent_buff_matches?:number;
 permanent_buffs_per_min?:number|null;
}
export interface PlayerRegion {
 account_id:number;
 region?:string|null;
 region_month?:number|null;
 history?:{month:number;cluster_id:number;matches:number;region?:string|null;datacenter?:string|null}[];
}
