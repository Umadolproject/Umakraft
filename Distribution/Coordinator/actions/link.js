// Distribution/Coordinator/actions/link.js
// Verifies the trainer exists on Uma.moe, then persists a Discord↔trainer link.
//
// Trainer resolution priority:
//   1. options.trainerId — explicit numeric ID (always wins)
//   2. options.trainer   — free-text name entered without autocomplete
//      → currently requires autocomplete selection; raw name lookup is not
//        implemented because the search API does not guarantee a unique match.

import { processTrainer } from '../../../umamoe/pipeline.js';
import { retrieve }        from '../../../Refinery/Depot/depot.js';
import { searchTrainers }  from '../../../umamoe/Miner/miner.js';
import { upsertLink }      from '../utils/memberLinks.js';

// ─── Trainer ID resolution ────────────────────────────────────────────────────

/**
 * Resolve a free-text trainer name to a numeric ID via Uma.moe search.
 * Returns null when no unambiguous match is found.
 *
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function resolveTrainerIdByName(name) {
  const result = await searchTrainers({ q: name.trim(), limit: 5 });
  if (!result?.success) return null;

  const raw = Array.isArray(result.data)
    ? result.data
    : (result.data?.trainers ?? result.data?.results ?? []);

  // Only accept an exact (case-insensitive) name match to avoid wrong links.
  const exact = raw.find(
    t => t?.name?.toLowerCase() === name.trim().toLowerCase(),
  );
  return exact?.id != null ? String(exact.id) : null;
}

// ─── Coordinator action ───────────────────────────────────────────────────────

export async function link(payload) {
  const { interaction, options } = payload;

  const targetDiscordId = options.member?.id ?? interaction.user.id;

  // ── 1. Resolve trainer ID ─────────────────────────────────────────────────
  let resolvedId = options.trainerId ?? null;

  if (!resolvedId && options.trainer) {
    if (/^\d+$/.test(options.trainer.trim())) {
      resolvedId = options.trainer.trim();
    }
  }

  if (!resolvedId && options.trainer && !/^\d+$/.test(options.trainer.trim())) {
    // User typed a name manually without selecting from autocomplete.
    // Attempt an exact-match lookup as a best-effort fallback.
    resolvedId = await resolveTrainerIdByName(options.trainer);

    if (!resolvedId) {
      return {
        success:   false,
        failedAt:  'Coordinator',
        error:     'TRAINER_NOT_FOUND',
        message:   `No exact match found for trainer name **"${options.trainer}"**.\n` +
                   `Use the autocomplete dropdown when typing the trainer name, or provide the numeric \`trainer_id\` directly.`,
        retriable: false,
        interaction,
      };
    }
  }

  if (!resolvedId) {
    return {
      success:   false,
      failedAt:  'Coordinator',
      error:     'TRAINER_NOT_FOUND',
      message:   'Please provide a trainer name (autocomplete) or a `trainer_id`.',
      retriable: false,
      interaction,
    };
  }

  // ── 2. Verify trainer exists on Uma.moe (runs the full pipeline) ──────────
  const pipelineResult = await processTrainer(resolvedId);
  if (!pipelineResult.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     'TRAINER_NOT_FOUND',
      message:   `Trainer ID \`${resolvedId}\` was not found on Uma.moe.`,
      retriable: false,
      interaction,
    };
  }

  // ── 3. Retrieve compiled name from Depot ──────────────────────────────────
  const { product: depotProduct } = await retrieve(resolvedId);
  const trainerName = depotProduct?.compiledProduct?.name ?? resolvedId;

  // ── 4. Persist the link ───────────────────────────────────────────────────
  await upsertLink({
    discordId:   targetDiscordId,
    guildId:     interaction.guildId,
    trainerId:   resolvedId,
    trainerName: String(trainerName),
  });

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       '✅ Link created',
      description: `<@${targetDiscordId}> has been linked to **${trainerName}** (ID: \`${resolvedId}\`).`,
    },
    interaction,
  };
}
