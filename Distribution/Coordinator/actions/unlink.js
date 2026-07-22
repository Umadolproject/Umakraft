// Distribution/Coordinator/actions/unlink.js
// Removes a Discord↔trainer link for the specified member.

export async function unlink(payload) {
  const { interaction, options, guildId } = payload;
  const targetMember = options.member;

  if (!targetMember) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   'No member provided to unlink.',
      retriable: false,
      interaction,
    };
  }

  // TODO: DELETE FROM member_links
  //       WHERE discord_id = $1 AND guild_id = $2
  //       RETURNING trainer_name;
  // If 0 rows deleted → member was not linked → return appropriate message.

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Link removed`,
      description: `<@${targetMember.id}>'s Uma.moe link has been removed.\n\n*(Database layer pending — unlink is not persisted yet.)*`,
    },
    interaction,
  };
}
