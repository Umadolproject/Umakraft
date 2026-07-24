// Distribution/Coordinator/actions/timelineSetup.js
// Configures the timeline post channel for this guild.

import { setConfig } from '../utils/guildConfig.js';

export async function timelineSetup(payload) {
  const { interaction, options, guildId } = payload;
  const { channelName } = options;

  // Strip leading # if the user typed #channel-name
  const cleanName = channelName.replace(/^#/, '');

  // Try to resolve the channel in the current guild
  const guild   = interaction.guild;
  const channel = guild?.channels.cache.find(c => c.name === cleanName);

  if (!channel) {
    return {
      success:   false,
      failedAt:  'Coordinator',
      error:     'PIPELINE_STAGE_ERROR',
      message:   `Channel \`#${cleanName}\` not found in this server. Make sure the name is exact (no spaces → use dashes).`,
      retriable: false,
      interaction,
    };
  }

  await setConfig(guildId, 'timeline_channel_id', channel.id);
  await setConfig(guildId, 'timeline_channel_name', channel.name);

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Timeline channel configured`,
      description: `Timeline posts will be sent to <#${channel.id}>. Use \`/timeline_post\` to trigger a post manually.`,
    },
    interaction,
  };
}
