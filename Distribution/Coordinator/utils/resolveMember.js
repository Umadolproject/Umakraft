// Distribution/Coordinator/utils/resolveMember.js
// Resolves an Uma.moe trainer ID from slash command options.
//
// Priority order:
//   1. options.trainerId  — provided directly (e.g. /store, /keep, /link trainer_id:...)
//   2. options.trainer    — value from the trainer autocomplete field
//      a. Pure numeric string → treat as trainer ID (autocomplete selection)
//      b. Text name → check member_links first, then the local trainer DB
//   3. options.member     — Discord GuildMember → look up their linked trainerId
//   4. self (userId)      — the calling user's linked trainerId
//
// Returns: { success: boolean, value?: string, message?: string }

import { getLinkByDiscordId, getLinkByTrainerName } from './memberLinks.js';
import { getByName } from './trainerDb.js';

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
    // 2a. Pure numeric string — autocomplete returned the trainer ID as the value
    if (/^\d+$/.test(options.trainer.trim())) {
      return { success: true, value: options.trainer.trim() };
    }

    // 2b. Text name — check member_links first (linked members in this guild)
    const memberLink = await getLinkByTrainerName(options.trainer, guildId);
    if (memberLink) return { success: true, value: memberLink.trainerId };

    // 2c. Fall back to the local trainer DB — covers trainers that have appeared
    //     in autocomplete results or been linked anywhere, even if not linked in
    //     this specific guild.
    const dbEntry = await getByName(options.trainer);
    if (dbEntry?.trainer_id) return { success: true, value: dbEntry.trainer_id };

    return {
      success: false,
      message:
        `No trainer found with name **"${options.trainer}"**.\n` +
        `Try using the autocomplete dropdown, or ask an admin to \`/link\` that trainer first.`,
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
