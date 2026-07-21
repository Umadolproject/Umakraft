/**
 * Umamoe → Refinery Pipeline Wire
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 *
 * Connects Stage 1 (Umamoe) to Stage 2 (Refinery).
 * Orchestrates the full chain:
 *
 *   Miner → Courier → Inspector → Vault → Refiner → Compiler → Depot
 *
 * This module is the handoff boundary between Stage 1 and Stage 2.
 * It owns no business logic — only sequencing and error propagation.
 */

import * as Miner   from './Miner/miner.js';
import { transport } from './Courier/courier.js';
import { receive, retrieve } from './Vault/vault.js';
import { refine }   from '../Refinery/Refiner/refiner.js';
import { compile }  from '../Refinery/Compiler/compiler.js';

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'pipeline',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function pipelineError(stage, error, message, context = {}) {
  return {
    success: false,
    failedAt: stage,
    error,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

// ─── Stage runner ─────────────────────────────────────────────────────────────

/**
 * Run a single pipeline stage. Returns the result or a pipeline error envelope.
 *
 * @param {string}   stageName
 * @param {Function} fn
 * @param {...*}     args
 */
async function runStage(stageName, fn, ...args) {
  try {
    return await fn(...args);
  } catch (err) {
    log('error', `unhandled error in stage ${stageName}: ${err.message}`);
    return pipelineError(stageName, 'PIPELINE_STAGE_ERROR', err.message);
  }
}

// ─── Full pipeline: Miner → Depot ────────────────────────────────────────────

/**
 * Fetch a trainer profile and run it through the full pipeline.
 *
 * Miner → Courier → Inspector → Vault → Refiner → Compiler → Depot
 *
 * @param {string} trainerId
 * @param {object} [options]
 * @param {object} [options.previousVaultRecord] — prior snapshot for delta gain calculation
 * @returns {Promise<PipelineResult>}
 */
export async function processTrainer(trainerId, options = {}) {
  log('info', `pipeline start — trainerId=${trainerId}`);

  // ── Stage 1a: Miner ───────────────────────────────────────────────────────
  const minerResult = await runStage('Miner', Miner.fetchTrainer, trainerId);
  if (minerResult.success === false && minerResult.failedAt) return minerResult;
  if (!minerResult.success) {
    log('warn', `Miner failed — ${minerResult.error}`, { trainerId });
    return pipelineError('Miner', minerResult.error, minerResult.message, { trainerId });
  }

  // ── Stage 1b: Courier → Inspector ─────────────────────────────────────────
  const inspectorResult = await runStage('Courier', transport, minerResult);
  if (inspectorResult.failedAt) return inspectorResult;
  if (!inspectorResult.success || !inspectorResult.accepted) {
    log('warn', `Inspector rejected data — ${inspectorResult.error}`, { trainerId });
    return pipelineError('Inspector', inspectorResult.error, inspectorResult.message, { trainerId });
  }

  // ── Stage 1c: Vault (store) ────────────────────────────────────────────────
  const vaultResult = await runStage('Vault', receive, inspectorResult);
  if (vaultResult.failedAt) return vaultResult;
  if (!vaultResult.success) {
    log('warn', `Vault store failed — ${vaultResult.error}`, { trainerId });
    return pipelineError('Vault', vaultResult.error, vaultResult.message, { trainerId });
  }

  // ── Stage 1d: Vault (retrieve for Refiner) ────────────────────────────────
  const vaultRecord = await runStage('Vault.retrieve', retrieve, { id: trainerId });
  if (vaultRecord.failedAt) return vaultRecord;
  if (!vaultRecord.success || !vaultRecord.data) {
    log('warn', `Vault retrieve failed — ${vaultRecord.error}`, { trainerId });
    return pipelineError('Vault.retrieve', vaultRecord.error ?? 'VAULT_RETRIEVE_FAILED', 'Could not retrieve stored record', { trainerId });
  }

  // ── Stage 2a: Refiner ─────────────────────────────────────────────────────
  const refinedResult = await runStage(
    'Refiner',
    async (record, opts) => refine(record, opts),
    vaultRecord.data,
    { previousRecord: options.previousVaultRecord }
  );
  if (refinedResult.failedAt) return refinedResult;
  if (!refinedResult.success) {
    log('warn', `Refiner failed — ${refinedResult.error}`, { trainerId });
    return pipelineError('Refiner', refinedResult.error, refinedResult.message, { trainerId });
  }

  // ── Stage 2b: Compiler → Depot ────────────────────────────────────────────
  const compileResult = await runStage('Compiler', compile, refinedResult);
  if (compileResult.failedAt) return compileResult;
  if (!compileResult.success) {
    log('warn', `Compiler failed — ${compileResult.error}`, { trainerId });
    return pipelineError('Compiler', compileResult.error, compileResult.message, { trainerId });
  }

  log('info', `pipeline complete — trainerId=${trainerId} version=${compileResult.version}`);

  return {
    success:  true,
    trainerId,
    version:  compileResult.version,
    product:  compileResult.product,
    storedAt: compileResult.storedAt,
  };
}

/**
 * Fetch ranked trainers and process each through the full pipeline.
 *
 * @param {object} [params] — e.g. { limit: 10 }
 * @returns {Promise<{ success: boolean, results: PipelineResult[] }>}
 */
export async function processRankings(params = {}) {
  log('info', 'pipeline start — rankings');

  const minerResult = await runStage('Miner', Miner.fetchRankings, params);
  if (minerResult.failedAt) return minerResult;
  if (!minerResult.success) {
    return pipelineError('Miner', minerResult.error, minerResult.message);
  }

  // Rankings returns an array of trainers
  const trainers = Array.isArray(minerResult.data)
    ? minerResult.data
    : minerResult.data?.trainers ?? [];

  log('info', `processing ${trainers.length} trainers from rankings`);

  const results = [];
  for (const trainer of trainers) {
    // Build a synthetic Miner envelope per trainer so the pipeline stages work
    const syntheticEnvelope = {
      success: true,
      data: trainer,
      metadata: {
        ...minerResult.metadata,
        endpoint: `/rankings → trainer/${trainer.id}`,
      },
    };

    const inspectorResult = await runStage('Courier', transport, syntheticEnvelope);
    if (!inspectorResult.success || !inspectorResult.accepted) {
      results.push({ success: false, trainerId: trainer.id, error: inspectorResult.error });
      continue;
    }

    const vaultResult = await runStage('Vault', receive, inspectorResult);
    if (!vaultResult.success) {
      results.push({ success: false, trainerId: trainer.id, error: vaultResult.error });
      continue;
    }

    const vaultRecord = await runStage('Vault.retrieve', retrieve, { id: trainer.id });
    if (!vaultRecord.success) {
      results.push({ success: false, trainerId: trainer.id, error: vaultRecord.error });
      continue;
    }

    const refinedResult = refine(vaultRecord.data);
    if (!refinedResult.success) {
      results.push({ success: false, trainerId: trainer.id, error: refinedResult.error });
      continue;
    }

    const compileResult = await compile(refinedResult);
    results.push({
      success:   compileResult.success,
      trainerId: trainer.id,
      version:   compileResult.version,
      error:     compileResult.error,
    });
  }

  const succeeded = results.filter((r) => r.success).length;
  log('info', `rankings pipeline complete — ${succeeded}/${results.length} succeeded`);

  return { success: true, results };
}
