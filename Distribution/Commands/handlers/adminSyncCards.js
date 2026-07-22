// Distribution/Commands/handlers/adminSyncCards.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'admin_synccards';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content:  'You need the **Administrator** permission to trigger a card sync.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.adminSyncCards({
    commandName: name,
    interaction,
    options: {},
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
