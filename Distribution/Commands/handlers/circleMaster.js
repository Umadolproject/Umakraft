// Distribution/Commands/handlers/circleMaster.js
export const name = 'circle_master';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  // trigger_milestones requires Manage Guild — checked in coordinator
  await interaction.deferReply({ ephemeral: false });
  return coordinator.circleMaster({
    commandName: name,
    interaction,
    options: {
      day:               interaction.options.getInteger('day')           ?? null,
      circle:            interaction.options.getString('circle')          ?? null,
      triggerMilestones: interaction.options.getBoolean('trigger_milestones') ?? false,
    },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
