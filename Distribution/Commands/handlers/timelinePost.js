// Distribution/Commands/handlers/timelinePost.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'timeline_post';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to post timelines.',
      ephemeral: true,
    });
  }

  const date = interaction.options.getString('date') ?? null;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return interaction.reply({
        content:  'Invalid date format. Use `YYYY-MM-DD` (e.g. `2026-07-21`).',
        ephemeral: true,
      });
    }
    // Date.parse for initial validation; component check catches auto-roll
    // (e.g. 2026-02-30 → Mar 2 in V8).
    if (isNaN(Date.parse(date))) {
      return interaction.reply({
        content:  `\`${date}\` is not a valid calendar date.`,
        ephemeral: true,
      });
    }
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(date);
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() + 1 !== m || parsed.getUTCDate() !== d) {
      return interaction.reply({
        content:  `\`${date}\` is not a valid calendar date.`,
        ephemeral: true,
      });
    }
  }
  return coordinator.timelinePost({
    commandName: name,
    interaction,
    options: { date },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
