/**
 * Refiner
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Refiner — Stage 2, Refinery
 *
 * Sole responsibility: transform trusted Vault records into
 * business-ready refined results for the Compiler.
 * Never fetches external data, validates, stores, or presents.
 */

const REFINER_VERSION = 'v1.1';

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'refiner',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Failure envelope ─────────────────────────────────────────────────────────

function failure(error, message, context = {}) {
  return {
    success: false,
    error,
    message,
    retriable: false,
    timestamp: new Date().toISOString(),
    context,
  };
}

// ─── Trust guard ──────────────────────────────────────────────────────────────

/**
 * Refiner only accepts records that originated from the Vault.
 * A valid Vault record has { data, metadata: { inspectedAt } }.
 */
function isTrustedRecord(record) {
  return (
    record !== null &&
    typeof record === 'object' &&
    'data' in record &&
    typeof record.data === 'object' &&
    record.data !== null &&
    typeof record.metadata?.inspectedAt === 'string'
  );
}

// ─── Business logic ───────────────────────────────────────────────────────────

/**
 * Derive a simple trend from rank and fan count.
 */
function deriveTrend(fans, rank) {
  if (rank <= 10)  return 'elite';
  if (rank <= 50)  return 'upward';
  if (rank <= 200) return 'stable';
  return 'emerging';
}

/**
 * Estimate daily / weekly / monthly fan gains.
 * Used only when no cumulative or historical data is available.
 */
function estimateGains(fans, rank) {
  const dailyRate = Math.max(1000, Math.floor(fans * 0.0015 / Math.sqrt(rank)));
  return {
    dailyFanGain:   dailyRate,
    weeklyFanGain:  dailyRate * 7,
    monthlyFanGain: dailyRate * 30,
  };
}

/**
 * Read raw cumulative gain values that were supplied by the upstream API.
 *
 * These are the CUMULATIVE values stored by UmaMoe (e.g. total fans gained
 * this month). They are NOT used as display values — computeCumulativeGains()
 * derives actual gains by delta comparison against the previous snapshot.
 *
 * @param {object} data — trusted trainer data
 * @returns {{monthlyFanGain?: number, weeklyFanGain?: number, dailyFanGain?: number}|null}
 */
export function extractApiGains(data = {}) {
  const sources = [
    data.apiGains,
    data.fanGains,
    data.fanGain,
    data.fan_gain,
    data,
  ].filter(source => source && typeof source === 'object');

  const aliases = {
    dailyFanGain: ['dailyFanGain', 'daily_gain', 'daily_fan_gain', 'dailyGain', 'daily'],
    weeklyFanGain: ['weeklyFanGain', 'weekly_gain', 'weekly_fan_gain', 'weeklyGain', 'weekly'],
    monthlyFanGain: ['monthlyFanGain', 'monthly_gain', 'monthly_fan_gain', 'monthlyGain', 'monthly'],
  };

  const gains = {};
  for (const [field, keys] of Object.entries(aliases)) {
    for (const source of sources) {
      const value = keys.map(key => source[key]).find(
        candidate => typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0,
      );
      if (value !== undefined) {
        gains[field] = value;
        break;
      }
    }
  }

  return Object.keys(gains).length > 0 ? gains : null;
}

/**
 * Compute accurate fan gain figures by treating UmaMoe's gain fields as
 * cumulative counters and deriving actual gains from deltas.
 *
 * UmaMoe accumulates fan gains within each calendar period:
 *   - fanGainMonthly: total fans gained since the 1st of the current month
 *   - fanGainWeekly:  total fans gained since the start of the current week
 *   - fanGainDaily:   total fans gained today
 *
 * All three reset at their respective period boundaries. This function detects
 * resets (delta < 0 or month/week change) and handles them gracefully.
 *
 * Rule: on first detection of a member, all gains are set to 0 to avoid
 * showing accumulated history as a single "daily gain" spike.
 *
 * @param {object} data         — current vault record data
 * @param {object} previousData — previous snapshot's data (or null if first seen)
 * @param {string} previousStoredAt — ISO timestamp of the previous snapshot
 * @returns {{ dailyFanGain, weeklyFanGain, monthlyFanGain, gainsSource }|null}
 *          null when no cumulative gain data is present in the current record.
 */
function computeCumulativeGains(data, previousData, previousStoredAt) {
  const currentMonthly = data.monthlyFanGain ?? data.apiGains?.monthlyFanGain;
  if (typeof currentMonthly !== 'number' || !Number.isFinite(currentMonthly)) {
    return null; // No cumulative data — fall through to other strategies
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── First time this member has been seen ──────────────────────────────────
  if (!previousData) {
    log('info', 'cumulative-gains: first-seen, initialising to 0');
    return {
      dailyFanGain:   0,
      weeklyFanGain:  0,
      monthlyFanGain: currentMonthly,
      gainsSource:    'first-seen',
    };
  }

  const prevMonthly = previousData.monthlyFanGain ?? previousData.apiGains?.monthlyFanGain;
  if (typeof prevMonthly !== 'number' || !Number.isFinite(prevMonthly)) {
    // Previous snapshot predates cumulative tracking — treat as first seen
    log('info', 'cumulative-gains: no previous cumulative, initialising to 0');
    return {
      dailyFanGain:   0,
      weeklyFanGain:  0,
      monthlyFanGain: currentMonthly,
      gainsSource:    'first-seen',
    };
  }

  // ── Determine the calendar month the previous snapshot was recorded in ────
  const prevMonth = previousStoredAt
    ? new Date(previousStoredAt).toISOString().slice(0, 7) // "YYYY-MM"
    : null;

  const monthlyDelta = currentMonthly - prevMonthly;

  // ── Monthly reset detection ───────────────────────────────────────────────
  // Reset occurs when the current month differs from the stored month,
  // or when the counter has gone backwards (safety net for timezone edge-cases).
  const monthReset = prevMonth !== null && prevMonth !== currentMonth;
  const dailyFanGain = (monthReset || monthlyDelta < 0)
    ? Math.max(currentMonthly, 0)   // Counter just reset; current value IS the gain
    : Math.max(monthlyDelta, 0);    // Normal case: take the positive delta

  // ── Weekly gain ───────────────────────────────────────────────────────────
  // Apply same delta strategy to weeklyFanGain when available; otherwise
  // approximate from the daily figure (7× daily is a reasonable upper bound).
  const currentWeekly = data.weeklyFanGain ?? data.apiGains?.weeklyFanGain;
  const prevWeekly    = previousData.weeklyFanGain ?? previousData.apiGains?.weeklyFanGain;

  let weeklyFanGain;
  if (typeof currentWeekly === 'number' && Number.isFinite(currentWeekly)) {
    if (typeof prevWeekly === 'number' && Number.isFinite(prevWeekly)) {
      const weeklyDelta = currentWeekly - prevWeekly;
      // Negative delta signals a weekly reset
      weeklyFanGain = weeklyDelta >= 0 ? weeklyDelta : currentWeekly;
    } else {
      // First time we have a weekly value — treat as first seen (use current;
      // it's the fans gained so far this week, which is still meaningful)
      weeklyFanGain = currentWeekly;
    }
  } else {
    // No weekly API data — scale daily figure by 7
    weeklyFanGain = dailyFanGain * 7;
  }

  log('info', `cumulative-gains: delta=${monthlyDelta} monthly=${currentMonthly} daily=${dailyFanGain} weekly=${weeklyFanGain}`, { monthReset });

  return {
    dailyFanGain,
    weeklyFanGain,
    monthlyFanGain: currentMonthly,   // Display the running month total as-is
    gainsSource:    'cumulative-delta',
  };
}

/**
 * Compute delta gains between two fan snapshots (absolute fan counts).
 * Used as a fallback when cumulative API counters are not available.
 */
function computeDeltaGains(currentFans, previousFans, previousAt) {
  if (previousFans === undefined || previousFans === null) return null;

  const fanDelta = currentFans - previousFans;
  const ageMs = previousAt ? Date.now() - new Date(previousAt).getTime() : null;
  const ageDays = ageMs ? ageMs / 86_400_000 : null;
  const dailyFanGain = ageDays && ageDays > 0 ? Math.round(fanDelta / ageDays) : null;

  return {
    fanDelta,
    dailyFanGain,
    weeklyFanGain:  dailyFanGain !== null ? Math.round(dailyFanGain * 7)  : null,
    monthlyFanGain: dailyFanGain !== null ? Math.round(dailyFanGain * 30) : null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Refine a trusted Vault record.
 *
 * Gain computation priority:
 *   1. Cumulative-delta  — UmaMoe stores running monthly/weekly/daily totals;
 *                          the actual gain is the delta vs the previous snapshot.
 *                          Handles first-seen (→ 0) and period resets cleanly.
 *   2. Historical delta  — fan-count difference between two vault snapshots,
 *                          when no cumulative API counter is present.
 *   3. Projected         — rank-weighted estimate when no history exists.
 *
 * @param {object} vaultRecord   — { data, metadata } from Vault.retrieve()
 * @param {object} [options]
 * @param {object} [options.previousRecord] — prior Vault snapshot for delta gains
 * @returns {RefinedResult}
 */
export function refine(vaultRecord, options = {}) {
  if (!isTrustedRecord(vaultRecord)) {
    log('error', 'REFINER_UNTRUSTED_INPUT: record did not originate from Vault');
    return failure(
      'REFINER_UNTRUSTED_INPUT',
      'Refiner only accepts trusted records from the Vault',
      { received: vaultRecord }
    );
  }

  const { data, metadata } = vaultRecord;
  const { previousRecord } = options;

  log('info', `refining trainer id=${data.id}`);

  try {
    const previousData     = previousRecord?.data ?? null;
    const previousStoredAt = previousRecord?.storedAt
      ?? previousRecord?.metadata?.storedAt
      ?? previousRecord?.metadata?.inspectedAt
      ?? null;

    // ── Strategy 0: API-computed gains (highest priority) ────────────────
    // When umamoe/pipeline.js has already computed correct day-over-day /
    // 7-day / month-baseline deltas from daily_fans, they are stored in
    // data.apiGains.  Use them directly — do NOT run computeCumulativeGains
    // on top of them, which would produce a near-zero "delta of a delta".
    const apiGainsData = (
      data.apiGains &&
      typeof data.apiGains === 'object' &&
      typeof data.apiGains.dailyFanGain === 'number' &&
      Number.isFinite(data.apiGains.dailyFanGain)
    ) ? data.apiGains : null;

    // ── Strategy 1: Cumulative-delta (when no pre-computed API gains) ──────
    // UmaMoe reports running totals per period. We derive the actual gain
    // from the delta between the current and previous snapshot's cumulative.
    const cumulativeGains = !apiGainsData
      ? computeCumulativeGains(data, previousData, previousStoredAt)
      : null;

    // ── Strategy 2: Historical fan-count delta (fallback) ─────────────────
    // Used when no cumulative API counter exists (e.g. legacy records, or
    // a trainer whose circle data had no gain fields at all).
    const deltas = !apiGainsData && !cumulativeGains
      ? computeDeltaGains(
          data.fans,
          previousData?.fans,
          previousStoredAt,
        )
      : null;

    // ── Strategy 3: Projection ────────────────────────────────────────────
    const estimated = estimateGains(data.fans, data.rank);

    // ── Merge gains in priority order ─────────────────────────────────────
    const gains = {
      dailyFanGain: apiGainsData?.dailyFanGain
        ?? cumulativeGains?.dailyFanGain
        ?? deltas?.dailyFanGain
        ?? estimated.dailyFanGain,
      weeklyFanGain: apiGainsData?.weeklyFanGain
        ?? cumulativeGains?.weeklyFanGain
        ?? deltas?.weeklyFanGain
        ?? estimated.weeklyFanGain,
      monthlyFanGain: apiGainsData?.monthlyFanGain
        ?? cumulativeGains?.monthlyFanGain
        ?? deltas?.monthlyFanGain
        ?? estimated.monthlyFanGain,
      // fanDelta from historical strategy only (useful for debug)
      ...(deltas?.fanDelta !== undefined ? { fanDelta: deltas.fanDelta } : {}),
    };

    const gainsSource = apiGainsData
      ? 'api-computed'
      : cumulativeGains?.gainsSource
        ?? (deltas ? 'delta' : 'projected');

    const trend = deriveTrend(data.fans, data.rank);

    const refinedResult = {
      // Preserve all trusted source fields
      id:           data.id,
      name:         data.name,
      fans:         data.fans,
      rank:         data.rank,
      characters:   data.characters  ?? [],
      achievements: data.achievements ?? [],

      // Derived fields
      trend,
      ...gains,
      gainsSource,
    };

    log('info', `refined successfully — id=${data.id} trend=${trend} gainsSource=${gainsSource}`);

    return {
      success: true,
      refinedResult,
      metadata: {
        source:            'Vault',
        sourceInspectedAt: metadata.inspectedAt,
        refinedAt:         new Date().toISOString(),
        refinerVersion:    REFINER_VERSION,
      },
    };

  } catch (err) {
    log('error', `refinement failed — ${err.message}`, { id: data?.id });
    return failure('REFINER_ERROR', `Refinement failed: ${err.message}`, { id: data?.id });
  }
}
