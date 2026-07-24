// Distribution/Coordinator/actions/totalFan.js
import { runImagePipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

export async function totalFan(payload) {
  return runImagePipeline({
    payload,
    blueprintKey: 'totalFan',
    mapToFabricator: (cp, options) => ({
      blueprintKey: 'totalFan',
      meta: {
        trainerId:   cp.id,
        trainerName: cp.name      ?? cp.id,
        avatarUrl:   cp.avatarUrl ?? null,
        generatedAt: new Date().toISOString(),
        circle:      parseCircleId(options.circle) ?? null,
      },
      fans: {
        lifetime: cp.fans ?? 0,
      },
      rank:  cp.rank  ?? null,
      trend: cp.trend ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
