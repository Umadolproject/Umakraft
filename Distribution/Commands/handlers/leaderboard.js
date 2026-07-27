// Distribution/Commands/handlers/leaderboard.js
export const name = 'leaderboard';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  // Validate date format and calendar validity; the boundary already deferred,
  // so the proxy translates interaction.reply() to editReply() automatically.
  const date = interaction.options.getString('date');
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return interaction.reply({ content: 'Invalid date format. Use `YYYY-MM-DD` (e.g. `2026-06-15`).', ephemeral: true });
    }
    // Date.parse is used for validation; component re-check catches auto-roll
    // (e.g. 2026-02-30 → Mar 2 in V8, detected because day 30 ≠ day 2).
    if (isNaN(Date.parse(date))) {
      return interaction.reply({ content: `\`${date}\` is not a valid calendar date.`, ephemeral: true });
    }
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(date);
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() + 1 !== m || parsed.getUTCDate() !== d) {
      return interaction.reply({ content: `\`${date}\` is not a valid calendar date.`, ephemeral: true });
    }
    if (parsed > new Date()) {
      return interaction.reply({ content: 'Date cannot be in the future.', ephemeral: true });
    }
  }
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
