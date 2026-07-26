/**
 * umamoe/rankingsQuick.js
 * Direct fast-path for leaderboard-type commands.
 *
 * Skips the full Vault → Refiner → Compiler → Depot chain. Instead:
 *   1. Fetch rankings from /v4/rankings/gains
 *   2. Fetch circle data for enrichment (fans, rank)
 *   3. Merge circle member data into each ranking item
 *   4. Sort by the requested gain field
 *   5. Return the top-N entries ready for embed display
 *
 * This avoids the SQLite write/read overhead that was causing ephemeral
 * file-system issues on Railway.  The old processRankings path is kept
 * untouched for scheduled / Broker runs that need Depot persistence.
 *
 * Used by: leaderboard, interCircleLeaderboard, circleMaster, clubGain,
 *          totalCircleFanGain, memberList
 */

import * as Miner from './Miner/miner.js';
import { CONFIGURED_CIRCLES } from '../core/botConfig.js';
import { createLogger }       from '../core/pipelineLogger.js';

const logger = createLogger('rankings-quick');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function firstNumber(...values) {
  return values.find(finiteNonNegative);
}

/**
 * Latest non-zero entry in a daily_fans array (calendar-month slots).
 * Works around pre-allocated 31-slot arrays where future days are 0.
 */
function latestDailyFanCount(dailyFans) {
  if (!Array.isArray(dailyFans) || dailyFans.length === 0) return undefined;
  let idx = dailyFans.length - 1;
  while (idx >= 0) {
    const v = Number(dailyFans[idx]);
    if (Number.isFinite(v) && v > 0) return v;
    idx--;
  }
  return undefined;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function normalizeRankingItem(raw, scopeSortBy) {
  if (!raw || typeof raw !== 'object') return raw;
  // Already normalised
  if (typeof raw.id === 'string' && raw.id !== '') return raw;

  const id = String(
    raw.account_id ?? raw.viewer_id ?? raw.trainer_id ?? raw.id ?? '',
  );
  const dailyFanGain   = raw.dailyFanGain   ?? raw.gain_3d  ?? raw.daily_gain   ?? null;
  const weeklyFanGain  = raw.weeklyFanGain  ?? raw.gain_7d  ?? raw.weekly_gain  ?? null;
  const monthlyFanGain = raw.monthlyFanGain ?? raw.gain_30d ?? raw.monthly_gain ?? null;
  const rank = raw.rank
    ?? (scopeSortBy === 'gain_30d' ? raw.rank_30d : scopeSortBy === 'gain_7d' ? raw.rank_7d : raw.rank_3d)
    ?? raw.ranking ?? raw.team_class ?? raw.placement ?? 1;

  return {
    ...raw,
    id,
    name:  String(raw.name ?? raw.trainer_name ?? ''),
    fans:  typeof raw.fans === 'number' ? raw.fans : 0,
    rank,
    dailyFanGain,
    weeklyFanGain,
    monthlyFanGain,
  };
}

// ─── Circle enrichment ────────────────────────────────────────────────────────

/**
 * Find a circle member by trainer ID, matching against all known ID fields.
 */
function findCircleMember(circleResult, trainerId) {
  const members = circleResult?.data?.members
    ?? circleResult?.data?.circle?.members
    ?? circleResult?.data?.data?.members
    ?? [];
  if (!Array.isArray(members) || members.length === 0) return null;

  const targetId = String(trainerId);
  return members.find(m =>
    String(m.viewer_id  ?? '') === targetId ||
    String(m.account_id ?? '') === targetId ||
    String(m.id         ?? '') === targetId ||
    String(m.trainer_id ?? '') === targetId,
  ) ?? null;
}

/**
 * Extract the absolute fan count and rank from a circle member record.
 */
function extractCircleFields(member) {
  if (!member) return {};

  const dailyFans  = member.daily_fans ?? member.dailyFans;
  const latestFans = latestDailyFanCount(dailyFans);

  const memberRank = firstNumber(
    member.rank, member.placement, member.ranking, member.daily_rank, member.dailyRank,
  );

  const result = {};
  if (typeof latestFans === 'number') result.fans = latestFans;
  if (memberRank !== undefined)       result.rank = memberRank;

  return result;
}

/**
 * Merge circle member data (fans, rank) into a normalised ranking item.
 * Circle data wins for fans/rank; API gains remain untouched.
 */
function enrichWithCircle(trainer, circleResult) {
  if (!circleResult?.success) return trainer;

  const member = findCircleMember(circleResult, trainer.id);
  if (!member) return trainer;

  const circleFields = extractCircleFields(member);

  // Only override fans if the circle actually provides a real value (> 0);
  // the rankings API always returns fans: 0 which is a placeholder.
  const enriched = { ...trainer };
  if (circleFields.fans && circleFields.fans > 0) enriched.fans = circleFields.fans;
  if (circleFields.rank !== undefined)             enriched.rank = circleFields.rank;

  return enriched;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and prepare leaderboard entries directly from the uma.moe API.
 *
 * @param {object} params
 * @param {'daily'|'weekly'|'monthly'} [params.scope='daily']
 * @param {number}                     [params.top=10]
 * @param {string|null}                [params.circle]  — circle ID for filtering & enrichment
 * @param {string|null}                [params.date]    — ISO date for historical rankings
 * @param {number|null}                [params.day]     — day-of-month (for circleMaster)
 * @returns {Promise<{
 *   success: boolean,
 *   entries: Array<{id, name, fans, rank, dailyFanGain, weeklyFanGain, monthlyFanGain}>,
 *   total: number,
 *   gainField: string,
 *   error?: string,
 *   message?: string,
 * }>}
 */
export async function fetchLeaderboardEntries(params = {}) {
  const scope     = params.scope  ?? 'daily';
  const top      = params.top    ?? 10;
  const circleId = params.circle ?? CONFIGURED_CIRCLES[0] ?? null;

  // ── 1. Fetch rankings + circle in parallel ──────────────────────────────────
  const sortBy = scope === 'monthly' ? 'gain_30d'
               : scope === 'weekly'  ? 'gain_7d'
               : 'gain_3d';

  const rankingsParams = { sort_by: sortBy, limit: top };
  if (params.date) rankingsParams.date = params.date;
  if (params.day)  rankingsParams.day  = params.day;

  let rankingsResult;
  let circleResult = null;

  try {
    const promises = [Miner.fetchRankings(rankingsParams)];
    if (circleId) promises.push(Miner.fetchCircle(circleId));

    const results = await Promise.allSettled(promises);
    rankingsResult = results[0].status === 'fulfilled' ? results[0].value : null;
    circleResult   = results[1]?.status === 'fulfilled' ? results[1].value : null;
  } catch (err) {
    logger.error('rankings fetch failed', { error: err.message });
    return { success: false, entries: [], total: 0, gainField: sortBy,
             error: 'API_FETCH_FAILED', message: err.message };
  }

  if (!rankingsResult?.success) {
    return {
      success: false,
      entries: [],
      total: 0,
      gainField: sortBy,
      error: rankingsResult?.error ?? 'RANKINGS_API_ERROR',
      message: rankingsResult?.message ?? 'Failed to fetch rankings from uma.moe',
    };
  }

  // ── 2. Extract & normalise raw trainer list ────────────────────────────────
  const rawData = rankingsResult.data;
  const rawTrainers = Array.isArray(rawData)
    ? rawData
    : rawData?.rankings
      ?? rawData?.trainers
      ?? rawData?.data
      ?? [];

  const trainers = rawTrainers
    .map(r => normalizeRankingItem(r, sortBy))
    .filter(t => t?.id && typeof t.id === 'string' && t.id !== '');

  // ── 3. Enrich with circle data ─────────────────────────────────────────────
  const enriched = circleResult?.success
    ? trainers.map(t => enrichWithCircle(t, circleResult))
    : trainers;

  // ── 4. Sort by gain field ──────────────────────────────────────────────────
  const gainField = scope === 'monthly' ? 'monthlyFanGain'
                  : scope === 'weekly'  ? 'weeklyFanGain'
                  : 'dailyFanGain';

  enriched.sort((a, b) => (b[gainField] ?? 0) - (a[gainField] ?? 0));

  const topEntries = enriched.slice(0, top);

  logger.info('rankings quick fetch complete', {
    total: enriched.length,
    top: topEntries.length,
    scope,
    gainField,
    circleEnriched: circleResult?.success ?? false,
  });

  return {
    success: true,
    entries: topEntries,
    total: enriched.length,
    gainField,
  };
}
