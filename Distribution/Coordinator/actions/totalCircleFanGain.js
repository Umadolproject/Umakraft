// Distribution/Coordinator/actions/totalCircleFanGain.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

/**
 * Total Circle Fan Gain embed matching blueprint:
 *   Circle + Period + Members → Big total → Top contributors table
 */
function buildTotalCircleFanGainEmbed({ topEntries, scope: _, gainField, total, blueprintKey, rankingsParams, interaction }) {
  const meta = rankingsParams ?? {};
  const fields = [];

  // Big total
  const totalGain = topEntries.reduce((sum, e) => sum + (e[gainField] ?? 0), 0);
  fields.push({
    name: '🌸 Total Circle Gain (This Month)',
    value: `**${totalGain.toLocaleString('en-US')}**`,
    inline: false,
  });

  // Top contributors table
  if (Array.isArray(topEntries) && topEntries.length > 0) {
    const lines = topEntries.slice(0, 15).map((entry, i) => {
      const name = (entry.name ?? entry.trainerName ?? `#${entry.id}`).slice(0, 22);
      const gain = (entry[gainField] ?? 0).toLocaleString('en-US');
      const share = totalGain > 0 ? ((entry[gainField] ?? 0) / totalGain * 100).toFixed(1) : '0.0';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${name}** — +${gain} (${share}%)`;
    });
    fields.push({ name: '📊 Top Contributors', value: lines.join('\n'), inline: false });
  }

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `🌸 Circle Fan Gain`,
      description: meta.circle ? `**Circle:** ${meta.circle}\n**Members:** ${total} active` : `**Members:** ${total} active`,
      fields,
      footer:      { text: 'totalCircleFanGain · UmaKraft · uma.moe data' },
      timestamp:   new Date().toISOString(),
    },
    interaction,
  };
}

export async function totalCircleFanGain(payload) {
  const { options, guildId } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      circle: parseCircleId(options.circle) ?? null,
      type:   'totalCircleFanGain',
    },
    blueprintKey: 'totalCircleFanGain',
    embedBuilder: buildTotalCircleFanGainEmbed,
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
