/**
 * /Member/memberReader.js
 *
 * Reads .md files from /Member/active/ and /Member/inactive/ — parses
 * the daily-gain table and summary line — and returns structured data.
 *
 * Used as a final fallback by fanGain and leaderboard when the pipeline
 * (Miner → Refiner → Compiler) errors out.  No API calls, no database;
 * just filesystem reads of the up-to-date .md files written by
 * memberdataupdater.js.
 *
 *    import { readMember, readAllActive, buildLeaderboardFromMembers } from '../Member/memberReader.js';
 */

import * as fs   from 'node:fs';
import * as path from 'node:path';

// ── Path resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the Member/ directory path. Tries, in order:
 *   1. The supplied root path
 *   2. process.cwd() + '/Member'
 *   3. '../Member' relative to this file
 */
function resolveMemberDir(rootDir) {
  if (rootDir) return rootDir;
  const cwd = path.join(process.cwd(), 'Member');
  if (fs.existsSync(cwd)) return cwd;
  // Fall back relative to this file
  const rel = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  if (fs.existsSync(rel)) return rel;
  return cwd; // best effort
}

// ── Parsers ─────────────────────────────────────────────────────────────────

const SUMMARY_RE = /^\*\*Active Days:\*\*\s*(\d+)\s*\|\s*\*\*Monthly Gain:\*\*\s*\+?([\d,]+)\s*\|\s*\*\*Latest Fans:\*\*\s*([\d,]+)/;
const LEFT_RE     = /^\*\*LEFT\*\*\s*—\s*Last active:\s*(\w+)\s*(\d+)\s*\|\s*Last fans:\s*([\d,]+)/;
const ID_RE       = /^\-\s*\*\*ID:\*\*\s*(\d+)/;
const STATUS_RE   = /^\-\s*\*\*Status:\*\*\s*(\w+)/;

// Table column indices (after splitting by '|')
const COL_DATE     = 1;
const COL_DAY      = 2;
const COL_TOTAL    = 4;
const COL_DAILY    = 5;
const COL_WEEKLY   = 6;
const COL_MONTHLY  = 7;

function parseNumber(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^0-9\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a gain cell from the member table.
 * Returns null for truly missing data ("—" / empty), 0 for literal zero,
 * and the numeric value otherwise (clamped to ≥0).
 * Callers can now distinguish "no data" (null) from "zero gain" (0).
 */
function parseGain(raw) {
  if (!raw || raw.trim() === '—') return null;       // truly unknown
  if (raw.trim() === '0') return 0;                   // literal zero
  const n = parseNumber(raw);
  if (n === null) return null;
  return Math.max(0, n);
}

/**
 * Parse a single .md file and return structured member data.
 *
 * Returns null if the file is unparseable.
 */
export function readMemberFile(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // ── Header ──
  const name = lines[0]?.replace(/^#\s*/, '').trim() ?? 'Unknown';

  let id = null;
  let status = 'Active';

  for (let i = 1; i < Math.min(lines.length, 10); i++) {
    const idMatch = lines[i].match(ID_RE);
    if (idMatch) { id = idMatch[1]; continue; }
    const stMatch = lines[i].match(STATUS_RE);
    if (stMatch) { status = stMatch[1]; continue; }
  }

  // ── Find today's row in the table ──
  const now = new Date();
  const todayDay = now.getDate(); // 1–31
  const todayRowMarker = new RegExp(`\\|\\s*\\w+\\s+${todayDay}\\s*\\|`);

  let todayGains = null;

  for (const line of lines) {
    if (!line.includes('|')) continue;
    if (!todayRowMarker.test(line)) continue;

    const cols = line.split('|').map(c => c.trim());
    todayGains = {
      totalFans:     parseNumber(cols[COL_TOTAL]),
      dailyGain:     parseGain(cols[COL_DAILY]),
      weeklyGain:    parseGain(cols[COL_WEEKLY]),
      monthlyGain:   parseGain(cols[COL_MONTHLY]),
    };
    break;
  }

  // ── Summary line ──
  let activeDays = null;
  let latestFans = null;
  let monthlyFromSummary = null;

  for (const line of lines) {
    const sm = line.match(SUMMARY_RE);
    if (sm) {
      activeDays        = parseInt(sm[1], 10);
      monthlyFromSummary = parseNumber(sm[2]);
      latestFans        = parseNumber(sm[3]);
      break;
    }
    const lm = line.match(LEFT_RE);
    if (lm) {
      latestFans = parseNumber(lm[3]);
      status = 'LEFT';
      break;
    }
  }

  return {
    name:        name || 'Unknown',
    id:          id || '',
    status:      status || 'Active',
    // From today's table row
    ...(todayGains ?? { totalFans: null, dailyGain: 0, weeklyGain: 0, monthlyGain: 0 }),
    // From summary
    activeDays:  activeDays,
    latestFans:  latestFans ?? todayGains?.totalFans,
    monthlyGain: todayGains?.monthlyGain ?? monthlyFromSummary ?? 0,
  };
}

/**
 * Read all active members from /Member/active/.
 *
 * @param {string} [rootDir] — overrides the Member/ directory path
 * @returns {Array<{name, id, status, totalFans, dailyGain, weeklyGain, monthlyGain}>}
 */
export function readAllActive(rootDir) {
  const memberDir = resolveMemberDir(rootDir);
  const activeDir = path.join(memberDir, 'active');
  if (!fs.existsSync(activeDir)) return [];

  const results = [];
  for (const entry of fs.readdirSync(activeDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const data = readMemberFile(path.join(activeDir, entry.name));
    if (data) results.push(data);
  }

  return results;
}

/**
 * Read all inactive (LEFT) members from /Member/inactive/.
 */
export function readAllInactive(rootDir) {
  const memberDir = resolveMemberDir(rootDir);
  const inactiveDir = path.join(memberDir, 'inactive');
  if (!fs.existsSync(inactiveDir)) return [];

  const results = [];
  for (const entry of fs.readdirSync(inactiveDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const data = readMemberFile(path.join(inactiveDir, entry.name));
    if (data) results.push(data);
  }

  return results;
}

/**
 * Find a specific member by name or ID across both active/ and inactive/.
 *
 * @param {string|number} lookup — trainer name or trainer ID
 * @returns {object|null}
 */
export function readMember(rootDir, lookup) {
  const memberDir = resolveMemberDir(rootDir);
  const target = String(lookup ?? '').trim().toLowerCase();
  if (!target) return null;

  // Check active first
  const activeDir = path.join(memberDir, 'active');
  if (fs.existsSync(activeDir)) {
    for (const entry of fs.readdirSync(activeDir)) {
      if (!entry.endsWith('.md')) continue;
      const data = readMemberFile(path.join(activeDir, entry));
      if (!data) continue;
      if (String(data.id ?? '').toLowerCase() === target) return data;
      if (data.name.toLowerCase() === target) return data;
      if (data.name.toLowerCase().includes(target)) return data;
    }
  }

  // Then inactive
  const inactiveDir = path.join(memberDir, 'inactive');
  if (fs.existsSync(inactiveDir)) {
    for (const entry of fs.readdirSync(inactiveDir)) {
      if (!entry.endsWith('.md')) continue;
      const data = readMemberFile(path.join(inactiveDir, entry));
      if (!data) continue;
      if (String(data.id ?? '').toLowerCase() === target) return data;
      if (data.name.toLowerCase() === target) return data;
      if (data.name.toLowerCase().includes(target)) return data;
    }
  }

  return null;
}

/**
 * Build a leaderboard from Member directory files — no API, no database.
 *
 * @param {object} options
 * @param {string} [options.memberDir]  — Member/ directory path
 * @param {string} [options.scope]      — 'daily' | 'weekly' | 'monthly' (default: 'daily')
 * @param {number} [options.top]        — top N (default: 10)
 * @returns {{ entries: Array, total: number, gainField: string }}
 */
export function buildLeaderboardFromMembers(options = {}) {
  const scope     = options.scope ?? 'daily';
  const top       = options.top  ?? 10;
  const allActive = readAllActive(options.memberDir);

  const gainField =
    scope === 'monthly' ? 'monthlyFanGain'
  : scope === 'weekly'  ? 'weeklyFanGain'
  :                        'dailyFanGain';

  const entries = allActive
    .map(m => ({
      id:             m.id,
      name:           m.name,
      totalFans:      m.totalFans,
      dailyFanGain:   m.dailyGain,
      weeklyFanGain:  m.weeklyGain,
      monthlyFanGain: m.monthlyGain,
      // Mark that this came from the Member directory
      source:         'member-directory',
    }))
    .sort((a, b) => (b[gainField] ?? 0) - (a[gainField] ?? 0))
    .slice(0, top);

  return {
    entries,
    total:     allActive.length,
    gainField,
  };
}
