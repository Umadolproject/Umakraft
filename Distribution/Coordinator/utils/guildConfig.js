// Distribution/Coordinator/utils/guildConfig.js
// Per-guild key-value configuration store.
//
// Table: guild_config (guild_id, key, value, updated_at)
// PK: (guild_id, key)
//
// Used by: timelineSetup, setFans, warningSettings

import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryAll, queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('guild_config');
let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS guild_config (
        guild_id   TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_gc_guild ON guild_config (guild_id);
    `);
    return { success: true };
  });
  return _initPromise;
}

/**
 * Get a single config value. Returns null if not set.
 */
export async function getConfig(guildId, key) {
  await init();
  return withRead(dbPath, (db) => {
    const row = queryOne(
      db,
      `SELECT value FROM guild_config WHERE guild_id = ? AND key = ?`,
      [guildId, key],
    );
    return row?.value ?? null;
  });
}

/**
 * Set a config value (upsert).
 */
export async function setConfig(guildId, key, value) {
  await init();
  const updatedAt = new Date().toISOString();
  return withWrite(dbPath, (db) => {
    db.run(
      `INSERT INTO guild_config (guild_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (guild_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [guildId, key, String(value), updatedAt],
    );
    return { success: true };
  });
}

/**
 * Get all config entries for a guild, optionally filtered by key prefix.
 * Returns a plain object: { key: value, ... }
 */
export async function getAllConfig(guildId, prefix = '') {
  await init();
  return withRead(dbPath, (db) => {
    const rows = prefix
      ? queryAll(db, `SELECT key, value FROM guild_config WHERE guild_id = ? AND key LIKE ?`, [guildId, `${prefix}%`])
      : queryAll(db, `SELECT key, value FROM guild_config WHERE guild_id = ?`, [guildId]);
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  });
}

/**
 * Delete a config key.
 */
export async function deleteConfig(guildId, key) {
  await init();
  return withWrite(dbPath, (db) => {
    db.run(`DELETE FROM guild_config WHERE guild_id = ? AND key = ?`, [guildId, key]);
    return { success: true };
  });
}