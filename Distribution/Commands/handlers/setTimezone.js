// Distribution/Commands/handlers/setTimezone.js
export const name = 'set_timezone';
export const defer = true;
export const ephemeral = true;

// Validate a basic IANA timezone string (does not cover every edge case,
// but prevents obvious garbage input before hitting the database).
const IANA_RE = /^[A-Za-z_]+(?:\/[A-Za-z_]+){0,2}$/;

export async function execute(interaction, coordinator) {
  const timezone = interaction.options.getString('timezone');

  if (!IANA_RE.test(timezone)) {
    return interaction.reply({
      content:  `Invalid timezone format. Use an IANA timezone string, e.g. \`Asia/Tokyo\` or \`America/New_York\`.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  return coordinator.setTimezone({
    commandName: name,
    interaction,
    options: { timezone },
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
