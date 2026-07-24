// Distribution/Coordinator/utils/memberLinks.js
// Persistence layer for Discord ↔ Uma.moe trainer links.
//
// Table: member_links (discord_id, guild_id, trainer_id, trainer_name, linked_at, join_date)
// Primary key: (discord_id, guild_id) — one trainer per member per guild.
//
// Uses the shared sql.js SQLite runtime (core/sqlite.js).

import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryAll, queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('member_links');
let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS member_links (
        discord_id   TEXT NOT NULL,
        guild_id     TEXT NOT NULL,
        trainer_id   TEXT NOT NULL,
        trainer_name TEXT NOT NULL,
        linked_at    TEXT NOT NULL,
        join_date    TEXT,
        PRIMARY KEY (discord_id, guild_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ml_guild      ON member_links (guild_id);
      CREATE INDEX IF NOT EXISTS idx_ml_trainer_id ON member_links (guild_id, trainer_id);
      CREATE INDEX IF NOT EXISTS idx_ml_trainer_nm ON member_links (guild_id, trainer_name COLLATE NOCASE);
    `);

    // Migrate: add join_date column if upgrading from an older schema
    try {
      db.run(`ALTER TABLE member_links ADD COLUMN join_date TEXT`);
    } catch {
      // Column already exists — safe to ignore
    }

    return { success: true };
  });
  return _initPromise;
}

// ─── Write operations ─────────────────────────────────────────────────────────

/**
 * Upsert a Discord ↔ trainer link.
 */
export async function upsertLink({ discordId, guildId, trainerId, trainerName }) {
  await init();
  const linkedAt = new Date().toISOString();
  return withWrite(dbPath, (db) => {
    db.run(
      `INSERT INTO member_links (discord_id, guild_id, trainer_id, trainer_name, linked_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (discord_id, guild_id) DO UPDATE SET
         trainer_id   = excluded.trainer_id,
         trainer_name = excluded.trainer_name,
         linked_at    = excluded.linked_at`,
      [discordId, guildId, trainerId, trainerName, linkedAt],
    );
    return { success: true, linkedAt };
  });
}

/**
 * Update a member's circle join date.
 * Returns { success } or { success: false, error: 'NOT_LINKED' }.
 */
export async function updateJoinDate(discordId, guildId, joinDate) {
  await init();
  return withWrite(dbPath, (db) => {
    const existing = queryOne(
      db,
      `SELECT discord_id FROM member_links WHERE discord_id = ? AND guild_id = ?`,
      [discordId, guildId],
    );
    if (!existing) return { success: false, error: 'NOT_LINKED' };
    db.run(
      `UPDATE member_links SET join_date = ? WHERE discord_id = ? AND guild_id = ?`,
      [joinDate, discordId, guildId],
    );
    return { success: true };
  });
}

/**
 * Remove a link. Returns { success, trainerName } or { success: false, error: 'NOT_LINKED' }.
 */
export async function removeLink(discordId, guildId) {
  await init();
  return withWrite(dbPath, (db) => {
    const existing = queryOne(
      db,
      `SELECT trainer_name FROM member_links WHERE discord_id = ? AND guild_id = ?`,
      [discordId, guildId],
    );
    if (!existing) return { success: false, error: 'NOT_LINKED' };
    db.run(
      `DELETE FROM member_links WHERE discord_id = ? AND guild_id = ?`,
      [discordId, guildId],
    );
    return { success: true, trainerName: existing.trainer_name };
  });
}

// ─── Read operations ──────────────────────────────────────────────────────────

function hydrateLink(row) {
  if (!row) return null;
  return {
    discordId:   row.discord_id,
    trainerId:   row.trainer_id,
    trainerName: row.trainer_name,
    linkedAt:    row.linked_at,
    joinDate:    row.join_date ?? null,
  };
}

/**
 * Look up a link by Discord user ID within a guild.
 */
export async function getLinkByDiscordId(discordId, guildId) {
  await init();
  return withRead(dbPath, (db) => {
    const row = queryOne(
      db,
      `SELECT discord_id, trainer_id, trainer_name, linked_at, join_date
       FROM member_links WHERE discord_id = ? AND guild_id = ?`,
      [discordId, guildId],
    );
    return hydrateLink(row);
  });
}

/**
 * Look up a link by trainer ID within a guild.
 */
export async function getLinkByTrainerId(trainerId, guildId) {
  await init();
  return withRead(dbPath, (db) => {
    const row = queryOne(
      db,
      `SELECT discord_id, trainer_id, trainer_name, linked_at, join_date
       FROM member_links WHERE trainer_id = ? AND guild_id = ?`,
      [trainerId, guildId],
    );
    return hydrateLink(row);
  });
}

/**
 * Look up a link by exact trainer name (case-insensitive) within a guild.
 */
export async function getLinkByTrainerName(trainerName, guildId) {
  await init();
  return withRead(dbPath, (db) => {
    const row = queryOne(
      db,
      `SELECT discord_id, trainer_id, trainer_name, linked_at, join_date
       FROM member_links WHERE guild_id = ? AND trainer_name = ? COLLATE NOCASE`,
      [guildId, trainerName],
    );
    return hydrateLink(row);
  });
}

/**
 * List all links for a guild, ordered by linked_at DESC.
 */
export async function listLinks(guildId, { limit = 20, offset = 0 } = {}) {
  await init();
  return withRead(dbPath, (db) => {
    const rows = queryAll(
      db,
      `SELECT discord_id, trainer_id, trainer_name, linked_at, join_date
       FROM member_links WHERE guild_id = ?
       ORDER BY linked_at DESC LIMIT ? OFFSET ?`,
      [guildId, limit, offset],
    );
    const total = queryOne(
      db,
      `SELECT COUNT(*) AS cnt FROM member_links WHERE guild_id = ?`,
      [guildId],
    );
    return { links: rows.map(hydrateLink), total: total?.cnt ?? 0 };
  });
}