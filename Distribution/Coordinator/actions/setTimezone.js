// Distribution/Coordinator/actions/setTimezone.js
// Persists the user's IANA timezone preference for greeting messages.

import { setTimezone as persistTimezone } from '../utils/userPreferences.js';

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
      message:   `\`${timezone}\` is not a valid IANA timezone. Examples: \`Europe/Amsterdam\`, \`Asia/Tokyo\`, \`America/New_York\`.`,
      retriable: false,
      interaction,
    };
  }

  await persistTimezone(userId, guildId, timezone);

  const sampleTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date());

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Timezone set`,
      description: `Your timezone has been set to **${timezone}**.\nCurrent local time: **${sampleTime}**\n\nGreeting messages will now use your local time.`,
    },
    interaction,
  };
}
