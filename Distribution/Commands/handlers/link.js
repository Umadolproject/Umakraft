// Distribution/Commands/handlers/link.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'link';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  // Permission check — must have Manage Guild
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to link members.',
      ephemeral: true,
    });
  }

  const trainer   = interaction.options.getString('trainer')    ?? null;
  const trainerId = interaction.options.getString('trainer_id') ?? null;

  if (!trainer && !trainerId) {
    return interaction.reply({
      content:  'Please provide a `trainer` name or `trainer_id`.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.link({
    commandName: name,
    interaction,
    options: {
      trainer,
      trainerId,
      member: interaction.options.getMember('member') ?? null,
      circle: interaction.options.getString('circle')  ?? null,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
