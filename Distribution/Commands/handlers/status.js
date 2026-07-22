// Distribution/Commands/handlers/status.js
export const name = 'status';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator) {
  await interaction.deferReply({ ephemeral: true });
  return coordinator.status({
    commandName: name,
    interaction,
    options: {},
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
