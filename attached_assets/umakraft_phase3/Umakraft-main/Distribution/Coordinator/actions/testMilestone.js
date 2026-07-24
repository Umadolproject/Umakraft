// Distribution/Coordinator/actions/testMilestone.js
// Renders a milestone announcement image ephemerally without posting it publicly.
// Uses the 'milestone' Workshop blueprint.

import { runImagePipeline } from '../utils/pipelineImage.js';

export async function testMilestone(payload) {
  const { options } = payload;
  const milestoneValue = parseInt(options.milestone, 10);

  return runImagePipeline({
    payload,
    blueprintKey: 'milestone',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'milestone',
      meta: {
        trainerId:   cp.id,
        trainerName: cp.name      ?? cp.id,
        avatarUrl:   cp.avatarUrl ?? null,
        generatedAt: new Date().toISOString(),
        preview:     true,      // signals this is a dry-run preview
      },
      milestone: {
        value:   milestoneValue,
        label:   formatMilestoneLabel(milestoneValue),
      },
      fans: {
        lifetime: cp.fans ?? 0,
      },
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}

function formatMilestoneLabel(value) {
  if (value >= 1_000_000) return `${value / 1_000_000}M fans`;
  if (value >= 1_000)     return `${value / 1_000}K fans`;
  return `${value} fans`;
}
