// Distribution/Commands/handlers/store.js
export const name = 'store';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  const trainerId = interaction.options.getString('trainer_id');

  // Validate numeric format before deferring
  if (!/^\d+$/.test(trainerId)) {
    return interaction.reply({
      content:  'Invalid trainer ID. The ID must be a numeric value (e.g. `974470619`).',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.storeCard({
    commandName: name,
    interaction,
    options: { trainerId },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
