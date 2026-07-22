// Distribution/Commands/handlers/linkList.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'link_list';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to view the link list.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.linkList({
    commandName: name,
    interaction,
    options: {
      page: interaction.options.getInteger('page') ?? 1,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
