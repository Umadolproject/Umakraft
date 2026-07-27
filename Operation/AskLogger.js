// Operation/AskLogger.js
// Persistent question logger for the AI Knowledge Service.
// Writes every /ask and /ai question + metadata to an NDJSON log file.
// Format: one JSON object per line — append-only, no read+rewrite overhead.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
//
// Public API:
//   log(entry) → Promise<void>   — append a question entry to the log
//   stats()    → { totalEntries, filePath }
//   getRecent(limit) → Array     — read the most recent entries

import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import coreLog from '../core/log.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LOG_DIR = join(process.cwd(), 'data');
const LOG_FILE = join(LOG_DIR, 'ask-log.ndjson');
const MAX_RESPONSE_PREVIEW = 200; // characters — keep log readable
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — rotate if exceeded

// Track state
let _dirReady = false;
let _totalEntries = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a short unique ID from userId + timestamp + query */
function deriveEntryId(userId, query) {
  const raw = `${userId}::${Date.now()}::${query.slice(0, 80)}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

/** Ensure the log directory exists */
async function ensureDir() {
  if (_dirReady) return;
  await mkdir(LOG_DIR, { recursive: true });
  _dirReady = true;
}

/** Truncate a string to max length with ellipsis */
function truncate(str, max) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max - 3) + '...';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an AI question entry to the persistent NDJSON log.
 *
 * @param {{
 *   userId:          string,
 *   username?:       string,
 *   guildId?:        string,
 *   channelId?:      string,
 *   command:         string,        // '/ask' or '/ai explain', etc.
 *   subcommand:      string,
 *   query:           string,        // the user's actual question
 *   topic:           string,        // classification topic
 *   complexity?:     string,
 *   responsePreview?: string,       // first ~200 chars of the AI's answer
 *   citations?:      string[],      // sources cited
 *   success:         boolean,
 *   errorMessage?:   string,
 *   durationMs?:     number,
 * }} entry
 * @returns {Promise<void>}
 */
export async function log(entry) {
  await ensureDir();

  const record = {
    id:              deriveEntryId(entry.userId, entry.query),
    userId:          entry.userId,
    username:        entry.username ?? null,
    guildId:         entry.guildId ?? null,
    channelId:       entry.channelId ?? null,
    command:         entry.command,
    subcommand:      entry.subcommand,
    query:           entry.query,
    topic:           entry.topic,
    complexity:      entry.complexity ?? null,
    responsePreview: truncate(entry.responsePreview ?? '', MAX_RESPONSE_PREVIEW),
    citations:       (entry.citations ?? []).slice(0, 5),
    success:         entry.success,
    errorMessage:    entry.errorMessage ?? null,
    durationMs:      entry.durationMs ?? null,
    createdAt:       new Date().toISOString(),
  };

  try {
    // Warn if the log file is approaching the configured maximum size.
    // Rotation is not implemented yet, so this is an operator visibility aid.
    try {
      const info = await stat(LOG_FILE);
      if (info.size > MAX_FILE_SIZE) {
        coreLog.warn(`[Operation/AskLogger] Log file exceeds ${MAX_FILE_SIZE} bytes — consider rotating`);
      }
    } catch { /* file may not exist yet */ }

    const line = JSON.stringify(record) + '\n';
    await appendFile(LOG_FILE, line, 'utf8');
    _totalEntries += 1;

    coreLog.debug(
      `[Operation/AskLogger] Logged question id=${record.id} ` +
      `user=${record.userId} topic=${record.topic} success=${record.success}`
    );
  } catch (err) {
    coreLog.error(`[Operation/AskLogger] Failed to write entry: ${err.message}`);
  }
}

/**
 * Read the most recent N log entries.
 *
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
export async function getRecent(limit = 50) {
  try {
    // Read only the tail of the file — avoids loading the entire file into
    // memory when the log has grown large. Estimate ~200 bytes per line.
    const info = await stat(LOG_FILE);
    const estLineBytes = 200;
    const readStart = Math.max(0, info.size - (limit + 5) * estLineBytes);

    const buf = Buffer.alloc(info.size - readStart);
    const fh = await (await import('node:fs/promises')).open(LOG_FILE, 'r');
    await fh.read(buf, 0, buf.length, readStart);
    await fh.close();

    const raw = buf.toString('utf8');
    // Skip the first (possibly partial) line, then parse the rest
    const lines = raw.split('\n').filter(Boolean);
    if (readStart > 0 && lines.length > 0) lines.shift();
    return lines.slice(-limit).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Return log statistics.
 * @returns {{ totalEntries: number, filePath: string }}
 */
export function stats() {
  return { totalEntries: _totalEntries, filePath: LOG_FILE };
}
