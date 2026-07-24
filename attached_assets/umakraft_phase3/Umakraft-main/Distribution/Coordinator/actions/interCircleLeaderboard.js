// Distribution/Coordinator/actions/interCircleLeaderboard.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';

export async function interCircleLeaderboard(payload) {
  const { options } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      type:  'interCircle',
      scope: options.scope ?? 'daily',
      top:   options.top   ?? 10,
    },
    blueprintKey: 'leaderboard',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'leaderboard',
      meta: {
        mode:        'interCircle',
        scope:       opts.scope ?? 'daily',
        top:         opts.top   ?? 10,
        generatedAt: new Date().toISOString(),
      },
      entries: cp.entries ?? [],
      trend:   cp.trend   ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
