// Distribution/Coordinator/actions/status.js
// Returns live bot health — uptime, last sync time, active circle count.

import { client } from '../../Discord/index.js';

export async function status(payload) {
  const { interaction } = payload;

  const uptimeMs   = process.uptime() * 1000;
  const uptimeStr  = formatUptime(uptimeMs);
  const guildCount = client.guilds.cache.size;
  const memoryMb   = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

  // TODO: Pull last sync time and next sync time from Umamoe scheduler state.
  // TODO: Pull active circle count from guild config table.

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:  '🤖 Bot Status',
      fields: [
        { name: 'Uptime',         value: uptimeStr,         inline: true },
        { name: 'Guilds',         value: String(guildCount), inline: true },
        { name: 'Memory',         value: `${memoryMb} MB`,  inline: true },
        { name: 'Last Sync',      value: 'Pending (scheduler not wired)', inline: false },
        { name: 'Next Sync',      value: 'Pending (scheduler not wired)', inline: false },
      ],
    },
    interaction,
  };
}

function formatUptime(ms) {
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s  / 60);
  const h  = Math.floor(m  / 60);
  const d  = Math.floor(h  / 24);
  if (d > 0)  return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0)  return `${h}h ${m % 60}m`;
  if (m > 0)  return `${m}m ${s % 60}s`;
  return `${s}s`;
}
