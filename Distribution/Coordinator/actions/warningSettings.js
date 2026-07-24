// Distribution/Coordinator/actions/warningSettings.js
// Views or updates the warning engine configuration for this guild.

import { getAllConfig, setConfig } from '../utils/guildConfig.js';

const THRESHOLD_KEYS = ['reminder_threshold', 'warning_threshold', 'critical_threshold'];

const DEFAULTS = {
  enabled: 'true',
  reminder_threshold: '90',
  warning_threshold: '50',
  critical_threshold: '20',
};

function cfgKey(key) { return `warning.${key}`; }

async function loadConfig(guildId) {
  const raw = await getAllConfig(guildId, 'warning.');
  const cfg = { ...DEFAULTS };
  for (const [rawKey, value] of Object.entries(raw)) {
    const key = rawKey.replace(/^warning\./, '');
    if (key in DEFAULTS) cfg[key] = value;
  }
  return cfg;
}

export async function warningSettings(payload) {
  const { interaction, options, guildId } = payload;
  const { subcommand, key, value } = options;

  // ── View ──────────────────────────────────────────────────────────────────
  if (subcommand === 'view') {
    const cfg = await loadConfig(guildId);
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title: '⚠️ Warning Engine Configuration',
        fields: [
          { name: 'Enabled', value: cfg.enabled === 'true' ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Reminder threshold', value: `${cfg.reminder_threshold}%`, inline: true },
          { name: 'Warning threshold', value: `${cfg.warning_threshold}%`, inline: true },
          { name: 'Critical threshold', value: `${cfg.critical_threshold}%`, inline: true },
        ],
        footer: 'Thresholds represent % of quota remaining when each alert fires.',
      },
      interaction,
    };
  }

  // ── Set ───────────────────────────────────────────────────────────────────
  if (key === 'enabled') {
    const boolVal = value.toLowerCase() === 'true';
    await setConfig(guildId, cfgKey('enabled'), String(boolVal));
    return {
      success: true,
      type: 'embed',
      ephemeral: true,
      result: {
        title: `✅ Warning engine ${boolVal ? 'enabled' : 'disabled'}`,
        description: `The warning engine is now **${boolVal ? 'enabled' : 'disabled'}** for this server.`,
      },
      interaction,
    };
  }

  if (THRESHOLD_KEYS.includes(key)) {
    const numVal = Number(value);
    if (isNaN(numVal) || numVal < 0 || numVal > 100) {
      return {
        success: false,
        failedAt: 'Commands',
        error: 'PIPELINE_STAGE_ERROR',
        message: `Threshold must be a number between 0 and 100. Got: \`${value}\`.`,
        retriable: false,
        interaction,
      };
    }
    const cfg = await loadConfig(guildId);
    cfg[key] = String(numVal);
    const r = Number(cfg.reminder_threshold);
    const w = Number(cfg.warning_threshold);
    const c = Number(cfg.critical_threshold);
    if (!(r > w && w > c)) {
      return {
        success: false,
        failedAt: 'Commands',
        error: 'PIPELINE_STAGE_ERROR',
        message: `Thresholds must satisfy **reminder > warning > critical**.\nWith your change: reminder=${r}%, warning=${w}%, critical=${c}%.`,
        retriable: false,
        interaction,
      };
    }
    await setConfig(guildId, cfgKey(key), String(numVal));
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       `✅ Setting updated`,
      description: `\`${key}\` set to **${numVal}%**.`,
      fields: [
        { name: 'Reminder', value: `${cfg.reminder_threshold}%`, inline: true },
        { name: 'Warning', value: `${cfg.warning_threshold}%`, inline: true },
        { name: 'Critical', value: `${cfg.critical_threshold}%`, inline: true },
      ],
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
