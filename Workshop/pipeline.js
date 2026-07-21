/**
 * Workshop Pipeline Wire
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 *
 * Connects Stage 3 (Workshop) internally:
 *
 *   Fabricator → Validator → Terminal
 *
 * This module is the handoff surface the Distribution Coordinator calls to
 * produce and stage a deliverable. It owns no business logic — only
 * sequencing, error propagation, and Terminal pickup.
 */

import { fabricate }                    from './Fabricator/fabricator.js';
import { validate }                     from './Validator/Validator.js';
import { receive, pickup, listReady, getReleaseMetadata } from './Terminal/terminal.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'workshop-pipeline',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function pipelineError(stage, error, message, context = {}) {
  return {
    success:   false,
    failedAt:  stage,
    error,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

async function runStage(stageName, fn, ...args) {
  try {
    return await fn(...args);
  } catch (err) {
    log('error', `unhandled error in stage ${stageName}: ${err.message}`);
    return pipelineError(stageName, 'PIPELINE_STAGE_ERROR', err.message);
  }
}

// ─── Full Workshop chain: Fabricator → Validator → Terminal ──────────────────

/**
 * Fabricate a deliverable from a compiled product, validate it, and stage it
 * in the Terminal for Distribution pickup.
 *
 * @param {object} compiledProduct — from Refinery/Depot
 * @returns {Promise<{ success: boolean, terminalId?: string, failedAt?: string, error?: string }>}
 *
 * @example
 * const result = await produce(compiledProduct);
 * if (result.success) {
 *   const delivery = await claimDeliverable(result.terminalId);
 * }
 */
export async function produce(compiledProduct) {
  const blueprintKey = compiledProduct?.blueprintKey ?? '(unknown)';
  log('info', `workshop pipeline start — blueprintKey=${blueprintKey}`);

  // ── Fabricator ─────────────────────────────────────────────────────────────
  const fabricatorResult = await runStage('Fabricator', fabricate, compiledProduct);
  if (fabricatorResult.failedAt) return fabricatorResult;
  if (!fabricatorResult.success) {
    log('warn', `Fabricator failed — ${fabricatorResult.error}`, { blueprintKey });
    return pipelineError('Fabricator', fabricatorResult.error, fabricatorResult.message, { blueprintKey });
  }

  // ── Validator ──────────────────────────────────────────────────────────────
  const validatorResult = await runStage('Validator', validate, fabricatorResult);
  if (validatorResult.failedAt) return validatorResult;
  if (!validatorResult.success || !validatorResult.approved) {
    log('warn', `Validator rejected deliverable — ${validatorResult.error}`, { blueprintKey });
    return pipelineError('Validator', validatorResult.error, validatorResult.message, { blueprintKey });
  }

  // ── Terminal ───────────────────────────────────────────────────────────────
  const terminalResult = await runStage('Terminal', receive, validatorResult);
  if (terminalResult.failedAt) return terminalResult;
  if (!terminalResult.success) {
    log('warn', `Terminal intake failed — ${terminalResult.error}`, { blueprintKey });
    return pipelineError('Terminal', terminalResult.error, terminalResult.message, { blueprintKey });
  }

  log('info', `workshop pipeline complete — terminalId=${terminalResult.terminalId} blueprintKey=${blueprintKey}`);
  return {
    success:    true,
    terminalId: terminalResult.terminalId,
    blueprintKey,
    receivedAt: terminalResult.receivedAt,
  };
}

/**
 * Claim a staged deliverable from the Terminal for Distribution.
 *
 * Called by the Distribution Coordinator after produce() returns a terminalId.
 *
 * @param {string} terminalId
 * @returns {Promise<TerminalPickupResult>}
 */
export async function claimDeliverable(terminalId) {
  return pickup(terminalId);
}

/**
 * List all deliverables in the Terminal waiting for Distribution pickup.
 *
 * @param {{ blueprintKey?: string, type?: string }} [filter]
 * @returns {Promise<{ results: TerminalRecord[] }>}
 */
export async function listPending(filter) {
  return listReady(filter);
}

/**
 * Get release metadata for a staged deliverable without the PNG buffer.
 *
 * @param {string} terminalId
 * @returns {Promise<TerminalMetadataResult>}
 */
export async function getDeliverableMetadata(terminalId) {
  return getReleaseMetadata(terminalId);
}
