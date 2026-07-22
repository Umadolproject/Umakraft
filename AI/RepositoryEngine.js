// AI/RepositoryEngine.js
// Orchestrates the Repository Indexer, Vector Database, and RAG Engine.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/REPOSITORY_ENGINE.md
//
// The Repository Engine is the single entry point for all repository
// intelligence operations. Callers never interact with the Indexer,
// VectorDatabase, or RAGEngine directly.
//
// Public API:
//   initialize(rootDir)          — startup: init VDB, run initial index
//   search(query, options)       — answer a repository question
//   reindex(rootDir, clean)      — trigger a manual re-index
//   getStatus()                  — current index health / backend info

import { resolve } from 'node:path';
import log from '../core/log.js';
import config from './Configuration.js';
import { initialize as initVDB, stats as vdbStats } from './VectorDatabase.js';
import { fullIndex, incrementalIndex } from './RepositoryIndexer.js';
import { retrieve } from './RAGEngine.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _initialized    = false;
let _rootDir        = null;
let _lastIndexedAt  = null;
let _indexStats     = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the Repository Engine.
 *
 * - Connects to (or creates) the Vector Database collection
 * - Runs a full index if the VDB is empty, otherwise incremental
 * - Stores rootDir for subsequent reindex calls
 *
 * Call once during bot startup, before handling any /ask commands.
 *
 * @param {string} [rootDir] — absolute path to repo root; defaults to process.cwd()
 */
export async function initialize(rootDir) {
  _rootDir = resolve(rootDir ?? process.cwd());

  log.info(`[AI/RepositoryEngine] Initializing — root: ${_rootDir}`);

  // 1. Connect to / create VDB collection
  await initVDB();

  // 2. Check if there is anything already indexed
  const { size, backend } = vdbStats();
  log.info(`[AI/RepositoryEngine] VDB backend: ${backend}, current size: ${size < 0 ? 'unknown (Qdrant)' : size}`);

  // 3. Run initial index
  //    full  — if VDB is empty (size === 0) or AI_REINDEX_ON_STARTUP is set
  //    incr  — otherwise (pick up only changed files since last run)
  const runFull = size === 0 || config.reindexOnStartup;
  const runner  = runFull ? fullIndex : incrementalIndex;
  const label   = runFull ? 'full' : 'incremental';

  log.info(`[AI/RepositoryEngine] Running ${label} index on startup.`);
  _indexStats    = await runner(_rootDir);
  _lastIndexedAt = new Date();
  _initialized   = true;

  log.info(`[AI/RepositoryEngine] Initialization complete.`);
}

/**
 * Search the repository for content relevant to the given query.
 * Returns ranked chunks ready for the Context Builder.
 *
 * Supports six search modes automatically:
 *   - Semantic    — default; embedding similarity across all indexed content
 *   - Governance  — scope: 'governance' filter
 *   - Blueprint   — scope: 'blueprints' filter
 *   - Commands    — scope: 'commands' filter
 *   - Source      — scope: 'source' filter
 *   - Folder      — department filter
 *
 * @param {string} query
 * @param {{
 *   topK?:       number,
 *   minScore?:   number,
 *   scope?:      string|null,
 *   department?: string|null,
 *   fileType?:   string|null,
 *   maxTokens?:  number,
 * }} [options]
 * @returns {Promise<import('./RAGEngine.js').RAGChunk[]>}
 */
export async function search(query, options = {}) {
  if (!_initialized) {
    throw new Error(
      '[AI/RepositoryEngine] Not initialized. Call initialize() before searching.'
    );
  }

  log.info(`[AI/RepositoryEngine] Search: "${query.slice(0, 80)}"`);

  const filter = {};
  if (options.department) filter.department = options.department;
  if (options.fileType)   filter.fileType   = options.fileType;

  const chunks = await retrieve(query, {
    topK:      options.topK,
    minScore:  options.minScore,
    scope:     options.scope ?? null,
    filter,
    maxTokens: options.maxTokens,
  });

  return chunks;
}

/**
 * Trigger a manual re-index.
 *
 * @param {string}  [rootDir] — defaults to the rootDir used at initialize()
 * @param {boolean} [clean]   — true = delete all embeddings first (clean slate)
 * @returns {Promise<object>} index stats
 */
export async function reindex(rootDir, clean = false) {
  const dir = resolve(rootDir ?? _rootDir ?? process.cwd());

  if (clean) {
    log.info('[AI/RepositoryEngine] Clean re-index requested — running full index.');
    _indexStats    = await fullIndex(dir);
  } else {
    log.info('[AI/RepositoryEngine] Incremental re-index requested.');
    _indexStats    = await incrementalIndex(dir);
  }

  _lastIndexedAt = new Date();
  return _indexStats;
}

/**
 * Return current status for the Operation health supervisor.
 *
 * @returns {{
 *   initialized:   boolean,
 *   rootDir:       string|null,
 *   lastIndexedAt: string|null,
 *   vdb:           object,
 *   lastRun:       object|null,
 * }}
 */
export function getStatus() {
  return {
    initialized:   _initialized,
    rootDir:       _rootDir,
    lastIndexedAt: _lastIndexedAt?.toISOString() ?? null,
    vdb:           vdbStats(),
    lastRun:       _indexStats,
  };
}
