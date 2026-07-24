// Distribution/Commands/handlers/clubGain.js
export const name = 'club_gain';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  return coordinator.clubGain({
    commandName: name,
    interaction,
    options: {
      club: interaction.options.getString('club')   ?? null,
      days: interaction.options.getInteger('days')  ?? 30,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
