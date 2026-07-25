// Distribution/Coordinator/utils/resolveMember.js
// Resolves an Uma.moe trainer ID from slash command options.
//
// Priority order:
//   1. options.trainerId  — provided directly (e.g. /store, /keep, /link trainer_id:...)
//   2. options.trainer    — value from the trainer autocomplete field
//      a. Pure numeric string → treat as trainer ID (autocomplete selection)
//      b. Text name → check member_links first, then the local trainer DB
//      c. Local DB fuzzy search → LIKE match when exact fails
//      d. Live uma.moe search API → last resort for unknown names
//   3. options.member     — Discord GuildMember → look up their linked trainerId
//   4. self (userId)      — the calling user's linked trainerId
//
// Returns: { success: boolean, value?: string, message?: string }

import { getLinkByDiscordId, getLinkByTrainerName } from './memberLinks.js';
import { getByName, searchByName } from './trainerDb.js';
import { searchTrainers } from '../../../umamoe/Miner/miner.js';

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

    // 2c. Exact match in the local trainer DB (seeded from circles on startup)
    const dbEntry = await getByName(options.trainer);
    if (dbEntry?.trainer_id) return { success: true, value: dbEntry.trainer_id };

    // 2d. Fuzzy match in the local trainer DB (LIKE search)
    const fuzzyMatches = await searchByName(options.trainer, 5);
    if (fuzzyMatches.length === 1) {
      // Single unambiguous match — use it
      return { success: true, value: fuzzyMatches[0].trainer_id };
    }
    if (fuzzyMatches.length > 1) {
      // Multiple matches — return the first but warn
      return { success: true, value: fuzzyMatches[0].trainer_id };
    }

    // 2e. Live uma.moe search API — last resort for unknown names
    try {
      const liveResult = await searchTrainers({ q: options.trainer, limit: 3 });
      if (liveResult?.success && Array.isArray(liveResult.data) && liveResult.data.length > 0) {
        const first = liveResult.data[0];
        const trainerId = String(first.id ?? first.viewer_id ?? first.trainer_id ?? '');
        if (trainerId) return { success: true, value: trainerId };
      }
    } catch {
      // Live search is best-effort; fall through to error
    }

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
