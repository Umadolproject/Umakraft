// Operation/Logger/logger.js
// Formats InvestigationRecord objects into OperationalLogEntry objects and
// emits each to core/log.js at the appropriate log level.
// Does not evaluate severity — that is the Manager's responsibility.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      Operation/Logger/Logger.md
// Version:   2.0.0

import log from '../../core/log.js';

// ─── Pipeline label mapping ───────────────────────────────────────────────────

/**
 * Map an investigation record's source + subject to a pipeline label.
 *
 * | source         | subject            | pipeline  |
 * |----------------|--------------------|-----------|
 * | runtime        | any                | runtime   |
 * | timeline       | any                | timeline  |
 * | dataSync       | any                | dataSync  |
 * | taskRegistry   | dataSync           | uma       |
 * | taskRegistry   | milestones         | milestone |
 * | taskRegistry   | timeline*          | timeline  |
 * | *              | *                  | core      |
 *
 * @param {string} source
 * @param {string} subject
 * @returns {string}
 */
function resolvePipeline(source, subject) {
  if (source === 'runtime')  return 'runtime';
  if (source === 'timeline') return 'timeline';
  if (source === 'dataSync') return 'dataSync';
  if (subject === 'dataSync')     return 'uma';
  if (subject === 'milestones')   return 'milestone';
  if (subject?.startsWith('timeline')) return 'timeline';
  return 'core';
}

// ─── Status mapping ───────────────────────────────────────────────────────────

/**
 * Derive a status code from an InvestigationRecord.
 *
 * | Condition                                            | Status  |
 * |------------------------------------------------------|---------|
 * | lastSuccess === null (never run)                     | unknown |
 * | consecutiveFailures >= 2                             | error   |
 * | consecutiveFailures === 1                            | warn    |
 * | staleSince !== null and consecutiveFailures === 0    | stale   |
 * | lastSuccess === true and consecutiveFailures === 0   | ok      |
 *
 * @param {object} record  InvestigationRecord
 * @returns {'ok'|'warn'|'error'|'stale'|'unknown'}
 */
function resolveStatus(record) {
  if (record.lastSuccess === null)      return 'unknown';
  if (record.consecutiveFailures >= 2)  return 'error';
  if (record.consecutiveFailures === 1) return 'warn';
  if (record.staleSince !== null && record.consecutiveFailures === 0) return 'stale';
  return 'ok';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * @param {Date|null} lastRunAt
 * @param {Date}      investigatedAt
 * @returns {number|null}
 */
function computeDuration(lastRunAt, investigatedAt) {
  if (!lastRunAt) return null;
  return investigatedAt - new Date(lastRunAt);
}

/**
 * @param {object} entry  OperationalLogEntry
 * @returns {string}
 */
function buildMessage(entry) {
  return (
    `pipeline=${entry.pipeline} stage=${entry.stage} status=${entry.status}` +
    ` failures=${entry.consecutiveFailures} duration=${entry.duration ?? 'n/a'}ms` +
    (entry.error ? ` error="${entry.error}"` : '')
  );
}

// ─── Core formatting ──────────────────────────────────────────────────────────

/**
 * Format one InvestigationRecord into one OperationalLogEntry and emit it.
 *
 * @param {object} record  InvestigationRecord
 * @returns {object}       OperationalLogEntry
 */
function formatOne(record) {
  const status   = resolveStatus(record);
  const duration = computeDuration(record.lastRunAt, record.investigatedAt);
  const pipeline = resolvePipeline(record.source, record.subject);

  /** @type {OperationalLogEntry} */
  const entry = {
    timestamp: record.investigatedAt.toISOString(),
    pipeline,
    stage: record.subject,
    status,
    duration,
    consecutiveFailures: record.consecutiveFailures,
    error: record.lastError ?? null,
    meta: {
      source:         record.source,
      memoryPressure: record.memoryPressure,
      staleSince:     record.staleSince ?? null,
    },
  };

  // Emit to core/log.js at the level that matches the status
  const message = `[Operation/Logger] ${buildMessage(entry)}`;
  switch (status) {
    case 'ok':      log.info(message);  break;
    case 'warn':    log.warn(message);  break;
    case 'error':
    case 'stale':   log.error(message); break;
    case 'unknown': log.debug(message); break;
  }

  // Emit a separate warning if memory pressure is active on this subject
  if (record.memoryPressure) {
    const { heapUsed, heapTotal } = record.extra ?? {};
    log.warn(
      `[Operation/Logger] Memory pressure detected — stage=${entry.stage}` +
      (heapUsed != null ? ` heap=${heapUsed}/${heapTotal}` : '')
    );
  }

  return entry;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Formats an array of InvestigationRecords into OperationalLogEntry objects
 * and emits each to core/log.js at the appropriate log level.
 *
 * @param {object[]} records  InvestigationRecord[]
 * @returns {object[]}        OperationalLogEntry[]
 *
 * @typedef {Object} OperationalLogEntry
 * @property {string}         timestamp
 * @property {string}         pipeline
 * @property {string}         stage
 * @property {'ok'|'warn'|'error'|'stale'|'unknown'} status
 * @property {number|null}    duration
 * @property {number}         consecutiveFailures
 * @property {string|null}    error
 * @property {{ source: string, memoryPressure: boolean, staleSince: number|null }} meta
 */
export function formatLogs(records) {
  return records.map(formatOne);
}
