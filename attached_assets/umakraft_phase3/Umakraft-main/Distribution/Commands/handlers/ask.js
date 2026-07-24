// Distribution/Commands/handlers/ask.js
// Handler for /ask — general repository & game mechanics questions.
export const name = 'ask';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  return coordinator.aiCommand({
    commandName: 'ask',
    subcommand:  'ask',
    interaction,
    options: {
      question: interaction.options.getString('question', true),
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
