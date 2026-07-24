import { PermissionFlagsBits } from 'discord.js';

export const name = 'deadletter_inspect';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator, client) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: 'You need the **Manage Guild** permission to inspect dead-letter records.',
      ephemeral: true,
    });
  }

  return coordinator.deadLetterInspect({
    commandName: name,
    interaction,
    client,
    options: {
      notificationKey: interaction.options.getString('notification_key') ?? null,
      limit: interaction.options.getInteger('limit') ?? null,
    },
    guildId: interaction.guildId,
    userId: interaction.user.id,
    channelId: interaction.channelId,
  });
}
