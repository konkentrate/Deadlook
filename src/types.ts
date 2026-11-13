export interface Profile { account_id: number; personaname: string; avatarmedium?: string; }
export interface Hero { id: number; name: string; playable?: boolean; images?: Record<string, string>; }
export interface Season {
  class_name: string; name: string; ranked_type: string;
  intervals: { interval: number; start_timestamp: number; end_timestamp: number }[];
}
export interface Match {
  match_id: number; hero_id: number; start_time: number; player_kills: number;
  player_deaths: number; player_assists: number; net_worth: number; last_hits: number;
  denies: number; match_duration_s: number; hero_level: number; player_match_outcome: number;
  game_mode: number; match_mode: number;
  ranked_delta?: number | null; // Ranked progress change awarded for this match, not MMR.
  ranked_display_badge?: number | null; [key: string]: unknown;
}
export interface Result<T> { data: T; fetchedAt: string; stale: boolean; cached: boolean; warning?: string; latestResponseCount?: number; }
export async function api<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
export const outcome = (m: Match) => ({ 1: 'Win', 2: 'Loss', 3: 'Penalized', 4: 'Party penalty', 5: 'Not scored' }[m.player_match_outcome] || 'Unknown');
export const duration = (seconds: number) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
