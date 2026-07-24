// Distribution/Coordinator/actions/profile.js
import { runImagePipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

export async function profile(payload) {
  return runImagePipeline({
    payload,
    blueprintKey: 'profile',
    mapToFabricator: (cp, options) => ({
      blueprintKey: 'profile',
      meta: {
        trainerId:   cp.id,
        trainerName: cp.name      ?? cp.id,
        avatarUrl:   cp.avatarUrl ?? null,
        generatedAt: new Date().toISOString(),
        circle:      parseCircleId(options.circle) ?? null,
      },
      fans: {
        lifetime: cp.fans           ?? 0,
        daily:    cp.dailyFanGain   ?? 0,
        weekly:   cp.weeklyFanGain  ?? 0,
        monthly:  cp.monthlyFanGain ?? 0,
      },
      rank:             cp.rank             ?? null,
      trend:            cp.trend            ?? null,
      personalRecords:  cp.personalRecords  ?? {},
      milestones:       cp.milestones       ?? [],
      monthlyHistory:   cp.monthlyHistory   ?? [],
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
