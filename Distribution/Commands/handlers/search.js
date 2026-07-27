// Distribution/Commands/handlers/search.js
// Handler for /search — explicit web search command.
// Searches the web directly (bypasses local docs) and returns an AI-synthesized answer.

export const name = 'search';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  const query = interaction.options.getString('query', true);

  return coordinator.aiCommand({
    commandName: 'search',
    subcommand:  'web-search',
    interaction,
    options: { query },
    guildId:    interaction.guildId,
    userId:     interaction.user.id,
    channelId:  interaction.channelId,
  });
}
