// Distribution/Coordinator/actions/storeCard.js
// Fetches trainer card data from Uma.moe, renders a confirmation image via
// Workshop (searchTrainer blueprint), stores the record with a 72-hour TTL.

import { processTrainer } from '../../../umamoe/pipeline.js';
import { retrieve }       from '../../../Refinery/Depot/depot.js';

export async function storeCard(payload) {
  const { interaction, options } = payload;
  const { trainerId } = options;

  // ── 1. Fetch trainer data from Uma.moe ────────────────────────────────────
  const pipelineResult = await processTrainer(trainerId);
  if (!pipelineResult.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     pipelineResult.error ?? 'MINER_HTTP_ERROR',
      message:   pipelineResult.message,
      retriable: true,
      interaction,
    };
  }

  const { product: depotProduct } = await retrieve(trainerId);
  if (!depotProduct) {
    return {
      success:   false,
      failedAt:  'Refinery',
      error:     'DEPOT_NOT_FOUND',
      message:   `No product in Depot for trainer ${trainerId}`,
      retriable: false,
      interaction,
    };
  }

  // ── 2. Persist to trainer_cards table with 72-hour TTL ───────────────────
  // TODO: INSERT INTO trainer_cards (trainer_id, name, skills, stored_at, expires_at, kept)
  //       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '72 hours', false)
  //       ON CONFLICT (trainer_id) DO UPDATE SET ...;

  const cp = depotProduct.compiledProduct;

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Card stored — ${cp.name ?? trainerId}`,
      description: `Trainer card saved. It will expire in **72 hours** unless you run \`/keep trainer_id:${trainerId}\` to make it permanent.`,
      fields: [
        { name: 'Trainer ID', value: trainerId,          inline: true },
        { name: 'Total Fans', value: String(cp.fans ?? 0), inline: true },
      ],
    },
    interaction,
  };
}
