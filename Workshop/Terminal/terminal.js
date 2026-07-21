/**
 * Terminal
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Terminal — Stage 3, Workshop
 *
 * Sole responsibility: receive Validator-approved deliverables, hold them in
 * an immutable pending state, and expose them for pickup by the Distribution
 * Coordinator.
 *
 * Uses an adapter pattern so the underlying store can be swapped without
 * changing this module. Mirrors Refinery/Depot/depot.js conventions.
 */

import { put, get, list, del } from './adapters/memoryAdapter.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'terminal',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function terminalError(error, message, context = {}) {
  return {
    success:   false,
    error,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

// ─── ID generation ────────────────────────────────────────────────────────────

function generateTerminalId(blueprintKey) {
  return `terminal-${blueprintKey}-${Date.now()}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Receive an approved deliverable from the Validator and store it.
 *
 * Rejects any envelope that is not Validator-approved (approved !== true).
 * The stored record is immutable — it is never modified after intake.
 *
 * @param {object} approvedDeliverable — Validator-approved envelope
 * @returns {Promise<{ success: boolean, terminalId?: string, receivedAt?: string, error?: string }>}
 */
export async function receive(approvedDeliverable) {
  if (!approvedDeliverable?.approved) {
    log('error', 'TERMINAL_INVALID_INPUT — envelope not approved by Validator', {
      success:  approvedDeliverable?.success,
      approved: approvedDeliverable?.approved,
    });
    return terminalError(
      'TERMINAL_INVALID_INPUT',
      'Deliverable must carry approved: true from the Validator before entering the Terminal',
      { received: { success: approvedDeliverable?.success, approved: approvedDeliverable?.approved } },
    );
  }

  const terminalId = generateTerminalId(approvedDeliverable.blueprintKey);
  const receivedAt = new Date().toISOString();

  const record = {
    terminalId,
    blueprintKey:      approvedDeliverable.blueprintKey,
    blueprintName:     approvedDeliverable.blueprintName,
    trigger:           approvedDeliverable.trigger,
    type:              approvedDeliverable.type,
    png:               approvedDeliverable.png,
    meta:              approvedDeliverable.meta,
    validatedAt:       approvedDeliverable.validatedAt,
    fabricatorVersion: approvedDeliverable.fabricatorVersion,
    receivedAt,
    state:             'pending',
    claimedAt:         null,
  };

  const result = await put(record);
  if (!result.success) {
    log('error', `TERMINAL_STORE_FAILURE — ${result.error}: ${result.message}`, { terminalId });
    return terminalError('TERMINAL_STORE_FAILURE', result.message, { terminalId });
  }

  log('info', `stored — terminalId=${terminalId} blueprintKey=${approvedDeliverable.blueprintKey}`);
  return { success: true, terminalId, receivedAt };
}

/**
 * Claim a pending deliverable for Distribution.
 *
 * Marks the record as claimed and returns the full deliverable.
 * Returns an error if the terminalId is unknown or already claimed.
 *
 * @param {string} terminalId
 * @returns {Promise<TerminalPickupResult>}
 */
export async function pickup(terminalId) {
  if (!terminalId) {
    return terminalError('TERMINAL_INVALID_INPUT', 'terminalId is required for pickup');
  }

  const { record } = await get(terminalId);

  if (!record) {
    log('warn', `TERMINAL_NOT_FOUND — terminalId=${terminalId}`);
    return terminalError('TERMINAL_NOT_FOUND', `No deliverable found for terminalId=${terminalId}`, { terminalId });
  }

  if (record.state === 'claimed') {
    log('warn', `TERMINAL_ALREADY_CLAIMED — terminalId=${terminalId} claimedAt=${record.claimedAt}`);
    return terminalError(
      'TERMINAL_ALREADY_CLAIMED',
      `Deliverable terminalId=${terminalId} was already claimed at ${record.claimedAt}`,
      { terminalId, claimedAt: record.claimedAt },
    );
  }

  const claimedAt = new Date().toISOString();
  const claimedRecord = { ...record, state: 'claimed', claimedAt };

  const updateResult = await put(claimedRecord);
  if (!updateResult.success) {
    log('error', `TERMINAL_STORE_FAILURE — failed to mark claimed: ${updateResult.message}`, { terminalId });
    return terminalError('TERMINAL_STORE_FAILURE', updateResult.message, { terminalId });
  }

  log('info', `claimed — terminalId=${terminalId}`);
  return { success: true, terminalId, deliverable: claimedRecord };
}

/**
 * List all pending deliverables available for Distribution pickup.
 *
 * @param {{ blueprintKey?: string, type?: string }} [filter]
 * @returns {Promise<{ results: TerminalRecord[] }>}
 */
export async function listReady(filter = {}) {
  return list({ ...filter, state: 'pending' });
}

/**
 * Retrieve release metadata for a stored deliverable (no PNG buffer).
 *
 * Used by the Coordinator to confirm availability before calling pickup().
 *
 * @param {string} terminalId
 * @returns {Promise<TerminalMetadataResult>}
 */
export async function getReleaseMetadata(terminalId) {
  if (!terminalId) {
    return terminalError('TERMINAL_INVALID_INPUT', 'terminalId is required');
  }

  const { record } = await get(terminalId);

  if (!record) {
    log('warn', `TERMINAL_NOT_FOUND — terminalId=${terminalId}`);
    return terminalError('TERMINAL_NOT_FOUND', `No deliverable found for terminalId=${terminalId}`, { terminalId });
  }

  // Return metadata without the PNG buffer
  const { png: _png, ...metadata } = record;
  return { success: true, ...metadata };
}
