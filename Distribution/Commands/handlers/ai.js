// Distribution/Commands/handlers/ai.js
// Handler for /ai — AI Knowledge Service subcommands:
//   explain, search, docs, glossary, live
// ADMIN-ONLY: regular members must use @mention instead.

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
    case 'explain':
      options.topic = interaction.options.getString('topic', true);
      break;

    case 'search':
      options.query = interaction.options.getString('query', true);
      break;

    case 'docs':
      options.file = interaction.options.getString('file', true);
      break;

    case 'glossary':
      options.term = interaction.options.getString('term', true);
      break;

    case 'live':
      options.query = interaction.options.getString('query', true);
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
