// Distribution/Coordinator/utils/resolveMember.js
// Resolves an Uma.moe trainer ID from slash command options.
//
// Priority order:
//   1. options.trainerId  — provided directly (e.g. /store, /keep, /link trainer_id:...)
//   2. options.trainer    — trainer name → look up in member_links by name
//   3. options.member     — Discord GuildMember → look up their linked trainerId
//   4. self (userId)      — the calling user's linked trainerId
//
// Returns: { success: boolean, value?: string, message?: string }

import { getLinkByDiscordId, getLinkByTrainerName } from './memberLinks.js';

/**
 * @param {object} options   — parsed command options from the Commands handler
 * @param {string} guildId   — Discord guild ID
 * @param {string} userId    — Discord user ID of the caller
 * @returns {Promise<{ success: boolean, value?: string, message?: string }>}
 */
export async function resolveMember(options, guildId, userId) {
  // 1. Direct trainer ID — no lookup needed
  if (options.trainerId) {
    return { success: true, value: options.trainerId };
  }

  // 2. Trainer name (or autocomplete-selected ID)
  if (options.trainer) {
    if (/^\d+$/.test(options.trainer.trim())) {
      return { success: true, value: options.trainer.trim() };
    }
    const link = await getLinkByTrainerName(options.trainer, guildId);
    if (link) return { success: true, value: link.trainerId };
    return {
      success: false,
      message: `No linked member found with trainer name **"${options.trainer}"**. Use \`/link\` to connect a Discord member to that trainer, or provide \`trainer_id\` directly.`,
    };
  }

  // 3. Discord member
  if (options.member) {
    const link = await getLinkByDiscordId(options.member.id, guildId);
    if (link) return { success: true, value: link.trainerId };
    return {
      success: false,
      message: `<@${options.member.id}> has not been linked to an Uma.moe account yet. Ask an admin to use \`/link\`.`,
    };
  }

  // 4. Self
  const link = await getLinkByDiscordId(userId, guildId);
  if (link) return { success: true, value: link.trainerId };
  return {
    success: false,
    message: `You have not been linked to an Uma.moe account yet. Ask an admin to use \`/link\` for you.`,
  };
}
