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

const REFINER_VERSION = 'v1.0';

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
 * In production this would compare against prior Vault snapshots.
 * For now: deterministic derivation from available data.
 */
function deriveTrend(fans, rank) {
  if (rank <= 10)  return 'elite';
  if (rank <= 50)  return 'upward';
  if (rank <= 200) return 'stable';
  return 'emerging';
}

/**
 * Estimate daily / weekly / monthly fan gains.
 * Without historical snapshots the Refiner produces projections
 * from rank position. When historical data is available (via
 * a second Vault record), this is replaced by delta calculation.
 */
function estimateGains(fans, rank) {
  // Rank-weighted projection — will be replaced with real deltas
  // once snapshot comparison is wired in.
  const dailyRate = Math.max(1000, Math.floor(fans * 0.0015 / Math.sqrt(rank)));
  return {
    dailyFanGain:   dailyRate,
    weeklyFanGain:  dailyRate * 7,
    monthlyFanGain: dailyRate * 30,
  };
}

/**
 * Compute delta gains between two fan snapshots (current vs previous).
 * Returns null if previous is not provided.
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
    // Delta gains (real) vs projected gains (estimated)
    const previousData = previousRecord?.data;
    const deltas = computeDeltaGains(
      data.fans,
      previousData?.fans,
      previousRecord?.metadata?.storedAt ?? previousRecord?.metadata?.inspectedAt
    );

    const gains = deltas ?? estimateGains(data.fans, data.rank);
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
      gainsSource: deltas ? 'delta' : 'projected',
    };

    log('info', `refined successfully — id=${data.id} trend=${trend}`);

    return {
      success: true,
      refinedResult,
      metadata: {
        source:         'Vault',
        sourceInspectedAt: metadata.inspectedAt,
        refinedAt:      new Date().toISOString(),
        refinerVersion: REFINER_VERSION,
      },
    };

  } catch (err) {
    log('error', `refinement failed — ${err.message}`, { id: data?.id });
    return failure('REFINER_ERROR', `Refinement failed: ${err.message}`, { id: data?.id });
  }
}
