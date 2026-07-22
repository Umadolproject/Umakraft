// Distribution/Coordinator/actions/timelineSetup.js
// Configures the timeline post channel for this guild.

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
      message:   `Channel \`#${cleanName}\` not found in this server.`,
      retriable: false,
      interaction,
    };
  }

  // TODO: UPSERT INTO guild_config (guild_id, key, value)
  //       VALUES ($1, 'timeline_channel_id', $2)
  //       ON CONFLICT (guild_id, key) DO UPDATE SET value = $2;

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Timeline channel configured`,
      description: `Timeline posts will be sent to <#${channel.id}>.\n\n*(Database layer pending — not persisted yet.)*`,
    },
    interaction,
  };
}
