// Distribution/Commands/handlers/interCircleLeaderboard.js
export const name = 'intercircleleaderboard';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  await interaction.deferReply({ ephemeral: false });
  return coordinator.interCircleLeaderboard({
    commandName: name,
    interaction,
    options: {
      scope: interaction.options.getString('scope')   ?? 'daily',
      top:   interaction.options.getInteger('top')    ?? 10,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
