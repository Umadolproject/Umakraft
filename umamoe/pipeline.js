/**
 * Umamoe → Refinery Pipeline Wire
 * Phase 4: stage-level timeouts + throughput metrics.
 *
 * Data source strategy (see docs/miner-data-source.md):
 *   1. Fetch circle FIRST — contains member fan data for the whole circle.
 *   2. Extract trainer from circle members (id, name, fans, rank if present).
 *   3. Only fetch the individual trainer profile (/api/v4/user/profile/{id})
 *      when the circle does not supply all required fields (id/name/fans/rank).
 *   4. Merge: profile fills rank + extended data; circle wins for fan values.
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

// ─── Numeric helpers ──────────────────────────────────────────────────────────

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

/**
 * Return the most recent non-zero fan total from a cumulative daily_fans
 * array (uma.moe pre-allocates 31 slots; future days are 0). Falls back to
 * today's index, then walks backwards to the last real value.
 */
function latestDailyFanCount(dailyFans) {
  if (!Array.isArray(dailyFans) || dailyFans.length === 0) return undefined;
  const start = Math.min(new Date().getDate() - 1, dailyFans.length - 1);
  for (let i = start; i >= 0; i--) {
    if (finiteNonNegative(dailyFans[i]) && dailyFans[i] > 0) return dailyFans[i];
  }
  // Fall back to any non-zero value later in the array (defensive).
  for (let i = start + 1; i < dailyFans.length; i++) {
    if (finiteNonNegative(dailyFans[i]) && dailyFans[i] > 0) return dailyFans[i];
  }
  return undefined;
}

// ─── Circle member helpers ────────────────────────────────────────────────────

function memberIdentityValues(member) {
  return [
    member?.id,
    member?.trainer_id,
    member?.trainerId,
    member?.user_id,
    member?.userId,
    member?.trainer?.id,
    member?.profile?.id,
    // viewer_id is the primary circle member identifier
    member?.viewer_id,
    member?.account_id,
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

  // daily_fans from uma.moe is a CUMULATIVE running total of a member's
  // absolute fan count at the end of each day (e.g. [99234948, 99474675, …]),
  // NOT per-day gains.  Compute gains as deltas, and treat a zero/missing
  // baseline as a join-day (gain = 0) so mid-month joiners do not spike
  // (see BUG-004 in docs/KNOWLEDGE_BASE.md).
  const dailyFans = member.daily_fans ?? member.dailyFans;
  if (Array.isArray(dailyFans) && dailyFans.length > 0) {
    const rawTodayIndex = Math.min(new Date().getDate() - 1, dailyFans.length - 1);
    // Some responses pre-allocate 31 slots and leave future days as 0;
    // walk back to the most recent non-zero entry so "today" is real.
    let todayIndex = rawTodayIndex;
    while (todayIndex > 0 && !finiteNonNegative(dailyFans[todayIndex])) todayIndex--;
    while (todayIndex > 0 && dailyFans[todayIndex] === 0) todayIndex--;

    const today = finiteNonNegative(dailyFans[todayIndex]) ? dailyFans[todayIndex] : undefined;

    if (today !== undefined) {
      const prevDay = todayIndex >= 1 ? dailyFans[todayIndex - 1] : undefined;
      const weekAgo = todayIndex >= 7 ? dailyFans[todayIndex - 7] : undefined;

      // First non-zero value in the array = this member's month-start baseline.
      let baselineIndex = 0;
      while (baselineIndex < todayIndex && !(finiteNonNegative(dailyFans[baselineIndex]) && dailyFans[baselineIndex] > 0)) {
        baselineIndex++;
      }
      const baseline = finiteNonNegative(dailyFans[baselineIndex]) ? dailyFans[baselineIndex] : undefined;

      // Daily: 0 if we have no valid previous day (join-day / first-seen).
      if (direct.dailyFanGain === undefined) {
        direct.dailyFanGain = finiteNonNegative(prevDay) && prevDay > 0
          ? Math.max(0, today - prevDay)
          : 0;
      }

      // Weekly: prefer 7-day delta; fall back to today − baseline when the
      // member has fewer than 7 days of history.
      if (direct.weeklyFanGain === undefined) {
        if (finiteNonNegative(weekAgo) && weekAgo > 0) {
          direct.weeklyFanGain = Math.max(0, today - weekAgo);
        } else if (baseline !== undefined && baselineIndex < todayIndex) {
          direct.weeklyFanGain = Math.max(0, today - baseline);
        } else {
          direct.weeklyFanGain = 0;
        }
      }

      // Monthly: today − month-start baseline. 0 on the join day itself.
      if (direct.monthlyFanGain === undefined) {
        direct.monthlyFanGain = baseline !== undefined && baselineIndex < todayIndex
          ? Math.max(0, today - baseline)
          : 0;
      }
    }
  }

  const gains = Object.fromEntries(Object.entries(direct).filter(([, value]) => value !== undefined));
  return Object.keys(gains).length > 0 ? gains : null;
}

/**
 * Merge the matching circle member's API gains (and latest fan count) into a
 * trainer response.
 *
 * Pure pipeline-wire helper: acquisition stays in Miner, business
 * prioritisation stays in Refiner.
 */
export function mergeCircleMemberGains(trainerData, circleResult, trainerId) {
  if (!trainerData || typeof trainerData !== 'object') return trainerData;
  const member = getCircleMember(circleResult, trainerId, trainerData);
  const gains  = circleMemberGains(member);

  // Latest absolute fan count from daily_fans — overrides profile placeholder.
  // Use the most recent non-zero entry at or before today's index so a
  // preallocated 31-slot array with future days = 0 does not report fans: 0.
  const dailyFans  = member?.daily_fans ?? member?.dailyFans;
  const latestFans = latestDailyFanCount(dailyFans);

  if (!gains && latestFans === undefined) return trainerData;

  const memberRank = firstNumber(
    member?.rank,
    member?.placement,
    member?.ranking,
    member?.daily_rank,
    member?.dailyRank,
  );

  return {
    ...trainerData,
    // Apply real fan total from circle when available
    ...(typeof latestFans === 'number' ? { fans: latestFans } : {}),
    ...(gains ?? {}),
    apiGains: { ...(gains ?? {}) },
    ...(memberRank !== undefined ? { rank: memberRank } : {}),
  };
}

// ─── Circle-first helpers ─────────────────────────────────────────────────────

/**
 * Try to build a flat trainer object from circle member data.
 * Returns null if the trainer is not found in the circle member list.
 *
 * Matching order:
 *   1. viewer_id / account_id exact match (numeric string comparison)
 *   2. Returns null — name matching is deferred to mergeCircleMemberGains
 *      after a profile fetch supplies the canonical name.
 */
function extractTrainerFromCircle(circleResult, trainerId) {
  const members = circleResult?.data?.members
    ?? circleResult?.data?.circle?.members
    ?? circleResult?.data?.data?.members
    ?? [];

  if (!Array.isArray(members) || members.length === 0) return null;

  const targetId = String(trainerId);
  const member   = members.find(m =>
    String(m.viewer_id  ?? '') === targetId ||
    String(m.account_id ?? '') === targetId ||
    String(m.id         ?? '') === targetId ||
    String(m.trainer_id ?? '') === targetId,
  );

  if (!member) return null;

  const dailyFans  = member.daily_fans ?? member.dailyFans;
  const latestFansValue = latestDailyFanCount(dailyFans);
  const latestFans = latestFansValue === undefined ? null : latestFansValue;

  const memberRank = firstNumber(
    member.rank, member.placement, member.ranking, member.daily_rank, member.dailyRank,
  );

  return {
    id:   String(member.viewer_id ?? member.account_id ?? trainerId),
    name: member.trainer_name ?? member.name ?? '',
    fans: typeof latestFans === 'number' ? latestFans : null,
    rank: memberRank ?? null,
    // Preserve raw circle fields for mergeCircleMemberGains enrichment
    viewer_id:      member.viewer_id,
    daily_fans:     member.daily_fans,
    dailyFanGain:   member.dailyFanGain   ?? member.daily_gain   ?? null,
    weeklyFanGain:  member.weeklyFanGain  ?? member.weekly_gain  ?? null,
    monthlyFanGain: member.monthlyFanGain ?? member.monthly_gain ?? null,
  };
}

/**
 * Returns true when any of the four Inspector-required fields is absent.
 * Used to decide whether a secondary profile fetch is needed.
 */
function hasMissingRequiredFields(data) {
  if (!data) return true;
  return ['id', 'name', 'fans', 'rank'].some(
    f => data[f] === null || data[f] === undefined,
  );
}

// ─── processTrainer ───────────────────────────────────────────────────────────

export async function processTrainer(trainerId, options = {}) {
  logger.info('pipeline start', { trainerId });

  const circleId = options.circleId
    ?? options.circle
    ?? CONFIGURED_CIRCLES[0]
    ?? null;

  // ── STEP 1: Fetch circle (primary source) ─────────────────────────────────
  const circleResult = circleId
    ? await runStage('Miner.circle', Miner.fetchCircle, circleId)
    : null;

  if (circleResult && !circleResult.success) {
    logger.warn('Circle fetch failed; will attempt trainer profile fallback', {
      trainerId, circleId, error: circleResult.error,
    });
  }

  // ── STEP 2: Try to build trainer envelope from circle member data ──────────
  const circleTrainer = circleResult?.success
    ? extractTrainerFromCircle(circleResult, trainerId)
    : null;

  // ── STEP 3: Decide if individual profile fetch is needed ──────────────────
  //   • Trainer not found in circle (different ID scheme, or not a member)
  //   • Or found but missing required fields (e.g. rank not in circle data)
  let minerResult;

  if (circleTrainer && !hasMissingRequiredFields(circleTrainer)) {
    // Circle supplies all required fields — no extra API call needed.
    logger.info('Trainer data complete from circle (primary source)', { trainerId });
    minerResult = {
      success:  true,
      data:     circleTrainer,
      metadata: {
        endpoint:   `${circleId ? `/v4/circles?circle_id=${circleId}` : '/v4/circles'}`,
        statusCode: 200,
        timestamp:  new Date().toISOString(),
        source:     'uma.moe',
        attempts:   1,
        dataSource: 'circle',
      },
    };
  } else {
    // Fetch individual trainer profile as fallback.
    logger.info(
      circleTrainer
        ? 'Circle member found but missing required fields — fetching trainer profile'
        : 'Trainer not found in circle — fetching trainer profile',
      { trainerId },
    );

    const profileResult = await runStage('Miner', Miner.fetchTrainer, trainerId);

    if (profileResult.success === false && profileResult.failedAt) return profileResult;

    if (!profileResult.success) {
      if (circleTrainer) {
        // Have partial circle data — proceed; Inspector will catch any
        // remaining required-field violations and surface them clearly.
        logger.warn('Profile fallback failed; proceeding with partial circle data', {
          trainerId, error: profileResult.error,
        });
        minerResult = {
          success:  true,
          data:     circleTrainer,
          metadata: {
            endpoint:   `/v4/circles?circle_id=${circleId}`,
            statusCode: 200,
            timestamp:  new Date().toISOString(),
            source:     'uma.moe',
            attempts:   1,
            dataSource: 'circle-partial',
          },
        };
      } else {
        logger.warn('Miner failed — no circle data, no profile', {
          trainerId, error: profileResult.error,
        });
        return failureEnvelope('Miner', profileResult.error, profileResult.message, { trainerId });
      }
    } else if (circleTrainer) {
      // Merge: profile fills rank + extended fields; circle data wins for fans.
      const circleFields = Object.fromEntries(
        Object.entries(circleTrainer).filter(([, v]) => v !== null && v !== undefined),
      );
      minerResult = {
        ...profileResult,
        data: { ...profileResult.data, ...circleFields },
      };
    } else {
      minerResult = profileResult;
    }
  }

  // ── STEP 4: Apply circle gains (fans, dailyFanGain, weeklyFanGain, …) ──────
  // mergeCircleMemberGains also sets the latest absolute fan count from
  // daily_fans, overriding any placeholder (e.g. fans: 0 from profile).
  const enrichedMinerResult = circleResult?.success
    ? {
        ...minerResult,
        data: mergeCircleMemberGains(minerResult.data, circleResult, trainerId),
      }
    : minerResult;

  // ── STEP 5: Courier → Inspector ───────────────────────────────────────────
  const inspectorResult = await runStage('Courier', transport, enrichedMinerResult);
  if (inspectorResult.failedAt) return inspectorResult;
  if (!inspectorResult.success || !inspectorResult.accepted) {
    logger.warn('Inspector rejected data', { trainerId, error: inspectorResult.error });
    return failureEnvelope('Inspector', inspectorResult.error, inspectorResult.message, { trainerId });
  }

  // ── STEP 6: Vault store + retrieve ───────────────────────────────────────
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

  // ── STEP 7: Previous snapshot for Refiner delta calculation ──────────────
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

  // ── STEP 8: Refiner → Compiler ────────────────────────────────────────────
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

  // The circle param here is an uma.moe circle ID (never the Discord guild ID).
  // Fall back to the first configured circle so the circle endpoint can be used
  // for fan-gain enrichment even when no explicit circle was requested.
  //
  // type === 'interCircle' means cross-circle rankings — skip circle enrichment
  // since no single circle context applies.
  const isInterCircle = params.type === 'interCircle';
  const circleId = isInterCircle
    ? null
    : (params.circleId ?? params.circle ?? CONFIGURED_CIRCLES[0] ?? null);

  // Only pass params the /v4/rankings/gains endpoint actually accepts.
  // Internal pipeline params (circle, scope) must NOT be forwarded.
  // `date: null` must be excluded — url.searchParams.set serialises null as "null".
  //
  // sort_by controls which gain period the API sorts by:
  //   gain_3d  → daily ranking
  //   gain_7d  → weekly ranking
  //   gain_30d → monthly ranking
  const scopeSortBy = params.scope === 'monthly' ? 'gain_30d'
                    : params.scope === 'weekly'  ? 'gain_7d'
                    :                              'gain_3d';
  const rankingsFetchParams = { sort_by: scopeSortBy };
  if (params.top   != null) rankingsFetchParams.limit = params.top;
  if (params.limit != null) rankingsFetchParams.limit = params.limit;
  // Forward date to the rankings API when provided (e.g. /leaderboard date:2026-07-01).
  // The API may or may not support it — if it 400s, the Miner retry logic handles it.
  if (params.date  != null) rankingsFetchParams.date  = params.date;
  // Forward day for circleMaster (day-of-month filter, 1-31).
  if (params.day   != null) rankingsFetchParams.day   = params.day;

  const [minerResult, circleResult] = await Promise.all([
    runStage('Miner', Miner.fetchRankings, rankingsFetchParams),
    circleId
      ? runStage('Miner.circle', Miner.fetchCircle, circleId)
      : Promise.resolve(null),
  ]);

  if (minerResult.failedAt) return minerResult;
  if (!minerResult.success) {
    return failureEnvelope('Miner', minerResult.error, minerResult.message, { params });
  }

  if (circleResult && !circleResult.success) {
    logger.warn('Circle enrichment unavailable for rankings; continuing without it', {
      circleId,
      error: circleResult.error,
    });
  }

  // Normalise each item from /v4/rankings/gains to the flat shape the
  // Inspector and Refiner expect.
  //
  // API response shape (verified 2026-07-25):
  //   { viewer_id, trainer_name, gain_3d, gain_7d, gain_30d,
  //     rank_3d, rank_7d, rank_30d, circle_id, circle_name, shame_score }
  //
  // Inspector requires: id (string), name (string), fans (number ≥ 0), rank (number ≥ 1).
  // fans is not in the rankings response — default to 0; circle enrichment
  // (mergeCircleMemberGains) will override with the real value when available.
  function normalizeRankingItem(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    // Already normalised (unit-test mocks or previous callers)
    if (typeof raw.id === 'string' && raw.id !== '') return raw;
    const id = String(
      raw.account_id ?? raw.viewer_id ?? raw.trainer_id ?? raw.id ?? '',
    );
    // Map the API's period-gain fields to the canonical names used throughout
    // the pipeline (Refiner, Compiler, Workshop sort/display).
    const dailyFanGain   = raw.dailyFanGain   ?? raw.gain_3d  ?? raw.daily_gain   ?? null;
    const weeklyFanGain  = raw.weeklyFanGain  ?? raw.gain_7d  ?? raw.weekly_gain  ?? null;
    const monthlyFanGain = raw.monthlyFanGain ?? raw.gain_30d ?? raw.monthly_gain ?? null;
    // Use the sort-period rank as the primary rank signal.
    const rank = raw.rank
      ?? (scopeSortBy === 'gain_30d' ? raw.rank_30d : scopeSortBy === 'gain_7d' ? raw.rank_7d : raw.rank_3d)
      ?? raw.ranking ?? raw.team_class ?? raw.placement ?? 1;
    return {
      // Preserve all raw fields first so nothing is lost for enrichment
      ...raw,
      // Override / add canonical fields the Inspector and downstream require
      id,
      name:  String(raw.name ?? raw.trainer_name ?? ''),
      fans:  typeof raw.fans === 'number' ? raw.fans : 0,
      rank,
      dailyFanGain,
      weeklyFanGain,
      monthlyFanGain,
    };
  }

  const rawTrainers = Array.isArray(minerResult.data)
    ? minerResult.data
    : minerResult.data?.rankings   // /v4/rankings/gains → { rankings: [...] }
      ?? minerResult.data?.trainers
      ?? minerResult.data?.data
      ?? [];

  const trainers = rawTrainers.map(normalizeRankingItem).filter(t => t?.id);

  // When a specific circle is configured (non-interCircle), filter rankings to
  // only include members of that circle.  The /v4/rankings/gains endpoint
  // returns global results; circle_id on each item tells us which circle they
  // belong to.  Without this filter, trainers from other circles appear in the
  // leaderboard with 0 fans (circle enrichment fails for non-members).
  const circleFiltered = circleId
    ? trainers.filter(t => String(t.circle_id ?? t.circleId ?? '') === String(circleId))
    : trainers;

  if (circleId && circleFiltered.length < trainers.length) {
    logger.info(
      `filtered ${trainers.length - circleFiltered.length} non-circle trainers from rankings`,
      { circleId, before: trainers.length, after: circleFiltered.length },
    );
  }

  logger.info('processing rankings', { trainerCount: circleFiltered.length });

  const results = [];
  let enrichedCount = 0;
  for (const trainer of circleFiltered) {
    // Apply circle enrichment per trainer so rankings gain numbers match
    // the authoritative API values used by processTrainer.
    const enrichedTrainerData = circleResult?.success
      ? mergeCircleMemberGains(trainer, circleResult, trainer.id)
      : trainer;

    // Track whether circle enrichment actually supplied fan counts — when
    // mergeCircleMemberGains can't find the member in the circle, fans stays
    // at 0 (the rankings API does not include absolute fan counts).
    if (circleResult?.success && (enrichedTrainerData.fans ?? 0) > (trainer.fans ?? 0)) {
      enrichedCount++;
    }

    const syntheticEnvelope = {
      success: true,
      data:    enrichedTrainerData,
      metadata: {
        ...minerResult.metadata,
        attempts:   minerResult.metadata?.attempts,
        statusCode: minerResult.metadata?.statusCode,
        endpoint:   `/rankings → trainer/${trainer.id}`,
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

    const refinedResult = await runStage(
      'Refiner',
      async (record, opts) => refine(record, opts),
      vaultRecord.data,
      { previousRecord },
    );
    if (refinedResult.failedAt) {
      results.push({ success: false, trainerId: trainer.id, error: refinedResult.error });
      continue;
    }
    if (!refinedResult.success) {
      results.push({ success: false, trainerId: trainer.id, error: refinedResult.error });
      continue;
    }

    const compileResult = await runStage('Compiler', compile, refinedResult);
    results.push({
      success:   compileResult.success,
      trainerId: trainer.id,
      version:   compileResult.version,
      error:     compileResult.error,
    });
  }

  const succeeded = results.filter(r => r.success).length;
  logger.info('rankings pipeline complete', {
    succeeded,
    total: results.length,
    circleEnriched: enrichedCount,
    missingFans: circleResult?.success ? results.length - enrichedCount : 0,
  });

  // When every trainer failed, return a proper failure so the caller can
  // surface a clear error instead of a misleading "no data available" from
  // an empty success envelope.
  if (results.length > 0 && succeeded === 0) {
    const firstError = results[0]?.error ?? 'UNKNOWN_STAGE_ERROR';
    return failureEnvelope(
      'UmamoeRankingsPipeline',
      'RANKINGS_ALL_FAILED',
      `All ${results.length} trainer(s) failed in the pipeline. First error: ${firstError}`,
      { results, total: results.length },
      true,
    );
  }

  if (results.length === 0) {
    return failureEnvelope(
      'UmamoeRankingsPipeline',
      'RANKINGS_NO_DATA',
      'No trainers were returned by the rankings endpoint after circle filtering',
      { circleId, circleFilteredCount: circleFiltered.length },
      false,
    );
  }

  return successEnvelope(
    'UmamoeRankingsPipeline',
    { results },
    { total: results.length, succeeded },
  );
}

// ─── processClubGain ──────────────────────────────────────────────────────────

/**
 * Build a 30-day club gain spreadsheet for a single circle.
 *
 * Fetches the circle, sums each member's cumulative daily_fans array across
 * all members per day, then computes the day-over-day delta (daily gain) and a
 * running total. Returns the rows[] and summary stats the clubGain blueprint
 * expects — this does NOT route through Inspector/Refiner/Compiler because the
 * output is aggregate club-level history, not a per-trainer compiled product.
 *
 * @param {object} params
 * @param {string} [params.circleId]  — uma.moe circle ID (falls back to first configured)
 * @param {number} [params.days=30]   — number of days to include (1–30)
 * @returns {Promise<envelope>} — { success, clubGain: { clubId, clubName, rows, summary } }
 */
export async function processClubGain(params = {}) {
  const circleId = params.circleId
    ?? params.circle
    ?? CONFIGURED_CIRCLES[0]
    ?? null;

  if (!circleId) {
    return failureEnvelope(
      'UmamoeClubGainPipeline',
      'CIRCLE_ID_REQUIRED',
      'A circle ID is required to build a club gain report',
      { params },
      false,
    );
  }

  const days = Math.min(Math.max(params.days ?? 30, 1), 30);

  logger.info('pipeline start — club gain', { circleId, days });

  const circleResult = await runStage('Miner.circle', Miner.fetchCircle, circleId);
  if (circleResult.failedAt) return circleResult;
  if (!circleResult.success) {
    return failureEnvelope(
      'Miner.circle',
      circleResult.error ?? 'CIRCLE_FETCH_FAILED',
      circleResult.message ?? `Could not fetch circle ${circleId}`,
      { circleId },
      circleResult.retriable ?? true,
    );
  }

  const members = circleResult?.data?.members
    ?? circleResult?.data?.circle?.members
    ?? circleResult?.data?.data?.members
    ?? [];

  if (!Array.isArray(members) || members.length === 0) {
    return failureEnvelope(
      'UmamoeClubGainPipeline',
      'CIRCLE_NO_MEMBERS',
      `Circle ${circleId} has no members to aggregate`,
      { circleId },
      false,
    );
  }

  // Sum every member's cumulative daily_fans into one per-day circle total.
  // uma.moe pre-allocates 31 slots; future days are 0 and must be excluded.
  const todayIndex = Math.min(new Date().getDate() - 1, 30);
  const startIndex  = Math.max(0, todayIndex - days + 1);

  const dailyTotals = new Array(days).fill(0);
  for (const member of members) {
    const dailyFans = member?.daily_fans ?? member?.dailyFans;
    if (!Array.isArray(dailyFans)) continue;
    for (let i = 0; i < days; i++) {
      const idx = startIndex + i;
      const v = dailyFans[idx];
      if (finiteNonNegative(v) && v > 0) dailyTotals[i] += v;
    }
  }

  // Day-over-day deltas = the daily gain. Running total accumulates gains.
  const rows = [];
  let runningTotal = 0;
  for (let i = 0; i < days; i++) {
    const today  = dailyTotals[i];
    const prev   = i > 0 ? dailyTotals[i - 1] : null;
    const gain   = prev == null ? 0 : Math.max(0, today - prev);
    runningTotal += gain;

    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    rows.push({
      date:         date.toISOString().substring(0, 10),
      dailyGain:    gain,
      runningTotal,
    });
  }

  const gains = rows.map(r => r.dailyGain).filter(g => g > 0);
  const total   = gains.reduce((a, b) => a + b, 0);
  const average = gains.length > 0 ? Math.round(total / gains.length) : 0;
  const highest = gains.length > 0 ? Math.max(...gains) : 0;
  const lowest  = gains.length > 0 ? Math.min(...gains) : 0;

  const clubName = circleResult?.data?.circle?.name
    ?? circleResult?.data?.name
    ?? circleResult?.data?.circle_name
    ?? String(circleId);

  const summary = { total, average, highest, lowest };

  logger.info('club gain pipeline complete', { circleId, rows: rows.length });

  return successEnvelope('UmamoeClubGainPipeline', {
    clubGain: {
      clubId:   String(circleId),
      clubName,
      rows,
      summary,
    },
  }, { circleId, days });
}
