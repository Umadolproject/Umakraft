// Distribution/Commands/handlers/browse.js
// Handler for /browse — explicit web-only search command.
// Forces online search, bypassing local docs. Returns AI-synthesized answer from web results.

export const name = 'browse';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  const query = interaction.options.getString('query', true);

  return coordinator.aiCommand({
    commandName: 'browse',
    subcommand:  'browse',
    interaction,
    options: { query },
    guildId:    interaction.guildId,
    userId:     interaction.user.id,
    channelId:  interaction.channelId,
  });
}
