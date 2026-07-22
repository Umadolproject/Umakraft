// Distribution/Commands/handlers/joinDate.js
export const name = 'joindate';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  await interaction.deferReply({ ephemeral: false });
  return coordinator.joinDate({
    commandName: name,
    interaction,
    options: {
      member:  interaction.options.getMember('member') ?? null,
      trainer: interaction.options.getString('trainer') ?? null,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
