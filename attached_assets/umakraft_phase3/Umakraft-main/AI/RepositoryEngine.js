// AI/RepositoryEngine.js
// Orchestrates the Repository Indexer, Vector Database, and RAG Engine.

import { resolve } from 'node:path';
import log from '../core/log.js';
import config from './Configuration.js';
import { initialize as initVDB, stats as vdbStats } from './VectorDatabase.js';
import { fullIndex, incrementalIndex } from './RepositoryIndexer.js';
import { retrieve } from './RAGEngine.js';
import { initialize as initLocalService } from './aiService.js';

let _initialized = false;
let _initializingPromise = null;
let _rootDir = null;
let _lastIndexedAt = null;
let _indexStats = null;

export async function initialize(rootDir) {
  if (_initialized) return;
  if (_initializingPromise) return _initializingPromise;

  _rootDir = resolve(rootDir ?? process.cwd());
  _initializingPromise = (async () => {
    log.info(`[AI/RepositoryEngine] Initializing — root: ${_rootDir}`);

    if (config.aiProvider === 'local') {
      await initLocalService();
      _initialized = true;
      log.info('[AI/RepositoryEngine] Local AI provider active — document index ready, model stays lazy.');
      return;
    }

    await initVDB();

    const { size, backend } = vdbStats();
    log.info(`[AI/RepositoryEngine] VDB backend: ${backend}, current size: ${size < 0 ? 'unknown (Qdrant)' : size}`);

    const runFull = size === 0 || config.reindexOnStartup;
    const runner = runFull ? fullIndex : incrementalIndex;
    const label = runFull ? 'full' : 'incremental';

    log.info(`[AI/RepositoryEngine] Running ${label} index on first AI request.`);
    _indexStats = await runner(_rootDir);
    _lastIndexedAt = new Date();
    _initialized = true;

    log.info('[AI/RepositoryEngine] Initialization complete.');
  })();

  try {
    await _initializingPromise;
  } finally {
    _initializingPromise = null;
  }
}

export async function search(query, options = {}) {
  if (!_initialized) {
    await initialize();
  }

  log.info(`[AI/RepositoryEngine] Search: "${query.slice(0, 80)}"`);

  const filter = {};
  if (options.department) filter.department = options.department;
  if (options.fileType) filter.fileType = options.fileType;

  const chunks = await retrieve(query, {
    topK: options.topK,
    minScore: options.minScore,
    scope: options.scope ?? null,
    filter,
    maxTokens: options.maxTokens,
  });

  return chunks;
}

export async function reindex(rootDir, clean = false) {
  await initialize(rootDir);
  const dir = resolve(rootDir ?? _rootDir ?? process.cwd());

  if (clean) {
    log.info('[AI/RepositoryEngine] Clean re-index requested — running full index.');
    _indexStats = await fullIndex(dir);
  } else {
    log.info('[AI/RepositoryEngine] Incremental re-index requested.');
    _indexStats = await incrementalIndex(dir);
  }

  _lastIndexedAt = new Date();
  return _indexStats;
}

export function getStatus() {
  return {
    initialized: _initialized,
    rootDir: _rootDir,
    lastIndexedAt: _lastIndexedAt?.toISOString() ?? null,
    vdb: config.aiProvider === 'local' ? null : vdbStats(),
    lastRun: _indexStats,
  };
}
