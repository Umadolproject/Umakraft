// Distribution/Coordinator/actions/searchTrainer.js
// Queries the local trainer card database by name fragment, rank, or white-skill count.

import { searchCards } from '../utils/trainerCards.js';

export async function searchTrainer(payload) {
  const { interaction, options } = payload;
  const { trainer, rank, whiteskills } = options;

  if (!trainer && rank == null && whiteskills == null) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   'Please provide at least one search filter: a trainer name, rank, or white-skill count.',
      retriable: false,
      interaction,
    };
  }

  const { results } = await searchCards({
    name:        trainer  ?? undefined,
    rank:        rank     ?? undefined,
    whiteSkills: whiteskills ?? undefined,
    limit:       20,
  });

  if (results.length === 0) {
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       '🔍 No cards found',
        description: 'No stored trainer cards match your search. Cards are added via `/store` and expire after 72 hours unless kept with `/keep`.',
      },
      interaction,
    };
  }

  const lines = results.map((c, i) =>
    `**${i + 1}.** ${c.name} — ID \`${c.trainerId}\` | Fans: ${(c.fans).toLocaleString()} | Rank: ${c.rank ?? 'n/a'} | ⬜ ${c.whiteSkills}${c.kept ? ' 📌' : ''}`,
  );

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `🔍 Search results (${results.length})`,
      description: lines.join('\n'),
      footer:      '📌 = permanently kept  •  Cards without 📌 expire after 72 hours',
    },
    interaction,
  };
}
