// Distribution/Coordinator/actions/joinDate.js
import { runImagePipeline } from '../utils/pipelineImage.js';

export async function joinDate(payload) {
  return runImagePipeline({
    payload,
    blueprintKey: 'joinDate',
    mapToFabricator: (cp, options) => ({
      blueprintKey: 'joinDate',
      meta: {
        trainerId:   cp.id,
        trainerName: cp.name      ?? cp.id,
        avatarUrl:   cp.avatarUrl ?? null,
        generatedAt: new Date().toISOString(),
      },
      joinDate:     cp.joinDate     ?? null,
      memberSince:  cp.memberSince  ?? null,
      daysInCircle: cp.daysInCircle ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
