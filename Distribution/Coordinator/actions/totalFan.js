// Distribution/Coordinator/actions/totalFan.js
import { runImagePipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

/**
 * Total Fan embed matching blueprint:
 *   Avatar + Lifetime fans → Circle Rank → Circle Name
 */
function buildTotalFanEmbed(fabricatorInput, blueprintKey, interaction) {
  const meta = fabricatorInput.meta ?? {};
  const fans = fabricatorInput.fans ?? {};
  const trainerName = meta.trainerName ?? meta.trainerId ?? 'Unknown';

  const avatarUrl = interaction.user?.displayAvatarURL({ dynamic: true, size: 256 }) ?? null;

  const fields = [];
  if (fabricatorInput.rank != null) fields.push({ name: '📊 Circle Rank', value: `#${fabricatorInput.rank}`, inline: true });
  if (meta.circle) fields.push({ name: '🌸 Circle', value: meta.circle, inline: true });

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `🏆 Total Fan Count — ${trainerName}`,
      description: fans.lifetime != null
        ? `**Lifetime Total Fans:** ${fans.lifetime.toLocaleString('en-US')}`
        : 'No fan data available.',
      thumbnail:   avatarUrl ? { url: avatarUrl } : undefined,
      fields:      fields.length > 0 ? fields : [{ name: 'Status', value: 'No additional data.' }],
      footer:      { text: `${blueprintKey} · UmaKraft` },
      timestamp:   meta.generatedAt ?? new Date().toISOString(),
    },
    interaction,
  };
}

export async function totalFan(payload) {
  return runImagePipeline({
    payload,
    blueprintKey: 'totalFan',
    embedBuilder: buildTotalFanEmbed,
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
