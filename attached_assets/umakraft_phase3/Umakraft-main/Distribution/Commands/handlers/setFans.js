// Distribution/Commands/handlers/setFans.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'set_fans';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content:  'You need the **Manage Guild** permission to configure fan quotas.',
      ephemeral: true,
    });
  }

  const amount       = interaction.options.getString('amount')        ?? null;
  const customAmount = interaction.options.getInteger('custom_amount') ?? null;

  if (amount === 'custom' && !customAmount) {
    return interaction.reply({
      content:  'Please provide a `custom_amount` when selecting **Custom**.',
      ephemeral: true,
    });
  }
  return coordinator.setFans({
    commandName: name,
    interaction,
    options: {
      status:       interaction.options.getBoolean('status') ?? false,
      circle:       interaction.options.getString('circle')   ?? null,
      scope:        interaction.options.getString('scope')    ?? null,
      amount,
      customAmount: amount === 'custom' ? customAmount : (amount ? parseInt(amount, 10) : null),
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
