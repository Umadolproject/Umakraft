// AI/AIObserver.js
// Observability bridge — connects AI Knowledge Service components to the
// Operation health supervisor and provides structured monitoring for
// embedding cache warming, response latency, and cache hit rates.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Plan:      AI/IMPLEMENTATION_PLAN.md (Phase 6)
//
// Public API:
//   registerAiTasks()                    — register AI tasks in core/taskRegistry
//   investigate()                        — collect AI health facts for Operation
//   warmEmbeddingCache()                 — pre-embed common queries on startup
//   getMetrics()                         — aggregate AI observability metrics
//   recordRequestStart()                 — start a request latency timer
//   recordRequestEnd(startToken, result) — record response latency + topic
//   getRequestMetrics()                  — latency summaries by topic

import { createHash } from 'node:crypto';
import log from '../core/log.js';
import config from './Configuration.js';
import { registerTask, recordTaskStart, recordTaskEnd } from '../core/taskRegistry.js';
import { embed as apiEmbed } from './managers/EmbeddingManager.js';
import { stats as cacheStats } from './Cache.js';
import { stats as vdbStats } from './VectorDatabase.js';
import { stats as docStats } from './documentSearch.js';

// ──────────────────────────────────────────────────────────────────────────────
// CORE METRICS (aggregated per-process lifetime)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AiMetrics
 * @property {number} totalRequests        — all /ask + /ai commands processed
 * @property {number} rejectedRequests     — off-topic rejection count
 * @property {number} cacheHits            — full-response cache hits (gateway)
 * @property {number} cacheMisses          — full-response cache misses (gateway)
 * @property {number} aiCalls              — successful Router.ai() completions
 * @property {number} aiFailures           — Router.ai() errors
 * @property {number} totalLatencyMs       — sum of all response latencies (ms)
 * @property {number} avgLatencyMs         — rolling average latency
 * @property {number} lastLatencyMs        — most recent request latency
 * @property {Map<string, {total:int, sum:int, last:int}>} latencyByTopic
 * @property {number} embeddingsCached     — cache.warm() calls completed
 * @property {Date | null} lastCacheWarmAt — last warmEmbeddingCache run
 * @property {number} cacheWarmFailures    — consecutive warm failures
 */

/** @type {AiMetrics} */
const _metrics = {
  totalRequests:     0,
  rejectedRequests:  0,
  cacheHits:         0,
  cacheMisses:       0,
  aiCalls:           0,
  aiFailures:        0,
  totalLatencyMs:    0,
  avgLatencyMs:      0,
  lastLatencyMs:     0,
  latencyByTopic:    new Map(),
  embeddingsCached:  0,
  lastCacheWarmAt:   null,
  cacheWarmFailures: 0,
  indexLastDurationMs:  null,
  indexLastStatus:      null,
};

// ──────────────────────────────────────────────────────────────────────────────
// TASK REGISTRATION — exposes AI tasks to the Operation health supervisor
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Register AI tasks in core/taskRegistry so Operation/Investigator can observe
 * them during the 5-minute health cycle. Call once during startup.
 *
 * Tasks are registered as "AI/*" subjects:
 *   - AI/Indexer      — maps to the RepositoryIndexer schedule
 *   - AI/CacheWarm     — embedding cache warming (runs once at startup)
 */
export function registerAiTasks() {
  // AI-based tasks that the Operation health cycle should observe.
  // The RepositoryIndexer re-indexes every VDB_INDEX_INTERVAL_HOURS (default: 6h).
  // We register the expected cron so stale detection works correctly.
  if (config.cacheEnabled) {
    registerTask(
      'AI/CacheWarm',
      `0 */${Math.max(1, Math.round(config.vdbIndexIntervalHours))} * * *`
    );
  }

  // Read the actual indexer schedule from config
  registerTask(
    'AI/Indexer',
    `0 */${Math.max(1, config.vdbIndexIntervalHours)} * * *`
  );

  log.info('[AI/AIObserver] AI tasks registered in taskRegistry.');
}

// ──────────────────────────────────────────────────────────────────────────────
// INVESTIGATION — collects facts for Operation/Investigator
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Collect AI component health facts for one Operation health cycle.
 * Called by runOperationCycle() → Investigator → this function.
 *
 * @returns {Promise<object[]>}  InvestigationRecord-compatible array
 */
export async function investigate() {
  const now   = new Date();
  const recs  = [];

  // ── API Provider: rate limiter state ────────────────────────────────────
  try {
    const { rateLimiterStats } = await import('./APIProvider.js');
    const rl = rateLimiterStats();
    recs.push({
      investigatedAt:      now,
      source:              'AI/APIProvider',
      subject:             'APIProvider.rateLimiter',
      consecutiveFailures: 0,
      lastRunAt:           null,
      lastSuccess:         true,
      lastError:           null,
      staleSince:          null,
      memoryPressure:      false,
      extra: {
        requestsInLastMinute: rl.requestsInLastMinute,
        limitRpm:             rl.limitRpm,
        rateLimitUsage:       rl.limitRpm > 0
          ? (rl.requestsInLastMinute / rl.limitRpm).toFixed(2)
          : '0',
      },
    });
  } catch (err) { /* non-fatal */ }

  // ── Cache: size + hit/miss from AIObserver metrics ─────────────────────
  const cs = cacheStats();
  recs.push({
    investigatedAt:      now,
    source:              'AI/Cache',
    subject:             'AI/Cache.aggregate',
    consecutiveFailures: 0,
    lastRunAt:           _metrics.lastCacheWarmAt,
    lastSuccess:         _metrics.cacheWarmFailures === 0,
    lastError:           _metrics.cacheWarmFailures > 0
      ? `${_metrics.cacheWarmFailures} consecutive warm failures`
      : null,
    staleSince:          null,
    memoryPressure:      false,
    extra: {
      embeddingSize:  cs.embeddingSize,
      responseSize:   cs.responseSize,
      cacheHits:      _metrics.cacheHits,
      cacheMisses:    _metrics.cacheMisses,
      cacheHitRate:   _metrics.totalRequests > 0
        ? (_metrics.cacheHits / _metrics.totalRequests).toFixed(2)
        : '0.00',
      embeddingsCached: _metrics.embeddingsCached,
    },
  });

  // ── Vector Database: backend + size ─────────────────────────────────────
  try {
    const vs = vdbStats();
    recs.push({
      investigatedAt:      now,
      source:              'AI/VectorDatabase',
      subject:             'AI/VectorDatabase',
      consecutiveFailures: 0,
      lastRunAt:           null,
      lastSuccess:         true,
      lastError:           null,
      staleSince:          null,
      memoryPressure:      false,
      extra: {
        backend: vs.backend,
        size:    vs.size,
      },
    });
  } catch (err) { /* non-fatal */ }

  // ── AI Request metrics: latency, throughput ──────────────────────────────
  recs.push({
    investigatedAt:      now,
    source:              'AI/RequestMetrics',
    subject:             'AI.RequestMetrics',
    consecutiveFailures: 0,
    lastRunAt:           null,
    lastSuccess:         true,
    lastError:           null,
    staleSince:          null,
    memoryPressure:      false,
    extra: {
      totalRequests:    _metrics.totalRequests,
      rejectedRequests: _metrics.rejectedRequests,
      aiCalls:          _metrics.aiCalls,
      aiFailures:       _metrics.aiFailures,
      avgLatencyMs:     _metrics.avgLatencyMs,
      lastLatencyMs:    _metrics.lastLatencyMs,
      latencyByTopic:   Object.fromEntries(
        [..._metrics.latencyByTopic.entries()].map(([topic, { total, sum, last }]) => [
          topic,
          { totalRequests: total, avgLatencyMs: total > 0 ? Math.round(sum / total) : 0, lastLatencyMs: last },
        ])
      ),
    },
  });

  // ── Indexer health ───────────────────────────────────────────────────────
  recs.push({
    investigatedAt:      now,
    source:              'AI/Indexer',
    subject:             'AI/Indexer.health',
    consecutiveFailures: 0,
    lastRunAt:           null,
    lastSuccess:         _metrics.indexLastStatus !== 'error',
    lastError:           _metrics.indexLastStatus === 'error'
      ? `Indexer failed; last run = ${_metrics.indexLastDurationMs}ms`
      : null,
    staleSince:          null,
    memoryPressure:      false,
    extra: {
      lastDurationMs:    _metrics.indexLastDurationMs,
      lastStatus:        _metrics.indexLastStatus,
    },
  });

  return recs;
}

// ──────────────────────────────────────────────────────────────────────────────
// EMBEDDING CACHE WARMING
// ──────────────────────────────────────────────────────────────────────────────

/** Common repository + Umamusume queries to warm the embedding cache at startup. */
const WARM_QUERIES = [
  'How does the Vault store data?',
  'What is the Miner responsible for?',
  'How is fan gain calculated?',
  'What is MANT?',
  'Explain the Broadcast pipeline',
  'How does the Refinery work?',
  'What are the circle rank tiers?',
  'What is fan deficit?',
  'How does the Fabricator render cards?',
  'What is the Depot?',
  'Explain Trainer Trend Tiers',
  'How are milestones triggered?',
];

/**
 * Pre-embed a set of common queries so the first real requests hit the cache
 * rather than incurring a cold-start API provider call.
 *
 * Runs asynchronously — failures are logged but never fatal.
 * Designed to be called during startup (fire-and-forget).
 *
 * @returns {Promise<number>} number of embeddings successfully cached
 */
export async function warmEmbeddingCache() {
  if (!config.cacheEnabled) {
    log.info('[AI/AIObserver] Cache warming skipped — CACHE_ENABLED=false.');
    return 0;
  }

  const startTime = Date.now();
  let cached = 0;
  _metrics.lastCacheWarmAt = new Date();

  log.info(`[AI/AIObserver] Cache warming started — ${WARM_QUERIES.length} queries.`);

  for (const query of WARM_QUERIES) {
    try {
      await apiEmbed(query);
      cached++;
    } catch (err) {
      log.warn(`[AI/AIObserver] Cache warm failed for "${query.slice(0, 50)}": ${err.message}`);
    }
  }

  const durationMs = Date.now() - startTime;
  _metrics.embeddingsCached += cached;
  _metrics.cacheWarmFailures = cached === WARM_QUERIES.length ? 0 : _metrics.cacheWarmFailures + 1;

  log.info(
    `[AI/AIObserver] Cache warming complete — ${cached}/${WARM_QUERIES.length} ` +
    `cached in ${(durationMs / 1000).toFixed(1)}s`
  );

  // Update taskRegistry for the health cycle
  recordTaskStart('AI/CacheWarm');
  recordTaskEnd('AI/CacheWarm', {
    success: cached > 0,
    error:   cached === 0 ? 'Cache warm produced 0 embeddings' : null,
  });

  return cached;
}

// ──────────────────────────────────────────────────────────────────────────────
// LATENCY TRACKING
// ──────────────────────────────────────────────────────────────────────────────

/** Simple random tokens for request tracking. */
function startToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Start timing a request. Returns a token to pass to recordRequestEnd().
 *
 * @returns {{ token: string, startedAt: number }}
 */
export function recordRequestStart() {
  const startedAt = Date.now();
  _metrics.totalRequests += 1;
  return {
    token:     startToken(),
    startedAt,
  };
}

/**
 * Record the end of a request with its latency and topic.
 *
 * @param {{ token: string, startedAt: number }} ctx    — from recordRequestStart()
 * @param {{
 *   topic:       string,
 *   cacheHit?:   boolean,
 *   aiCalled?:   boolean,
 *   aiFailed?:   boolean,
 *   rejected?:   boolean,
 * }} result
 */
export function recordRequestEnd(ctx, { topic, cacheHit = false, aiCalled = false, aiFailed = false, rejected = false } = {}) {
  if (!ctx?.startedAt) return;

  const latencyMs = Date.now() - ctx.startedAt;
  _metrics.lastLatencyMs = latencyMs;
  _metrics.totalLatencyMs += latencyMs;

  // Rolling average: avg = (avg * (n-1) + new) / n  where n = totalRequests
  const n = _metrics.totalRequests;
  _metrics.avgLatencyMs = n > 1
    ? Math.round((_metrics.avgLatencyMs * (n - 1) + latencyMs) / n)
    : latencyMs;

  // Accumulate by topic
  if (topic) {
    let t = _metrics.latencyByTopic.get(topic);
    if (!t) {
      t = { total: 0, sum: 0, last: 0 };
      _metrics.latencyByTopic.set(topic, t);
    }
    t.total += 1;
    t.sum   += latencyMs;
    t.last   = latencyMs;
  }

  if (cacheHit) _metrics.cacheHits += 1;
  else          _metrics.cacheMisses += 1;
  if (rejected)  _metrics.rejectedRequests += 1;
  if (aiCalled) {
    _metrics.aiCalls += 1;
    if (aiFailed) _metrics.aiFailures += 1;
  }

  log.info(
    `[AI/AIObserver] Request end — topic=${topic} latency=${latencyMs}ms ` +
    `cache=${cacheHit ? 'hit' : 'miss'} aiCalled=${aiCalled}`
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// METRICS EXPORT
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Export aggregate AI metrics for AI/status commands and health checks.
 *
 * @returns {object}
 */
export function getMetrics() {
  const cs = cacheStats();
  const cacheHitRate = _metrics.totalRequests > 0
    ? (_metrics.cacheHits / _metrics.totalRequests).toFixed(2)
    : '0.00';

  return {
    requests: {
      total:      _metrics.totalRequests,
      rejected:   _metrics.rejectedRequests,
      aiCalls:    _metrics.aiCalls,
      aiFailures: _metrics.aiFailures,
    },
    latency: {
      averageMs:    _metrics.avgLatencyMs,
      lastMs:       _metrics.lastLatencyMs,
      byTopic:      [..._metrics.latencyByTopic.entries()].map(([topic, t]) => ({
        topic,
        requests:       t.total,
        avgLatencyMs:   t.total > 0 ? Math.round(t.sum / t.total) : 0,
        lastLatencyMs:  t.last,
      })),
    },
    cache: {
      embeddingSize: cs.embeddingSize,
      responseSize:  cs.responseSize,
      requestsHit:   _metrics.cacheHits,
      requestsMiss:  _metrics.cacheMisses,
      hitRate:       cacheHitRate,
      warmCached:    _metrics.embeddingsCached,
      lastWarmAt:    _metrics.lastCacheWarmAt?.toISOString() ?? null,
    },
    indexer: {
      lastDurationMs: _metrics.indexLastDurationMs,
      lastStatus:     _metrics.indexLastStatus,
    },
  };
}

/**
 * Record indexer run outcome so Operation can track indexing health.
 * Called by the indexer runner (fullIndex / incrementalIndex).
 *
 * @param {{ status: 'ok'|'error', durationMs: number }} result
 */
export function recordIndexerRun({ status, durationMs }) {
  _metrics.indexLastDurationMs = durationMs;
  _metrics.indexLastStatus     = status;
  recordTaskStart('AI/Indexer');
  recordTaskEnd('AI/Indexer', { success: status === 'ok' });
}

// ──────────────────────────────────────────────────────────────────────────────
// QUERY LOG ENTRY (for Operation/AskLogger compatibility)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Structured query log for Operation-level debugging.
 * Full detail including response preview (truncated to 200 chars).
 *
 * @param {object} entry
 */
export function logQuery(entry) {
  const preview = typeof entry.responsePreview === 'string'
    ? entry.responsePreview.slice(0, 200)
    : null;

  log.info(JSON.stringify({
    timestamp:     new Date().toISOString(),
    component:     'AI/AIObserver',
    userId:        entry.userId        ?? 'unknown',
    username:      entry.username      ?? null,
    guildId:       entry.guildId       ?? null,
    channelId:     entry.channelId     ?? null,
    command:       entry.command       ?? 'unknown',
    subcommand:    entry.subcommand    ?? null,
    query:         entry.query         ?? '',
    topic:         entry.topic         ?? 'unknown',
    complexity:    entry.complexity    ?? null,
    responsePreview: preview,
    citations:     entry.citations     ?? null,
    success:       entry.success       ?? false,
    errorMessage:  entry.errorMessage  ?? null,
    durationMs:    entry.durationMs    ?? 0,
  }));
}

/**
 * Export a snapshot for Operation/status commands.
 * @returns {{ status: string, backend: string|null, metrics: object }}
 */
export function getStatus() {
  const vs = vdbStats();
  return {
    status:  _metrics.aiFailures > 10 ? 'degraded' : 'healthy',
    backend: vs.backend,
    metrics: getMetrics(),
  };
}
