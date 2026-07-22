// Distribution/Commands/handlers/memberList.js
export const name = 'memberlist';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  await interaction.deferReply({ ephemeral: false });
  return coordinator.memberList({
    commandName: name,
    interaction,
    options: {
      includeFormer: interaction.options.getBoolean('include_former') ?? false,
      circle:        interaction.options.getString('circle')           ?? null,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
