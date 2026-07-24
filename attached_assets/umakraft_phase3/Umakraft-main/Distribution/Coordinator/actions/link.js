// Distribution/Coordinator/actions/link.js
// Verifies the trainer exists on Uma.moe, then persists a Discord↔trainer link.

import { processTrainer } from '../../../umamoe/pipeline.js';
import { retrieve }       from '../../../Refinery/Depot/depot.js';

export async function link(payload) {
  const { interaction, options, guildId } = payload;

  // Resolve trainer ID — trainer_id takes priority over trainer name
  const trainerId = options.trainerId ?? null;
  const targetDiscordId = options.member?.id ?? interaction.user.id;

  if (!trainerId) {
    // TODO: Resolve trainer name → ID via Uma.moe name lookup.
    return {
      success:   false,
      failedAt:  'Coordinator',
      error:     'TRAINER_NOT_FOUND',
      message:   'Trainer name resolution not yet implemented. Provide `trainer_id` instead.',
      retriable: false,
      interaction,
    };
  }

  // ── 1. Verify trainer exists on Uma.moe ──────────────────────────────────
  const pipelineResult = await processTrainer(trainerId);
  if (!pipelineResult.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     'TRAINER_NOT_FOUND',
      message:   `Trainer ID ${trainerId} not found on Uma.moe.`,
      retriable: false,
      interaction,
    };
  }

  const { product: depotProduct } = await retrieve(trainerId);
  const trainerName = depotProduct?.compiledProduct?.name ?? trainerId;

  // ── 2. Persist the link ───────────────────────────────────────────────────
  // TODO: UPSERT INTO member_links (discord_id, guild_id, trainer_id, trainer_name, linked_at)
  //       VALUES ($1, $2, $3, $4, NOW())
  //       ON CONFLICT (discord_id, guild_id) DO UPDATE SET
  //         trainer_id = $3, trainer_name = $4, linked_at = NOW();

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Link created`,
      description: `<@${targetDiscordId}> has been linked to **${trainerName}** (ID: \`${trainerId}\`).\n\n*(Database layer pending — link is not persisted yet.)*`,
    },
    interaction,
  };
}
