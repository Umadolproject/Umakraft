// Distribution/Coordinator/actions/adminSyncCards.js
// Triggers a support card image sync from GameTora for the trainer card database.

export async function adminSyncCards(payload) {
  const { interaction } = payload;

  // TODO: Trigger GameTora scrape job.
  // For each trainer card in the trainer_cards table:
  //   1. Fetch updated card image from GameTora by trainer_id.
  //   2. Store image in object storage or update the image URL field.
  //   3. Mark last_synced_at = NOW().
  // This is a background job — respond immediately and run async.

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       '🔄 Card sync triggered',
      description: 'Support card image sync from GameTora has been queued.\n\n*(GameTora scraper not yet implemented — this is a stub.)*',
    },
    interaction,
  };
}
