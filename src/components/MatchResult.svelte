<script lang="ts">
 import { outcome, type Match } from '../types';
 let { match }: { match: Match } = $props();
</script>
<span class="badge" class:bg-success-lt={match.player_match_outcome===1} class:bg-danger-lt={match.player_match_outcome===2} class:bg-secondary-lt={![1,2].includes(match.player_match_outcome)}>{outcome(match)}</span>
