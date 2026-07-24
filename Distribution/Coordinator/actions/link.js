// Distribution/Coordinator/actions/link.js
// Verifies the trainer exists on Uma.moe, then persists a Discord↔trainer link.
//
// Trainer resolution priority:
//   1. options.trainerId — explicit numeric ID (always wins)
//   2. options.trainer   — value from the trainer autocomplete field
//      a. Pure numeric string → treat as trainer ID (autocomplete selection)
//      b. Text name → look up in local trainer DB, then Uma.moe search API

import { processTrainer } from '../../../umamoe/pipeline.js';
import { retrieve }        from '../../../Refinery/Depot/depot.js';
import { searchTrainers }  from '../../../umamoe/Miner/miner.js';
import { upsertLink }      from '../utils/memberLinks.js';
import { upsertTrainer, getByName, getById } from '../utils/trainerDb.js';

// ─── Trainer ID resolution ────────────────────────────────────────────────────

/**
 * Resolve a free-text trainer name to a numeric ID.
 *
 * Checks the local trainer DB first (instant, no network), then falls back to
 * the Uma.moe search API with an exact-match filter.
 *
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function resolveTrainerIdByName(name) {
  const trimmed = name.trim();

  // ── 1. Local trainer DB ───────────────────────────────────────────────────
  const local = await getByName(trimmed);
  if (local?.trainer_id) return String(local.trainer_id);

  // ── 2. Uma.moe search API ─────────────────────────────────────────────────
  // Search endpoint returns { items: [...] }; each item has account_id + trainer_name.
  const result = await searchTrainers({ q: trimmed, limit: 5 });
  if (!result?.success) return null;

  const raw = result.data?.items
    ?? (Array.isArray(result.data) ? result.data : []);

  // Only accept an exact (case-insensitive) name match to avoid wrong links.
  const exact = raw.find(
    t => t?.trainer_name?.toLowerCase() === trimmed.toLowerCase(),
  );
  return exact?.account_id != null ? String(exact.account_id) : null;
}

// ─── Coordinator action ───────────────────────────────────────────────────────

export async function link(payload) {
  const { interaction, options } = payload;

  const targetDiscordId = options.member?.id ?? interaction.user.id;

  // ── 1. Resolve trainer ID ─────────────────────────────────────────────────
  let resolvedId = options.trainerId ?? null;

  if (!resolvedId && options.trainer) {
    const trainerVal = options.trainer.trim();
    if (/^\d+$/.test(trainerVal)) {
      // Autocomplete selection — value is the numeric trainer ID.
      resolvedId = trainerVal;
    }
  }

  if (!resolvedId && options.trainer && !/^\d+$/.test(options.trainer.trim())) {
    // User typed a name manually without selecting from autocomplete.
    // Try local DB first, then Uma.moe search.
    resolvedId = await resolveTrainerIdByName(options.trainer);

    if (!resolvedId) {
      return {
        success:   false,
        failedAt:  'Coordinator',
        error:     'TRAINER_NOT_FOUND',
        message:
          `No trainer found matching **"${options.trainer}"**.\n` +
          `• Use the autocomplete dropdown when typing the trainer name, or\n` +
          `• Provide the numeric \`trainer_id\` directly.`,
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
      message:   'Please provide a trainer name (use autocomplete) or a `trainer_id`.',
      retriable: false,
      interaction,
    };
  }

  // ── 2. Resolve trainer name; verify existence if not already cached ──────────
  //
  // If the trainer is in the local DB they appeared in autocomplete, which means
  // uma.moe's search API already confirmed they exist. Trust that and link
  // immediately, then run the pipeline in the background so the Depot is warm
  // for subsequent /fan_gain, /profile, etc. calls.
  //
  // Only block on the full pipeline when the trainer is completely unknown
  // (not in local DB), e.g. the user typed a raw ID with trainer_id:.
  let trainerName;
  const cachedTrainer = await getById(resolvedId);

  if (cachedTrainer?.trainer_name) {
    // Known from autocomplete — link without waiting for the pipeline.
    trainerName = cachedTrainer.trainer_name;
    // Warm the Depot in the background; ignore failures (non-critical here).
    processTrainer(resolvedId).catch(() => {});
  } else {
    // Unknown trainer — run the pipeline to verify existence and get the name.
    const pipelineResult = await processTrainer(resolvedId);
    if (!pipelineResult.success) {
      // Distinguish a genuine "not found" (permanent API error) from transient
      // failures (network, rate-limit, timeout) so we don't mislead the user.
      const isPermFailure = pipelineResult.error === 'API_PERMANENT_ERROR'
        || pipelineResult.error === 'MINER_INVALID_PARAMS';
      return {
        success:   false,
        failedAt:  'Umamoe',
        error:     isPermFailure ? 'TRAINER_NOT_FOUND' : (pipelineResult.error ?? 'PIPELINE_STAGE_ERROR'),
        message:   isPermFailure
          ? `Trainer ID \`${resolvedId}\` was not found on Uma.moe. Check the ID and try again.`
          : `Could not reach Uma.moe right now — please try again in a moment.`,
        retriable: !isPermFailure,
        interaction,
      };
    }
    const { product: depotProduct } = await retrieve(resolvedId);
    trainerName = depotProduct?.compiledProduct?.name ?? resolvedId;
  }

  // ── 4. Persist the link ───────────────────────────────────────────────────
  await upsertLink({
    discordId:   targetDiscordId,
    guildId:     interaction.guildId,
    trainerId:   resolvedId,
    trainerName: String(trainerName),
  });

  // ── 5. Cache the trainer in the local DB for future autocomplete / lookups ─
  upsertTrainer(resolvedId, String(trainerName)).catch(() => {});

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
