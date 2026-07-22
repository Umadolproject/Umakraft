// Distribution/Commands/handlers/help.js
export const name = 'help';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  await interaction.deferReply({ ephemeral: false });
  return coordinator.help({
    commandName: name,
    interaction,
    options: {},
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
