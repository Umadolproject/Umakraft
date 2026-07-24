// Distribution/Discord/events/ready.js
// Fires once when the bot connects to the Discord gateway and is ready.
// Registers all scheduled tasks and starts the task runner.

import { Events } from 'discord.js';
import { schedule, scheduleDailyAt, start } from '../../../tasks/index.js';
import { runOperationCycle } from '../../../Operation/operation.js';
import { runMinerCycle } from '../../../tasks/minerTask.js';

export const name = Events.ClientReady;
export const once = true;

const MINER_TIMEZONE = process.env.MINER_TIMEZONE || 'Europe/Amsterdam';

export async function execute(client) {
  console.log(`[ready] Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`[ready] Serving ${client.guilds.cache.size} guild(s)`);
  console.log('[ready] AI initialization is deferred until the first AI command.');

  // Health / ops check every 5 minutes
  schedule('operation', '*/5 * * * *', runOperationCycle);

  // Daily uma.moe data fetch — 18:00 and 18:30 Amsterdam (uma.moe finishes updating by then)
  scheduleDailyAt('miner-1800', 18, 0,  MINER_TIMEZONE, runMinerCycle);
  scheduleDailyAt('miner-1830', 18, 30, MINER_TIMEZONE, runMinerCycle);

  start(client);
}
