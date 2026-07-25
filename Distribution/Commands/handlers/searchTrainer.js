// Distribution/Commands/handlers/searchTrainer.js
export const name = 'search_trainer';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  // When autocomplete is used the trainer field returns the numeric trainer ID.
  // Detect this so the coordinator can look up by ID instead of name.
  const trainerRaw   = interaction.options.getString('trainer')     ?? null;
  const rank         = interaction.options.getInteger('rank')       ?? null;
  const whiteskills  = interaction.options.getInteger('whiteskills') ?? null;

  // Autocomplete selection → value is always the numeric trainer ID
  const trainerIsId  = trainerRaw != null && /^\d+$/.test(trainerRaw.trim());
  const trainer      = trainerIsId ? null : trainerRaw;
  const trainerId    = trainerIsId ? trainerRaw.trim() : null;

  if (!trainer && !trainerId && rank === null && whiteskills === null) {
    return interaction.reply({
      content:  'Please provide at least one search option: `trainer`, `rank`, or `whiteskills`.',
      ephemeral: true,
    });
  }
  return coordinator.searchTrainer({
    commandName: name,
    interaction,
    options: { trainer, trainerId, rank, whiteskills },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
