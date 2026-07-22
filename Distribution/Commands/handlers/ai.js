// Distribution/Commands/handlers/ai.js
// Handler for /ai — AI Knowledge Service subcommands:
//   explain, search, docs, glossary, message, live
export const name = 'ai';
export const defer = true;
export const ephemeral = false;

export async function execute(interaction, coordinator) {
  await interaction.deferReply({ ephemeral: false });

  const subcommand = interaction.options.getSubcommand();
  const options    = {};

  switch (subcommand) {
    case 'explain':
      options.topic = interaction.options.getString('topic', true);
      break;

    case 'search':
      options.query = interaction.options.getString('query', true);
      break;

    case 'docs':
      options.file = interaction.options.getString('file', true);
      break;

    case 'glossary':
      options.term = interaction.options.getString('term', true);
      break;

    case 'message':
      options.type             = interaction.options.getString('type', true);
      options.trainer_name     = interaction.options.getString('trainer_name')     ?? undefined;
      options.milestone_value  = interaction.options.getInteger('milestone_value') ?? undefined;
      options.achievement_name = interaction.options.getString('achievement_name') ?? undefined;
      options.event_name       = interaction.options.getString('event_name')       ?? undefined;
      options.event_date       = interaction.options.getString('event_date')       ?? undefined;
      break;

    case 'live':
      options.query = interaction.options.getString('query', true);
      break;

    default:
      break;
  }

  return coordinator.aiCommand({
    commandName: `ai ${subcommand}`,
    subcommand,
    interaction,
    options,
    guildId:   interaction.guildId,
    userId:    interaction.user.id,
    channelId: interaction.channelId,
  });
}
