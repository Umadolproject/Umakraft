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

// TODO: Replace stubs with real database lookups once the persistence layer
// (member_links table) is built. The function signature and return shape are final.

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

  // 2. Trainer name — TODO: query member_links WHERE trainer_name = options.trainer AND guild_id = guildId
  if (options.trainer) {
    // STUB: return not-implemented until database layer is ready
    return {
      success: false,
      message: `Trainer name lookup not yet implemented. Provide \`trainer_id\` directly for now.`,
    };
  }

  // 3. Discord member — TODO: query member_links WHERE discord_id = options.member.id AND guild_id = guildId
  if (options.member) {
    return {
      success: false,
      message: `Member lookup not yet implemented. Provide \`trainer_id\` directly for now.`,
    };
  }

  // 4. Self — TODO: query member_links WHERE discord_id = userId AND guild_id = guildId
  return {
    success: false,
    message: `You have not been linked to an Uma.moe account yet. Ask an admin to use \`/link\` for you.`,
  };
}
