/**
 * Workshop Pipeline — End-to-End Smoke Test
 *
 * Tests: Validator → Terminal (isolated from Fabricator/Puppeteer)
 * Uses mock Fabricator deliverables that match the real envelope shape.
 */

import { validate, approve, reject, report } from '../Validator/Validator.js';
import { receive, pickup, listReady, getReleaseMetadata } from '../Terminal/terminal.js';

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Valid PNG signature + enough padding to pass the minimum size check
function makePng(size = 2048) {
  const buf = Buffer.alloc(size, 0);
  // PNG magic bytes: \x89PNG\r\n\x1a\n
  buf[0] = 137; buf[1] = 80; buf[2] = 78; buf[3] = 71;
  buf[4] = 13;  buf[5] = 10; buf[6] = 26; buf[7] = 10;
  return buf;
}

const validDeliverable = {
  success:           true,
  blueprintKey:      'fanGain',
  blueprintName:     'Fan Gain',
  trigger:           '/fan_gain',
  type:              'command',
  png:               makePng(),
  meta:              { trainerId: 'trainer-001', trainerName: 'Alice' },
  fabricatorVersion: '3.0.0',
  renderedAt:        '2026-07-21T12:00:00.000Z',
};

// ─── Validator — Category 1: Existence ───────────────────────────────────────

console.log('\n── Validator: Existence ────────────────────────────────');

const e1 = validate(null);
assert('rejects null deliverable',
  e1.success === false && e1.error === 'EXISTENCE_FAILURE');

const e2 = validate([]);
assert('rejects array instead of object',
  e2.success === false && e2.error === 'EXISTENCE_FAILURE');

const e3 = validate({ success: false, error: 'FABRICATOR_RENDER_ERROR', message: 'boom', timestamp: new Date().toISOString(), context: {} });
assert('passes through Fabricator failure envelope unchanged',
  e3.success === false && e3.error === 'FABRICATOR_RENDER_ERROR');

const e4 = validate({ ...validDeliverable, success: false });
assert('rejects success: false without a known Fabricator error code (passthrough)',
  e4.success === false);

// ─── Validator — Category 2: Structure ───────────────────────────────────────

console.log('\n── Validator: Structure ────────────────────────────────');

const s1 = validate({ ...validDeliverable, blueprintKey: undefined });
assert('rejects missing blueprintKey',
  s1.success === false && s1.error === 'STRUCTURE_FAILURE');

const s2 = validate({ ...validDeliverable, type: 'unknown' });
assert('rejects invalid type',
  s2.success === false && s2.error === 'STRUCTURE_FAILURE');

const s3 = validate({ ...validDeliverable, png: null });
assert('rejects null png',
  s3.success === false && s3.error === 'STRUCTURE_FAILURE');

const s4 = validate({ ...validDeliverable, renderedAt: '' });
assert('rejects empty renderedAt',
  s4.success === false && s4.error === 'STRUCTURE_FAILURE');

// ─── Validator — Category 3: Blueprint Registration ──────────────────────────

console.log('\n── Validator: Blueprint Registration ───────────────────');

const b1 = validate({ ...validDeliverable, blueprintKey: 'notABlueprint' });
assert('rejects unregistered blueprintKey',
  b1.success === false && b1.error === 'BLUEPRINT_REGISTRATION_FAILURE');

const b2 = validate({ ...validDeliverable, blueprintName: 'Wrong Name' });
assert('rejects blueprintName mismatch',
  b2.success === false && b2.error === 'BLUEPRINT_REGISTRATION_FAILURE');

const b3 = validate({ ...validDeliverable, trigger: '/wrong_trigger' });
assert('rejects trigger mismatch',
  b3.success === false && b3.error === 'BLUEPRINT_REGISTRATION_FAILURE');

const b4 = validate({ ...validDeliverable, type: 'broadcast' });
assert('rejects type mismatch with registry',
  b4.success === false && b4.error === 'BLUEPRINT_REGISTRATION_FAILURE');

// ─── Validator — Category 4: Output Integrity ────────────────────────────────

console.log('\n── Validator: Output Integrity ─────────────────────────');

const o1 = validate({ ...validDeliverable, png: 'not-a-buffer' });
assert('rejects string instead of Buffer',
  o1.success === false && o1.error === 'OUTPUT_INTEGRITY_FAILURE');

const o2 = validate({ ...validDeliverable, png: Buffer.alloc(0) });
assert('rejects empty Buffer',
  o2.success === false && o2.error === 'OUTPUT_INTEGRITY_FAILURE');

const o3 = validate({ ...validDeliverable, png: Buffer.alloc(512) });
assert('rejects Buffer below minimum size',
  o3.success === false && o3.error === 'OUTPUT_INTEGRITY_FAILURE');

const badSig = Buffer.alloc(2048, 0);  // no PNG signature
const o4 = validate({ ...validDeliverable, png: badSig });
assert('rejects Buffer with invalid PNG header',
  o4.success === false && o4.error === 'OUTPUT_INTEGRITY_FAILURE');

// ─── Validator — Category 5: Metadata Consistency ────────────────────────────

console.log('\n── Validator: Metadata Consistency ─────────────────────');

const m1 = validate({ ...validDeliverable, meta: null });
assert('rejects null meta',
  m1.success === false && m1.error === 'METADATA_CONSISTENCY_FAILURE');

const m2 = validate({ ...validDeliverable, renderedAt: 'not-a-date' });
assert('rejects invalid renderedAt',
  m2.success === false && m2.error === 'METADATA_CONSISTENCY_FAILURE');

const m3 = validate({ ...validDeliverable, fabricatorVersion: null });
assert('rejects missing fabricatorVersion',
  m3.success === false && m3.error === 'METADATA_CONSISTENCY_FAILURE');

// ─── Validator — Full approval ────────────────────────────────────────────────

console.log('\n── Validator: Approval ─────────────────────────────────');

const v1 = validate(validDeliverable);
assert('valid deliverable is approved',           v1.success === true && v1.approved === true);
assert('approved envelope carries blueprintKey',  v1.blueprintKey === 'fanGain');
assert('approved envelope carries png buffer',    Buffer.isBuffer(v1.png));
assert('approved envelope carries validatedAt',   typeof v1.validatedAt === 'string');
assert('approved envelope carries meta',          typeof v1.meta === 'object');

// approve() helper
const a1 = approve(validDeliverable);
assert('approve() returns success: true',         a1.success === true && a1.approved === true);
assert('approve() sets validatedAt',              typeof a1.validatedAt === 'string');

// reject() helper
const r1 = reject('STRUCTURE', 'test reason', validDeliverable);
assert('reject() returns success: false',         r1.success === false && r1.approved === false);
assert('reject() formats error code correctly',   r1.error === 'STRUCTURE_FAILURE');
assert('reject() includes original context',      r1.context?.blueprintKey === 'fanGain');

// report() helper
const rp1 = report(validDeliverable);
assert('report() passes valid deliverable',       rp1.passed === true && rp1.failedAt === null);

const rp2 = report({ ...validDeliverable, blueprintKey: undefined });
assert('report() catches invalid deliverable',    rp2.passed === false && rp2.failedAt === 'STRUCTURE');

// Other registered blueprints pass validation
const leaderboardDeliverable = {
  ...validDeliverable,
  blueprintKey:  'leaderboard',
  blueprintName: 'Leaderboard',
  trigger:       '/leaderboard',
  type:          'command',
};
const v2 = validate(leaderboardDeliverable);
assert('leaderboard blueprint validates correctly', v2.success === true && v2.approved === true);

// ─── Terminal — Intake ────────────────────────────────────────────────────────

console.log('\n── Terminal: Intake ────────────────────────────────────');

const approvedDeliverable = validate(validDeliverable);

const t1 = await receive(approvedDeliverable);
assert('approved deliverable is stored in Terminal', t1.success === true);
assert('receive() returns a terminalId',             typeof t1.terminalId === 'string' && t1.terminalId.startsWith('terminal-'));
assert('receive() returns receivedAt',               typeof t1.receivedAt === 'string');

const t2 = await receive({ success: true, approved: false });
assert('Terminal rejects non-approved envelope',     t2.success === false && t2.error === 'TERMINAL_INVALID_INPUT');

const t3 = await receive(null);
assert('Terminal rejects null',                      t3.success === false && t3.error === 'TERMINAL_INVALID_INPUT');

const t4 = await receive({ success: false, error: 'X' });
assert('Terminal rejects failure envelope',          t4.success === false && t4.error === 'TERMINAL_INVALID_INPUT');

// ─── Terminal — listReady ─────────────────────────────────────────────────────

console.log('\n── Terminal: listReady ─────────────────────────────────');

const l1 = await listReady();
assert('listReady returns results array',            Array.isArray(l1.results));
assert('listReady includes the stored deliverable',  l1.results.some((r) => r.terminalId === t1.terminalId));
assert('all listed records are in pending state',    l1.results.every((r) => r.state === 'pending'));

const l2 = await listReady({ blueprintKey: 'leaderboard' });
assert('listReady filters by blueprintKey',          l2.results.every((r) => r.blueprintKey === 'leaderboard'));

// ─── Terminal — getReleaseMetadata ────────────────────────────────────────────

console.log('\n── Terminal: getReleaseMetadata ────────────────────────');

const md1 = await getReleaseMetadata(t1.terminalId);
assert('getReleaseMetadata returns success',         md1.success === true);
assert('metadata has blueprintKey',                  md1.blueprintKey === 'fanGain');
assert('metadata has state: pending',                md1.state === 'pending');
assert('metadata does not include png buffer',       !('png' in md1));

const md2 = await getReleaseMetadata('terminal-does-not-exist');
assert('getReleaseMetadata returns TERMINAL_NOT_FOUND for unknown id',
  md2.success === false && md2.error === 'TERMINAL_NOT_FOUND');

// ─── Terminal — pickup ────────────────────────────────────────────────────────

console.log('\n── Terminal: pickup ────────────────────────────────────');

const p1 = await pickup(t1.terminalId);
assert('pickup succeeds',                            p1.success === true);
assert('pickup returns the full deliverable',        p1.deliverable?.blueprintKey === 'fanGain');
assert('pickup returns png buffer',                  Buffer.isBuffer(p1.deliverable?.png));
assert('pickup marks state as claimed',              p1.deliverable?.state === 'claimed');
assert('pickup sets claimedAt',                      typeof p1.deliverable?.claimedAt === 'string');

// Already claimed
const p2 = await pickup(t1.terminalId);
assert('pickup rejects already-claimed deliverable', p2.success === false && p2.error === 'TERMINAL_ALREADY_CLAIMED');

// Not found
const p3 = await pickup('terminal-does-not-exist');
assert('pickup returns TERMINAL_NOT_FOUND',          p3.success === false && p3.error === 'TERMINAL_NOT_FOUND');

// No terminalId
const p4 = await pickup(undefined);
assert('pickup rejects missing terminalId',          p4.success === false && p4.error === 'TERMINAL_INVALID_INPUT');

// Claimed record no longer in listReady
const l3 = await listReady();
assert('claimed deliverable removed from listReady', !l3.results.some((r) => r.terminalId === t1.terminalId));

// ─── Full Workshop chain (mock Fabricator → Validator → Terminal) ─────────────

console.log('\n── Full Workshop Chain (mock Fabricator → Validator → Terminal) ──');

// Simulate the full chain using a second valid deliverable
const secondDeliverable = {
  ...validDeliverable,
  blueprintKey:  'profile',
  blueprintName: 'Profile',
  trigger:       '/profile',
  type:          'command',
  meta:          { trainerId: 'trainer-999', trainerName: 'Kenji' },
  renderedAt:    new Date().toISOString(),
};

const validated2 = validate(secondDeliverable);
assert('second deliverable validates',               validated2.success === true && validated2.approved === true);

const stored2 = await receive(validated2);
assert('second deliverable stored in Terminal',      stored2.success === true);

const metadata2 = await getReleaseMetadata(stored2.terminalId);
assert('metadata confirms blueprintKey=profile',     metadata2.blueprintKey === 'profile');

const claimed2 = await pickup(stored2.terminalId);
assert('second deliverable claimed by Distribution', claimed2.success === true);
assert('claimed deliverable has correct trainerId',  claimed2.deliverable?.meta?.trainerId === 'trainer-999');
assert('claimed deliverable has png buffer',         Buffer.isBuffer(claimed2.deliverable?.png));

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────`);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);
