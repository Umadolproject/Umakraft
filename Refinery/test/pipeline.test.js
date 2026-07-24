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

// Delta gains (with previous snapshot)
const previousRecord = {
  data: { ...validVaultRecord.data, fans: 149000000 },
  metadata: { ...validVaultRecord.metadata, inspectedAt: '2026-07-14T10:00:00.000Z' },
};
const r2 = refine(validVaultRecord, { previousRecord });
assert('delta gains used when previous record provided',  r2.refinedResult?.gainsSource === 'delta');
assert('delta fanDelta is positive',                      r2.refinedResult?.fanDelta > 0);

const apiRecord = {
  ...validVaultRecord,
  data: {
    ...validVaultRecord.data,
    apiGains: {
      dailyFanGain: 321000,
      weeklyFanGain: 2100000,
      monthlyFanGain: 8400000,
    },
  },
};
const rApi = refine(apiRecord, { previousRecord });
assert('API gains take priority over historical delta',    rApi.refinedResult?.gainsSource === 'api');
assert('API daily gain is preserved',                      rApi.refinedResult?.dailyFanGain === 321000);
assert('API weekly gain is preserved',                     rApi.refinedResult?.weeklyFanGain === 2100000);
assert('API monthly gain is preserved',                    rApi.refinedResult?.monthlyFanGain === 8400000);

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
