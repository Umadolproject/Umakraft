// Distribution/Coordinator/actions/setTimezone.js
// Persists the user's IANA timezone preference for greeting messages.

// Basic IANA zone validation via Intl — works without any external package.
function isValidTimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function setTimezone(payload) {
  const { interaction, options, userId, guildId } = payload;
  const { timezone } = options;

  if (!isValidTimezone(timezone)) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   `Invalid IANA timezone: ${timezone}`,
      retriable: false,
      interaction,
    };
  }

  // TODO: UPSERT INTO user_preferences (discord_id, guild_id, timezone)
  //       VALUES ($1, $2, $3)
  //       ON CONFLICT (discord_id, guild_id) DO UPDATE SET timezone = $3;

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Timezone set`,
      description: `Your timezone has been set to **${timezone}**. Greeting messages will now use your local time.\n\n*(Database layer pending — this confirmation is a stub.)*`,
    },
    interaction,
  };
}
