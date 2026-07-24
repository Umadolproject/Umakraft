// Distribution/Coordinator/utils/trainerCards.js
// Trainer card persistence with 72-hour TTL and permanent-keep flag.
//
// Table: trainer_cards (trainer_id, name, fans, rank, white_skills, skills_json,
//                       stored_at, expires_at, kept)
//
// Used by: storeCard, keepCard, searchTrainer, adminSyncCards

import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryAll, queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('trainer_cards');
const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS trainer_cards (
        trainer_id  TEXT NOT NULL PRIMARY KEY,
        name        TEXT NOT NULL,
        fans        INTEGER NOT NULL DEFAULT 0,
        rank        INTEGER,
        white_skills INTEGER NOT NULL DEFAULT 0,
        skills_json TEXT NOT NULL DEFAULT '[]',
        stored_at   TEXT NOT NULL,
        expires_at  TEXT,
        kept        INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_tc_name ON trainer_cards (name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_tc_rank ON trainer_cards (rank);
      CREATE INDEX IF NOT EXISTS idx_tc_white ON trainer_cards (white_skills);
    `);
    return { success: true };
  });
  return _initPromise;
}

function hydrate(row) {
  if (!row) return null;
  return {
    trainerId:   row.trainer_id,
    name:        row.name,
    fans:        row.fans,
    rank:        row.rank,
    whiteSkills: row.white_skills,
    skills:      JSON.parse(row.skills_json ?? '[]'),
    storedAt:    row.stored_at,
    expiresAt:   row.expires_at,
    kept:        row.kept === 1,
  };
}

/**
 * Insert or update a trainer card. Sets a 72-hour expiry unless kept=true.
 *
 * @param {{ trainerId, name, fans, rank, whiteSkills, skills }} card
 */
export async function upsertCard(card) {
  await init();
  const storedAt  = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  return withWrite(dbPath, (db) => {
    // Preserve kept flag if record already exists
    const existing = queryOne(db, `SELECT kept FROM trainer_cards WHERE trainer_id = ?`, [card.trainerId]);
    const kept = existing?.kept ?? 0;
    const effectiveExpiry = kept ? null : expiresAt;

    db.run(
      `INSERT INTO trainer_cards (trainer_id, name, fans, rank, white_skills, skills_json, stored_at, expires_at, kept)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (trainer_id) DO UPDATE SET
         name        = excluded.name,
         fans        = excluded.fans,
         rank        = excluded.rank,
         white_skills = excluded.white_skills,
         skills_json = excluded.skills_json,
         stored_at   = excluded.stored_at,
         expires_at  = CASE WHEN kept = 1 THEN NULL ELSE excluded.expires_at END`,
      [
        card.trainerId,
        card.name,
        card.fans    ?? 0,
        card.rank    ?? null,
        card.whiteSkills ?? 0,
        JSON.stringify(card.skills ?? []),
        storedAt,
        effectiveExpiry,
        kept,
      ],
    );
    return { success: true, storedAt, expiresAt: effectiveExpiry };
  });
}

/**
 * Get a card by trainer ID. Returns null if not found or expired.
 */
export async function getCard(trainerId) {
  await init();
  return withRead(dbPath, (db) => {
    const now = new Date().toISOString();
    const row = queryOne(
      db,
      `SELECT * FROM trainer_cards
       WHERE trainer_id = ?
         AND (kept = 1 OR expires_at IS NULL OR expires_at > ?)`,
      [trainerId, now],
    );
    return hydrate(row);
  });
}

/**
 * Mark a trainer card as permanently kept (removes expiry).
 * Returns { success, name } or { success: false, error: 'NOT_FOUND' }.
 */
export async function markKept(trainerId) {
  await init();
  return withWrite(dbPath, (db) => {
    const existing = queryOne(db, `SELECT name FROM trainer_cards WHERE trainer_id = ?`, [trainerId]);
    if (!existing) return { success: false, error: 'NOT_FOUND' };
    db.run(
      `UPDATE trainer_cards SET kept = 1, expires_at = NULL WHERE trainer_id = ?`,
      [trainerId],
    );
    return { success: true, name: existing.name };
  });
}

/**
 * Search trainer cards by optional name fragment, rank, or white skill count.
 *
 * @param {{ name?, rank?, whiteSkills?, limit? }} filters
 * @returns {{ results: Card[] }}
 */
export async function searchCards({ name, rank, whiteSkills, limit = 20 } = {}) {
  await init();
  return withRead(dbPath, (db) => {
    const now    = new Date().toISOString();
    const where  = [`(kept = 1 OR expires_at IS NULL OR expires_at > ?)`];
    const params = [now];

    if (name) {
      where.push(`name LIKE ? COLLATE NOCASE`);
      params.push(`%${name}%`);
    }
    if (rank != null) {
      where.push(`rank = ?`);
      params.push(rank);
    }
    if (whiteSkills != null) {
      where.push(`white_skills = ?`);
      params.push(whiteSkills);
    }

    const rows = queryAll(
      db,
      `SELECT * FROM trainer_cards
       WHERE ${where.join(' AND ')}
       ORDER BY stored_at DESC
       LIMIT ?`,
      [...params, limit],
    );
    return { results: rows.map(hydrate) };
  });
}

/**
 * Delete all expired, non-kept cards. Returns count of deleted rows.
 */
export async function purgeExpired() {
  await init();
  return withWrite(dbPath, (db) => {
    const now = new Date().toISOString();
    db.run(`DELETE FROM trainer_cards WHERE kept = 0 AND expires_at IS NOT NULL AND expires_at <= ?`, [now]);
    return { success: true, deleted: db.getRowsModified() };
  });
}