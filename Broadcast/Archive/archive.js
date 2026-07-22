/**
 * Archive
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Archive — Stage 5, Broadcast
 * Version:   v2.0.0
 *
 * Pure notification state storage. Archive holds no pipeline logic, makes no
 * decisions, and performs no eligibility checks. It stores exactly what
 * Archive-Inspector writes and serves exactly what Archive-Transporter,
 * Announcer, and Broker request.
 *
 * Callers:
 *   INSERT new record        — Archive-Inspector only
 *   SELECT by key            — Archive-Transporter
 *   UPDATE delivery flags    — Announcer only
 *   INSERT history row       — Announcer only
 *   SELECT incomplete        — Broker only
 *   DELETE old records       — Scheduled prune
 */

import * as memoryAdapter from './adapters/memoryAdapter.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'archive',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function archiveError(error, message, context = {}) {
  return { success: false, error, message, timestamp: new Date().toISOString(), context };
}

// ─── Adapter resolution ───────────────────────────────────────────────────────

let _adapter = null;

/**
 * Create and attach an Archive adapter.
 *
 * @param {'inmemory'|'sqlite'} type
 * @param {{ dbPath?: string }} [options]
 * @returns {Archive}
 */
export function createArchiveAdapter(type, options = {}) {
  if (type === 'sqlite') {
    // Lazy-load the SQLite adapter so the module can be imported without better-sqlite3
    let sqliteAdapter;
    try {
      // The SQLite adapter module is co-located alongside this file
      const { createAdapter } = await_sync_import('./adapters/sqliteAdapter.js');
      sqliteAdapter = createAdapter(options);
    } catch (err) {
      throw new Error(
        `ARCHIVE_SQLITE_UNAVAILABLE: Could not load SQLite adapter. ` +
        `Install better-sqlite3 and ensure the adapter file exists. ${err.message}`
      );
    }
    _adapter = sqliteAdapter;
  } else {
    _adapter = memoryAdapter;
  }
  return _buildInterface(_adapter);
}

// Helper used only for createArchiveAdapter's SQLite branch — synchronous require
function await_sync_import(path) {
  // We use a dynamic import here for ESM compatibility; callers handle the await
  throw new Error('Use createArchiveAdapterAsync for SQLite in ESM environments.');
}

/**
 * Async factory — required for SQLite adapter in ESM.
 *
 * @param {'inmemory'|'sqlite'} type
 * @param {{ dbPath?: string }} [options]
 * @returns {Promise<ArchiveInterface>}
 */
export async function createArchiveAdapterAsync(type, options = {}) {
  if (type === 'sqlite') {
    const { createAdapter } = await import('./adapters/sqliteAdapter.js');
    _adapter = createAdapter(options);
  } else {
    _adapter = memoryAdapter;
  }
  return _buildInterface(_adapter);
}

// ─── Default export: module-level functions using in-memory adapter ───────────
// This allows `import * as archive from './archive.js'` in tests and pipelines.

// Lazily resolved to the attached adapter; falls back to memoryAdapter.
function getAdapter() {
  return _adapter ?? memoryAdapter;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the database / adapter.
 * Call once on startup before any other Archive operation.
 */
export async function init() {
  return getAdapter().init();
}

/**
 * Insert a new notification record.
 * Only Archive-Inspector may call this.
 * INSERT OR IGNORE — a second insert for the same key is a no-op.
 *
 * @param {{ notificationKey, type, circleId, recipients, payload }} record
 */
export async function insert(record) {
  if (!record?.notificationKey || !record?.type || !record?.circleId) {
    log('error', 'ARCHIVE_INSERT_INVALID: missing required fields', { record });
    return archiveError('ARCHIVE_INSERT_INVALID', 'notificationKey, type, and circleId are required');
  }
  const result = await getAdapter().insert(record);
  if (result.success && result.inserted) {
    log('info', `inserted notification record key=${record.notificationKey}`);
  } else if (!result.success) {
    log('error', `insert failed — ${result.error}: ${result.message}`, { key: record.notificationKey });
  }
  return result;
}

/**
 * Retrieve a full notification record by key.
 * Only Archive-Transporter may call this.
 *
 * @param {string} notificationKey
 */
export async function get(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const result = await getAdapter().get(notificationKey);
  if (!result.record && !result.error) {
    log('warn', `no record found for key=${notificationKey}`);
  }
  return result;
}

/**
 * Return all incomplete records for a circle (any delivery flag = 0).
 * Only Broker may call this.
 *
 * @param {string|null} circleId  — null returns incomplete records for all circles
 */
export async function getIncomplete(circleId = null) {
  const result = await getAdapter().getIncomplete(circleId);
  if (result.error) {
    log('error', `getIncomplete failed — ${result.error}: ${result.message}`, { circleId });
  }
  return result;
}

/**
 * Mark the channel delivery step complete.
 * Only Announcer may call this.
 *
 * @param {string} notificationKey
 * @param {{ channelMsgId?: string, channelId?: string, guildId?: string }} meta
 */
export async function markChannelSent(notificationKey, meta = {}) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const result = await getAdapter().markChannelSent(notificationKey, meta);
  if (!result.success) {
    log('error', `markChannelSent failed — ${result.error}`, { notificationKey });
  }
  return result;
}

/**
 * Mark the member DM delivery step complete.
 * Only Announcer may call this.
 *
 * @param {string} notificationKey
 */
export async function markDmMemberSent(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const result = await getAdapter().markDmMemberSent(notificationKey);
  if (!result.success) {
    log('error', `markDmMemberSent failed — ${result.error}`, { notificationKey });
  }
  return result;
}

/**
 * Mark the leader DM delivery step complete.
 * Only Announcer may call this.
 *
 * @param {string} notificationKey
 */
export async function markDmLeaderSent(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const result = await getAdapter().markDmLeaderSent(notificationKey);
  if (!result.success) {
    log('error', `markDmLeaderSent failed — ${result.error}`, { notificationKey });
  }
  return result;
}

/**
 * Append a delivery attempt to the history log.
 * Only Announcer may call this.
 *
 * @param {string} notificationKey
 * @param {{ step: string, outcome: string, discordCode?: number, detail?: string }} entry
 */
export async function recordHistory(notificationKey, entry = {}) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  if (!entry.step || !entry.outcome) {
    return archiveError('ARCHIVE_HISTORY_INVALID', 'step and outcome are required');
  }
  const result = await getAdapter().recordHistory(notificationKey, entry);
  if (!result.success) {
    log('error', `recordHistory failed — ${result.error}`, { notificationKey, step: entry.step });
  }
  return result;
}

/**
 * Delete records older than the retention window.
 * Only removes fully delivered records (all flags = 1).
 *
 * @param {{ olderThanDays: number }} opts
 */
export async function prune({ olderThanDays } = {}) {
  if (!olderThanDays || olderThanDays <= 0) {
    return archiveError('ARCHIVE_PRUNE_INVALID', 'olderThanDays must be a positive number');
  }
  const result = await getAdapter().prune({ olderThanDays });
  if (result.success) {
    log('info', `pruned ${result.pruned ?? 0} records older than ${olderThanDays} days`);
  } else {
    log('error', `prune failed — ${result.error}: ${result.message}`);
  }
  return result;
}

// ─── Interface builder (for adapter-pattern consumers) ────────────────────────

function _buildInterface(adapter) {
  return {
    init:             () => adapter.init(),
    insert:           (r) => insert_on(adapter, r),
    get:              (k) => adapter.get(k),
    getIncomplete:    (c) => adapter.getIncomplete(c),
    markChannelSent:  (k, m) => adapter.markChannelSent(k, m),
    markDmMemberSent: (k) => adapter.markDmMemberSent(k),
    markDmLeaderSent: (k) => adapter.markDmLeaderSent(k),
    recordHistory:    (k, e) => adapter.recordHistory(k, e),
    prune:            (o) => adapter.prune(o),
  };
}

async function insert_on(adapter, record) {
  if (!record?.notificationKey || !record?.type || !record?.circleId) {
    return archiveError('ARCHIVE_INSERT_INVALID', 'notificationKey, type, and circleId are required');
  }
  return adapter.insert(record);
}
