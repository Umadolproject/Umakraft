// Distribution/Coordinator/actions/setFans.js
// Views or updates fan gain quota targets for a circle.

export async function setFans(payload) {
  const { interaction, options, guildId } = payload;
  const { status, circle, scope, customAmount } = options;

  // ── View mode ─────────────────────────────────────────────────────────────
  if (status || (!scope && !customAmount)) {
    // TODO: SELECT * FROM circle_quotas WHERE guild_id = $1 AND circle = $2
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       `📊 Fan Quota Settings`,
        description: `Current quota configuration for **${circle ?? 'primary circle'}**.\n\n*(Database layer pending — displaying placeholder.)*`,
        fields: [
          { name: 'Daily',   value: 'Not set', inline: true },
          { name: 'Weekly',  value: 'Not set', inline: true },
          { name: 'Monthly', value: 'Not set', inline: true },
        ],
      },
      interaction,
    };
  }

  // ── Set mode ──────────────────────────────────────────────────────────────
  if (!scope) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'PIPELINE_STAGE_ERROR',
      message:   'Please specify a scope (daily, weekly, or monthly) when setting a quota.',
      retriable: false,
      interaction,
    };
  }

  const amount = customAmount ?? 0;

  // TODO: UPSERT INTO circle_quotas (guild_id, circle, scope, amount)
  //       VALUES ($1, $2, $3, $4)
  //       ON CONFLICT (guild_id, circle, scope) DO UPDATE SET amount = $4;

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Quota updated`,
      description: `**${scope.charAt(0).toUpperCase() + scope.slice(1)}** fan quota set to **${amount.toLocaleString()}** for **${circle ?? 'primary circle'}**.\n\n*(Database layer pending — not persisted yet.)*`,
    },
    interaction,
  };
}
