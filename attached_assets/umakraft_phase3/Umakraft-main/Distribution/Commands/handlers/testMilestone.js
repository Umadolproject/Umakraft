// Distribution/Commands/handlers/testMilestone.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'test_milestone';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to preview milestones.',
      ephemeral: true,
    });
  }
  return coordinator.testMilestone({
    commandName: name,
    interaction,
    options: {
      member:    interaction.options.getMember('member')    ?? null,
      trainer:   interaction.options.getString('trainer')   ?? null,
      milestone: interaction.options.getString('milestone'),
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
