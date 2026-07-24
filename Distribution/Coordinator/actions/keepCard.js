// Distribution/Coordinator/actions/keepCard.js
// Sets the permanent flag on a stored trainer card, preventing 72-hour auto-expiry.

import { markKept } from '../utils/trainerCards.js';

export async function keepCard(payload) {
  const { interaction, options } = payload;
  const { trainerId } = options;

  const result = await markKept(trainerId);

  if (!result.success) {
    return {
      success:   false,
      failedAt:  'Coordinator',
      error:     'TRAINER_NOT_FOUND',
      message:   `Trainer ID \`${trainerId}\` is not in the card database. Run \`/store trainer_id:${trainerId}\` first.`,
      retriable: false,
      interaction,
    };
  }

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Card marked as permanent`,
      description: `**${result.name}** (\`${trainerId}\`) will no longer expire automatically.`,
    },
    interaction,
  };
}
