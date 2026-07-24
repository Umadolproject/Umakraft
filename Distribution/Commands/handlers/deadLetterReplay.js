import { PermissionFlagsBits } from 'discord.js';

export const name = 'deadletter_replay';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator, client) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: 'You need the **Manage Guild** permission to replay a dead-letter record.',
      ephemeral: true,
    });
  }

  return coordinator.deadLetterReplay({
    commandName: name,
    interaction,
    client,
    options: {
      notificationKey: interaction.options.getString('notification_key', true),
    },
    guildId: interaction.guildId,
    userId: interaction.user.id,
    channelId: interaction.channelId,
  });
}
