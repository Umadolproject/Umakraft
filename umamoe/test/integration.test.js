/**
 * Umamoe → Refinery Integration Test
 *
 * Tests the full wired pipeline using mock Miner output:
 * Miner (mock) → Courier → Inspector → Vault → Refiner → Compiler → Depot
 *
 * No live API calls. The Miner is stubbed by injecting a mock envelope
 * directly into the Courier, bypassing the HTTP layer.
 */

import { transport }  from '../Courier/courier.js';
import { receive, retrieve } from '../Vault/vault.js';
import { refine }     from '../../Refinery/Refiner/refiner.js';
import { compile }    from '../../Refinery/Compiler/compiler.js';
import { retrieve as depotRetrieve } from '../../Refinery/Depot/depot.js';

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

// ─── Mock Miner output ────────────────────────────────────────────────────────

const mockMinerEnvelope = {
  success: true,
  data: {
    id:           'trainer-integration-01',
    name:         'Yuki',
    fans:         220000000,
    rank:         8,
    characters:   ['gold-ship', 'symboli-rudolf'],
    achievements: ['s-rank', 'legend'],
  },
  metadata: {
    endpoint:   '/api/trainers/trainer-integration-01',
    statusCode: 200,
    timestamp:  new Date().toISOString(),
    source:     'uma.moe',
    attempts:   1,
  },
};

// ─── Full wired pipeline ──────────────────────────────────────────────────────

console.log('\n── Umamoe → Refinery Integration ───────────────────────');

// Stage 1: Courier → Inspector
const inspectorResult = await transport(mockMinerEnvelope);
assert('Stage 1 — Inspector accepts the mock trainer',        inspectorResult.success === true && inspectorResult.accepted === true);

// Stage 1: Vault store
const vaultStoreResult = await receive(inspectorResult);
assert('Stage 1 — Vault stores the accepted record',          vaultStoreResult.success === true);
assert('Stage 1 — Vault id matches trainer id',               vaultStoreResult.id === 'trainer-integration-01');

// Stage 1: Vault retrieve (handoff to Stage 2)
const vaultRecord = await retrieve({ id: 'trainer-integration-01' });
assert('Stage 1→2 — Vault retrieves record for Refiner',      vaultRecord.success === true && vaultRecord.data !== null);

// Stage 2: Refiner
const refinedResult = refine(vaultRecord.data);
assert('Stage 2 — Refiner processes vault record',            refinedResult.success === true);
assert('Stage 2 — Refiner preserves trainer id',              refinedResult.refinedResult?.id === 'trainer-integration-01');
assert('Stage 2 — Refiner produces trend',                    typeof refinedResult.refinedResult?.trend === 'string');
assert('Stage 2 — Rank 8 yields elite trend',                 refinedResult.refinedResult?.trend === 'elite');
assert('Stage 2 — Refiner produces dailyFanGain',             refinedResult.refinedResult?.dailyFanGain > 0);

// Stage 2: Compiler → Depot
const compileResult = await compile(refinedResult);
assert('Stage 2 — Compiler succeeds',                         compileResult.success === true);
assert('Stage 2 — Depot receives compiled product',           typeof compileResult.storedAt === 'string');

// Stage 2: Depot retrieve
const depotRecord = await depotRetrieve('trainer-integration-01');
assert('Stage 2 — Depot stores correct trainer',              depotRecord.product?.compiledProduct?.id === 'trainer-integration-01');
assert('Stage 2 — Depot product has fans',                    depotRecord.product?.compiledProduct?.fans === 220000000);
assert('Stage 2 — Depot product has presentationHints',       typeof depotRecord.product?.compiledProduct?.presentationHints === 'object');
assert('Stage 2 — Depot provenance has sources',              depotRecord.product?.provenance?.sources?.length >= 1);

// ─── Pipeline error propagation ───────────────────────────────────────────────

console.log('\n── Error Propagation ───────────────────────────────────');

// Invalid data rejected early
const badEnvelope = {
  success: true,
  data: { id: 'bad-trainer', name: 'X', fans: -500, rank: 10 },
  metadata: { endpoint: '/trainers/bad', statusCode: 200, timestamp: new Date().toISOString(), source: 'uma.moe', attempts: 1 },
};

const badInspector = await transport(badEnvelope);
assert('Bad data rejected at Inspector (negative fans)',       badInspector.success === false && badInspector.error === 'RANGE_INTEGRITY_FAILURE');

// Rejected result must NOT reach Vault
const badVault = await receive(badInspector);
assert('Rejected Inspector result blocked at Vault',          badVault.success === false);

// Refiner rejects non-Vault input
const badRefine = refine({ data: { id: 'x', fans: 100 } }); // no inspectedAt
assert('Refiner rejects untrusted record',                    badRefine.success === false && badRefine.error === 'REFINER_UNTRUSTED_INPUT');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);
