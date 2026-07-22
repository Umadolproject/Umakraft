// Distribution/Commands/handlers/searchTrainer.js
export const name = 'search_trainer';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  // Require at least one search option
  const trainer     = interaction.options.getString('trainer')     ?? null;
  const rank        = interaction.options.getInteger('rank')       ?? null;
  const whiteskills = interaction.options.getInteger('whiteskills') ?? null;

  if (!trainer && rank === null && whiteskills === null) {
    return interaction.reply({
      content:  'Please provide at least one search option: `trainer`, `rank`, or `whiteskills`.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.searchTrainer({
    commandName: name,
    interaction,
    options: { trainer, rank, whiteskills },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
