/**
 * Archive — Memory Storage Adapter
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Archive — Stage 5, Broadcast
 *
 * In-memory adapter for development and testing.
 * Does not persist across process restarts.
 *
 * Implements the Archive adapter contract:
 *   insert(record)
 *   get(notificationKey)
 *   getIncomplete(circleId)
 *   markChannelSent(notificationKey, { channelMsgId, channelId, guildId })
 *   markDmMemberSent(notificationKey)
 *   markDmLeaderSent(notificationKey)
 *   recordHistory(notificationKey, { step, outcome, discordCode, detail })
 *   prune({ olderThanDays })
 *   init()
 */

// key: notificationKey, value: claim record
const claims = new Map();
// history rows (append-only)
const history = [];
let historyId = 0;

/**
 * Initialize the adapter (no-op for in-memory).
 */
export async function init() {
  return { success: true };
}

/**
 * Insert a new notification record.
 * INSERT OR IGNORE semantics — a second insert for the same key is a no-op.
 *
 * @param {{ notificationKey, type, circleId, recipients, payload }} record
 * @returns {{ success: boolean, inserted: boolean, error?: string }}
 */
export async function insert(record) {
  try {
    if (!record?.notificationKey) {
      return { success: false, inserted: false, error: 'ARCHIVE_MISSING_KEY', message: 'notificationKey is required' };
    }
    if (claims.has(record.notificationKey)) {
      // Already exists — INSERT OR IGNORE: treat as success, not an error
      return { success: true, inserted: false, notificationKey: record.notificationKey };
    }
    claims.set(record.notificationKey, {
      notificationKey:  record.notificationKey,
      type:             record.type,
      circleId:         record.circleId,
      claimedAt:        new Date().toISOString(),
      channelSent:      0,
      dmMemberSent:     0,
      dmLeaderSent:     0,
      channelMsgId:     null,
      channelId:        null,
      guildId:          null,
      payloadJson:      JSON.stringify({ recipients: record.recipients, payload: record.payload }),
    });
    return { success: true, inserted: true, notificationKey: record.notificationKey };
  } catch (err) {
    return { success: false, inserted: false, error: 'ARCHIVE_INSERT_ERROR', message: err.message };
  }
}

/**
 * Read a full notification record by key.
 *
 * @param {string} notificationKey
 * @returns {{ record: object|null, error?: string }}
 */
export async function get(notificationKey) {
  try {
    const row = claims.get(notificationKey);
    if (!row) return { record: null };
    return { record: _hydrate(row) };
  } catch (err) {
    return { record: null, error: 'ARCHIVE_GET_ERROR', message: err.message };
  }
}

/**
 * Return all records for a circle where any delivery flag is still 0.
 * Pass circleId = null to return incomplete records across all circles.
 *
 * @param {string|null} circleId
 * @returns {{ records: object[], error?: string }}
 */
export async function getIncomplete(circleId) {
  try {
    const rows = Array.from(claims.values()).filter(row => {
      const matchesCircle = circleId == null || row.circleId === circleId;
      const isIncomplete  = row.channelSent === 0 || row.dmMemberSent === 0 || row.dmLeaderSent === 0;
      return matchesCircle && isIncomplete;
    });
    return { records: rows.map(_hydrate) };
  } catch (err) {
    return { records: [], error: 'ARCHIVE_INCOMPLETE_ERROR', message: err.message };
  }
}

/**
 * Mark the channel delivery step complete.
 *
 * @param {string} notificationKey
 * @param {{ channelMsgId?: string, channelId?: string, guildId?: string }} meta
 */
export async function markChannelSent(notificationKey, { channelMsgId, channelId, guildId } = {}) {
  return _setFlags(notificationKey, { channelSent: 1, channelMsgId, channelId, guildId });
}

/**
 * Mark the member DM delivery step complete.
 *
 * @param {string} notificationKey
 */
export async function markDmMemberSent(notificationKey) {
  return _setFlags(notificationKey, { dmMemberSent: 1 });
}

/**
 * Mark the leader DM delivery step complete.
 *
 * @param {string} notificationKey
 */
export async function markDmLeaderSent(notificationKey) {
  return _setFlags(notificationKey, { dmLeaderSent: 1 });
}

/**
 * Append a delivery attempt to the history log.
 *
 * @param {string} notificationKey
 * @param {{ step: string, outcome: string, discordCode?: number, detail?: string }} entry
 */
export async function recordHistory(notificationKey, { step, outcome, discordCode, detail } = {}) {
  try {
    history.push({
      id:              ++historyId,
      notificationKey,
      step,
      outcome,
      discordCode:     discordCode ?? null,
      attemptedAt:     new Date().toISOString(),
      detail:          detail ?? null,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_HISTORY_ERROR', message: err.message };
  }
}

/**
 * Delete records older than the given retention window.
 * Only removes fully delivered records (all flags = 1).
 *
 * @param {{ olderThanDays: number }} opts
 */
export async function prune({ olderThanDays } = {}) {
  try {
    if (!olderThanDays || olderThanDays <= 0) {
      return { success: false, error: 'ARCHIVE_PRUNE_INVALID', message: 'olderThanDays must be a positive number' };
    }
    const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
    let pruned = 0;
    for (const [key, row] of claims) {
      if (row.claimedAt < cutoff && row.channelSent === 1 && row.dmMemberSent === 1 && row.dmLeaderSent === 1) {
        claims.delete(key);
        pruned++;
      }
    }
    return { success: true, pruned };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_PRUNE_ERROR', message: err.message };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _setFlags(notificationKey, patch) {
  try {
    const row = claims.get(notificationKey);
    if (!row) return { success: false, error: 'ARCHIVE_NOT_FOUND', message: `No record for key=${notificationKey}` };
    claims.set(notificationKey, { ...row, ...patch });
    return { success: true };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_FLAG_ERROR', message: err.message };
  }
}

function _hydrate(row) {
  let parsed = {};
  try { parsed = JSON.parse(row.payloadJson ?? '{}'); } catch { /* leave empty */ }
  return {
    notificationKey: row.notificationKey,
    type:            row.type,
    circleId:        row.circleId,
    claimedAt:       row.claimedAt,
    channelSent:     row.channelSent,
    dmMemberSent:    row.dmMemberSent,
    dmLeaderSent:    row.dmLeaderSent,
    channelMsgId:    row.channelMsgId,
    channelId:       row.channelId,
    guildId:         row.guildId,
    recipients:      parsed.recipients ?? null,
    payload:         parsed.payload    ?? null,
  };
}

/**
 * Test-only helper — clear all state between test cases.
 */
export function _reset() {
  claims.clear();
  history.length = 0;
  historyId = 0;
}
