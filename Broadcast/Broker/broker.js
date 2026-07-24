/**
 * Broker
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Broker — Stage 5, Broadcast
 * Version:   v3.0.0  (Phase 4: per-circle concurrency control)
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
 *      and up to brokerConcurrency circles are processed in parallel (Phase 4)
 *
 * Broker does NOT decide whether a notification should fire — that is
 * Archive-Inspector's sole responsibility.
 */

import * as archiveInspector   from '../archive-inspector/archiveInspector.js';
import * as archiveTransporter from '../archive_transporter/archiveTransporter.js';
import * as archive             from '../Archive/archive.js';
import { CONFIGURED_CIRCLES as DEFAULT_CIRCLES } from '../../core/botConfig.js';
import { pipelineRuntime }      from '../../core/pipelineRuntime.js';

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

// ─── Concurrency semaphore (Phase 4) ─────────────────────────────────────────

/**
 * Creates a simple counting semaphore.
 * Returns an `acquire()` function; each call resolves to a `release()` fn.
 *
 * @param {number} max
 * @returns {() => Promise<() => void>}
 */
function createSemaphore(max) {
  let active = 0;
  const queue = [];

  return function acquire() {
    if (active < max) {
      active++;
      return Promise.resolve(() => {
        active--;
        if (queue.length > 0) queue.shift()();
      });
    }
    return new Promise(resolve => {
      queue.push(() => {
        active++;
        resolve(() => {
          active--;
          if (queue.length > 0) queue.shift()();
        });
      });
    });
  };
}

// ─── Configured circles ───────────────────────────────────────────────────────

let _configuredCircles = null;

export function setConfiguredCircles(circleIds) {
  if (!Array.isArray(circleIds)) throw new Error('setConfiguredCircles: circleIds must be an array');
  _configuredCircles = circleIds;
  log('info', `configured circles set: [${circleIds.join(', ')}]`);
}

export function getConfiguredCircles() {
  if (_configuredCircles) return _configuredCircles;
  return [...DEFAULT_CIRCLES];
}

// ─── Fetch registry ───────────────────────────────────────────────────────────

const _fetchRegistry = new Map();

export function registerFetch(type, fetchFn) {
  if (!type || typeof fetchFn !== 'function') {
    throw new Error('registerFetch: type (string) and fetchFn (function) are required');
  }
  _fetchRegistry.set(type, fetchFn);
  log('info', `registered fetch handler for type="${type}"`);
}

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
      await archiveTransporter.fetch(record.notificationKey, client);
    } catch (err) {
      log('error', `recovery routing failed for key=${record.notificationKey}: ${err.message}`);
    }
  }
}

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
    }
  }
  log('info', 'restart recovery complete');
}

// ─── Per-circle processing (extracted for concurrency) ────────────────────────

async function _processCircle(type, circleId, client) {
  await _recoverIncomplete(circleId, client);

  const data = await _fetch(type, circleId);
  if (data == null) {
    log('warn', `no data fetched for type="${type}" circleId="${circleId}" — skipping`);
    return;
  }

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
}

// ─── Main run ─────────────────────────────────────────────────────────────────

/**
 * Execute one Broker run for a notification type across all configured circles.
 *
 * Phase 4: circles are processed in parallel up to `brokerConcurrency` at a time
 * (default 3, controlled by the BROKER_CONCURRENCY env var).
 * One failing circle still never blocks the others.
 *
 * @param {string} type
 * @param {object|null} client
 * @param {string[]|null} circleIds
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

  const concurrency = Math.max(1, pipelineRuntime.brokerConcurrency);
  log('info', `Broker.run type="${type}" circles=[${ids.join(', ')}] concurrency=${concurrency}`);

  const acquire = createSemaphore(concurrency);

  await Promise.all(ids.map(async (circleId) => {
    const release = await acquire();
    try {
      await _processCircle(type, circleId, client);
    } catch (err) {
      log('error', `Broker.run failed for type="${type}" circleId="${circleId}": ${err.message}`);
    } finally {
      release();
    }
  }));

  log('info', `Broker.run complete type="${type}"`);
}
