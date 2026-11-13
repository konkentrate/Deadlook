# Match Analysis: data contract

Entry: match inspector embedded in History. Clicking a history match automatically loads the selected match analysis. Legacy `/analysis.html?p=ACCOUNT&hero=HERO&match=MATCH` links are retained by Vite and open that match in the same inspector; without a match, they fall back to History. There is no separate analysis page or navigation item. The history inspector uses the selected player's match history and never changes the saved player implicitly.

## Sources and request budget

- /api/analysis/curve → player-performance-curve, resolution=0 (absolute seconds).
- /api/analysis/metrics → player-stats/metrics, bucket=hero (array response).
- /api/analysis/match/:id → metadata with disable_steam=true; normalize one player.
- /api/analysis/ranks and /map → assets/ranks and assets/map.

Queries require one hero and an explicit ordered date window of at most 90 days.
Game mode is fixed to normal; match modes/duration/badge filters are validated.
No arbitrary endpoint, query or SQL forwarding. Unrecognized query fields are
not forwarded. Self comparison uses curve and metric queries; optional player or
lobby-rank comparison adds one peer pair. Requests run in batches of at most two,
and stale responses cannot overwrite newer selections. Metadata is fetched only
for the selected game after its inspector opens, not for every history row. Map
art is loaded only when the selected match has route samples. No replay downloads
or background collection.

Benchmarks cache one hour, raw metadata 24 hours, map/ranks 24 hours. Metadata
shares the existing match cache and stale fallback; analysis never initiates a
Steam metadata fallback. Object caching is explicitly opted into for map assets.
Every stale source is disclosed. History coverage and analytic coverage differ.

## Economy and statistics

- End-game net worth/min = net worth / (duration seconds / 60).
- Interval growth/min = (net worth B - net worth A) / elapsed minutes.
  It can be negative. Do NOT call it pure earned souls or unspent cash.
- Per-source interval income = cumulative counter B - A. Missing or decreasing
  source counters are unavailable, not zero. Only actual timestamp pairs count;
  there is no invented zero-time snapshot or interpolated minute-by-minute data.
- Lane: gold_lane_creep + gold_lane_creep_orbs.
- Jungle: gold_neutral_creep + gold_neutral_creep_orbs.
- Fights: gold_player + gold_player_orbs. Assists are already in gold_player:
  NEVER add gold_assists again.
- Objectives: gold_boss + gold_boss_orb. Urn: gold_treasure.
  This subset is NOT a complete reconciliation of net worth.
- Compare source totals only at an identical recorded checkpoint.
- Benchmark graphs show scheduled checkpoints (180s cadence through 900s,
  300s thereafter), not each match's variable end-time bucket.
- Do not subtract population means to claim interval income: participants change
  as games end. The curve's samples count snapshots, not global unique players.
- Metrics supply approximate per-game percentiles, not player ranks or a sample
  count. Show median / interquartile range, never “top X% player.”
- Duration/hero/mode/date filters apply to player and benchmark. Date windows may
  span patches; do not claim patch matching. Self averages can include this game.
- Badge filters describe average LOBBY rank, not each player's personal rank.
  Unknown/unranked lobbies can be excluded. Rank cohorts are not top-30 lists.

## Recorded route and combat tempo

CMsgMatchPlayerPathsData version 1 contains interval_s and per-player quantized
positions. Match paths to player_slot, not account_id or array index.
For sample i:
  time = i * interval_s
  x = x_min + x_pos[i] / x_resolution * (x_max - x_min)
  y = y_min + y_pos[i] / y_resolution * (y_max - y_min)

Only decode supported versions and valid bounds/coordinates. Preserve zero
coordinates. Break drawn routes at death, missing samples or large jumps.
The map uses world radius and flips Y for SVG. Current map artwork may differ
from historical layouts; no artwork falls back to a world-coordinate grid.
This is 2D, not a replay: no height, named-camp IDs, exact kill sequence or intent.

Combat enum: 0 out, 1 player, 2 enemy NPC, 3 neutral. Movement 6 is ziplining.
Sum only each available sample's overlap with the selected window. Gaps are
not idle time. Zipline time overlaps combat-state totals; don't sum it again.
Enemy NPC includes lane/objective combat. Neutral combat doesn't prove a camp
clear. Out of combat can be productive setup/travel, not necessarily wasted time.
Death intervals are clipped/unioned. Incomplete death durations show unavailable,
not zero. Combat-state sampled dead time can differ from event-based downtime.

## Review prompts, not authoritative coaching

A source prompt needs a shared checkpoint, >=10 comparison snapshots, >1000
comparison source souls, and a gap >20%. At most two source prompts (lane/jungle).
Repeated-death review needs >=2 timed deaths and >=90 recorded downtime seconds.
Maximum three prompts. Describe the selected game; do not claim a recurring
weakness, avoided death, optimal camp route or causal reason for losing.

Tests cover proxy validation, decoding, source overlap, missing/reset counters,
death clipping, coverage gaps, stale/missing data, rapid selection races, browser
preferences, rank/player comparisons and mobile overflow.

Sources: https://api.deadlock-api.com/openapi.json and
https://github.com/SteamDatabase/Protobufs/blob/master/deadlock/citadel_gcmessages_common.proto
