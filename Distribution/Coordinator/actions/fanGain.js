// Distribution/Coordinator/actions/fanGain.js
import { runImagePipeline } from '../utils/pipelineImage.js';

export async function fanGain(payload) {
  return runImagePipeline({
    payload,
    blueprintKey: 'fanGain',
    mapToFabricator: (cp, options) => ({
      blueprintKey: 'fanGain',
      meta: {
        trainerId:   cp.id,
        trainerName: cp.name   ?? cp.id,
        avatarUrl:   cp.avatarUrl  ?? null,
        generatedAt: new Date().toISOString(),
        circle:      options.circle ?? null,
      },
      fans: {
        lifetime: cp.fans          ?? 0,
        daily:    cp.dailyFanGain  ?? 0,
        weekly:   cp.weeklyFanGain ?? 0,
        monthly:  cp.monthlyFanGain ?? 0,
      },
      rank:  cp.rank  ?? null,
      trend: cp.trend ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
