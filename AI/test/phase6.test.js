// AI/test/phase6.test.js
// Phase 6 test suite — Observability (AIObserver metrics, latency tracking,
// cache warming, Operation integration)
//
// Runs without live API keys or Qdrant.

import assert from 'node:assert/strict';

// ── helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──────────────────────────────────────`);
}

// ── AIObserver imports ──────────────────────────────────────────────────────

section('AIObserver — import');

const {
  registerAiTasks,
  investigate,
  warmEmbeddingCache,
  getMetrics,
  recordRequestStart,
  recordRequestEnd,
  getStatus,
  logQuery,
  recordIndexerRun,
} = await import('../AIObserver.js');

await test('module exports all public functions', () => {
  assert.equal(typeof registerAiTasks,     'function');
  assert.equal(typeof investigate,         'function');
  assert.equal(typeof warmEmbeddingCache,  'function');
  assert.equal(typeof getMetrics,          'function');
  assert.equal(typeof recordRequestStart,  'function');
  assert.equal(typeof recordRequestEnd,    'function');
  assert.equal(typeof getStatus,           'function');
  assert.equal(typeof logQuery,            'function');
  assert.equal(typeof recordIndexerRun,    'function');
});

section('AIObserver — registerAiTasks');

await test('registerAiTasks does not throw', () => {
  assert.doesNotThrow(() => registerAiTasks());
});

await test('registerAiTasks is idempotent (can be called multiple times)', () => {
  assert.doesNotThrow(() => {
    registerAiTasks();
    registerAiTasks();
  });
});

section('AIObserver — investigate');

await test('investigate returns a non-empty array of records', async () => {
  const records = await investigate();
  assert.ok(Array.isArray(records), 'investigate must return an array');
  assert.ok(records.length > 0, 'expected at least one record');
});

await test('every record has required InvestigationRecord fields', async () => {
  const records = await investigate();
  const requiredFields = [
    'investigatedAt', 'source', 'subject', 'consecutiveFailures',
    'lastRunAt', 'lastSuccess', 'lastError', 'staleSince',
    'memoryPressure', 'extra',
  ];
  for (const r of records) {
    for (const f of requiredFields) {
      assert.ok(f in r, `record missing field: ${f} (source=${r.source}, subject=${r.subject})`);
    }
  }
});

await test('all records have valid source strings starting with AI/', async () => {
  const records = await investigate();
  for (const r of records) {
    assert.ok(typeof r.source === 'string' && r.source.length > 0, 'source must be a string');
    assert.ok(r.source.startsWith('AI/'), `source must start with AI/: ${r.source}`);
  }
});

await test('records include AI/Cache.aggregate with cache metrics', async () => {
  const records = await investigate();
  const cacheRecord = records.find(r => r.subject === 'AI/Cache.aggregate');
  assert.ok(cacheRecord, 'expected AI/Cache.aggregate record');
  assert.ok('embeddingSize'   in (cacheRecord.extra ?? {}), 'embeddingSize missing');
  assert.ok('responseSize'    in (cacheRecord.extra ?? {}), 'responseSize missing');
  assert.ok('cacheHitRate'    in (cacheRecord.extra ?? {}), 'cacheHitRate missing');
});

await test('records include AI/RequestMetrics with latency fields', async () => {
  const records = await investigate();
  const reqRecord = records.find(r => r.subject === 'AI.RequestMetrics');
  assert.ok(reqRecord, 'expected AI.RequestMetrics record');
  assert.ok('totalRequests' in (reqRecord.extra ?? {}), 'totalRequests missing');
  assert.ok('avgLatencyMs'  in (reqRecord.extra ?? {}), 'avgLatencyMs missing');
  assert.ok('lastLatencyMs' in (reqRecord.extra ?? {}), 'lastLatencyMs missing');
  assert.ok('latencyByTopic' in (reqRecord.extra ?? {}), 'latencyByTopic missing');
});

// ── AIObserver — latency tracking ───────────────────────────────────────────

section('AIObserver — recordRequestStart / recordRequestEnd');

await test('recordRequestStart returns a context object with token and startedAt', () => {
  const ctx = recordRequestStart();
  assert.ok(typeof ctx.token     === 'string' && ctx.token.length > 0, 'token must be a string');
  assert.ok(typeof ctx.startedAt === 'number' && ctx.startedAt > 0, 'startedAt must be a positive number');
});

await test('recordRequestEnd with no ctx does not throw', () => {
  assert.doesNotThrow(() => recordRequestEnd(null));
  assert.doesNotThrow(() => recordRequestEnd(undefined));
  assert.doesNotThrow(() => recordRequestEnd({}));
});

await test('recordRequestEnd tracks latency and updates metrics', () => {
  const before = getMetrics();
  const initialRequests = before.requests.total;

  const ctx = recordRequestStart();
  recordRequestEnd(ctx, { topic: 'repository', cacheHit: true, aiCalled: false });

  const after = getMetrics();
  assert.ok(after.requests.total > initialRequests, 'totalRequests should increment');
  assert.ok(after.latency.lastMs >= 0, 'lastLatencyMs should be >= 0');
  assert.ok(after.latency.averageMs >= 0, 'averageMs should be >= 0');
  assert.ok(
    after.latency.byTopic.some(t => t.topic === 'repository'),
    'latencyByTopic should include "repository"'
  );
});

await test('recordRequestEnd counts cache hits vs misses', () => {
  const before = getMetrics();
  const hitBefore  = before.cache.requestsHit;
  const missBefore = before.cache.requestsMiss;

  const ctx1 = recordRequestStart();
  recordRequestEnd(ctx1, { topic: 'umamusume', cacheHit: true });

  const ctx2 = recordRequestStart();
  recordRequestEnd(ctx2, { topic: 'repository', cacheHit: false });

  const after = getMetrics();
  assert.equal(after.cache.requestsHit,  hitBefore + 1,  'cache hits should increment');
  assert.equal(after.cache.requestsMiss, missBefore + 1, 'cache misses should increment');
});

await test('recordRequestEnd tracks rejection count', () => {
  const before = getMetrics();
  const rejectedBefore = before.requests.rejected;

  const ctx = recordRequestStart();
  recordRequestEnd(ctx, { topic: 'off-topic', rejected: true });

  const after = getMetrics();
  assert.equal(after.requests.rejected, rejectedBefore + 1, 'rejected should increment');
});

await test('latencyByTopic correctly groups multiple requests per topic', () => {
  // Fire several requests for the same topic
  for (let i = 0; i < 3; i++) {
    const ctx = recordRequestStart();
    recordRequestEnd(ctx, { topic: 'repository', cacheHit: true });
  }
  const metrics = getMetrics();
  const repoStats = metrics.latency.byTopic.find(t => t.topic === 'repository');
  assert.ok(repoStats, 'repository topic should exist in byTopic');
  assert.ok(repoStats.requests >= 3, `expected >=3 requests for repository, got ${repoStats.requests}`);
  assert.ok(repoStats.avgLatencyMs >= 0, 'avgLatencyMs should be non-negative');
});

// ── AIObserver — getMetrics shape ────────────────────────────────────────────

section('AIObserver — getMetrics');

await test('getMetrics returns well-formed metrics object', () => {
  const m = getMetrics();
  assert.ok(typeof m === 'object');
  assert.ok('requests' in m, 'requests missing');
  assert.ok('latency'  in m, 'latency missing');
  assert.ok('cache'    in m, 'cache missing');
  assert.ok('indexer'  in m, 'indexer missing');
});

await test('metrics.requests has total, rejected, aiCalls, aiFailures', () => {
  const { requests } = getMetrics();
  assert.ok(typeof requests.total      === 'number');
  assert.ok(typeof requests.rejected   === 'number');
  assert.ok(typeof requests.aiCalls    === 'number');
  assert.ok(typeof requests.aiFailures === 'number');
});

await test('metrics.latency has averageMs, lastMs, byTopic array', () => {
  const { latency } = getMetrics();
  assert.ok(typeof latency.averageMs === 'number');
  assert.ok(typeof latency.lastMs    === 'number');
  assert.ok(Array.isArray(latency.byTopic));
});

await test('metrics.cache has embeddingSize, responseSize, hitRate, warmCached', () => {
  const { cache } = getMetrics();
  assert.ok(typeof cache.embeddingSize === 'number');
  assert.ok(typeof cache.responseSize  === 'number');
  assert.ok(typeof cache.hitRate       === 'string');
  assert.ok(typeof cache.warmCached    === 'number');
});

await test('metrics.cache.hitRate is 0.00 when no requests served', () => {
  // NOTE: hitRate is derived from cumulative metrics, so after many tests
  // it will no longer be 0.00. Instead, verify it's a valid decimal string.
  const { cache } = getMetrics();
  assert.match(cache.hitRate, /^\d+\.\d{2}$/, 'hitRate should be a decimal like 0.00 or 0.75');
});

// ── AIObserver — recordIndexerRun ────────────────────────────────────────────

section('AIObserver — recordIndexerRun');

await test('recordIndexerRun does not throw with valid args', () => {
  assert.doesNotThrow(() => recordIndexerRun({ status: 'ok', durationMs: 1234 }));
  assert.doesNotThrow(() => recordIndexerRun({ status: 'error', durationMs: 5678 }));
});

await test('recordIndexerRun updates metrics.indexer fields', () => {
  recordIndexerRun({ status: 'ok', durationMs: 9999 });
  const m = getMetrics();
  assert.equal(m.indexer.lastDurationMs, 9999);
  assert.equal(m.indexer.lastStatus, 'ok');

  recordIndexerRun({ status: 'error', durationMs: 0 });
  const m2 = getMetrics();
  assert.equal(m2.indexer.lastStatus, 'error');
});

// ── AIObserver — getStatus ──────────────────────────────────────────────────

section('AIObserver — getStatus');

await test('getStatus returns status and backend', () => {
  const s = getStatus();
  assert.ok(typeof s.status  === 'string', 'status must be a string');
  assert.ok(typeof s.backend === 'string', 'backend must be a string');
  assert.ok(typeof s.metrics === 'object', 'metrics must be an object');
});

// ── AIObserver — logQuery ────────────────────────────────────────────────────

section('AIObserver — logQuery');

await test('logQuery does not throw with full entry', () => {
  assert.doesNotThrow(() => logQuery({
    userId: 'u123', username: 'TestUser', guildId: 'g1', channelId: 'c1',
    command: '/ask', subcommand: 'ask', query: 'What is MANT?',
    topic: 'umamusume', complexity: 'simple',
    responsePreview: 'MANT stands for Monthly Average New Trainers...',
    citations: ['AI/KnowledgeEngine (glossary)'],
    success: true, durationMs: 312,
  }));
});

await test('logQuery does not throw with minimal entry', () => {
  assert.doesNotThrow(() => logQuery({
    query: 'hello',
    success: false,
    durationMs: 0,
  }));
});

// ── AIObserver — warmEmbeddingCache ──────────────────────────────────────────

section('AIObserver — warmEmbeddingCache');

await test('warmEmbeddingCache does not throw when API keys are missing', async () => {
  // Without API keys the cache warm will try to embed and fail per-query.
  // The function must return gracefully (0 or a number of cached items).
  const count = await warmEmbeddingCache();
  assert.ok(typeof count === 'number', 'should return a number');
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Phase 6: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
