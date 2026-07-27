// Distribution/Coordinator/actions/circleMaster.js
import { PermissionFlagsBits } from 'discord.js';
import { runRankingsPipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

/**
 * Circle Master embed matching blueprint:
 *   Circle + Month + Day → Top 3 per day table
 */
function buildCircleMasterEmbed({ topEntries, scope, gainField, total: _, blueprintKey, rankingsParams, interaction }) {
  const meta = rankingsParams ?? {};
  const fields = [];

  if (Array.isArray(topEntries) && topEntries.length > 0) {
    const lines = topEntries.slice(0, 31).map((entry, i) => {
      const name = (entry.name ?? entry.trainerName ?? `#${entry.id}`).slice(0, 18);
      const gain = (entry[gainField] ?? 0).toLocaleString('en-US');
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${name}** — +${gain}`;
    });
    fields.push({ name: `📅 Day ${meta.day ?? '—'} Top Contributors`, value: lines.join('\n'), inline: false });
  }

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `👑 Circle Master — Day ${meta.day ?? '—'}`,
      description: meta.circle ? `**Circle:** ${meta.circle}` : '',
      fields:      fields.length > 0 ? fields : [{ name: 'Status', value: 'No data available for this day.' }],
      footer:      { text: 'circleMaster · UmaKraft · uma.moe data' },
      timestamp:   new Date().toISOString(),
    },
    interaction,
  };
}

export async function circleMaster(payload) {
  const { options, guildId, interaction } = payload;

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
      circle: parseCircleId(options.circle) ?? null,
      day:    options.day    ?? today,
      type:   'circleMaster',
    },
    blueprintKey: 'circleMaster',
    embedBuilder: buildCircleMasterEmbed,
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'circleMaster',
      meta: {
        circle:      parseCircleId(opts.circle) ?? null,
        day:         opts.day    ?? today,
        generatedAt: new Date().toISOString(),
      },
      topContributors: cp.topContributors ?? cp.entries ?? [],
      trend:           cp.trend           ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
