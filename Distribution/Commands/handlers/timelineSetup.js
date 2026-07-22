// Distribution/Commands/handlers/timelineSetup.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'timeline_setup';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to configure the timeline channel.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.timelineSetup({
    commandName: name,
    interaction,
    options: {
      channelName: interaction.options.getString('channel_name'),
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
