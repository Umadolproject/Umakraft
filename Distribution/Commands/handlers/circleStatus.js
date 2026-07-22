// Distribution/Commands/handlers/circleStatus.js
export const name = 'circle_status';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  await interaction.deferReply({ ephemeral: true });
  return coordinator.circleStatus({
    commandName: name,
    interaction,
    options: {},
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
