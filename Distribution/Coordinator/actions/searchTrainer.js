// Distribution/Coordinator/actions/searchTrainer.js
// Queries the trainer card database directly — no Umamoe or Workshop pipeline.

export async function searchTrainer(payload) {
  const { interaction, options } = payload;

  // TODO: Replace with real database query against the trainer_cards table.
  // Query: SELECT * FROM trainer_cards
  //        WHERE (trainer IS NULL OR name ILIKE '%' || $trainer || '%')
  //          AND (rank IS NULL OR rank = $rank)
  //          AND (whiteskills IS NULL OR white_skills_count = $whiteskills)
  //        ORDER BY stored_at DESC LIMIT 20;

  return {
    success:   false,
    failedAt:  'Coordinator',
    error:     'PIPELINE_STAGE_ERROR',
    message:   'search_trainer database layer not yet implemented.',
    retriable: false,
    interaction,
  };
}
