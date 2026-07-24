// Distribution/Coordinator/utils/trainerDb.js
// Local SQLite cache of Uma.moe trainer records.
//
// Table: trainers (trainer_id TEXT PRIMARY KEY, trainer_name TEXT NOT NULL, last_seen TEXT NOT NULL)
//
// Populated automatically:
//   - When autocomplete fetches results from the Uma.moe API
//   - After every successful /link operation
//
// Used by:
//   - autocomplete.js  — local-first suggestions (avoids live API latency)
//   - link.js          — name → ID resolution before hitting Uma.moe search
//   - resolveMember.js — fallback for commands that accept a trainer name directly
//
// Same SQLite runtime as member_links (core/sqlite.js, deferred flush).

import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryAll, queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('trainer_db');
let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS trainers (
        trainer_id   TEXT NOT NULL PRIMARY KEY,
        trainer_name TEXT NOT NULL,
        last_seen    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_trainer_name ON trainers (trainer_name COLLATE NOCASE);
    `);
    return { success: true };
  });
  return _initPromise;
}

// ─── Write operations ─────────────────────────────────────────────────────────

/**
 * Upsert a single trainer into the local cache.
 *
 * @param {string|number} trainerId
 * @param {string}        trainerName
 */
export async function upsertTrainer(trainerId, trainerName) {
  if (!trainerId || !trainerName) return;
  await init();
  const lastSeen = new Date().toISOString();
  return withWrite(dbPath, (db) => {
    db.run(
      `INSERT INTO trainers (trainer_id, trainer_name, last_seen)
       VALUES (?, ?, ?)
       ON CONFLICT (trainer_id) DO UPDATE SET
         trainer_name = excluded.trainer_name,
         last_seen    = excluded.last_seen`,
      [String(trainerId), String(trainerName), lastSeen],
    );
    return { success: true };
  });
}

/**
 * Bulk-upsert an array of trainer objects.
 *
 * @param {Array<{ id: string|number, name: string }>} trainers
 */
export async function upsertTrainers(trainers) {
  if (!trainers?.length) return;
  await init();
  const lastSeen = new Date().toISOString();
  return withWrite(dbPath, (db) => {
    for (const t of trainers) {
      if (!t?.id || !t?.name) continue;
      db.run(
        `INSERT INTO trainers (trainer_id, trainer_name, last_seen)
         VALUES (?, ?, ?)
         ON CONFLICT (trainer_id) DO UPDATE SET
           trainer_name = excluded.trainer_name,
           last_seen    = excluded.last_seen`,
        [String(t.id), String(t.name), lastSeen],
      );
    }
    return { success: true };
  });
}

// ─── Read operations ──────────────────────────────────────────────────────────

/**
 * Search trainers by name substring (case-insensitive LIKE).
 * Returns up to `limit` rows as `{ trainer_id, trainer_name }`.
 *
 * @param {string} query
 * @param {number} [limit=25]
 * @returns {Promise<Array<{ trainer_id: string, trainer_name: string }>>}
 */
export async function searchByName(query, limit = 25) {
  await init();
  // Escape special LIKE characters in the query so a literal % or _ works.
  const pattern = `%${query.replace(/[%_\\]/g, c => `\\${c}`)}%`;
  return withRead(dbPath, (db) =>
    queryAll(
      db,
      `SELECT trainer_id, trainer_name FROM trainers
       WHERE trainer_name LIKE ? ESCAPE '\\'
       ORDER BY
         CASE WHEN trainer_name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
         trainer_name COLLATE NOCASE
       LIMIT ?`,
      // Second bind puts prefix-matches first
      [pattern, `${query.replace(/[%_\\]/g, c => `\\${c}`)}%`, limit],
    ),
  );
}

/**
 * Exact (case-insensitive) name lookup.
 *
 * @param {string} name
 * @returns {Promise<{ trainer_id: string, trainer_name: string }|null>}
 */
export async function getByName(name) {
  await init();
  return withRead(dbPath, (db) =>
    queryOne(
      db,
      `SELECT trainer_id, trainer_name FROM trainers
       WHERE trainer_name = ? COLLATE NOCASE`,
      [name],
    ),
  );
}

/**
 * Look up a trainer by numeric ID.
 *
 * @param {string|number} trainerId
 * @returns {Promise<{ trainer_id: string, trainer_name: string }|null>}
 */
export async function getById(trainerId) {
  await init();
  return withRead(dbPath, (db) =>
    queryOne(
      db,
      `SELECT trainer_id, trainer_name FROM trainers WHERE trainer_id = ?`,
      [String(trainerId)],
    ),
  );
}
