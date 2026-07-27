/**
 * umamoe/rankingsQuick.js
 * Direct fast-path for circle leaderboard commands.
 *
 * Builds the leaderboard DIRECTLY from circle member data — no rankings API,
 * no ID-matching between rankings and circle.  This guarantees every entry
 * is an actual circle member and eliminates the cross-API ID mismatch that
 * caused the old pipeline (and the global rankings API) to show unrelated
 * trainers.
 *
 * Gain computation reuses the same circleMemberGains logic already
 * battle-tested in processTrainer (daily_fans deltas → day-over-day gain).
 *
 * Used by: leaderboard (default), circleMaster, totalCircleFanGain
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

/**
 * How many consecutive trailing zeros are at the end of daily_fans.
 * An active member always has a non-zero cumulative value at today's slot
 * (the total fan count, even if growth is 0).  Trailing zeros mean the
 * member left mid-month and the API zeroed out the remaining slots.
 *
 * Returns the count of trailing zero days.  > 3 means the member likely left.
 */
/**
 * Minimum trailing zeros needed (beyond future-day padding) to consider
 * a member as having left the circle.  e.g. 3 means if there are 3 more
 * trailing zeros than remaining month days, the member likely left.
 */
const LEFT_THRESHOLD_DAYS = 3;

function trailingZeroDays(dailyFans) {
  if (!Array.isArray(dailyFans) || dailyFans.length === 0) return 0;
  let count = 0;
  for (let i = dailyFans.length - 1; i >= 0; i--) {
    const v = Number(dailyFans[i]);
    if (!Number.isFinite(v) || v <= 0) {
      count++;
    } else {
      break; // hit a real value — stop counting
    }
  }
  return count;
}

function daysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - now.getDate());
}

function hasMemberLeftThisMonth(member) {
  const dailyFans = member?.daily_fans ?? member?.dailyFans;
  if (!Array.isArray(dailyFans) || dailyFans.length === 0) return false;

  const zeroDays = trailingZeroDays(dailyFans);

  // daily_fans is a per-day cumulative array padded to month length.
  // Future days (e.g. July 27 → positions 27-30) are zero-filled by the API.
  // We subtract those from the trailing zero count before checking the threshold.
  const remainingDays = daysRemainingInMonth();
  const realTrailingZeros = zeroDays - remainingDays;

  return realTrailingZeros > LEFT_THRESHOLD_DAYS;
}

// ─── Gain computation (mirrors pipeline.js circleMemberGains) ─────────────────

function computeMemberGains(member) {
  if (!member || typeof member !== 'object') return null;

  // Try direct gain fields first (API may provide these).
  const direct = {
    dailyFanGain:   firstNumber(member.dailyFanGain, member.daily_gain, member.daily_fan_gain, member.dailyGain, member.fan_gain?.daily, member.fanGain?.daily),
    weeklyFanGain:  firstNumber(member.weeklyFanGain, member.weekly_gain, member.weekly_fan_gain, member.weeklyGain, member.fan_gain?.weekly, member.fanGain?.weekly),
    monthlyFanGain: firstNumber(member.monthlyFanGain, member.monthly_gain, member.monthly_fan_gain, member.monthlyGain, member.fan_gain?.monthly, member.fanGain?.monthly),
  };

  // Fall back to daily_fans deltas when direct fields are missing.
  // daily_fans is a CUMULATIVE per-day array (e.g. [99234948, 99474675, …]).
  const dailyFans = member.daily_fans ?? member.dailyFans;
  if (Array.isArray(dailyFans) && dailyFans.length > 0) {
    const lastSlot = dailyFans.length - 1;

    // Walk back to the most recent non-zero entry.
    let todayIdx = Math.min(new Date().getDate() - 1, lastSlot);
    while (todayIdx > 0 && !(finiteNonNegative(dailyFans[todayIdx]) && dailyFans[todayIdx] > 0)) todayIdx--;

    const today = finiteNonNegative(dailyFans[todayIdx]) ? dailyFans[todayIdx] : undefined;

    if (today !== undefined) {
      const prevDay   = todayIdx >= 1 ? dailyFans[todayIdx - 1] : undefined;
      const weekAgo   = todayIdx >= 7 ? dailyFans[todayIdx - 7] : undefined;

      let baselineIdx = 0;
      while (baselineIdx < todayIdx && !(finiteNonNegative(dailyFans[baselineIdx]) && dailyFans[baselineIdx] > 0)) {
        baselineIdx++;
      }
      const baseline = finiteNonNegative(dailyFans[baselineIdx]) ? dailyFans[baselineIdx] : undefined;

      if (direct.dailyFanGain === undefined) {
        direct.dailyFanGain = finiteNonNegative(prevDay) && prevDay > 0
          ? Math.max(0, today - prevDay)
          : 0;
      }

      if (direct.weeklyFanGain === undefined) {
        if (finiteNonNegative(weekAgo) && weekAgo > 0) {
          direct.weeklyFanGain = Math.max(0, today - weekAgo);
        } else if (baseline !== undefined && baselineIdx < todayIdx) {
          direct.weeklyFanGain = Math.max(0, today - baseline);
        } else {
          direct.weeklyFanGain = 0;
        }
      }

      if (direct.monthlyFanGain === undefined) {
        direct.monthlyFanGain = baseline !== undefined && baselineIdx < todayIdx
          ? Math.max(0, today - baseline)
          : 0;
      }
    }
  }

  const result = Object.fromEntries(Object.entries(direct).filter(([, v]) => v !== undefined));
  return Object.keys(result).length > 0 ? result : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a leaderboard directly from circle member data.
 *
 * Fetches the circle, extracts every member, computes gains from daily_fans
 * (or direct gain fields), sorts by the requested scope, and returns the
 * top-N entries.
 *
 * @param {object} params
 * @param {'daily'|'weekly'|'monthly'} [params.scope='daily']
 * @param {number}                     [params.top=10]
 * @param {string|null}                [params.circle] — uma.moe circle ID
 * @returns {Promise<{
 *   success: boolean,
 *   entries: Array,
 *   total: number,
 *   gainField: string,
 *   circleName?: string,
 *   circleId?: string,
 *   error?: string,
 *   message?: string,
 * }>}
 */
export async function fetchLeaderboardEntries(params = {}) {
  const scope    = params.scope  ?? 'daily';
  const top      = params.top    ?? 10;
  const circleId = params.circle ?? CONFIGURED_CIRCLES[0] ?? null;

  if (!circleId) {
    return {
      success: false,
      entries: [],
      total: 0,
      gainField: 'dailyFanGain',
      error: 'NO_CIRCLE',
      message: 'No circle configured. Set CONFIGURED_CIRCLES or pass a circle option.',
    };
  }

  // ── 1. Fetch circle ────────────────────────────────────────────────────────
  let circleResult;
  try {
    circleResult = await Miner.fetchCircle(circleId);
  } catch (err) {
    logger.error('circle fetch failed', { circleId, error: err.message });
    return {
      success: false,
      entries: [],
      total: 0,
      gainField: 'dailyFanGain',
      error: 'CIRCLE_FETCH_FAILED',
      message: `Failed to fetch circle ${circleId}: ${err.message}`,
    };
  }

  if (!circleResult?.success) {
    return {
      success: false,
      entries: [],
      total: 0,
      gainField: 'dailyFanGain',
      error: circleResult?.error ?? 'CIRCLE_API_ERROR',
      message: circleResult?.message ?? `Circle ${circleId} returned an error.`,
    };
  }

  // ── 2. Extract members ─────────────────────────────────────────────────────
  const members =
    circleResult?.data?.members
    ?? circleResult?.data?.circle?.members
    ?? circleResult?.data?.data?.members
    ?? [];

  if (!Array.isArray(members) || members.length === 0) {
    return {
      success: false,
      entries: [],
      total: 0,
      gainField: 'dailyFanGain',
      error: 'CIRCLE_EMPTY',
      message: `Circle ${circleId} has no members.`,
    };
  }

  // ── 3. Build entries from circle members ───────────────────────────────────
  const entries = [];
  let leftMembers = 0;

  for (const m of members) {
    // Skip members who left this month (trailing zeros in daily_fans).
    if (hasMemberLeftThisMonth(m)) { leftMembers++; continue; }

    const gains = computeMemberGains(m);

    const id = String(
      m.viewer_id ?? m.account_id ?? m.trainer_id ?? m.id ?? '',
    );
    if (!id) continue;

    const name = String(m.name ?? m.trainer_name ?? m.trainerName ?? id);

    const dailyFans = m.daily_fans ?? m.dailyFans;
    const fans      = latestDailyFanCount(dailyFans) ?? 0;

    const rank = firstNumber(
      m.rank, m.placement, m.ranking, m.daily_rank, m.dailyRank,
    ) ?? 1;

    entries.push({
      id,
      name,
      fans,
      rank,
      dailyFanGain:    gains?.dailyFanGain   ?? 0,
      weeklyFanGain:   gains?.weeklyFanGain  ?? 0,
      monthlyFanGain:  gains?.monthlyFanGain ?? 0,
    });
  }

  // ── 4. Sort by scope gain field ────────────────────────────────────────────
  const gainField =
    scope === 'monthly' ? 'monthlyFanGain'
  : scope === 'weekly'  ? 'weeklyFanGain'
  :                        'dailyFanGain';

  entries.sort((a, b) => (b[gainField] ?? 0) - (a[gainField] ?? 0));

  const topEntries = entries.slice(0, top);

  // ── 5. Circle name for the embed ───────────────────────────────────────────
  const circleName =
    circleResult?.data?.circle?.name
    ?? circleResult?.data?.name
    ?? `Circle ${circleId}`;

  logger.info('leaderboard built from circle', {
    circleId,
    totalMembers: members.length,
    leftMembers,
    activeMembers: entries.length,
    top: topEntries.length,
    scope,
    gainField,
  });

  return {
    success: true,
    entries: topEntries,
    total: entries.length,
    gainField,
    circleName,
    circleId,
  };
}
