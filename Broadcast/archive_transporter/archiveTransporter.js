/**
 * Archive-Transporter
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Archive-Transporter — Stage 5, Broadcast
 * Version:   v2.0.0
 *
 * The fetch-and-handoff stage of the Broadcast pipeline.
 *
 * Sits between Archive and Announcer. Receives a notificationKey from either:
 *   - Archive-Inspector (new delivery)
 *   - Broker (restart recovery for incomplete records)
 *
 * Both callers use the same interface — Archive-Transporter does not distinguish
 * between a new notification and a restart-recovery retry.
 *
 * Workflow:
 *   1. Receive notificationKey
 *   2. Fetch full record from Archive
 *   3. Validate the record is well-formed
 *   4. Hand off the full record to Announcer
 *
 * Never evaluates eligibility, writes to Archive, selects variants, or renders
 * content. It only fetches and forwards.
 */

import * as archive  from '../Archive/archive.js';
import * as announcer from '../Announcer/announcer.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'archive-transporter',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a notification record from Archive and hand it off to Announcer.
 *
 * Called by Archive-Inspector (new delivery) and Broker (restart recovery).
 * Both code paths use this same interface — Archive-Transporter does not
 * distinguish between a new notification and a restart-recovery retry.
 *
 * @param {string} notificationKey
 * @param {object|null} client  — Discord client forwarded to Announcer
 * @returns {Promise<void>}
 */
export async function fetch(notificationKey, client) {
  if (!notificationKey) {
    log('error', 'TRANSPORTER_MISSING_KEY: notificationKey is required');
    return;
  }

  log('info', `fetching record key=${notificationKey}`);

  // ── Step 1: Read the full record from Archive ──────────────────────────────
  let record;
  try {
    const result = await archive.get(notificationKey);
    if (result.error) {
      log('error', `Archive.get failed for key=${notificationKey} — ${result.error}: ${result.message}`);
      return; // programming error upstream — do not call Announcer
    }
    record = result.record;
  } catch (err) {
    log('error', `Archive.get threw for key=${notificationKey}: ${err.message}`);
    return;
  }

  // ── Step 2: Validate the record ────────────────────────────────────────────
  if (!record) {
    log('error', `TRANSPORTER_RECORD_MISSING: no Archive record for key=${notificationKey} — this is a programming error upstream`);
    return; // do not call Announcer with an empty payload
  }

  if (!record.payload) {
    log('error', `TRANSPORTER_PAYLOAD_MISSING: record has no payload for key=${notificationKey}`);
    return;
  }

  if (!record.payload.imageParams) {
    log('warn', `TRANSPORTER_IMAGE_PARAMS_MISSING: payload.imageParams is absent for key=${notificationKey} — cannot call Announcer`);
    return; // Announcer must never be called with incomplete fabrication data
  }

  // ── Step 3: Hand off to Announcer ──────────────────────────────────────────
  log('info', `handing off key=${notificationKey} to Announcer`);

  try {
    await announcer.deliver(record, client);
  } catch (err) {
    log('error', `Announcer.deliver threw for key=${notificationKey}: ${err.message}`);
    // Leave all delivery flags at 0 — Broker will surface this record again
    // on the next cron tick via Archive-Transporter for retry.
  }
}
