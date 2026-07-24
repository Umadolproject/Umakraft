// Distribution/Coordinator/actions/totalCircleFanGain.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';

export async function totalCircleFanGain(payload) {
  const { options, guildId } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      circle: options.circle ?? guildId,
      type:   'totalCircleFanGain',
    },
    blueprintKey: 'totalCircleFanGain',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'totalCircleFanGain',
      meta: {
        circle:      opts.circle ?? null,
        generatedAt: new Date().toISOString(),
      },
      totalFanGain: cp.totalFanGain ?? 0,
      memberCount:  cp.memberCount  ?? 0,
      breakdown:    cp.breakdown    ?? [],
      trend:        cp.trend        ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
