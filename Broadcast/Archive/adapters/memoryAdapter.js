/**
 * Archive — Memory Storage Adapter
 */

const claims = new Map();
const history = [];
let historyId = 0;

export async function init() {
  return { success: true };
}

export async function insert(record) {
  try {
    if (!record?.notificationKey) {
      return { success: false, inserted: false, error: 'ARCHIVE_MISSING_KEY', message: 'notificationKey is required' };
    }
    if (claims.has(record.notificationKey)) {
      return { success: true, inserted: false, notificationKey: record.notificationKey };
    }
    claims.set(record.notificationKey, {
      notificationKey: record.notificationKey,
      type: record.type,
      circleId: record.circleId,
      claimedAt: new Date().toISOString(),
      channelSent: 0,
      dmMemberSent: 0,
      dmLeaderSent: 0,
      channelMsgId: null,
      channelId: null,
      guildId: null,
      payloadJson: JSON.stringify({ recipients: record.recipients, payload: record.payload }),
      deadLetter: 0,
      deadLetterReason: null,
      deadLetteredAt: null,
    });
    return { success: true, inserted: true, notificationKey: record.notificationKey };
  } catch (err) {
    return { success: false, inserted: false, error: 'ARCHIVE_INSERT_ERROR', message: err.message };
  }
}

export async function get(notificationKey) {
  try {
    const row = claims.get(notificationKey);
    if (!row) return { record: null };
    return { record: hydrate(row) };
  } catch (err) {
    return { record: null, error: 'ARCHIVE_GET_ERROR', message: err.message };
  }
}

export async function getIncomplete(circleId) {
  try {
    const rows = Array.from(claims.values()).filter(row => {
      const matchesCircle = circleId == null || row.circleId === circleId;
      const isIncomplete = row.deadLetter === 0 && (row.channelSent === 0 || row.dmMemberSent === 0 || row.dmLeaderSent === 0);
      return matchesCircle && isIncomplete;
    });
    return { records: rows.map(hydrate) };
  } catch (err) {
    return { records: [], error: 'ARCHIVE_INCOMPLETE_ERROR', message: err.message };
  }
}

export async function markChannelSent(notificationKey, { channelMsgId, channelId, guildId } = {}) {
  return setFlags(notificationKey, { channelSent: 1, channelMsgId, channelId, guildId });
}

export async function markDmMemberSent(notificationKey) {
  return setFlags(notificationKey, { dmMemberSent: 1 });
}

export async function markDmLeaderSent(notificationKey) {
  return setFlags(notificationKey, { dmLeaderSent: 1 });
}

export async function markDeadLetter(notificationKey, { reason, step, attemptCount } = {}) {
  try {
    const row = claims.get(notificationKey);
    if (!row) return { success: false, error: 'ARCHIVE_NOT_FOUND', message: `No record for key=${notificationKey}` };
    claims.set(notificationKey, {
      ...row,
      deadLetter: 1,
      deadLetterReason: reason ?? null,
      deadLetteredAt: new Date().toISOString(),
    });
    history.push({
      id: ++historyId,
      notificationKey,
      step: step ?? 'dead_letter',
      outcome: 'dead_letter',
      discordCode: null,
      attemptedAt: new Date().toISOString(),
      detail: JSON.stringify({ reason, attemptCount }),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_DEAD_LETTER_ERROR', message: err.message };
  }
}

export async function replayDeadLetter(notificationKey) {
  try {
    const row = claims.get(notificationKey);
    if (!row) return { success: false, error: 'ARCHIVE_NOT_FOUND', message: `No record for key=${notificationKey}` };
    claims.set(notificationKey, {
      ...row,
      deadLetter: 0,
      deadLetterReason: null,
      deadLetteredAt: null,
    });
    history.push({
      id: ++historyId,
      notificationKey,
      step: 'dead_letter_replay',
      outcome: 'success',
      discordCode: null,
      attemptedAt: new Date().toISOString(),
      detail: 'Replay requested',
    });
    return { success: true, notificationKey };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_REPLAY_ERROR', message: err.message };
  }
}

export async function listDeadLetters({ circleId = null, limit = 10 } = {}) {
  try {
    const rows = Array.from(claims.values())
      .filter(row => row.deadLetter === 1 && (circleId == null || row.circleId === circleId))
      .sort((a, b) => (a.deadLetteredAt < b.deadLetteredAt ? 1 : -1))
      .slice(0, limit);
    return { success: true, records: rows.map(hydrate) };
  } catch (err) {
    return { success: false, records: [], error: 'ARCHIVE_LIST_DEAD_LETTERS_ERROR', message: err.message };
  }
}

export async function recordHistory(notificationKey, { step, outcome, discordCode, detail } = {}) {
  try {
    history.push({
      id: ++historyId,
      notificationKey,
      step,
      outcome,
      discordCode: discordCode ?? null,
      attemptedAt: new Date().toISOString(),
      detail: detail ?? null,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_HISTORY_ERROR', message: err.message };
  }
}

export async function getHistory(notificationKey) {
  try {
    return {
      history: history.filter(row => row.notificationKey === notificationKey).sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1)),
    };
  } catch (err) {
    return { history: [], error: 'ARCHIVE_HISTORY_READ_ERROR', message: err.message };
  }
}

export async function getAttemptSummary(notificationKey) {
  const result = await getHistory(notificationKey);
  if (result.error) return { ...result, failureCount: 0 };
  const failureCount = result.history.filter(row => row.outcome === 'failure').length;
  return { success: true, failureCount, history: result.history };
}

export async function getStats() {
  try {
    const rows = Array.from(claims.values());
    const completed = rows.filter(row => row.channelSent === 1 && row.dmMemberSent === 1 && row.dmLeaderSent === 1).length;
    const incomplete = rows.filter(row => row.deadLetter === 0 && (row.channelSent === 0 || row.dmMemberSent === 0 || row.dmLeaderSent === 0)).length;
    const deadLetters = rows.filter(row => row.deadLetter === 1).length;
    return {
      success: true,
      total: rows.length,
      completed,
      incomplete,
      deadLetters,
      historyEntries: history.length,
    };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_STATS_ERROR', message: err.message };
  }
}

export async function prune({ olderThanDays } = {}) {
  try {
    if (!olderThanDays || olderThanDays <= 0) {
      return { success: false, error: 'ARCHIVE_PRUNE_INVALID', message: 'olderThanDays must be a positive number' };
    }
    const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
    let pruned = 0;
    for (const [key, row] of claims) {
      const completed = row.channelSent === 1 && row.dmMemberSent === 1 && row.dmLeaderSent === 1;
      if (row.claimedAt < cutoff && (completed || row.deadLetter === 1)) {
        claims.delete(key);
        pruned++;
      }
    }
    return { success: true, pruned };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_PRUNE_ERROR', message: err.message };
  }
}

function setFlags(notificationKey, patch) {
  try {
    const row = claims.get(notificationKey);
    if (!row) return { success: false, error: 'ARCHIVE_NOT_FOUND', message: `No record for key=${notificationKey}` };
    claims.set(notificationKey, { ...row, ...patch });
    return { success: true };
  } catch (err) {
    return { success: false, error: 'ARCHIVE_FLAG_ERROR', message: err.message };
  }
}

function hydrate(row) {
  let parsed;
  try { parsed = JSON.parse(row.payloadJson ?? '{}'); } catch { parsed = {}; }
  return {
    notificationKey: row.notificationKey,
    type: row.type,
    circleId: row.circleId,
    claimedAt: row.claimedAt,
    channelSent: row.channelSent,
    dmMemberSent: row.dmMemberSent,
    dmLeaderSent: row.dmLeaderSent,
    channelMsgId: row.channelMsgId,
    channelId: row.channelId,
    guildId: row.guildId,
    recipients: parsed.recipients ?? null,
    payload: parsed.payload ?? null,
    deadLetter: row.deadLetter,
    deadLetterReason: row.deadLetterReason,
    deadLetteredAt: row.deadLetteredAt,
  };
}

export function _reset() {
  claims.clear();
  history.length = 0;
  historyId = 0;
}
