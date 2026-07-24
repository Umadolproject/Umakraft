/**
 * Umamoe Pipeline — End-to-End Smoke Test
 *
 * Tests the full chain: Inspector → Vault
 * Miner and Courier are tested with mock envelopes
 * (no live API calls in unit tests).
 */

import { inspect } from '../Inspector/inspector.js';
import { transport } from '../Courier/courier.js';
import { receive, retrieve } from '../Vault/vault.js';

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

// ─── Inspector ────────────────────────────────────────────────────────────────

console.log('\n── Inspector ──────────────────────────────────────────');

const validEnvelope = {
  success: true,
  data: { id: 'trainer-001', name: 'Alice', fans: 50000000, rank: 45, characters: [], achievements: [] },
  metadata: { endpoint: '/trainers/001', statusCode: 200, timestamp: new Date().toISOString(), source: 'uma.moe', attempts: 1 },
};

const r1 = inspect(validEnvelope);
assert('valid data is accepted', r1.success === true && r1.accepted === true);
assert('accepted result carries data', r1.data?.id === 'trainer-001');
assert('accepted result carries inspectedAt', typeof r1.inspectedAt === 'string');

const r2 = inspect({ success: false, error: 'API_TIMEOUT', message: 'timeout', severity: 'error', retriable: true, timestamp: new Date().toISOString(), context: {} });
assert('Miner failure envelope passes through', r2.success === false && r2.error === 'API_TIMEOUT');

const r3 = inspect({ success: true, data: null });
assert('null data is rejected — EXISTENCE_FAILURE', r3.success === false && r3.error === 'EXISTENCE_FAILURE');

const r4 = inspect({ success: true, data: { id: 'x', name: 'Bob', fans: -1, rank: 10 } });
assert('negative fans rejected — RANGE_INTEGRITY_FAILURE', r4.success === false && r4.error === 'RANGE_INTEGRITY_FAILURE');

const r5 = inspect({ success: true, data: { id: 'x', name: 'Bob', fans: '50000', rank: 10 } });
assert('fans as string rejected — TYPE_INTEGRITY_FAILURE', r5.success === false && r5.error === 'TYPE_INTEGRITY_FAILURE');

const r6 = inspect({ success: true, data: { id: 'x', name: 'Bob' } });
assert('missing fans rejected — COMPLETENESS_FAILURE', r6.success === false && r6.error === 'COMPLETENESS_FAILURE');

// ─── Courier ──────────────────────────────────────────────────────────────────

console.log('\n── Courier ─────────────────────────────────────────────');

const c1 = await transport(validEnvelope);
assert('courier delivers valid envelope to Inspector → accepted', c1.success === true && c1.accepted === true);

const c2 = await transport(null);
assert('courier rejects null envelope', c2.success === false && c2.error === 'TRANSPORT_INVALID_INPUT');

const c3 = await transport({ notAValidEnvelope: true });
assert('courier rejects envelope without success field', c3.success === false && c3.error === 'TRANSPORT_INVALID_INPUT');

const c4 = await transport({ success: false, error: 'API_TIMEOUT', message: 'timed out', severity: 'error', retriable: true, timestamp: new Date().toISOString(), context: {} });
assert('courier passes Miner failure through', c4.success === false && c4.error === 'API_TIMEOUT');

// ─── Vault ────────────────────────────────────────────────────────────────────

console.log('\n── Vault ───────────────────────────────────────────────');

const approvedResult = inspect(validEnvelope);

const v1 = await receive(approvedResult);
assert('vault stores Inspector-approved result', v1.success === true && v1.id === 'trainer-001');

const v2 = await retrieve({ id: 'trainer-001' });
assert('vault retrieves stored record by id', v2.success === true && v2.data?.data?.id === 'trainer-001');

const v3 = await receive({ success: true, data: { id: 'x' } }); // not Inspector-approved (no accepted/inspectedAt)
assert('vault rejects non-approved envelope', v3.success === false && v3.error === 'VAULT_UNTRUSTED_INPUT');

const v4 = await receive({ success: false, error: 'REJECTED' });
assert('vault rejects Miner failure envelope', v4.success === false);

const v5 = await retrieve({ id: 'does-not-exist' });
assert('vault returns error for unknown id', v5.success === false && v5.error === 'VAULT_NOT_FOUND');

// ─── Full pipeline ────────────────────────────────────────────────────────────

console.log('\n── Full Pipeline (mock Miner → Courier → Inspector → Vault) ──');

const minerOutput = {
  success: true,
  data: { id: 'trainer-999', name: 'Kenji', fans: 120000000, rank: 3, characters: ['sp-week'], achievements: ['top10'] },
  metadata: { endpoint: '/trainers/999', statusCode: 200, timestamp: new Date().toISOString(), source: 'uma.moe', attempts: 1 },
};

const courierResult  = await transport(minerOutput);
const vaultResult    = await receive(courierResult);
const retrieveResult = await retrieve({ id: 'trainer-999' });

assert('full pipeline: Miner → Courier → Inspector → Vault stores data', vaultResult.success === true);
assert('full pipeline: Vault retrieves correct trainer', retrieveResult.data?.data?.id === 'trainer-999');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);
