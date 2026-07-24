import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryAll, queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('terminal');
let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, async (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS terminal_records (
        terminal_id TEXT PRIMARY KEY,
        blueprint_key TEXT NOT NULL,
        blueprint_name TEXT,
        trigger_json TEXT,
        type TEXT,
        png_base64 TEXT,
        meta_json TEXT,
        validated_at TEXT,
        fabricator_version TEXT,
        received_at TEXT NOT NULL,
        state TEXT NOT NULL,
        claimed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_terminal_state_received_at
        ON terminal_records (state, received_at DESC);
    `);
    return { success: true };
  });
  return _initPromise;
}

function hydrate(row) {
  if (!row) return null;
  return {
    terminalId: row.terminal_id,
    blueprintKey: row.blueprint_key,
    blueprintName: row.blueprint_name,
    trigger: row.trigger_json ? JSON.parse(row.trigger_json) : null,
    type: row.type,
    png: row.png_base64 ? Buffer.from(row.png_base64, 'base64') : null,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    validatedAt: row.validated_at,
    fabricatorVersion: row.fabricator_version,
    receivedAt: row.received_at,
    state: row.state,
    claimedAt: row.claimed_at,
  };
}

export async function put(record) {
  await init();
  try {
    return withWrite(dbPath, async (db) => {
      db.run(
        `INSERT OR REPLACE INTO terminal_records (
          terminal_id, blueprint_key, blueprint_name, trigger_json, type,
          png_base64, meta_json, validated_at, fabricator_version,
          received_at, state, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.terminalId,
          record.blueprintKey,
          record.blueprintName ?? null,
          record.trigger ? JSON.stringify(record.trigger) : null,
          record.type ?? null,
          record.png ? Buffer.from(record.png).toString('base64') : null,
          record.meta ? JSON.stringify(record.meta) : null,
          record.validatedAt ?? null,
          record.fabricatorVersion ?? null,
          record.receivedAt,
          record.state,
          record.claimedAt ?? null,
        ],
      );
      return { success: true };
    });
  } catch (err) {
    return { success: false, error: 'TERMINAL_PUT_ERROR', message: err.message };
  }
}

export async function get(terminalId) {
  await init();
  try {
    return withRead(dbPath, async (db) => {
      const row = queryOne(
        db,
        `SELECT * FROM terminal_records WHERE terminal_id = ?`,
        [terminalId],
      );
      return { record: hydrate(row) };
    });
  } catch (err) {
    return { record: null, error: 'TERMINAL_GET_ERROR', message: err.message };
  }
}

export async function list(filter = {}) {
  await init();
  try {
    return withRead(dbPath, async (db) => {
      const where = [];
      const params = [];
      if (filter.blueprintKey) {
        where.push('blueprint_key = ?');
        params.push(filter.blueprintKey);
      }
      if (filter.type) {
        where.push('type = ?');
        params.push(filter.type);
      }
      if (filter.state) {
        where.push('state = ?');
        params.push(filter.state);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = queryAll(
        db,
        `SELECT * FROM terminal_records ${whereSql} ORDER BY received_at DESC`,
        params,
      );
      return { results: rows.map(hydrate) };
    });
  } catch (err) {
    return { results: [], error: 'TERMINAL_LIST_ERROR', message: err.message };
  }
}

export async function del(terminalId) {
  await init();
  try {
    return withWrite(dbPath, async (db) => {
      db.run(`DELETE FROM terminal_records WHERE terminal_id = ?`, [terminalId]);
      return db.getRowsModified() > 0
        ? { success: true }
        : { success: false, error: 'TERMINAL_NOT_FOUND', message: `No record for terminalId=${terminalId}` };
    });
  } catch (err) {
    return { success: false, error: 'TERMINAL_DEL_ERROR', message: err.message };
  }
}
