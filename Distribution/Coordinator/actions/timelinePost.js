// Distribution/Coordinator/actions/timelinePost.js
// Manually triggers a timeline post to the configured timeline channel.

import { getConfig } from '../utils/guildConfig.js';

export async function timelinePost(payload) {
  const { interaction, options, guildId } = payload;
  const date = options.date ?? new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      success: false,
      failedAt: 'Commands',
      error: 'PIPELINE_STAGE_ERROR',
      message: `Invalid date format: \`${date}\`. Use **YYYY-MM-DD**.`,
      retriable: false,
      interaction,
    };
  }

  const channelId = await getConfig(guildId, 'timeline_channel_id');
  const channelName = await getConfig(guildId, 'timeline_channel_name');

  if (!channelId) {
    return {
      success: false,
      failedAt: 'Coordinator',
      error: 'PIPELINE_STAGE_ERROR',
      message: 'Timeline channel is not configured for this server. Use `/timeline_setup` first.',
      retriable: false,
      interaction,
    };
  }

  const channel = interaction.guild?.channels.cache.get(channelId)
    ?? await interaction.client?.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return {
      success: false,
      failedAt: 'Coordinator',
      error: 'PIPELINE_STAGE_ERROR',
      message: `Configured timeline channel <#${channelId}> (${channelName ?? channelId}) is no longer accessible. Re-run \`/timeline_setup\` to pick a new channel.`,
      retriable: false,
      interaction,
    };
  }

  await channel.send({
    embeds: [{
      title: `📅 Timeline — ${date}`,
      description: `Timeline data for **${date}** will appear here once the timeline blueprint is built.`,
      footer: { text: `Triggered by ${interaction.user.tag}` },
      timestamp: new Date().toISOString(),
    }],
  });

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Timeline posted`,
      description: `Timeline for **${date}** sent to <#${channelId}>.`,
    },
    interaction,
  };
}
