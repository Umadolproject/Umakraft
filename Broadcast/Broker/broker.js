/**
 * Broker
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Broker — Stage 5, Broadcast
 * Version:   v2.0.0
 *
 * The entry point and data courier of the Broadcast pipeline.
 *
 * Responsibilities:
 *   1. Receive the cron trigger or threshold event for a specific notification type
 *   2. Fetch the relevant compiled product(s) from Refinery/Depot for each circle
 *   3. Build the raw notification input envelope from the fetched data
 *   4. Pass the raw input to Archive-Inspector
 *   5. On restart: read Archive for incomplete records and route them to
 *      Archive-Transporter (bypassing Archive-Inspector — already approved)
 *   6. Manage the per-circle queue so one failing circle never blocks another
 *
 * Broker does NOT decide whether a notification should fire — that is
 * Archive-Inspector's sole responsibility.
 *
 * Usage (called by tasks/index.js on cron tick):
 *   await broker.run('dailyWarning', client)
 *
 * On startup:
 *   await broker.recoverIncomplete(circleIds, client)
 */

import * as archiveInspector   from '../archive-inspector/archiveInspector.js';
import * as archiveTransporter from '../archive_transporter/archiveTransporter.js';
import * as archive             from '../Archive/archive.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'broker',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Configured circles ───────────────────────────────────────────────────────

// The set of configured circles is resolved by getConfiguredCircles().
// In production this is loaded from the database or environment config.
// Override with setConfiguredCircles() for testing or startup injection.

let _configuredCircles = null;

/**
 * Override the configured circles list.
 * Call this during bot startup before the first cron tick.
 *
 * @param {string[]} circleIds
 */
export function setConfiguredCircles(circleIds) {
  if (!Array.isArray(circleIds)) throw new Error('setConfiguredCircles: circleIds must be an array');
  _configuredCircles = circleIds;
  log('info', `configured circles set: [${circleIds.join(', ')}]`);
}

/**
 * Return the list of configured circle IDs.
 * Falls back to the CONFIGURED_CIRCLES environment variable (comma-separated).
 *
 * @returns {string[]}
 */
export function getConfiguredCircles() {
  if (_configuredCircles) return _configuredCircles;
  const env = process.env.CONFIGURED_CIRCLES;
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// ─── Fetch registry ───────────────────────────────────────────────────────────

/**
 * Registry of data fetch functions per notification type.
 * Each function receives (circleId) and returns the raw data for that circle.
 *
 * Register via registerFetch(type, fn).
 * @type {Map<string, (circleId: string) => Promise<object>>}
 */
const _fetchRegistry = new Map();

/**
 * Register a data fetch function for a notification type.
 *
 * The function must:
 *   - Accept a circleId string
 *   - Return the raw data object that Archive-Inspector expects
 *   - Throw or return null on failure
 *
 * @param {string} type
 * @param {(circleId: string) => Promise<object>} fetchFn
 */
export function registerFetch(type, fetchFn) {
  if (!type || typeof fetchFn !== 'function') {
    throw new Error('registerFetch: type (string) and fetchFn (function) are required');
  }
  _fetchRegistry.set(type, fetchFn);
  log('info', `registered fetch handler for type="${type}"`);
}

// ─── Internal fetch ───────────────────────────────────────────────────────────

/**
 * Fetch raw data for a notification type and circle from Refinery/Depot.
 *
 * @param {string} type
 * @param {string} circleId
 * @returns {Promise<object|null>}
 */
export async function _fetch(type, circleId) {
  const fetchFn = _fetchRegistry.get(type);
  if (!fetchFn) {
    log('warn', `no fetch handler registered for type="${type}" circleId="${circleId}"`);
    return null;
  }
  try {
    const data = await fetchFn(circleId);
    return data ?? null;
  } catch (err) {
    log('error', `fetch failed for type="${type}" circleId="${circleId}": ${err.message}`);
    return null;
  }
}

// ─── Restart recovery ─────────────────────────────────────────────────────────

/**
 * Read incomplete Archive records for a circle and route their notificationKeys
 * to Archive-Transporter. Bypasses Archive-Inspector (already approved).
 *
 * @param {string} circleId
 * @param {object|null} client  — Discord client
 */
export async function _recoverIncomplete(circleId, client) {
  let result;
  try {
    result = await archive.getIncomplete(circleId);
  } catch (err) {
    log('error', `getIncomplete threw for circleId="${circleId}": ${err.message}`);
    return;
  }

  const records = result?.records ?? [];
  if (records.length === 0) return;

  log('info', `recovering ${records.length} incomplete records for circleId="${circleId}"`);

  for (const record of records) {
    try {
      // Route to Archive-Transporter — it fetches the full record and calls Announcer
      await archiveTransporter.fetch(record.notificationKey, client);
    } catch (err) {
      log('error', `recovery routing failed for key=${record.notificationKey}: ${err.message}`);
      // Continue to the next record — one failing recovery never blocks others
    }
  }
}

/**
 * Run restart recovery for all configured circles.
 * Call this once during bot startup before the first cron tick.
 *
 * @param {string[]|null} circleIds  — defaults to getConfiguredCircles()
 * @param {object|null} client
 */
export async function recoverIncomplete(circleIds, client) {
  const ids = circleIds ?? getConfiguredCircles();
  if (ids.length === 0) {
    log('info', 'recoverIncomplete: no configured circles — skipping recovery');
    return;
  }

  log('info', `starting restart recovery for ${ids.length} circle(s)`);
  for (const circleId of ids) {
    try {
      await _recoverIncomplete(circleId, client);
    } catch (err) {
      log('error', `recovery failed for circleId="${circleId}": ${err.message}`);
      // Isolation: one failing circle never blocks others
    }
  }
  log('info', 'restart recovery complete');
}

// ─── Main run ─────────────────────────────────────────────────────────────────

/**
 * Execute one Broker run for a notification type across all configured circles.
 *
 * Called by tasks/index.js on a cron tick (or on a data threshold event).
 *
 * For each configured circle:
 *   1. Run restart recovery (surface incomplete records from Archive)
 *   2. Fetch raw data from Refinery/Depot
 *   3. Build the raw input envelope
 *   4. Pass the envelope to Archive-Inspector for evaluation
 *
 * One failing circle never blocks the others.
 *
 * @param {string} type    — notification type registered with Archive-Inspector
 * @param {object|null} client — Discord.js Client
 * @param {string[]|null} circleIds — defaults to getConfiguredCircles()
 */
export async function run(type, client, circleIds) {
  const ids = circleIds ?? getConfiguredCircles();

  if (!type) {
    log('error', 'Broker.run: type is required');
    return;
  }

  if (ids.length === 0) {
    log('warn', `Broker.run(${type}): no configured circles — nothing to do`);
    return;
  }

  log('info', `Broker.run type="${type}" circles=[${ids.join(', ')}]`);

  for (const circleId of ids) {
    try {
      // ── Restart recovery first ───────────────────────────────────────────
      await _recoverIncomplete(circleId, client);

      // ── Fetch raw data ───────────────────────────────────────────────────
      const data = await _fetch(type, circleId);
      if (data == null) {
        log('warn', `no data fetched for type="${type}" circleId="${circleId}" — skipping`);
        continue;
      }

      // ── Build envelope and hand to Archive-Inspector ─────────────────────
      const envelope = {
        type,
        circleId,
        fetchedAt: new Date().toISOString(),
        data,
      };

      const result = await archiveInspector.evaluate(envelope, { client });

      if (result.accepted) {
        log('info', `Inspector approved key=${result.notificationKey} circleId="${circleId}"`);
      } else {
        log('info', `Inspector rejected type="${type}" circleId="${circleId}" reason=${result.reason}`);
      }
    } catch (err) {
      log('error', `Broker.run failed for type="${type}" circleId="${circleId}": ${err.message}`);
      // Isolation: continue to the next circle
    }
  }

  log('info', `Broker.run complete type="${type}"`);
}
