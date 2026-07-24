/**
 * Archive
 */

import { resolveStorageBackend } from '../../core/storageBackend.js';

let _adapterPromise = null;

async function resolveAdapter(typeOverride = null) {
  if (_adapterPromise && !typeOverride) return _adapterPromise;

  const backend = (typeOverride ?? resolveStorageBackend('archive')).toLowerCase();
  _adapterPromise = backend === 'sqlite'
    ? import('./adapters/sqliteAdapter.js')
    : import('./adapters/memoryAdapter.js');

  const adapter = await _adapterPromise;
  await (adapter.init?.() ?? adapter.initAdapter?.());
  return adapter;
}

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'archive',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function archiveError(error, message, context = {}) {
  return { success: false, error, message, timestamp: new Date().toISOString(), context };
}

export function createArchiveAdapter(type) {
  if (type === 'sqlite') {
    throw new Error('Use createArchiveAdapterAsync("sqlite") in ESM mode.');
  }
  _adapterPromise = import('./adapters/memoryAdapter.js');
  return _buildInterface(type);
}

export async function createArchiveAdapterAsync(type) {
  await resolveAdapter(type);
  return _buildInterface(type);
}

async function getAdapter() {
  return resolveAdapter();
}

export async function init() {
  const adapter = await getAdapter();
  return adapter.init();
}

export async function insert(record) {
  if (!record?.notificationKey || !record?.type || !record?.circleId) {
    log('error', 'ARCHIVE_INSERT_INVALID: missing required fields', { record });
    return archiveError('ARCHIVE_INSERT_INVALID', 'notificationKey, type, and circleId are required');
  }
  const adapter = await getAdapter();
  const result = await adapter.insert(record);
  if (result.success && result.inserted) log('info', `inserted notification record key=${record.notificationKey}`);
  else if (!result.success) log('error', `insert failed — ${result.error}: ${result.message}`, { key: record.notificationKey });
  return result;
}

export async function get(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  return adapter.get(notificationKey);
}

export async function getIncomplete(circleId = null) {
  const adapter = await getAdapter();
  return adapter.getIncomplete(circleId);
}

export async function markChannelSent(notificationKey, meta = {}) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  return adapter.markChannelSent(notificationKey, meta);
}

export async function markDmMemberSent(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  return adapter.markDmMemberSent(notificationKey);
}

export async function markDmLeaderSent(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  return adapter.markDmLeaderSent(notificationKey);
}

export async function recordHistory(notificationKey, entry = {}) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  if (!entry.step || !entry.outcome) return archiveError('ARCHIVE_HISTORY_INVALID', 'step and outcome are required');
  const adapter = await getAdapter();
  return adapter.recordHistory(notificationKey, entry);
}

export async function getHistory(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  return adapter.getHistory(notificationKey);
}

export async function getAttemptSummary(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  return adapter.getAttemptSummary(notificationKey);
}

export async function markDeadLetter(notificationKey, details = {}) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  const result = await adapter.markDeadLetter(notificationKey, details);
  if (result.success) log('warn', `dead-lettered notification key=${notificationKey}`, details);
  return result;
}

export async function listDeadLetters(options = {}) {
  const adapter = await getAdapter();
  return adapter.listDeadLetters(options);
}

export async function replayDeadLetter(notificationKey) {
  if (!notificationKey) return archiveError('ARCHIVE_MISSING_KEY', 'notificationKey is required');
  const adapter = await getAdapter();
  return adapter.replayDeadLetter(notificationKey);
}

export async function getStats() {
  const adapter = await getAdapter();
  return adapter.getStats();
}

export async function prune({ olderThanDays } = {}) {
  if (!olderThanDays || olderThanDays <= 0) {
    return archiveError('ARCHIVE_PRUNE_INVALID', 'olderThanDays must be a positive number');
  }
  const adapter = await getAdapter();
  return adapter.prune({ olderThanDays });
}

function _buildInterface(type) {
  return {
    init: () => init(),
    insert: record => insert(record),
    get: notificationKey => get(notificationKey),
    getIncomplete: circleId => getIncomplete(circleId),
    markChannelSent: (notificationKey, meta) => markChannelSent(notificationKey, meta),
    markDmMemberSent: notificationKey => markDmMemberSent(notificationKey),
    markDmLeaderSent: notificationKey => markDmLeaderSent(notificationKey),
    recordHistory: (notificationKey, entry) => recordHistory(notificationKey, entry),
    getHistory: notificationKey => getHistory(notificationKey),
    getAttemptSummary: notificationKey => getAttemptSummary(notificationKey),
    markDeadLetter: (notificationKey, details) => markDeadLetter(notificationKey, details),
    listDeadLetters: options => listDeadLetters(options),
    replayDeadLetter: notificationKey => replayDeadLetter(notificationKey),
    getStats: () => getStats(),
    prune: options => prune(options),
    type,
  };
}
