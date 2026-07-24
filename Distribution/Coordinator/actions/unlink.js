// Distribution/Coordinator/actions/unlink.js
// Removes a Discord↔trainer link for the specified member.

import { removeLink } from '../utils/memberLinks.js';

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

  const result = await removeLink(targetMember.id, guildId);

  if (!result.success) {
    return {
      success: false,
      failedAt: 'Commands',
      error: 'NOT_LINKED',
      message: `<@${targetMember.id}> is not linked to any Uma.moe trainer.`,
      retriable: false,
      interaction,
    };
  }

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Link removed`,
      description: `<@${targetMember.id}>'s link to **${result.trainerName}** has been removed.`,
    },
    interaction,
  };
}
