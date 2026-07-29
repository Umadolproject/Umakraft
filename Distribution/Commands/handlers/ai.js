// Distribution/Commands/handlers/ai.js
// Handler for /ai — AI Knowledge Service subcommands:
//   search, docs
// ADMIN-ONLY: regular members must use @mention or /ask instead.
//
// NOTE: /ai explain and /ai glossary have been merged into /ask.
//       Use /ask "explain …" or /ask "define …" instead.

import { PermissionFlagsBits } from 'discord.js';

export const name = 'ai';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  // ── Admin-only guard ────────────────────────────────────────────────────
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content:
        '🔒 The `/ai` command is restricted to administrators.\n\n' +
        '**Members:** just **@mention me** with your question and I\'ll answer!\n' +
        'For example: `@Umakraft How is my fan gain today?`',
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const options    = {};

  switch (subcommand) {
    case 'search':
      options.query = interaction.options.getString('query', true);
      break;

    case 'docs':
      options.file = interaction.options.getString('file', true);
      break;

    default:
      break;
  }

  return coordinator.aiCommand({
    commandName: `ai ${subcommand}`,
    subcommand,
    interaction,
    options,
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
