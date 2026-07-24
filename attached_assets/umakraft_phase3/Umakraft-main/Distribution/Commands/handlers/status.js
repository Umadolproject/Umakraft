// Distribution/Commands/handlers/status.js
export const name = 'status';
export const defer = true;
export const ephemeral = true;

export async function execute(interaction, coordinator, client) {
  return coordinator.status({
    commandName: name,
    interaction,
    client,
    options: {},
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
