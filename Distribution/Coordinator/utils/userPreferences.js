// Distribution/Coordinator/utils/userPreferences.js
// Per-user preference storage (timezone, etc.).
//
// Table: user_preferences (discord_id, guild_id, timezone, updated_at)
// PK: (discord_id, guild_id)
//
// Used by: setTimezone

import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('user_preferences');
let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        discord_id TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        timezone   TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (discord_id, guild_id)
      );
    `);
    return { success: true };
  });
  return _initPromise;
}

/**
 * Persist a user's IANA timezone. Creates or updates the record.
 */
export async function setTimezone(discordId, guildId, timezone) {
  await init();
  const updatedAt = new Date().toISOString();
  return withWrite(dbPath, (db) => {
    db.run(
      `INSERT INTO user_preferences (discord_id, guild_id, timezone, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (discord_id, guild_id) DO UPDATE SET
         timezone   = excluded.timezone,
         updated_at = excluded.updated_at`,
      [discordId, guildId, timezone, updatedAt],
    );
    return { success: true };
  });
}

/**
 * Get a user's stored timezone. Returns null if not set.
 */
export async function getTimezone(discordId, guildId) {
  await init();
  return withRead(dbPath, (db) => {
    const row = queryOne(
      db,
      `SELECT timezone FROM user_preferences WHERE discord_id = ? AND guild_id = ?`,
      [discordId, guildId],
    );
    return row?.timezone ?? null;
  });
}