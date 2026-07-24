// Distribution/Discord/events/ready.js
// Fires once when the bot connects to the Discord gateway and is ready.
// Registers all scheduled tasks and starts the task runner.

import { schedule, start } from '../../../tasks/index.js';
import { runOperationCycle } from '../../../Operation/operation.js';

export const name = 'clientReady';
export const once = true;

export async function execute(client) {
  console.log(`[ready] Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`[ready] Serving ${client.guilds.cache.size} guild(s)`);
  console.log('[ready] AI initialization is deferred until the first AI command.');

  schedule('operation', '*/5 * * * *', runOperationCycle);
  start(client);
}
