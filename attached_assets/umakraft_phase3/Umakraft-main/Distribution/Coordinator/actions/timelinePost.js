// Distribution/Coordinator/actions/timelinePost.js
// Manually triggers a timeline post to the configured timeline channel.

export async function timelinePost(payload) {
  const { interaction, options, guildId } = payload;
  const date = options.date ?? new Date().toISOString().slice(0, 10);

  // TODO: 1. Fetch guild_config timeline_channel_id for this guild.
  //       2. If not configured → error: "Timeline channel not configured. Use /timeline_setup first."
  //       3. Fetch event/timeline data for the given date from Umamoe.
  //       4. Render via Workshop (timeline blueprint).
  //       5. Post to the configured channel (via Dispatcher or direct client.channels.fetch).
  //       6. Reply ephemeral confirmation to the caller.

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Timeline post triggered`,
      description: `Timeline for **${date}** will be posted to the configured channel.\n\n*(Database layer pending — timeline channel config not yet persisted.)*`,
    },
    interaction,
  };
}
