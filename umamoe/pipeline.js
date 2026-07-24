/**
 * Umamoe → Refinery Pipeline Wire
 * Phase 4: stage-level timeouts + throughput metrics.
 */

import * as Miner from './Miner/miner.js';
import { transport }  from './Courier/courier.js';
import { receive, retrieve } from './Vault/vault.js';
import { refine }  from '../Refinery/Refiner/refiner.js';
import { compile } from '../Refinery/Compiler/compiler.js';
import { CONFIGURED_CIRCLES } from '../core/botConfig.js';
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
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`STAGE_TIMEOUT: ${stageName} exceeded ${limitMs}ms`)),
            limitMs,
          );
        }),
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

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function firstNumber(...values) {
  return values.find(finiteNonNegative);
}

function sumNumbers(values) {
  if (!Array.isArray(values)) return undefined;
  const numbers = values.filter(finiteNonNegative);
  return numbers.length > 0 ? numbers.reduce((total, value) => total + value, 0) : undefined;
}

function memberIdentityValues(member) {
  return [
    member?.id,
    member?.trainer_id,
    member?.trainerId,
    member?.user_id,
    member?.userId,
    member?.trainer?.id,
    member?.profile?.id,
  ].filter(value => value !== undefined && value !== null).map(String);
}

function getCircleMember(circleResult, trainerId, trainerData) {
  const members = circleResult?.data?.members
    ?? circleResult?.data?.circle?.members
    ?? circleResult?.data?.data?.members
    ?? [];
  if (!Array.isArray(members)) return null;

  const targetIds = new Set([String(trainerId), String(trainerData?.id)].filter(Boolean));
  const byId = members.find(member => memberIdentityValues(member).some(id => targetIds.has(id)));
  if (byId) return byId;

  const targetName = String(trainerData?.name ?? '').trim().toLowerCase();
  if (!targetName) return null;
  return members.find(member => [
    member?.name,
    member?.trainer_name,
    member?.trainerName,
    member?.trainer?.name,
  ].some(name => String(name ?? '').trim().toLowerCase() === targetName)) ?? null;
}

function circleMemberGains(member) {
  if (!member || typeof member !== 'object') return null;

  const direct = {
    dailyFanGain: firstNumber(
      member.dailyFanGain,
      member.daily_gain,
      member.daily_fan_gain,
      member.dailyGain,
      member.fan_gain?.daily,
      member.fanGain?.daily,
    ),
    weeklyFanGain: firstNumber(
      member.weeklyFanGain,
      member.weekly_gain,
      member.weekly_fan_gain,
      member.weeklyGain,
      member.fan_gain?.weekly,
      member.fanGain?.weekly,
    ),
    monthlyFanGain: firstNumber(
      member.monthlyFanGain,
      member.monthly_gain,
      member.monthly_fan_gain,
      member.monthlyGain,
      member.fan_gain?.monthly,
      member.fanGain?.monthly,
    ),
  };

  const dailyFans = member.daily_fans ?? member.dailyFans;
  if (Array.isArray(dailyFans) && dailyFans.length > 0) {
    const todayIndex = Math.min(new Date().getDate() - 1, dailyFans.length - 1);
    direct.dailyFanGain ??= firstNumber(dailyFans[todayIndex], dailyFans[dailyFans.length - 1]);
    direct.weeklyFanGain ??= sumNumbers(dailyFans.slice(Math.max(0, todayIndex - 6), todayIndex + 1));
    direct.monthlyFanGain ??= sumNumbers(dailyFans.slice(0, todayIndex + 1));
  }

  const gains = Object.fromEntries(Object.entries(direct).filter(([, value]) => value !== undefined));
  return Object.keys(gains).length > 0 ? gains : null;
}

/**
 * Merge the matching circle member's API gains into a trainer response.
 * This is intentionally a pure pipeline-wire helper: acquisition remains in
 * Miner and business prioritisation remains in Refiner.
 */
export function mergeCircleMemberGains(trainerData, circleResult, trainerId) {
  if (!trainerData || typeof trainerData !== 'object') return trainerData;
  const member = getCircleMember(circleResult, trainerId, trainerData);
  const gains = circleMemberGains(member);
  if (!gains) return trainerData;

  const memberRank = firstNumber(
    member.rank,
    member.placement,
    member.ranking,
    member.daily_rank,
    member.dailyRank,
  );

  return {
    ...trainerData,
    ...gains,
    apiGains: { ...gains },
    ...(memberRank !== undefined ? { rank: memberRank } : {}),
  };
}

// ─── processTrainer ───────────────────────────────────────────────────────────

export async function processTrainer(trainerId, options = {}) {
  logger.info('pipeline start', { trainerId });

  const circleId = options.circleId
    ?? options.circle
    ?? CONFIGURED_CIRCLES[0]
    ?? null;
  const [minerResult, circleResult] = await Promise.all([
    runStage('Miner', Miner.fetchTrainer, trainerId),
    circleId
      ? runStage('Miner.circle', Miner.fetchCircle, circleId)
      : Promise.resolve(null),
  ]);
  if (minerResult.success === false && minerResult.failedAt) return minerResult;
  if (!minerResult.success) {
    logger.warn('Miner failed', { trainerId, error: minerResult.error });
    return failureEnvelope('Miner', minerResult.error, minerResult.message, { trainerId });
  }

  if (circleResult && !circleResult.success) {
    logger.warn('Circle enrichment unavailable; continuing with trainer data', {
      trainerId,
      circleId,
      error: circleResult.error,
    });
  }

  const enrichedMinerResult = circleResult?.success
    ? {
        ...minerResult,
        data: mergeCircleMemberGains(minerResult.data, circleResult, trainerId),
      }
    : minerResult;

  const inspectorResult = await runStage('Courier', transport, enrichedMinerResult);
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
