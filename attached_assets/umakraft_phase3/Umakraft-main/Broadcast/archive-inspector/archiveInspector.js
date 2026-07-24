/**
 * Archive-Inspector
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Archive-Inspector — Stage 5, Broadcast
 * Version:   v2.0.0
 *
 * The decision-maker of the Broadcast pipeline and the sole department that
 * creates records in Archive.
 *
 * Decision flow (all steps must pass in order):
 *   1. Eligibility check
 *   2. Dedup check (Archive)
 *   3. Recipient resolution
 *   4. Variant selection
 *   5. Write full record to Archive
 *   6. Signal Archive-Transporter
 *
 * Any failure stops immediately — no partial writes, no side effects.
 *
 * Usage:
 *   archiveInspector.registerType(type, { buildKey, checkEligibility, resolveRecipients, selectVariant })
 *   const result = await archiveInspector.evaluate({ type, circleId, data, fetchedAt })
 */

import * as archive           from '../Archive/archive.js';
import * as archiveTransporter from '../archive_transporter/archiveTransporter.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'archive-inspector',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function reject(notificationKey, reason, context = {}) {
  log('info', `REJECTED key=${notificationKey} reason=${reason}`, context);
  return { accepted: false, notificationKey, reason };
}

// ─── Type registry ────────────────────────────────────────────────────────────

/**
 * Registry of notification type handlers.
 *
 * Each entry:
 * {
 *   buildKey:          (circleId, data) => string
 *   checkEligibility:  (data) => boolean
 *   resolveRecipients: (data) => { channels: string[], memberDms: string[], leaderDm: string|null }
 *   selectVariant:     (data) => { variant: number, message: string, imageParams: object }
 * }
 */
const _typeRegistry = new Map();

/**
 * Register handlers for a notification type.
 *
 * @param {string} type
 * @param {{
 *   buildKey:          (circleId: string, data: object) => string,
 *   checkEligibility:  (data: object) => boolean,
 *   resolveRecipients: (data: object) => { channels: string[], memberDms: string[], leaderDm: string|null },
 *   selectVariant:     (data: object) => { variant: number, message: string, imageParams: object }
 * }} handlers
 */
export function registerType(type, { buildKey, checkEligibility, resolveRecipients, selectVariant }) {
  if (!type || typeof type !== 'string') throw new Error('registerType: type must be a non-empty string');
  if (typeof buildKey          !== 'function') throw new Error(`registerType(${type}): buildKey must be a function`);
  if (typeof checkEligibility  !== 'function') throw new Error(`registerType(${type}): checkEligibility must be a function`);
  if (typeof resolveRecipients !== 'function') throw new Error(`registerType(${type}): resolveRecipients must be a function`);
  if (typeof selectVariant     !== 'function') throw new Error(`registerType(${type}): selectVariant must be a function`);

  _typeRegistry.set(type, { buildKey, checkEligibility, resolveRecipients, selectVariant });
  log('info', `registered notification type="${type}"`);
}

/**
 * Return true if a type has been registered.
 *
 * @param {string} type
 * @returns {boolean}
 */
export function hasType(type) {
  return _typeRegistry.has(type);
}

// ─── Core evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate a raw notification input envelope from Broker.
 *
 * All six steps must pass in order. Any failure stops immediately.
 *
 * @param {{ type: string, circleId: string, data: object, fetchedAt: string }} envelope
 * @param {{ client?: object }} [opts]  — Discord client forwarded to Archive-Transporter
 * @returns {Promise<{ accepted: boolean, notificationKey: string, reason?: string }>}
 */
export async function evaluate(envelope, { client } = {}) {
  const { type, circleId, data, fetchedAt } = envelope ?? {};

  // ── Input guard ────────────────────────────────────────────────────────────
  if (!type || !circleId || !data) {
    log('error', 'ARCHIVE_INSPECTOR_INVALID_ENVELOPE: missing type, circleId, or data', { envelope });
    return { accepted: false, notificationKey: null, reason: 'INVALID_ENVELOPE' };
  }

  const handlers = _typeRegistry.get(type);
  if (!handlers) {
    log('error', `ARCHIVE_INSPECTOR_UNKNOWN_TYPE: no handlers registered for type="${type}"`);
    return { accepted: false, notificationKey: null, reason: 'UNKNOWN_TYPE' };
  }

  // Compute the notification key up front so we can use it in all log messages
  let notificationKey;
  try {
    notificationKey = handlers.buildKey(circleId, data);
  } catch (err) {
    log('error', `buildKey threw for type="${type}" circleId="${circleId}": ${err.message}`);
    return { accepted: false, notificationKey: null, reason: 'KEY_BUILD_ERROR' };
  }

  if (!notificationKey) {
    log('error', `buildKey returned empty key for type="${type}" circleId="${circleId}"`);
    return { accepted: false, notificationKey: null, reason: 'KEY_BUILD_ERROR' };
  }

  log('info', `evaluating key=${notificationKey} type=${type} circleId=${circleId}`);

  // ── Step 1: Eligibility ────────────────────────────────────────────────────
  let eligible;
  try {
    eligible = handlers.checkEligibility(data);
  } catch (err) {
    log('error', `checkEligibility threw for key=${notificationKey}: ${err.message}`);
    return reject(notificationKey, 'ELIGIBILITY_ERROR');
  }
  if (!eligible) return reject(notificationKey, 'THRESHOLD_NOT_MET');

  // ── Step 2: Dedup ──────────────────────────────────────────────────────────
  const existing = await archive.get(notificationKey);
  if (existing.record) return reject(notificationKey, 'DEDUP_EXISTS');
  if (existing.error) {
    log('error', `dedup Archive.get failed for key=${notificationKey}: ${existing.error}`);
    return reject(notificationKey, 'ARCHIVE_READ_ERROR');
  }

  // ── Step 3: Recipient resolution ───────────────────────────────────────────
  let recipients;
  try {
    recipients = handlers.resolveRecipients(data);
  } catch (err) {
    log('error', `resolveRecipients threw for key=${notificationKey}: ${err.message}`);
    return reject(notificationKey, 'RECIPIENT_RESOLUTION_ERROR');
  }

  if (!recipients || (
    (!recipients.channels   || recipients.channels.length   === 0) &&
    (!recipients.memberDms  || recipients.memberDms.length  === 0) &&
    !recipients.leaderDm
  )) {
    return reject(notificationKey, 'NO_RECIPIENTS');
  }

  // Normalise
  recipients = {
    channels:  Array.isArray(recipients.channels)  ? recipients.channels  : [],
    memberDms: Array.isArray(recipients.memberDms) ? recipients.memberDms : [],
    leaderDm:  recipients.leaderDm ?? null,
  };

  // ── Step 4: Variant selection ──────────────────────────────────────────────
  let variantSelection;
  try {
    variantSelection = handlers.selectVariant(data);
  } catch (err) {
    log('error', `selectVariant threw for key=${notificationKey}: ${err.message}`);
    return reject(notificationKey, 'VARIANT_SELECTION_ERROR');
  }

  if (!variantSelection || !variantSelection.imageParams) {
    return reject(notificationKey, 'VARIANT_SELECTION_INCOMPLETE');
  }

  // ── Step 5: Write full record to Archive ───────────────────────────────────
  const insertResult = await archive.insert({
    notificationKey,
    type,
    circleId,
    recipients,
    payload: {
      ...variantSelection,
      fetchedAt: fetchedAt ?? new Date().toISOString(),
    },
  });

  if (!insertResult.success) {
    log('error', `Archive.insert failed for key=${notificationKey}: ${insertResult.error}`);
    return reject(notificationKey, 'ARCHIVE_WRITE_ERROR');
  }

  // If INSERT OR IGNORE found an existing record, treat as dedup
  if (!insertResult.inserted) {
    return reject(notificationKey, 'DEDUP_EXISTS');
  }

  log('info', `approved and claimed key=${notificationKey} type=${type}`);

  // ── Step 6: Signal Archive-Transporter ────────────────────────────────────
  // Fire-and-don't-await so evaluate() returns immediately after the Archive
  // write. If Transporter or Announcer fails, the incomplete record will be
  // surfaced by Broker on the next run.
  archiveTransporter.fetch(notificationKey, client).catch((err) => {
    log('error', `Archive-Transporter threw for key=${notificationKey}: ${err.message}`);
  });

  return { accepted: true, notificationKey };
}
