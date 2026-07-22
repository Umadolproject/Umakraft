// Distribution/Commands/handlers/unlink.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'unlink';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to unlink members.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.unlink({
    commandName: name,
    interaction,
    options: {
      member: interaction.options.getMember('member'),
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
