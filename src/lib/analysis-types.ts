export interface Snapshot {
 time: number;
 net_worth: number | null;
 [key: string]: number | null;
}
export interface CurvePoint {
 game_time: number; game_time_avg: number; samples: number;
 [key: string]: number | null;
}
export interface RoutePoint { time: number; x: number; y: number; alive: boolean; combat: number|null; move: number|null; }
export interface AnalysisMatch {
 matchId: number; accountId: number; heroId: number; duration: number;
 kills: number|null; deathCount: number|null; assists: number|null; netWorth: number|null;
 stats: Snapshot[]; deaths: {time:number;duration:number|null}[];
 route: RoutePoint[]; routeInterval: number|null; routeVersion: number|null;
}
export interface Metric { avg: number|null; percentile25: number|null; percentile50: number|null; percentile75: number|null; }
export interface Metrics { bucket: number; [key:string]: Metric | number; }
export interface Rank { tier: number; name: string; }
export interface MapAsset { radius: number; images: {minimap?:string;plain?:string}; }
export interface Sources { lane:number|null; jungle:number|null; fights:number|null; objectives:number|null; urn:number|null; }
