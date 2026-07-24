// Distribution/Coordinator/actions/linkList.js
// Returns a paginated embed of all linked members in this guild.

import { listLinks } from '../utils/memberLinks.js';

const PAGE_SIZE = 20;

export async function linkList(payload) {
  const { interaction, options, guildId } = payload;
  const page   = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { links, total } = await listLinks(guildId, { limit: PAGE_SIZE, offset });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total === 0) {
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       '🔗 Linked Members',
        description: 'No members are linked in this guild yet. Use `/link` to connect Discord members to Uma.moe trainers.',
      },
      interaction,
    };
  }

  if (page > totalPages) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   `Page ${page} does not exist. There are only **${totalPages}** page${totalPages !== 1 ? 's' : ''}.`,
      retriable: false,
      interaction,
    };
  }

  const lines = links.map((l, i) => {
    const num      = offset + i + 1;
    const joinInfo = l.joinDate ? ` · joined ${l.joinDate}` : '';
    return `**${num}.** ${l.trainerName} — <@${l.discordId}> · ID \`${l.trainerId}\`${joinInfo}`;
  });

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `🔗 Linked Members (${total} total)`,
      description: lines.join('\n'),
      footer:      `Page ${page} of ${totalPages}`,
    },
    interaction,
  };
}
