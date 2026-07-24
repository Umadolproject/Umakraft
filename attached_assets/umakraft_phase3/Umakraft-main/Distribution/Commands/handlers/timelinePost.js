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
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return interaction.reply({
      content:  'Invalid date format. Use `YYYY-MM-DD` (e.g. `2026-07-21`).',
      ephemeral: true,
    });
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
