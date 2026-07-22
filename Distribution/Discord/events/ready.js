// Distribution/Discord/events/ready.js
// Fires once when the bot connects to the Discord gateway and is ready.
// Registers all scheduled tasks and starts the task runner.

import { schedule, start }          from '../../../tasks/index.js';
import { runOperationCycle }         from '../../../Operation/operation.js';
import { initialize as initAI }      from '../../../AI/RepositoryEngine.js';

export const name = 'ready';
export const once = true;

export async function execute(client) {
  console.log(`[ready] Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`[ready] Serving ${client.guilds.cache.size} guild(s)`);

  // ── AI Knowledge Service — Repository Engine ────────────────────────────
  // Initialize once at startup: connects to VDB and indexes the repository.
  // /ask and /ai commands degrade gracefully if this fails.
  try {
    await initAI();
    console.log('[ready] AI Repository Engine initialized.');
  } catch (err) {
    console.error(`[ready] AI Repository Engine init failed (AI commands degraded): ${err.message}`);
  }

  // ── Operation supervisor — 5-minute health check cycle ─────────────────
  // Investigator → Logger → Manager → (Broadcast/Announcer on escalation)
  schedule('operation', '*/5 * * * *', runOperationCycle);

  // TODO: Register Broadcast cron triggers here (warning engine, milestone checks).
  // These are owned by Broadcast — they are started from this event handler
  // but implemented in Broadcast/Broker/.

  // ── Start all registered tasks ─────────────────────────────────────────
  // Each task fires immediately on start, then repeats on its cron interval.
  start(client);
}
