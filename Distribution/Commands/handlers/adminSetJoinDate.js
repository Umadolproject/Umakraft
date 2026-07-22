// Distribution/Commands/handlers/adminSetJoinDate.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'admin_setjoindate';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to override join dates.',
      ephemeral: true,
    });
  }

  const date = interaction.options.getString('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return interaction.reply({
      content:  'Invalid date format. Use `YYYY-MM-DD` (e.g. `2026-06-15`).',
      ephemeral: true,
    });
  }

  const member  = interaction.options.getMember('member')   ?? null;
  const trainer = interaction.options.getString('trainer')  ?? null;
  if (!member && !trainer) {
    return interaction.reply({
      content:  'Please specify either a `member` or a `trainer` name.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.adminSetJoinDate({
    commandName: name,
    interaction,
    options: { date, member, trainer },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
