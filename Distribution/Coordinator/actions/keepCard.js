// Distribution/Coordinator/actions/keepCard.js
// Sets the permanent flag on a stored trainer card, preventing 72-hour auto-expiry.

export async function keepCard(payload) {
  const { interaction, options } = payload;
  const { trainerId } = options;

  // TODO: UPDATE trainer_cards SET kept = true, expires_at = NULL
  //       WHERE trainer_id = $1
  //       RETURNING name;
  // If 0 rows updated → card not found → return TRAINER_NOT_LINKED error.

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Card marked as permanent`,
      description: `Trainer ID \`${trainerId}\` will no longer expire automatically.\n\n*(Database layer pending — this confirmation is a stub.)*`,
    },
    interaction,
  };
}
