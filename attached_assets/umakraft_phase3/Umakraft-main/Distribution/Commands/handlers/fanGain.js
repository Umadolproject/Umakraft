// Distribution/Commands/handlers/fanGain.js
export const name = 'fan_gain';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  return coordinator.fanGain({
    commandName: name,
    interaction,
    options: {
      member:  interaction.options.getMember('member') ?? null,
      trainer: interaction.options.getString('trainer') ?? null,
      circle:  interaction.options.getString('circle')  ?? null,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
