// Distribution/Commands/handlers/warningSettings.js
import { PermissionFlagsBits } from 'discord.js';

export const name = 'warningsettings';
export const defer = true;
export const ephemeral = true;

const VALID_KEYS = new Set(['enabled', 'reminder_threshold', 'warning_threshold', 'critical_threshold']);

export async function execute(interaction, coordinator) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content:  'You need the **Administrator** permission to use this command.',
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  let key = null;
  let value = null;

  if (subcommand === 'set') {
    key   = interaction.options.getString('key');
    value = interaction.options.getString('value');

    if (!VALID_KEYS.has(key)) {
      return interaction.reply({ content: `Unknown setting key \`${key}\`.`, ephemeral: true });
    }

    // Threshold keys must be numeric 1–100
    if (key !== 'enabled' && (isNaN(Number(value)) || Number(value) < 1 || Number(value) > 100)) {
      return interaction.reply({
        content:  `Invalid value for \`${key}\`. Expected a number between 1 and 100.`,
        ephemeral: true,
      });
    }
    // enabled must be true/false
    if (key === 'enabled' && !['true', 'false'].includes(value.toLowerCase())) {
      return interaction.reply({
        content:  `Invalid value for \`enabled\`. Expected \`true\` or \`false\`.`,
        ephemeral: true,
      });
    }
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.warningSettings({
    commandName: name,
    interaction,
    options: { subcommand, key, value },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
