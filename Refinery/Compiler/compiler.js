/**
 * Compiler
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Compiler — Stage 2, Refinery
 *
 * Sole responsibility: assemble one or more refinedResult envelopes
 * into a canonical compiledProduct and persist it to the Depot.
 * Deterministic — identical inputs produce identical outputs.
 * Never mutates input envelopes. Never performs business logic.
 */

import { store } from '../Depot/depot.js';

const COMPILER_VERSION = 'v2.0';

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'compiler',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function failure(error, message, context = {}) {
  return { success: false, error, message, timestamp: new Date().toISOString(), context };
}

// ─── Input validation ─────────────────────────────────────────────────────────

function isValidRefinedResult(envelope) {
  return (
    envelope !== null &&
    typeof envelope === 'object' &&
    envelope.success === true &&
    typeof envelope.refinedResult === 'object' &&
    envelope.refinedResult !== null &&
    typeof envelope.metadata?.refinedAt === 'string'
  );
}

// ─── Conflict resolution ──────────────────────────────────────────────────────

/**
 * Structural equality check used during conflict detection.
 * Arrays and objects are compared by value (JSON), primitives by ===.
 * Avoids false-positive conflicts on array/object fields (e.g. characters,
 * achievements) that are identical in content but distinct in reference.
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Merge multiple refined results into one canonical product.
 * Conflict rule: last-write-wins ordered by refinedAt timestamp.
 * Non-conflicting fields are merged additively.
 */
function mergeRefinedResults(envelopes) {
  // Sort oldest → newest so newest wins on conflict
  const sorted = [...envelopes].sort(
    (a, b) => new Date(a.metadata.refinedAt) - new Date(b.metadata.refinedAt)
  );

  const merged = {};
  const conflictsResolved = [];

  for (const envelope of sorted) {
    const result = envelope.refinedResult;
    for (const [key, value] of Object.entries(result)) {
      if (key in merged && !deepEqual(merged[key], value)) {
        conflictsResolved.push({
          field: key,
          previous: merged[key],
          resolved: value,
          resolvedBy: envelope.metadata.refinedAt,
          rule: 'last-write-wins',
        });
      }
      merged[key] = value;
    }
  }

  return { merged, conflictsResolved };
}

// ─── Product assembly ─────────────────────────────────────────────────────────

function assembleProduct(merged, envelopes, compiledAt) {
  return {
    // Core identity
    id:           merged.id,
    version:      compiledAt,
    blueprintKey: `trainer:${merged.id}`,

    // Canonical product — copy (never mutate inputs)
    compiledProduct: {
      id:           merged.id,
      name:         merged.name,
      fans:         merged.fans,
      rank:         merged.rank,
      characters:   merged.characters  ?? [],
      achievements: merged.achievements ?? [],

      // Derived analytical fields
      trend:          merged.trend,
      dailyFanGain:   merged.dailyFanGain,
      weeklyFanGain:  merged.weeklyFanGain,
      monthlyFanGain: merged.monthlyFanGain,
      gainsSource:    merged.gainsSource,

      // Presentation hints for Workshop
      presentationHints: {
        highlight: merged.dailyFanGain != null ? 'dailyFanGain' : 'fans',
        trend:     merged.trend,
      },
    },

    // Provenance — full assembly audit trail
    provenance: {
      sources: envelopes.map((e) => ({
        refinedAt:      e.metadata.refinedAt,
        refinerVersion: e.metadata.refinerVersion,
        sourceInspectedAt: e.metadata.sourceInspectedAt,
      })),
      compiledAt,
      compilerVersion: COMPILER_VERSION,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compile one or more refinedResult envelopes into a product and store in Depot.
 *
 * @param {object|object[]} input — single or array of refinedResult envelopes from Refiner
 * @returns {Promise<CompileResult>}
 */
export async function compile(input) {
  const envelopes = Array.isArray(input) ? input : [input];

  // Validate all envelopes
  for (let i = 0; i < envelopes.length; i++) {
    if (!isValidRefinedResult(envelopes[i])) {
      log('error', `COMPILER_INVALID_INPUT: envelope[${i}] is not a valid refinedResult`);
      return failure(
        'COMPILER_INVALID_INPUT',
        `Input at index ${i} is not a valid refinedResult envelope (requires success:true, refinedResult, metadata.refinedAt)`,
        { index: i, received: envelopes[i] }
      );
    }
  }

  // Verify all envelopes share the same id
  const ids = [...new Set(envelopes.map((e) => e.refinedResult?.id))];
  if (ids.length > 1) {
    log('error', `COMPILER_ID_MISMATCH: envelopes span multiple ids: ${ids.join(', ')}`);
    return failure('COMPILER_ID_MISMATCH', `All input envelopes must share the same id. Got: ${ids.join(', ')}`);
  }

  const trainerId = ids[0];
  log('info', `compiling product for id=${trainerId} sources=${envelopes.length}`);

  // Merge and assemble
  const { merged, conflictsResolved } = mergeRefinedResults(envelopes);
  const compiledAt = new Date().toISOString();
  const product = assembleProduct(merged, envelopes, compiledAt);

  if (conflictsResolved.length > 0) {
    log('warn', `${conflictsResolved.length} conflict(s) resolved during merge`, { conflicts: conflictsResolved });
  }

  // Persist to Depot — write only after clean compile
  const storeResult = await store(product);
  if (!storeResult.success) {
    log('error', `COMPILER_DEPOT_WRITE_FAILED: ${storeResult.error}`);
    return failure('COMPILER_DEPOT_WRITE_FAILED', storeResult.message ?? 'Depot write failed', {
      id: trainerId,
      depotError: storeResult.error,
    });
  }

  log('info', `compiled and stored id=${trainerId} version=${compiledAt}`);

  return {
    success: true,
    id:      trainerId,
    version: compiledAt,
    product,
    conflictsResolved,
    storedAt: storeResult.storedAt,
  };
}
