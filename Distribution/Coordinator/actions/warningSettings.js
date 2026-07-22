// Distribution/Coordinator/actions/warningSettings.js
// Views or updates the warning engine configuration for this guild.

const THRESHOLD_KEYS = new Set(['reminder_threshold', 'warning_threshold', 'critical_threshold']);

export async function warningSettings(payload) {
  const { interaction, options, guildId } = payload;
  const { subcommand, key, value } = options;

  // ── View ──────────────────────────────────────────────────────────────────
  if (subcommand === 'view') {
    // TODO: SELECT * FROM warning_config WHERE guild_id = $1
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title: '⚠️ Warning Engine Configuration',
        fields: [
          { name: 'Enabled',              value: 'true',  inline: true },
          { name: 'Reminder threshold',   value: '90%',   inline: true },
          { name: 'Warning threshold',    value: '50%',   inline: true },
          { name: 'Critical threshold',   value: '20%',   inline: true },
        ],
        footer: 'Database layer pending — showing placeholder values.',
      },
      interaction,
    };
  }

  // ── Set ───────────────────────────────────────────────────────────────────
  if (THRESHOLD_KEYS.has(key)) {
    const numVal = Number(value);
    // TODO: Fetch current config, validate ordering, then persist.
    // Reminder < Warning < Critical — enforced here.
    // Current stub: just acknowledge.
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       `✅ Setting updated`,
        description: `\`${key}\` has been set to **${numVal}%**.\n\n*(Database layer pending — not persisted yet.)*`,
      },
      interaction,
    };
  }

  // enabled toggle
  if (key === 'enabled') {
    const boolVal = value.toLowerCase() === 'true';
    // TODO: UPDATE warning_config SET enabled = $1 WHERE guild_id = $2;
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       `✅ Warning engine ${boolVal ? 'enabled' : 'disabled'}`,
        description: `The warning engine has been ${boolVal ? '**enabled**' : '**disabled**'} for this server.\n\n*(Database layer pending — not persisted yet.)*`,
      },
      interaction,
    };
  }

  return {
    success:   false,
    failedAt:  'Coordinator',
    error:     'PIPELINE_STAGE_ERROR',
    message:   `Unknown setting key: ${key}`,
    retriable: false,
    interaction,
  };
}
