// Distribution/Commands/handlers/leaderboard.js
export const name = 'leaderboard';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  // Validate date format before deferring so we can reject synchronously.
  const date = interaction.options.getString('date');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return interaction.reply({ content: 'Invalid date format. Use `YYYY-MM-DD` (e.g. `2026-06-15`).', ephemeral: true });
  }
  if (date && new Date(date) > new Date()) {
    return interaction.reply({ content: 'Date cannot be in the future.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: false });
  return coordinator.leaderboard({
    commandName: name,
    interaction,
    options: {
      scope:  interaction.options.getString('scope')   ?? 'daily',
      top:    interaction.options.getInteger('top')    ?? 10,
      circle: interaction.options.getString('circle')  ?? null,
      date,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
