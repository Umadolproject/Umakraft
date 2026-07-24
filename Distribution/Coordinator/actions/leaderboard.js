// Distribution/Coordinator/actions/leaderboard.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

export async function leaderboard(payload) {
  const { options, guildId } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      circle: parseCircleId(options.circle) ?? guildId,
      scope:  options.scope  ?? 'daily',
      top:    options.top    ?? 10,
      date:   options.date   ?? null,
    },
    blueprintKey: 'leaderboard',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'leaderboard',
      meta: {
        circle:      parseCircleId(opts.circle) ?? null,
        scope:       opts.scope  ?? 'daily',
        top:         opts.top    ?? 10,
        date:        opts.date   ?? null,
        generatedAt: new Date().toISOString(),
      },
      entries:      cp.entries      ?? [],
      trend:        cp.trend        ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
