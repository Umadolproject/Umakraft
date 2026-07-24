// Distribution/Coordinator/actions/setFans.js
// Views or updates fan gain quota targets for a circle.

import { getAllConfig, setConfig } from '../utils/guildConfig.js';
import { CONFIGURED_CIRCLES } from '../../../core/botConfig.js';

const SCOPES = ['daily', 'weekly', 'monthly'];

function circleKey(circle, scope) {
  return `quota.${circle ?? 'primary'}.${scope}`;
}

function fmt(val) {
  if (val == null) return 'Not set';
  return Number(val).toLocaleString();
}

export async function setFans(payload) {
  const { interaction, options, guildId } = payload;
  const { status, circle, scope, amount, customAmount } = options;
  const targetCircle = circle ?? String(CONFIGURED_CIRCLES[0] ?? 'primary');

  // ── View mode ─────────────────────────────────────────────────────────────
  if (status || (!scope && amount == null && customAmount == null)) {
    const all = await getAllConfig(guildId, `quota.${targetCircle}.`);
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       `📊 Fan Quota Settings — ${targetCircle}`,
        description: `Current quota configuration for circle **${targetCircle}**.`,
        fields: SCOPES.map(s => ({
          name: s.charAt(0).toUpperCase() + s.slice(1),
          value: fmt(all[circleKey(targetCircle, s)]),
          inline: true,
        })),
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
      message:   'Please specify a **scope** (daily, weekly, or monthly) when setting a quota.',
      retriable: false,
      interaction,
    };
  }

  const finalAmount = customAmount ?? (amount ? parseInt(amount, 10) : null);

  if (finalAmount == null || isNaN(finalAmount) || finalAmount < 0) {
    return {
      success: false,
      failedAt: 'Commands',
      error: 'PIPELINE_STAGE_ERROR',
      message: 'Please provide a valid quota amount.',
      retriable: false,
      interaction,
    };
  }

  await setConfig(guildId, circleKey(targetCircle, scope), finalAmount);

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       `✅ Quota updated`,
      description: `**${scope.charAt(0).toUpperCase() + scope.slice(1)}** fan quota for circle **${targetCircle}** set to **${finalAmount.toLocaleString()}**.`,
    },
    interaction,
  };
}
