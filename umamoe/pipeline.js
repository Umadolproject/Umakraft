/**
 * Umamoe → Refinery Pipeline Wire
 * Phase 4: stage-level timeouts + throughput metrics.
 */

import * as Miner from './Miner/miner.js';
import { transport }  from './Courier/courier.js';
import { receive, retrieve } from './Vault/vault.js';
import { refine }  from '../Refinery/Refiner/refiner.js';
import { compile } from '../Refinery/Compiler/compiler.js';
import { createLogger }                        from '../core/pipelineLogger.js';
import { failureEnvelope, successEnvelope }    from '../core/pipelineEnvelope.js';
import { stageTimeout }                        from '../core/pipelineRuntime.js';
import { recordStageRun }                      from '../core/pipelineMetrics.js';

const logger = createLogger('umamoe-pipeline');

// ─── Timeout-aware stage runner ───────────────────────────────────────────────

async function runStage(stageName, fn, ...args) {
  const start   = Date.now();
  const limitMs = stageTimeout(stageName);

  try {
    let result;
    if (limitMs > 0) {
      result = await Promise.race([
        fn(...args),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`STAGE_TIMEOUT: ${stageName} exceeded ${limitMs}ms`)),
            limitMs,
          ),
        ),
      ]);
    } else {
      result = await fn(...args);
    }
    recordStageRun(stageName, Date.now() - start, false);
    return result;
  } catch (err) {
    recordStageRun(stageName, Date.now() - start, true);
    const isTimeout = err.message?.startsWith('STAGE_TIMEOUT');
    logger.error(
      `${isTimeout ? 'timeout' : 'unhandled error'} in stage ${stageName}: ${err.message}`,
      { stageName },
    );
    return failureEnvelope(
      stageName,
      isTimeout ? 'PIPELINE_STAGE_TIMEOUT' : 'PIPELINE_STAGE_ERROR',
      err.message,
    );
  }
}

// ─── processTrainer ───────────────────────────────────────────────────────────

export async function processTrainer(trainerId, options = {}) {
  logger.info('pipeline start', { trainerId });

  const minerResult = await runStage('Miner', Miner.fetchTrainer, trainerId);
  if (minerResult.success === false && minerResult.failedAt) return minerResult;
  if (!minerResult.success) {
    logger.warn('Miner failed', { trainerId, error: minerResult.error });
    return failureEnvelope('Miner', minerResult.error, minerResult.message, { trainerId });
  }

  const inspectorResult = await runStage('Courier', transport, minerResult);
  if (inspectorResult.failedAt) return inspectorResult;
  if (!inspectorResult.success || !inspectorResult.accepted) {
    logger.warn('Inspector rejected data', { trainerId, error: inspectorResult.error });
    return failureEnvelope('Inspector', inspectorResult.error, inspectorResult.message, { trainerId });
  }

  const vaultResult = await runStage('Vault', receive, inspectorResult);
  if (vaultResult.failedAt) return vaultResult;
  if (!vaultResult.success) {
    logger.warn('Vault store failed', { trainerId, error: vaultResult.error });
    return failureEnvelope('Vault', vaultResult.error, vaultResult.message, { trainerId });
  }

  const vaultRecord = await runStage('Vault.retrieve', retrieve, { id: trainerId });
  if (vaultRecord.failedAt) return vaultRecord;
  if (!vaultRecord.success || !vaultRecord.data) {
    logger.warn('Vault retrieve failed', { trainerId, error: vaultRecord.error });
    return failureEnvelope(
      'Vault.retrieve',
      vaultRecord.error ?? 'VAULT_RETRIEVE_FAILED',
      'Could not retrieve stored record',
      { trainerId },
    );
  }

  let previousRecord = options.previousVaultRecord ?? null;
  if (!previousRecord) {
    const previousSnapshot = await runStage(
      'Vault.retrievePrevious',
      retrieve,
      { id: trainerId, version: 'previous' },
    );
    if (!previousSnapshot?.failedAt && previousSnapshot?.success && previousSnapshot?.data) {
      previousRecord = previousSnapshot.data;
    }
  }

  const refinedResult = await runStage(
    'Refiner',
    async (record, opts) => refine(record, opts),
    vaultRecord.data,
    { previousRecord },
  );
  if (refinedResult.failedAt) return refinedResult;
  if (!refinedResult.success) {
    logger.warn('Refiner failed', { trainerId, error: refinedResult.error });
    return failureEnvelope('Refiner', refinedResult.error, refinedResult.message, { trainerId });
  }

  const compileResult = await runStage('Compiler', compile, refinedResult);
  if (compileResult.failedAt) return compileResult;
  if (!compileResult.success) {
    logger.warn('Compiler failed', { trainerId, error: compileResult.error });
    return failureEnvelope('Compiler', compileResult.error, compileResult.message, { trainerId });
  }

  logger.info('pipeline complete', { trainerId, version: compileResult.version });
  return successEnvelope('UmamoePipeline', {
    trainerId,
    version:  compileResult.version,
    product:  compileResult.product,
    storedAt: compileResult.storedAt,
  }, { trainerId });
}

// ─── processRankings ──────────────────────────────────────────────────────────

export async function processRankings(params = {}) {
  logger.info('pipeline start — rankings', { params });

  const minerResult = await runStage('Miner', Miner.fetchRankings, params);
  if (minerResult.failedAt) return minerResult;
  if (!minerResult.success) {
    return failureEnvelope('Miner', minerResult.error, minerResult.message, { params });
  }

  const trainers = Array.isArray(minerResult.data)
    ? minerResult.data
    : minerResult.data?.trainers ?? [];

  logger.info('processing rankings', { trainerCount: trainers.length });

  const results = [];
  for (const trainer of trainers) {
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

    let previousRecord = null;
    const previousSnapshot = await runStage(
      'Vault.retrievePrevious',
      retrieve,
      { id: trainer.id, version: 'previous' },
    );
    if (!previousSnapshot?.failedAt && previousSnapshot?.success && previousSnapshot?.data) {
      previousRecord = previousSnapshot.data;
    }

    const refinedResult = refine(vaultRecord.data, { previousRecord });
    if (!refinedResult.success) {
      results.push({ success: false, trainerId: trainer.id, error: refinedResult.error });
      continue;
    }

    const compileResult = await compile(refinedResult);
    results.push({
      success: compileResult.success,
      trainerId: trainer.id,
      version: compileResult.version,
      error: compileResult.error,
    });
  }

  const succeeded = results.filter(r => r.success).length;
  logger.info('rankings pipeline complete', { succeeded, total: results.length });
  return successEnvelope(
    'UmamoeRankingsPipeline',
    { results },
    { total: results.length, succeeded },
  );
}
