// Distribution/Commands/handlers/adminGreet.js
// Admin-only command — generates and posts an AI greeting to the current channel.

import { PermissionFlagsBits } from 'discord.js';

export const name = 'admin-greet';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to trigger an AI greeting.',
      ephemeral: true,
    });
  }
  return coordinator.aiCommand({
    commandName: 'admin-greet',
    subcommand:  'message',
    interaction,
    options:     { type: 'greeting' },
    guildId:     interaction.guildId,
    userId:      interaction.user.id,
    channelId:   interaction.channelId,
  });
}
