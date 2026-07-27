// Distribution/Coordinator/actions/joinDate.js
import { runImagePipeline } from '../utils/pipelineImage.js';

/**
 * Join Date embed matching blueprint:
 *   Trainer name + Circle → Join Date + Membership + Days Active → Presence Flags
 */
function buildJoinDateEmbed(fabricatorInput, blueprintKey, interaction) {
  const meta = fabricatorInput.meta ?? {};
  const trainerName = meta.trainerName ?? meta.trainerId ?? 'Unknown';

  const fields = [];

  if (fabricatorInput.joinDate) {
    fields.push({ name: '📅 Join Date', value: fabricatorInput.joinDate, inline: true });
  }
  if (fabricatorInput.memberSince) {
    fields.push({ name: '⏳ Member Since', value: fabricatorInput.memberSince, inline: true });
  }
  if (fabricatorInput.daysInCircle != null) {
    fields.push({ name: '📆 Days Active', value: String(fabricatorInput.daysInCircle), inline: true });
  }

  // Presence flags
  if (Array.isArray(fabricatorInput.presenceFlags) && fabricatorInput.presenceFlags.length > 0) {
    fields.push({
      name: '🏷️ Presence',
      value: fabricatorInput.presenceFlags.map(f => `• ${f.label ?? f}`).join('\n'),
      inline: false,
    });
  }

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `📅 Trainer Join Date — ${trainerName}`,
      description: meta.circle ? `**Circle:** ${meta.circle}` : '',
      fields:      fields.length > 0 ? fields : [{ name: 'Status', value: 'No join data available.' }],
      footer:      { text: `${blueprintKey} · UmaKraft · uma.moe` },
      timestamp:   meta.generatedAt ?? new Date().toISOString(),
    },
    interaction,
  };
}

export async function joinDate(payload) {
  return runImagePipeline({
    payload,
    blueprintKey: 'joinDate',
    embedBuilder: buildJoinDateEmbed,
    mapToFabricator: (cp, options) => ({
      blueprintKey: 'joinDate',
      meta: {
        trainerId:   cp.id,
        trainerName: cp.name      ?? cp.id,
        avatarUrl:   cp.avatarUrl ?? null,
        generatedAt: new Date().toISOString(),
        circle:      cp.circle ?? null,
      },
      joinDate:      cp.joinDate      ?? null,
      memberSince:   cp.memberSince   ?? null,
      daysInCircle:  cp.daysInCircle  ?? null,
      presenceFlags: cp.presenceFlags ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
