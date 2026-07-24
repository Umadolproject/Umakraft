// Distribution/Commands/handlers/adminSync.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'admin_sync';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to trigger a sync.',
      ephemeral: true,
    });
  }
  return coordinator.adminSync({
    commandName: name,
    interaction,
    options: {},
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
