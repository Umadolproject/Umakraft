// Distribution/Coordinator/utils/pipelineImage.js
// Shared orchestration flow for all image-producing commands.
//
// Flow: resolveMember → processTrainer → retrieve (Depot) → produce (Workshop) → claimDeliverable
//
// Usage:
//   import { runImagePipeline } from '../utils/pipelineImage.js';
//   export async function fanGain(payload) {
//     return runImagePipeline({ payload, blueprintKey: 'fanGain', mapToFabricator: ... });
//   }

import { processTrainer, processRankings } from '../../../umamoe/pipeline.js';
import { retrieve }         from '../../../Refinery/Depot/depot.js';
import { produce, claimDeliverable } from '../../../Workshop/pipeline.js';
import { resolveMember }    from './resolveMember.js';
import { parseCircleId }    from './parseCircle.js';

/**
 * runImagePipeline — full pipeline for a single-trainer image command.
 *
 * @param {object} opts
 * @param {object}   opts.payload        — validated command payload from Commands
 * @param {string}   opts.blueprintKey   — Workshop blueprint key (e.g. 'fanGain')
 * @param {Function} opts.mapToFabricator — (compiledProduct) => fabricator input shape
 * @returns {Promise<envelope>}
 */
export async function runImagePipeline({ payload, blueprintKey, mapToFabricator }) {
  const { interaction, options, guildId, userId } = payload;

  // ── 1. Resolve trainer ID ─────────────────────────────────────────────────
  const resolved = await resolveMember(options, guildId, userId);
  if (!resolved.success) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'MEMBER_NOT_LINKED',
      message:   resolved.message,
      retriable: false,
      interaction,
    };
  }
  const trainerId = resolved.value;

  // ── 2. Umamoe + Refinery pipeline ─────────────────────────────────────────
  const pipelineResult = await processTrainer(trainerId, {
    circleId: parseCircleId(options.circle),
  });
  if (!pipelineResult.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     pipelineResult.error ?? 'PIPELINE_STAGE_ERROR',
      message:   pipelineResult.message ?? 'Umamoe pipeline failed',
      retriable: pipelineResult.retriable ?? true,
      interaction,
    };
  }

  // ── 3. Retrieve compiled product from Depot ──────────────────────────────
  const { product: depotProduct } = await retrieve(trainerId);
  if (!depotProduct) {
    return {
      success:   false,
      failedAt:  'Refinery',
      error:     'DEPOT_NOT_FOUND',
      message:   `No compiled product in Depot for trainer ${trainerId}`,
      retriable: false,
      interaction,
    };
  }

  // ── 4. Map to Fabricator input shape ─────────────────────────────────────
  const fabricatorInput = mapToFabricator(depotProduct.compiledProduct, options);

  // ── 5. Workshop: produce (Draftsman → Fabricator → Validator → Terminal) ─
  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    return {
      success:   false,
      failedAt:  'Workshop',
      error:     produced.error ?? 'FABRICATOR_RENDER_ERROR',
      message:   produced.message ?? 'Workshop produce failed',
      retriable: false,
      interaction,
    };
  }

  // ── 6. Claim deliverable from Terminal ────────────────────────────────────
  const claimed = await claimDeliverable(produced.terminalId);
  if (!claimed.success) {
    return {
      success:   false,
      failedAt:  'Terminal',
      error:     claimed.error ?? 'TERMINAL_NOT_FOUND',
      message:   claimed.message ?? 'Terminal claim failed',
      retriable: false,
      interaction,
    };
  }

  return {
    success:      true,
    terminalId:   produced.terminalId,
    blueprintKey,
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}

/**
 * runRankingsPipeline — full pipeline for ranking / circle-wide image commands.
 * Uses processRankings instead of processTrainer.
 *
 * @param {object} opts
 * @param {object}   opts.payload
 * @param {object}   opts.rankingsParams  — params passed to processRankings
 * @param {string}   opts.blueprintKey
 * @param {Function} opts.mapToFabricator — (compiledProduct) => fabricator input
 */
export async function runRankingsPipeline({ payload, rankingsParams, blueprintKey, mapToFabricator }) {
  const { interaction } = payload;

  // ── 1. Umamoe + Refinery rankings pipeline ───────────────────────────────
  // processRankings stores each trainer's compiled product individually in the
  // Depot (keyed by trainer ID). There is no single unified "ranking" product.
  const pipelineResult = await processRankings(rankingsParams);
  if (!pipelineResult.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     pipelineResult.error ?? 'PIPELINE_STAGE_ERROR',
      message:   pipelineResult.message ?? 'Rankings pipeline failed',
      retriable: pipelineResult.retriable ?? true,
      interaction,
    };
  }

  // ── 2. Assemble leaderboard entries from individual Depot records ─────────
  // pipelineResult.results is an array of { success, trainerId, version, error }.
  const trainerResults = pipelineResult.results ?? [];
  const successful = trainerResults.filter(r => r.success);

  if (successful.length === 0) {
    return {
      success:   false,
      failedAt:  'Refinery',
      error:     'RANKINGS_NO_DATA',
      message:   'No trainer data was successfully processed for the leaderboard',
      retriable: false,
      interaction,
    };
  }

  const entries = [];
  for (const r of successful) {
    const { product: depotProduct } = await retrieve(r.trainerId);
    if (depotProduct?.compiledProduct) {
      entries.push(depotProduct.compiledProduct);
    }
  }

  if (entries.length === 0) {
    return {
      success:   false,
      failedAt:  'Refinery',
      error:     'DEPOT_NOT_FOUND',
      message:   'No compiled trainer products found in Depot for the leaderboard',
      retriable: false,
      interaction,
    };
  }

  // ── 3. Sort entries by scope gain and slice to top-N ─────────────────────
  const scope     = rankingsParams.scope ?? 'daily';
  const gainField = scope === 'monthly' ? 'monthlyFanGain'
                  : scope === 'weekly'  ? 'weeklyFanGain'
                  : 'dailyFanGain';
  const top = rankingsParams.top ?? 10;

  entries.sort((a, b) => (b[gainField] ?? 0) - (a[gainField] ?? 0));
  const topEntries = entries.slice(0, top);

  // ── 4. Build assembled product for the Fabricator ─────────────────────────
  const assembledProduct = {
    entries:           topEntries,
    trend:             topEntries[0]?.trend ?? null,
    presentationHints: { scope, gainField, total: entries.length },
  };

  // ── 5. Map + produce + claim ──────────────────────────────────────────────
  const fabricatorInput = mapToFabricator(assembledProduct, payload.options ?? {});
  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    return { success: false, failedAt: 'Workshop', error: produced.error ?? 'FABRICATOR_RENDER_ERROR', message: produced.message, retriable: false, interaction };
  }

  const claimed = await claimDeliverable(produced.terminalId);
  if (!claimed.success) {
    return { success: false, failedAt: 'Terminal', error: claimed.error ?? 'TERMINAL_NOT_FOUND', message: claimed.message, retriable: false, interaction };
  }

  return {
    success:      true,
    terminalId:   produced.terminalId,
    blueprintKey,
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}
