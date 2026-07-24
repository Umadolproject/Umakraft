import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryAll, queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('archive');
let _initPromise = null;

async function initSchema() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, async (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS archive_claims (
        notification_key TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        circle_id TEXT NOT NULL,
        claimed_at TEXT NOT NULL,
        channel_sent INTEGER NOT NULL DEFAULT 0,
        dm_member_sent INTEGER NOT NULL DEFAULT 0,
        dm_leader_sent INTEGER NOT NULL DEFAULT 0,
        channel_msg_id TEXT,
        channel_id TEXT,
        guild_id TEXT,
        payload_json TEXT,
        dead_letter INTEGER NOT NULL DEFAULT 0,
        dead_letter_reason TEXT,
        dead_lettered_at TEXT
      );
      CREATE TABLE IF NOT EXISTS archive_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_key TEXT NOT NULL,
        step TEXT NOT NULL,
        outcome TEXT NOT NULL,
        discord_code INTEGER,
        attempted_at TEXT NOT NULL,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_archive_circle_incomplete
        ON archive_claims (circle_id, dead_letter, channel_sent, dm_member_sent, dm_leader_sent, claimed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_dead_letter_time
        ON archive_claims (dead_letter, dead_lettered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_type_claimed_at
        ON archive_claims (type, claimed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_history_key_time
        ON archive_history (notification_key, attempted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_history_outcome_time
        ON archive_history (outcome, attempted_at DESC);
    `);
    return { success: true };
  });
  return _initPromise;
}

function hydrate(row) {
  if (!row) return null;
  let parsed;
  try { parsed = JSON.parse(row.payload_json ?? '{}'); } catch { parsed = {}; }
  return {
    notificationKey: row.notification_key,
    type: row.type,
    circleId: row.circle_id,
    claimedAt: row.claimed_at,
    channelSent: row.channel_sent,
    dmMemberSent: row.dm_member_sent,
    dmLeaderSent: row.dm_leader_sent,
    channelMsgId: row.channel_msg_id,
    channelId: row.channel_id,
    guildId: row.guild_id,
    recipients: parsed.recipients ?? null,
    payload: parsed.payload ?? null,
    deadLetter: row.dead_letter,
    deadLetterReason: row.dead_letter_reason,
    deadLetteredAt: row.dead_lettered_at,
  };
}

export async function initAdapter() {
  return initSchema();
}

export async function insert(record) {
  await initSchema();
  try {
    return withWrite(dbPath, async (db) => {
      const payloadJson = JSON.stringify({ recipients: record.recipients, payload: record.payload });
      db.run(
        `INSERT OR IGNORE INTO archive_claims (
          notification_key, type, circle_id, claimed_at, channel_sent,
          dm_member_sent, dm_leader_sent, channel_msg_id, channel_id, guild_id,
          payload_json, dead_letter, dead_letter_reason, dead_lettered_at
        ) VALUES (?, ?, ?, ?, 0, 0, 0, NULL, NULL, NULL, ?, 0, NULL, NULL)`,
        [record.notificationKey, record.type, record.circleId, new Date().toISOString(), payloadJson],
      );
      return { success: true, inserted: db.getRowsModified() > 0, notificationKey: record.notificationKey };
    });
  } catch (err) {
    return { success: false, inserted: false, error: 'ARCHIVE_INSERT_ERROR', message: err.message };
  }
}

export async function get(notificationKey) {
  await initSchema();
  try {
    return withRead(dbPath, async (db) => {
      const row = queryOne(db, `SELECT * FROM archive_claims WHERE notification_key = ?`, [notificationKey]);
      return { record: hydrate(row) };
    });
  } catch (err) {
    return { record: null, error: 'ARCHIVE_GET_ERROR', message: err.message };
  }
}

export async function getIncomplete(circleId = null) {
  await initSchema();
  try {
    return withRead(dbPath, async (db) => {
      const rows = circleId == null
        ? queryAll(
            db,
            `SELECT * FROM archive_claims
             WHERE dead_letter = 0 AND (channel_sent = 0 OR dm_member_sent = 0 OR dm_leader_sent = 0)
             ORDER BY claimed_at DESC`,
          )
        : queryAll(
            db,
            `SELECT * FROM archive_claims
             WHERE circle_id = ? AND dead_letter = 0 AND (channel_sent = 0 OR dm_member_sent = 0 OR dm_leader_sent = 0)
             ORDER BY claimed_at DESC`,
            [circleId],
          );
      return { records: rows.map(hydrate) };
    });
  } catch (err) {
    return { records: [], error: 'ARCHIVE_INCOMPLETE_ERROR', message: err.message };
  }
}

async function setFlags(notificationKey, patch = {}) {
  await initSchema();
  try {
    return withWrite(dbPath, async (db) => {
      const existing = queryOne(db, `SELECT notification_key FROM archive_claims WHERE notification_key = ?`, [notificationKey]);
      if (!existing) {
        return { success: false, error: 'ARCHIVE_NOT_FOUND', message: `No record for key=${notificationKey}` };
      }
      const sets = [];
      const params = [];
      for (const [column, value] of Object.entries(patch)) {
        sets.push(`${column} = ?`);
        params.push(value);
      }
      params.push(notificationKey);
      db.run(`UPDATE archive_claims SET ${sets.join(', ')} WHERE notification_key = ?`, params);
      return { success: true };
    });
  } catch (err) {
    return { success: false, error: 'ARCHIVE_FLAG_ERROR', message: err.message };
  }
}

export async function markChannelSent(notificationKey, { channelMsgId, channelId, guildId } = {}) {
  return setFlags(notificationKey, {
    channel_sent: 1,
    channel_msg_id: channelMsgId ?? null,
    channel_id: channelId ?? null,
    guild_id: guildId ?? null,
  });
}

export async function markDmMemberSent(notificationKey) {
  return setFlags(notificationKey, { dm_member_sent: 1 });
}

export async function markDmLeaderSent(notificationKey) {
  return setFlags(notificationKey, { dm_leader_sent: 1 });
}

export async function markDeadLetter(notificationKey, { reason, step, attemptCount } = {}) {
  await initSchema();
  try {
    return withWrite(dbPath, async (db) => {
      const existing = queryOne(db, `SELECT notification_key FROM archive_claims WHERE notification_key = ?`, [notificationKey]);
      if (!existing) {
        return { success: false, error: 'ARCHIVE_NOT_FOUND', message: `No record for key=${notificationKey}` };
      }
      const deadLetteredAt = new Date().toISOString();
      db.run(
        `UPDATE archive_claims
         SET dead_letter = 1, dead_letter_reason = ?, dead_lettered_at = ?
         WHERE notification_key = ?`,
        [reason ?? null, deadLetteredAt, notificationKey],
      );
      db.run(
        `INSERT INTO archive_history (notification_key, step, outcome, discord_code, attempted_at, detail)
         VALUES (?, ?, 'dead_letter', NULL, ?, ?)`,
        [notificationKey, step ?? 'dead_letter', deadLetteredAt, JSON.stringify({ reason, attemptCount })],
      );
      return { success: true };
    });
  } catch (err) {
    return { success: false, error: 'ARCHIVE_DEAD_LETTER_ERROR', message: err.message };
  }
}

export async function replayDeadLetter(notificationKey) {
  await initSchema();
  try {
    return withWrite(dbPath, async (db) => {
      const existing = queryOne(db, `SELECT notification_key FROM archive_claims WHERE notification_key = ?`, [notificationKey]);
      if (!existing) {
        return { success: false, error: 'ARCHIVE_NOT_FOUND', message: `No record for key=${notificationKey}` };
      }
      const replayedAt = new Date().toISOString();
      db.run(
        `UPDATE archive_claims
         SET dead_letter = 0, dead_letter_reason = NULL, dead_lettered_at = NULL
         WHERE notification_key = ?`,
        [notificationKey],
      );
      db.run(
        `INSERT INTO archive_history (notification_key, step, outcome, discord_code, attempted_at, detail)
         VALUES (?, 'dead_letter_replay', 'success', NULL, ?, 'Replay requested')`,
        [notificationKey, replayedAt],
      );
      return { success: true, notificationKey };
    });
  } catch (err) {
    return { success: false, error: 'ARCHIVE_REPLAY_ERROR', message: err.message };
  }
}

export async function listDeadLetters({ circleId = null, limit = 10 } = {}) {
  await initSchema();
  try {
    return withRead(dbPath, async (db) => {
      const rows = circleId == null
        ? queryAll(
            db,
            `SELECT * FROM archive_claims
             WHERE dead_letter = 1
             ORDER BY dead_lettered_at DESC
             LIMIT ?`,
            [limit],
          )
        : queryAll(
            db,
            `SELECT * FROM archive_claims
             WHERE dead_letter = 1 AND circle_id = ?
             ORDER BY dead_lettered_at DESC
             LIMIT ?`,
            [circleId, limit],
          );
      return { success: true, records: rows.map(hydrate) };
    });
  } catch (err) {
    return { success: false, records: [], error: 'ARCHIVE_LIST_DEAD_LETTERS_ERROR', message: err.message };
  }
}

export async function recordHistory(notificationKey, { step, outcome, discordCode, detail } = {}) {
  await initSchema();
  try {
    return withWrite(dbPath, async (db) => {
      db.run(
        `INSERT INTO archive_history (notification_key, step, outcome, discord_code, attempted_at, detail)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [notificationKey, step, outcome, discordCode ?? null, new Date().toISOString(), detail ?? null],
      );
      return { success: true };
    });
  } catch (err) {
    return { success: false, error: 'ARCHIVE_HISTORY_ERROR', message: err.message };
  }
}

export async function getHistory(notificationKey) {
  await initSchema();
  try {
    return withRead(dbPath, async (db) => ({
      history: queryAll(
        db,
        `SELECT id, notification_key AS notificationKey, step, outcome, discord_code AS discordCode, attempted_at AS attemptedAt, detail
         FROM archive_history
         WHERE notification_key = ?
         ORDER BY attempted_at DESC`,
        [notificationKey],
      ),
    }));
  } catch (err) {
    return { history: [], error: 'ARCHIVE_HISTORY_READ_ERROR', message: err.message };
  }
}

export async function getAttemptSummary(notificationKey) {
  const historyResult = await getHistory(notificationKey);
  if (historyResult.error) return { ...historyResult, failureCount: 0 };
  const failureCount = historyResult.history.filter(row => row.outcome === 'failure').length;
  return { success: true, failureCount, history: historyResult.history };
}

export async function getStats() {
  await initSchema();
  try {
    return withRead(dbPath, async (db) => {
      const counts = queryOne(
        db,
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN channel_sent = 1 AND dm_member_sent = 1 AND dm_leader_sent = 1 THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN dead_letter = 0 AND (channel_sent = 0 OR dm_member_sent = 0 OR dm_leader_sent = 0) THEN 1 ELSE 0 END) AS incomplete,
           SUM(CASE WHEN dead_letter = 1 THEN 1 ELSE 0 END) AS dead_letters
         FROM archive_claims`,
      ) ?? {};
      const history = queryOne(db, `SELECT COUNT(*) AS history_entries FROM archive_history`) ?? {};
      return {
        success: true,
        total: Number(counts.total ?? 0),
        completed: Number(counts.completed ?? 0),
        incomplete: Number(counts.incomplete ?? 0),
        deadLetters: Number(counts.dead_letters ?? 0),
        historyEntries: Number(history.history_entries ?? 0),
      };
    });
  } catch (err) {
    return { success: false, error: 'ARCHIVE_STATS_ERROR', message: err.message };
  }
}

export async function prune({ olderThanDays } = {}) {
  await initSchema();
  try {
    return withWrite(dbPath, async (db) => {
      const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
      db.run(
        `DELETE FROM archive_claims
         WHERE claimed_at < ?
           AND ((channel_sent = 1 AND dm_member_sent = 1 AND dm_leader_sent = 1) OR dead_letter = 1)`,
        [cutoff],
      );
      return { success: true, pruned: db.getRowsModified() };
    });
  } catch (err) {
    return { success: false, error: 'ARCHIVE_PRUNE_ERROR', message: err.message };
  }
}

export { initAdapter as init };
