// Operation/test/pipeline.test.js
// Integration test for the Operation internal pipeline:
//   Investigator → Logger → Manager
//
// Tests run without a Discord client or live data sources.
// dataSync / timeline modules are intentionally absent — Investigator must
// handle them gracefully (covered by test 3).

import { investigate } from '../Investigator/investigator.js';
import { formatLogs }  from '../Logger/logger.js';
import { evaluate }    from '../Manager/manager.js';
import { runOperationCycle } from '../operation.js';
import {
  registerTask,
  recordTaskStart,
  recordTaskEnd,
  getAllTaskStats,
} from '../../core/taskRegistry.js';
import { getHealth } from '../../core/health.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('\n[Operation] Pipeline integration tests\n');

// ── 1. core/taskRegistry ─────────────────────────────────────────────────────
console.log('1. core/taskRegistry');

registerTask('testTask', '*/5 * * * *');
const stats = getAllTaskStats().find(t => t.name === 'testTask');
assert(stats !== undefined,           'task is registered');
assert(stats.lastSuccess === null,    'lastSuccess is null before first run');
assert(stats.consecutiveFailures === 0, 'consecutiveFailures starts at 0');

recordTaskStart('testTask');
assert(stats.lastRunAt instanceof Date, 'lastRunAt is set after recordTaskStart');

recordTaskEnd('testTask', { success: true });
assert(stats.lastSuccess === true,    'lastSuccess=true after success');
assert(stats.consecutiveFailures === 0, 'consecutiveFailures stays 0 on success');
assert(stats.totalRuns === 1,         'totalRuns incremented');

recordTaskEnd('testTask', { success: false, error: 'NETWORK_ERROR' });
assert(stats.consecutiveFailures === 1, 'consecutiveFailures increments on failure');
assert(stats.lastError === 'NETWORK_ERROR', 'lastError is captured');

// ── 2. core/health ───────────────────────────────────────────────────────────
console.log('\n2. core/health');

const health = getHealth();
assert(typeof health.uptime === 'number',    'uptime is a number');
assert(typeof health.heapUsed === 'number',  'heapUsed is a number');
assert(typeof health.heapTotal === 'number', 'heapTotal is a number');
assert(Array.isArray(health.tasks),          'tasks is an array');

// ── 3. Investigator ───────────────────────────────────────────────────────────
console.log('\n3. Investigator');

const records = await investigate();
assert(Array.isArray(records),              'returns an array');
assert(records.length > 0,                  'at least one record produced');

const runtimeRecord = records.find(r => r.source === 'runtime');
assert(runtimeRecord !== undefined,         'runtime record present');
assert(runtimeRecord.subject === 'runtime', 'runtime subject is "runtime"');
assert(typeof runtimeRecord.memoryPressure === 'boolean', 'memoryPressure is boolean');

const taskRecord = records.find(r => r.source === 'taskRegistry');
assert(taskRecord !== undefined,            'taskRegistry record present');
assert(typeof taskRecord.consecutiveFailures === 'number', 'consecutiveFailures is a number');
assert('staleSince' in taskRecord,          'staleSince field present');
assert('extra' in taskRecord,               'extra field present');

// ── 4. Logger ─────────────────────────────────────────────────────────────────
console.log('\n4. Logger');

const entries = formatLogs(records);
assert(Array.isArray(entries),              'returns an array');
assert(entries.length === records.length,   'one entry per record');

const runtimeEntry = entries.find(e => e.stage === 'runtime');
assert(runtimeEntry !== undefined,          'runtime entry present');
assert(typeof runtimeEntry.status === 'string', 'status is a string');
assert(['ok','warn','error','stale','unknown'].includes(runtimeEntry.status), 'status is a valid code');
assert(typeof runtimeEntry.timestamp === 'string', 'timestamp is a string');
assert('meta' in runtimeEntry,              'meta field present');
assert(typeof runtimeEntry.meta.memoryPressure === 'boolean', 'meta.memoryPressure is boolean');

// ── 5. Manager — Healthy ──────────────────────────────────────────────────────
console.log('\n5. Manager — Healthy decision');

// Build a clean set of entries with no failures
const healthyEntries = [
  {
    timestamp: new Date().toISOString(),
    pipeline: 'runtime',
    stage: 'runtime',
    status: 'ok',
    duration: null,
    consecutiveFailures: 0,
    error: null,
    meta: { source: 'runtime', memoryPressure: false, staleSince: null },
  },
];

const healthyDecision = evaluate(healthyEntries);
assert(healthyDecision.decision === 'Healthy',           'Healthy when no failures');
assert(Array.isArray(healthyDecision.affectedSubjects),  'affectedSubjects is an array');
assert(healthyDecision.affectedSubjects.length === 0,    'no affected subjects for Healthy');
assert(typeof healthyDecision.summary === 'string',      'summary is a string');
assert(healthyDecision.decidedAt instanceof Date,        'decidedAt is a Date');

// ── 6. Manager — Warning ──────────────────────────────────────────────────────
console.log('\n6. Manager — Warning decision');

const warningEntries = [
  {
    timestamp: new Date().toISOString(),
    pipeline: 'core',
    stage: 'someTask',
    status: 'warn',
    duration: 500,
    consecutiveFailures: 1,
    error: 'TIMEOUT',
    meta: { source: 'taskRegistry', memoryPressure: false, staleSince: null },
  },
];

const warningDecision = evaluate(warningEntries);
assert(warningDecision.decision === 'Warning',            'Warning when 1 failure');
assert(warningDecision.affectedSubjects.includes('someTask'), 'someTask in affectedSubjects');

// ── 7. Manager — Critical ─────────────────────────────────────────────────────
console.log('\n7. Manager — Critical decision');

const criticalEntries = [
  {
    timestamp: new Date().toISOString(),
    pipeline: 'uma',
    stage: 'dataSync',
    status: 'error',
    duration: null,
    consecutiveFailures: 2,
    error: 'NETWORK_ERROR',
    meta: { source: 'taskRegistry', memoryPressure: false, staleSince: null },
  },
];

const criticalDecision = evaluate(criticalEntries);
assert(criticalDecision.decision === 'Critical',          'Critical when >=2 failures');
assert(criticalDecision.affectedSubjects.includes('dataSync'), 'dataSync in affectedSubjects');

// ── 8. Manager — Failed ───────────────────────────────────────────────────────
console.log('\n8. Manager — Failed decision');

const failedEntries = [
  {
    timestamp: new Date().toISOString(),
    pipeline: 'milestone',
    stage: 'milestones',
    status: 'error',
    duration: null,
    consecutiveFailures: 4, // > WITHRETRY_MAX (3)
    error: 'API_ERROR',
    meta: { source: 'taskRegistry', memoryPressure: false, staleSince: null },
  },
];

const failedDecision = evaluate(failedEntries);
assert(failedDecision.decision === 'Failed',              'Failed when > WITHRETRY_MAX');

// ── 9. Manager — stale core task → Critical ───────────────────────────────────
console.log('\n9. Manager — stale core task → Critical');

const staleEntries = [
  {
    timestamp: new Date().toISOString(),
    pipeline: 'uma',
    stage: 'dataSync',
    status: 'stale',
    duration: 700000,
    consecutiveFailures: 0,
    error: null,
    meta: { source: 'taskRegistry', memoryPressure: false, staleSince: 700000 },
  },
];

const staleDecision = evaluate(staleEntries);
assert(staleDecision.decision === 'Critical',             'stale core task → Critical');

// ── 10. Full cycle ────────────────────────────────────────────────────────────
console.log('\n10. Full runOperationCycle()');

const cycleDecision = await runOperationCycle();
assert(cycleDecision !== undefined,                       'returns a HealthDecision');
assert(typeof cycleDecision.decision === 'string',        'decision is a string');
assert(
  ['Healthy','Warning','Critical','Failed','Investigation Required'].includes(cycleDecision.decision),
  'decision is a valid value'
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n[Operation] Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
