/**
 * Refinery Pipeline — End-to-End Smoke Test
 *
 * Tests: Refiner → Compiler → Depot (isolated from Umamoe)
 */

import { refine }   from '../Refiner/refiner.js';
import { compile }  from '../Compiler/compiler.js';
import { retrieve, remove } from '../Depot/depot.js';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const validVaultRecord = {
  data: {
    id: 'trainer-001',
    name: 'Alice',
    fans: 150000000,
    rank: 12,
    characters: ['sp-week'],
    achievements: ['top50'],
  },
  metadata: {
    source: 'Inspector',
    inspectedAt: '2026-07-21T10:00:00.000Z',
    receivedAt:  '2026-07-21T10:00:01.000Z',
  },
};

// ─── Refiner ──────────────────────────────────────────────────────────────────

console.log('\n── Refiner ─────────────────────────────────────────────');

const r1 = refine(validVaultRecord);
assert('valid vault record is refined successfully',       r1.success === true);
assert('refinedResult preserves id',                      r1.refinedResult?.id === 'trainer-001');
assert('refinedResult preserves fans',                    r1.refinedResult?.fans === 150000000);
assert('refinedResult preserves rank',                    r1.refinedResult?.rank === 12);
assert('refinedResult includes trend',                    typeof r1.refinedResult?.trend === 'string');
assert('refinedResult includes dailyFanGain',             typeof r1.refinedResult?.dailyFanGain === 'number');
assert('refinedResult includes weeklyFanGain',            typeof r1.refinedResult?.weeklyFanGain === 'number');
assert('refinedResult includes monthlyFanGain',           typeof r1.refinedResult?.monthlyFanGain === 'number');
assert('metadata carries refinedAt',                      typeof r1.metadata?.refinedAt === 'string');
assert('metadata carries refinerVersion',                 typeof r1.metadata?.refinerVersion === 'string');
assert('elite trend for rank ≤ 10 — rank 12 is upward',  r1.refinedResult?.trend === 'upward');

// ── Historical fan-count delta (fallback when no cumulative counters) ─────────
// previousRecord has no monthlyFanGain → cumulative strategy skipped → delta
const previousRecord = {
  data: { ...validVaultRecord.data, fans: 149000000 },
  metadata: { ...validVaultRecord.metadata, inspectedAt: '2026-07-14T10:00:00.000Z' },
  storedAt: '2026-07-14T10:00:00.000Z',
};
const r2 = refine(validVaultRecord, { previousRecord });
assert('fan-count delta used when no cumulative data',    r2.refinedResult?.gainsSource === 'delta');
assert('delta fanDelta is positive',                      r2.refinedResult?.fanDelta > 0);

// ── Cumulative-delta: first time seen ─────────────────────────────────────────
// UmaMoe provides monthlyFanGain (cumulative) but there is no previous snapshot.
// dailyFanGain must be 0 to avoid a historical-accumulation spike.
const cumulativeRecord = {
  ...validVaultRecord,
  data: {
    ...validVaultRecord.data,
    monthlyFanGain: 12540,
    weeklyFanGain: 3200,
    dailyFanGain: 12540,
    apiGains: { monthlyFanGain: 12540, weeklyFanGain: 3200, dailyFanGain: 12540 },
  },
};
const rFirstSeen = refine(cumulativeRecord);
assert('first-seen: gainsSource is first-seen',           rFirstSeen.refinedResult?.gainsSource === 'first-seen');
assert('first-seen: dailyFanGain is 0',                   rFirstSeen.refinedResult?.dailyFanGain === 0);
assert('first-seen: weeklyFanGain is 0',                  rFirstSeen.refinedResult?.weeklyFanGain === 0);
assert('first-seen: monthlyFanGain is preserved total',   rFirstSeen.refinedResult?.monthlyFanGain === 12540);

// ── Cumulative-delta: subsequent day ─────────────────────────────────────────
// Previous snapshot: monthlyFanGain=12540. Today's: 12620. Delta = 80.
const day2Record = {
  ...validVaultRecord,
  data: {
    ...validVaultRecord.data,
    monthlyFanGain: 12620,
    weeklyFanGain:  3280,
    dailyFanGain:   12620,
    apiGains: { monthlyFanGain: 12620, weeklyFanGain: 3280, dailyFanGain: 12620 },
  },
};
const prevCumulativeRecord = {
  data: { ...validVaultRecord.data, monthlyFanGain: 12540, weeklyFanGain: 3200, apiGains: { monthlyFanGain: 12540, weeklyFanGain: 3200 } },
  metadata: { ...validVaultRecord.metadata, inspectedAt: '2026-07-24T10:00:00.000Z' },
  storedAt: '2026-07-24T10:00:00.000Z',
};
const rDelta = refine(day2Record, { previousRecord: prevCumulativeRecord });
assert('cumulative-delta: gainsSource is cumulative-delta', rDelta.refinedResult?.gainsSource === 'cumulative-delta');
assert('cumulative-delta: dailyFanGain is the delta',       rDelta.refinedResult?.dailyFanGain === 80);
assert('cumulative-delta: monthlyFanGain is running total', rDelta.refinedResult?.monthlyFanGain === 12620);

// ── Cumulative-delta: monthly reset handling ──────────────────────────────────
// Previous snapshot was last month (July); now it's the next month with a
// lower cumulative (it just reset). The current value IS the gain since reset.
const julyRecord = {
  data: { ...validVaultRecord.data, monthlyFanGain: 18520, apiGains: { monthlyFanGain: 18520 } },
  metadata: { ...validVaultRecord.metadata, inspectedAt: '2026-07-31T23:59:00.000Z' },
  storedAt: '2026-07-31T23:59:00.000Z',
};
const augustRecord = {
  ...validVaultRecord,
  data: {
    ...validVaultRecord.data,
    monthlyFanGain: 340,
    apiGains: { monthlyFanGain: 340 },
  },
};
// Patch the "current month" for this test by overriding storedAt of julyRecord
// so the month comparison fires (stored in July, now August = different month).
// We cannot control Date.now() in tests, so we verify the delta-is-negative path:
// 340 - 18520 = -18180 (negative) → reset detected → dailyFanGain = 340.
const rReset = refine(augustRecord, { previousRecord: { ...julyRecord, storedAt: '2026-07-31T23:59:00.000Z' } });
assert('monthly reset: dailyFanGain equals post-reset cumulative', rReset.refinedResult?.dailyFanGain === 340);
assert('monthly reset: monthlyFanGain is new running total',       rReset.refinedResult?.monthlyFanGain === 340);

// Untrusted input
const r3 = refine({ data: { id: 'x' } }); // missing metadata.inspectedAt
assert('untrusted record rejected',                       r3.success === false && r3.error === 'REFINER_UNTRUSTED_INPUT');

const r4 = refine(null);
assert('null input rejected',                             r4.success === false);

// ─── Compiler ─────────────────────────────────────────────────────────────────

console.log('\n── Compiler ────────────────────────────────────────────');

const c1 = await compile(r1);
assert('single refinedResult compiles successfully',      c1.success === true);
assert('compiledProduct has id',                          c1.product?.compiledProduct?.id === 'trainer-001');
assert('compiledProduct has fans',                        c1.product?.compiledProduct?.fans === 150000000);
assert('compiledProduct has trend',                       typeof c1.product?.compiledProduct?.trend === 'string');
assert('compiledProduct has presentationHints',           typeof c1.product?.compiledProduct?.presentationHints === 'object');
assert('provenance carries compiledAt',                   typeof c1.product?.provenance?.compiledAt === 'string');
assert('provenance carries compilerVersion',              typeof c1.product?.provenance?.compilerVersion === 'string');
assert('provenance carries sources array',                Array.isArray(c1.product?.provenance?.sources));

// Multi-source compile
const secondRecord = {
  data: { ...validVaultRecord.data, id: 'trainer-001', fans: 151000000, rank: 11 },
  metadata: { ...validVaultRecord.metadata, inspectedAt: '2026-07-21T11:00:00.000Z' },
};
const r5 = refine(secondRecord);
const c2 = await compile([r1, r5]);
assert('multi-source compile succeeds',                   c2.success === true);
assert('multi-source provenance has 2 sources',           c2.product?.provenance?.sources?.length === 2);
assert('conflict resolution logged (fans differ)',        Array.isArray(c2.conflictsResolved));

// Invalid input
const c3 = await compile({ success: false, error: 'bad' });
assert('invalid envelope rejected by compiler',           c3.success === false && c3.error === 'COMPILER_INVALID_INPUT');

const c4 = await compile([r1, { ...r5, refinedResult: { ...r5.refinedResult, id: 'trainer-999' } }]);
assert('mismatched ids rejected',                         c4.success === false && c4.error === 'COMPILER_ID_MISMATCH');

// ─── Depot ────────────────────────────────────────────────────────────────────

console.log('\n── Depot ───────────────────────────────────────────────');

const d1 = await retrieve('trainer-001');
assert('depot has the compiled product',                  d1.product !== null);
assert('depot product id matches',                        d1.product?.id === 'trainer-001');

const d2 = await retrieve('does-not-exist');
assert('depot returns null for unknown id',               d2.product === null);

const d3 = await remove('trainer-001');
assert('depot deletes product',                           d3.success === true);

const d4 = await retrieve('trainer-001');
assert('depot product gone after delete',                 d4.product === null);

// ─── Full Refinery chain ──────────────────────────────────────────────────────

console.log('\n── Full Refinery Chain (Vault record → Depot) ──────────');

const vaultRecord2 = {
  data: { id: 'trainer-999', name: 'Kenji', fans: 80000000, rank: 5, characters: [], achievements: [] },
  metadata: { source: 'Inspector', inspectedAt: '2026-07-21T12:00:00.000Z', receivedAt: '2026-07-21T12:00:01.000Z' },
};

const refined = refine(vaultRecord2);
const compiled = await compile(refined);
const stored = await retrieve('trainer-999');

assert('full chain: refine → compile → depot',            compiled.success === true);
assert('full chain: depot retrieves correct trainer',     stored.product?.compiledProduct?.id === 'trainer-999');
assert('full chain: trend is elite for rank 5',           stored.product?.compiledProduct?.trend === 'elite');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);
