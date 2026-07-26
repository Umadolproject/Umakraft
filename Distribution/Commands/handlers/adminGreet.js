// Distribution/Commands/handlers/adminGreet.js
// Admin-only command — generates and posts an AI greeting to the current channel.
export const name = 'admin-greet';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  return coordinator.aiCommand({
    commandName: 'admin-greet',
    subcommand:  'message',
    interaction,
    options:     { type: 'greeting' },
    guildId:     interaction.guildId,
    userId:      interaction.user.id,
    channelId:   interaction.channelId,
  });
}
