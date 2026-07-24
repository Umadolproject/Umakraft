// Distribution/Coordinator/actions/totalCircleFanGain.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

export async function totalCircleFanGain(payload) {
  const { options, guildId } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      circle: parseCircleId(options.circle) ?? guildId,
      type:   'totalCircleFanGain',
    },
    blueprintKey: 'totalCircleFanGain',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'totalCircleFanGain',
      meta: {
        circle:      parseCircleId(opts.circle) ?? null,
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
