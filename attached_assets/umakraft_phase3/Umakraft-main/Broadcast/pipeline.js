/**
 * Broadcast Pipeline Wire
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Stage:     5 — Broadcast (Deliver Notifications)
 *
 * Connects Stage 5 (Broadcast) internally:
 *
 *   Broker → Archive-Inspector → Archive → Archive-Transporter → Announcer
 *
 * This module is the entry point that tasks/index.js calls on a cron tick.
 * It owns no business logic — only startup initialization, type registration
 * convenience, and the public trigger surface (run / recoverIncomplete).
 *
 * Typical startup sequence:
 *   import * as broadcast from './Broadcast/pipeline.js';
 *   await broadcast.init();
 *   broadcast.registerType('dailyWarning', { buildKey, checkEligibility, resolveRecipients, selectVariant });
 *   broadcast.registerFetch('dailyWarning', async (circleId) => depot.fetch(circleId));
 *   broadcast.setConfiguredCircles(['circle-001', 'circle-002']);
 *   await broadcast.recoverIncomplete(null, discordClient);
 *   // Then wire into cron:
 *   //   cron.schedule('0 23 * * *', () => broadcast.run('dailyWarning', discordClient));
 */

export { init }                  from './Archive/archive.js';
export { registerType, evaluate } from './archive-inspector/archiveInspector.js';
export { fetch as transporterFetch } from './archive_transporter/archiveTransporter.js';
export {
  run,
  recoverIncomplete,
  registerFetch,
  setConfiguredCircles,
  getConfiguredCircles,
} from './Broker/broker.js';
export { deliver, announceOperationAlert } from './Announcer/announcer.js';
