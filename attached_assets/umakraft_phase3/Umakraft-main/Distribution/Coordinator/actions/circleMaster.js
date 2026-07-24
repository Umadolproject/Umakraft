// Distribution/Coordinator/actions/circleMaster.js
import { PermissionFlagsBits } from 'discord.js';
import { runRankingsPipeline } from '../utils/pipelineImage.js';

export async function circleMaster(payload) {
  const { options, guildId, interaction } = payload;

  // trigger_milestones requires Manage Guild — enforced here, not just in Commands,
  // so the Coordinator remains the authoritative permission gate for this feature flag.
  if (options.triggerMilestones && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PERMISSION_DENIED',
      message:   'trigger_milestones requires Manage Guild',
      retriable: false,
      interaction,
    };
  }

  const today = new Date().getDate();
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      circle: options.circle ?? guildId,
      day:    options.day    ?? today,
      type:   'circleMaster',
    },
    blueprintKey: 'circleMaster',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'circleMaster',
      meta: {
        circle:      opts.circle ?? null,
        day:         opts.day    ?? today,
        generatedAt: new Date().toISOString(),
      },
      topContributors: cp.topContributors ?? [],
      trend:           cp.trend           ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
