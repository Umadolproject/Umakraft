// Distribution/Coordinator/actions/storeCard.js
// Fetches trainer card data from Uma.moe, renders a confirmation image via
// Workshop (searchTrainer blueprint), stores the record with a 72-hour TTL.

import { processTrainer } from '../../../umamoe/pipeline.js';
import { retrieve }       from '../../../Refinery/Depot/depot.js';
import { upsertCard }     from '../utils/trainerCards.js';

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

  const cp = depotProduct.compiledProduct;
  const skills = cp.skills ?? [];
  const whiteSkills = skills.filter(s => (s.level ?? s.rarity) >= 5).length;

  await upsertCard({
    trainerId,
    name: cp.name ?? trainerId,
    fans: cp.fans ?? 0,
    rank: cp.rank ?? null,
    whiteSkills,
    skills,
  });

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Card stored — ${cp.name ?? trainerId}`,
      description: `Trainer card saved. It will expire in **72 hours** unless you run \`/keep trainer_id:${trainerId}\` to make it permanent.`,
      fields: [
        { name: 'Trainer ID', value: trainerId,          inline: true },
        { name: 'Total Fans', value: (cp.fans ?? 0).toLocaleString(), inline: true },
        { name: 'White Skills', value: String(whiteSkills), inline: true },
      ],
    },
    interaction,
  };
}
