// Distribution/Commands/handlers/totalCircleFanGain.js
export const name = 'total_circlefan_gain';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  return coordinator.totalCircleFanGain({
    commandName: name,
    interaction,
    options: {
      circle: interaction.options.getString('circle') ?? null,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
