/**
 * Date-based seasons: include starts, exclude ends. Never infer ranked status.
 * @param {number} timestamp
 * @param {{intervals: {start_timestamp: number, end_timestamp: number}[]} | undefined} season
 */
export function inSeason(timestamp, season) {
  return !!season?.intervals.some(i => timestamp >= i.start_timestamp && timestamp < i.end_timestamp);
}
/**
 * @param {{class_name: string, intervals: {start_timestamp: number, end_timestamp: number}[]}[]} seasons
 * @param {number} now
 */
export function currentSeason(seasons, now) {
  return seasons.find(s => inSeason(now, s))?.class_name ?? '';
}
