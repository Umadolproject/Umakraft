// Distribution/Coordinator/actions/adminSetJoinDate.js
// Manually overrides a member's circle join date in the database.

import { getLinkByDiscordId, getLinkByTrainerId, getLinkByTrainerName, updateJoinDate } from '../utils/memberLinks.js';

export async function adminSetJoinDate(payload) {
  const { interaction, options, guildId } = payload;
  const { date, member, trainer } = options;

  if (!member && !trainer) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   'Please provide either a Discord member or a trainer name.',
      retriable: false,
      interaction,
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   `Invalid date format: \`${date}\`. Use **YYYY-MM-DD**.`,
      retriable: false,
      interaction,
    };
  }

  let link;
  if (member) {
    link = await getLinkByDiscordId(member.id, guildId);
  } else if (/^\d+$/.test(trainer.trim())) {
    link = await getLinkByTrainerId(trainer.trim(), guildId);
  } else {
    link = await getLinkByTrainerName(trainer, guildId);
  }

  if (!link) {
    const label = member ? `<@${member.id}>` : `**${trainer}**`;
    return {
      success:   false,
      failedAt:  'Coordinator',
      error:     'MEMBER_NOT_LINKED',
      message:   `${label} is not linked to any Uma.moe trainer in this guild. Use \`/link\` first.`,
      retriable: false,
      interaction,
    };
  }

  await updateJoinDate(link.discordId, guildId, date);

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Join date updated`,
      description: `**${link.trainerName}** (<@${link.discordId}>) join date set to **${date}**.`,
    },
    interaction,
  };
}
