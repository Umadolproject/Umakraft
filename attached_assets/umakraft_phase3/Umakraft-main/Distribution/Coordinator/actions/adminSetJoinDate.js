// Distribution/Coordinator/actions/adminSetJoinDate.js
// Manually overrides a member's circle join date in the database.

export async function adminSetJoinDate(payload) {
  const { interaction, options, guildId } = payload;
  const { date, member, trainer } = options;

  const targetLabel = member ? `<@${member.id}>` : `**${trainer}**`;

  // TODO: Resolve Discord member or trainer name → trainer_id via member_links.
  // TODO: UPDATE member_links SET join_date = $1 WHERE guild_id = $2 AND (discord_id = $3 OR trainer_name = $4);
  // If 0 rows updated → member not linked → return MEMBER_NOT_LINKED error.

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Join date updated`,
      description: `${targetLabel}'s join date has been set to **${date}**.\n\n*(Database layer pending — not persisted yet.)*`,
    },
    interaction,
  };
}
