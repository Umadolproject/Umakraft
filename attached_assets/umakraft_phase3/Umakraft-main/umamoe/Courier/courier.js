/**
 * Courier
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Courier — Stage 1, Umamoe
 *
 * Sole responsibility: transport Miner envelopes to the Inspector.
 * Never modifies, validates content, or stores data.
 */

import { inspect } from '../Inspector/inspector.js';

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'courier',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Transport error ─────────────────────────────────────────────────────────

function transportError(error, message, retriable, context = {}) {
  return {
    success: false,
    error,
    message,
    severity: 'error',
    retriable,
    timestamp: new Date().toISOString(),
    context,
  };
}

// ─── Transportability checks ─────────────────────────────────────────────────

/**
 * 4 basic transportability checks (per Courier spec).
 * Does NOT validate data content — that is Inspector's job.
 */
function validateTransportability(envelope) {
  // 1. Envelope must exist
  if (envelope === null || envelope === undefined) {
    return { ok: false, reason: 'Envelope is null or undefined' };
  }
  // 2. Envelope must be an object
  if (typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { ok: false, reason: 'Envelope is not a plain object' };
  }
  // 3. Envelope must have a success field
  if (!('success' in envelope)) {
    return { ok: false, reason: 'Envelope is missing required "success" field' };
  }
  // 4. Success envelopes must carry a data field; failure envelopes must carry an error field
  if (envelope.success === true && !('data' in envelope)) {
    return { ok: false, reason: 'Success envelope is missing required "data" field' };
  }
  if (envelope.success === false && !('error' in envelope)) {
    return { ok: false, reason: 'Failure envelope is missing required "error" field' };
  }
  return { ok: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Transport a Miner envelope to the Inspector.
 *
 * @param {object} envelope — result from Miner
 * @returns {Promise<InspectorResult | TransportErrorEnvelope>}
 */
export async function transport(envelope) {
  // Transportability gate
  const check = validateTransportability(envelope);
  if (!check.ok) {
    log('error', `TRANSPORT_INVALID_INPUT: ${check.reason}`);
    return transportError(
      'TRANSPORT_INVALID_INPUT',
      check.reason,
      false,
      { envelope }
    );
  }

  // Pass-through: Miner failure envelopes reach Inspector unchanged
  // so Inspector can log and propagate them correctly.
  if (envelope.success === false) {
    log('info', 'passing Miner failure envelope to Inspector', { error: envelope.error });
  } else {
    log('info', 'transporting Miner success envelope to Inspector', {
      endpoint: envelope.metadata?.endpoint,
    });
  }

  const start = Date.now();

  try {
    const result = await inspect(envelope);
    const duration = Date.now() - start;
    log('info', `transport complete — duration=${duration}ms`, {
      accepted: result?.accepted ?? false,
    });
    return result;
  } catch (err) {
    log('error', `delivery to Inspector failed: ${err.message}`);
    return transportError(
      'TRANSPORT_DELIVERY_FAILED',
      'Courier failed to deliver envelope to Inspector',
      true,
      { originalError: err.message }
    );
  }
}
