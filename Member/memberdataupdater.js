/**
 * /Member/memberdataupdater.js
 *
 * Called by the pipeline every time circle data is processed.
 * Uses the SAME circle API response the pipeline already fetched —
 * no extra API calls.  Writes per-member .md files with daily fan-gain
 * tables into /Member/active/ and /Member/inactive/.
 *
 * Integration:
 *   The pipeline imports this module and passes the raw circle result:
 *
 *     import { updateMemberDirectory } from '../../Member/memberdataupdater.js';
 *
 *     const circleResult = await Miner.fetchCircle(circleId);
 *     // ... normal pipeline processing ...
 *     await updateMemberDirectory(circleResult, {
 *       memberDir: path.join(process.cwd(), 'Member'),
 *     });
 *
 *     // Or with a simple call (infers Member/ dir from cwd):
 *     await updateMemberDirectory(circleResult);
 *
 * The pipeline knows what the Member directory needs:
 *   - circleResult.data.members[]  — the full member list
 *   - Each member.viewer_id, member.trainer_name, member.daily_fans
 *   - The pipeline passes whatever it already fetched
 *
 * LEFT detection:
 *   A member is considered LEFT when daily_fans has 3+ trailing zeros
 *   AND the last non-zero day is behind today by at least 3 days.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Config ──────────────────────────────────────────────────────────────────

const LEFT_THRESHOLD_DAYS = 3;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DOW_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isLeftMember(dailyFans, todayDay) {
  if (!Array.isArray(dailyFans)) return false;

  let lastNonZeroDay = -1;
  for (let i = 0; i < dailyFans.length; i++) {
    const v = Number(dailyFans[i]);
    if (Number.isFinite(v) && v > 0) lastNonZeroDay = i;
  }
  if (lastNonZeroDay < 0) return true;

  let trailingZeros = 0;
  for (let i = lastNonZeroDay + 1; i < dailyFans.length; i++) {
    if (Number(dailyFans[i]) <= 0) trailingZeros++;
    else break;
  }

  return trailingZeros > LEFT_THRESHOLD_DAYS && lastNonZeroDay < todayDay - LEFT_THRESHOLD_DAYS;
}

/**
 * Compute per-day gains from the cumulative daily_fans array.
 * Returns an array of { value, gain } for each day, or null for
 * slots with no valid data.
 */
function computeDailyGains(dailyFans) {
  const gains = [];
  let prev = null;

  for (let i = 0; i < 31; i++) {
    const val = i < dailyFans.length ? Number(dailyFans[i]) : 0;

    if (!Number.isFinite(val) || val <= 0) {
      gains.push({ value: 0, gain: null });
      prev = null;
    } else {
      const gain = (prev !== null && prev > 0) ? (val - prev) : null;
      gains.push({ value: val, gain });
      prev = val;
    }
  }

  return gains;
}

/**
 * Day-of-week index for July 1, 2026 = Wednesday (index 2 in Mon=0..Sun=6).
 *
 * Returns the DOW index (0–6) for a given day of the month.
 * This is based on a fixed offset; for a general solution, pass the
 * year/month and use new Date().
 */
function dowIndex(day, offset = 2) {
  return (day - 1 + offset) % 7;
}

/**
 * The first day of the current Monday-based week for a given day.
 * Dynamically computed from the month's DOW offset.
 *
 * @param {number} day      — day of month (1–31)
 * @param {number} dowOffset — DOW index for day 1 (0=Mon … 6=Sun)
 */
function getWeekStart(day, dowOffset) {
  if (day < 1) return 1;
  // Day 1.dowOffset <= Mon => days until Monday = (7 - dowOffset) % 7
  // But we want the Monday that is <= day
  // If day 1 is Wed (dowOffset=2), first Monday is day 1 + (7-2)%7 = day 6
  const firstMonday = 1 + ((7 - dowOffset) % 7);
  if (day < firstMonday) return 1;                               // before first Monday
  const weeksSince = Math.floor((day - firstMonday) / 7);
  return firstMonday + weeksSince * 7;
}

// ─── File writer ─────────────────────────────────────────────────────────────

/**
 * Write a single member .md file.
 *
 * @param {object} member — raw member object from the circle API
 * @param {string} dir    — absolute path to active/ or inactive/
 * @param {object} calendar — { year, monthIdx, todayDay, monthLabel }
 */
function writeMemberFile(member, dir, calendar) {
  const name    = String(member.trainer_name ?? member.name ?? 'Unknown').trim();
  const vid     = String(member.viewer_id ?? member.account_id ?? '');
  const df      = member.daily_fans ?? member.dailyFans ?? [];
  const isLeft  = isLeftMember(df, calendar.todayDay);
  const gains   = computeDailyGains(df);

  const safeName = name
    .replace(/[^a-zA-Z0-9_\- ]/g, '_')
    .replace(/\s+/g, '_');

  const filePath = path.join(dir, `${safeName}.md`);
  const lines = [];

  // ── Header ──
  lines.push(`# ${name}`);
  lines.push(`- **ID:** ${vid}`);
  lines.push(`- **Status:** ${isLeft ? 'LEFT' : 'Active'}`);
  lines.push('');
  lines.push(`## Daily Fan Gain — ${calendar.monthLabel} ${calendar.year}`);
  lines.push('');
  lines.push('| Date | Day | DOW | Total Fans | Daily Gain | 7-Day Gain | Monthly Gain |');
  lines.push('|------|-----|-----|-----------:|-----------:|-----------:|-------------:|');

  // Pre-compute gains for the month
  let monthlyCumulative = 0;
  const monthGainByDay = new Array(31).fill(null);

  for (let i = 0; i < 31; i++) {
    if (gains[i].gain !== null && gains[i].gain > 0) {
      monthlyCumulative += gains[i].gain;
    }
    monthGainByDay[i] = monthlyCumulative;
  }

  // ── Day rows ──
  for (let day = 1; day <= 31; day++) {
    const idx    = day - 1;
    const g      = gains[idx];
    const dow    = DOW_NAMES[dowIndex(day, calendar.dowOffset)];
    const future = day > calendar.todayDay;

    // Total Fans
    let totalStr;
    if (future) {
      totalStr = '—';
    } else if (g.value > 0) {
      totalStr = g.value.toLocaleString('en-US');
    } else {
      totalStr = '0';
    }

    // Daily Gain
    let dailyStr;
    if (future) {
      dailyStr = '—';
    } else if (g.gain !== null) {
      dailyStr = g.gain > 0 ? `+${g.gain.toLocaleString('en-US')}` :
                 g.gain === 0 ? '0' : g.gain.toLocaleString('en-US');
    } else {
      dailyStr = '—';
    }

    // 7-Day Gain (sum of daily gains since most recent Monday)
    let weeklyStr;
    if (future) {
      weeklyStr = '—';
    } else {
      const ws = getWeekStart(day, calendar.dowOffset);
      let wg = 0;
      let hasData = false;
      for (let d = ws - 1; d < day; d++) {
        if (gains[d].gain !== null && gains[d].gain > 0) {
          wg += gains[d].gain;
          hasData = true;
        }
      }
      if (hasData) {
        weeklyStr = `+${wg.toLocaleString('en-US')}`;
      } else if (dailyStr === '—') {
        weeklyStr = '—';
      } else {
        weeklyStr = '0';
      }
    }

    // Monthly Gain (cumulative since day 1)
    let monthlyStr;
    if (future) {
      monthlyStr = '—';
    } else if (monthGainByDay[idx] > 0) {
      monthlyStr = `+${monthGainByDay[idx].toLocaleString('en-US')}`;
    } else if (dailyStr === '—') {
      monthlyStr = '—';
    } else {
      monthlyStr = '0';
    }

    lines.push(`| ${calendar.monthLabel} ${day} | ${day} | ${dow} | ${totalStr} | ${dailyStr} | ${weeklyStr} | ${monthlyStr} |`);
  }

  // ── Summary ──
  lines.push('');
  if (!isLeft) {
    const activeDays = df.filter(v => Number.isFinite(v) && v > 0).length;
    let latestFans = 0;
    for (let i = df.length - 1; i >= 0; i--) {
      const v = Number(df[i]);
      if (Number.isFinite(v) && v > 0) { latestFans = v; break; }
    }
    let firstFans = 0;
    for (let i = 0; i < df.length; i++) {
      const v = Number(df[i]);
      if (Number.isFinite(v) && v > 0) { firstFans = v; break; }
    }
    const monthlyTotal = firstFans > 0 ? Math.max(0, latestFans - firstFans) : 0;
    lines.push(`**Active Days:** ${activeDays} | **Monthly Gain:** +${monthlyTotal.toLocaleString('en-US')} | **Latest Fans:** ${latestFans.toLocaleString('en-US')}`);
  } else {
    let lastActiveIdx = -1;
    for (let i = 0; i < df.length; i++) {
      const v = Number(df[i]);
      if (Number.isFinite(v) && v > 0) lastActiveIdx = i;
    }
    if (lastActiveIdx >= 0) {
      lines.push(`**LEFT** — Last active: ${calendar.monthLabel} ${lastActiveIdx + 1} | Last fans: ${Number(df[lastActiveIdx]).toLocaleString('en-US')}`);
    } else {
      lines.push('**LEFT** — No activity this month');
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return { name, vid, isLeft, filePath };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Update all member .md files from a circle API response.
 *
 * @param {object} circleResult — the raw Miner.circle API result, shape:
 *   { success: true, data: { members: [{ viewer_id, train_name, daily_fans }] } }
 * @param {object} [options]
 * @param {string} [options.memberDir] — absolute path to the Member/ directory
 * @param {Date}   [options.refDate]   — reference date for "today" (defaults to now)
 * @returns {{ success: boolean, active: number, inactive: number, errors: string[] }}
 */
export async function updateMemberDirectory(circleResult, options = {}) {
  const now = options.refDate ? new Date(options.refDate) : new Date();
  const year      = now.getFullYear();
  const monthIdx  = now.getMonth();        // 0–11
  const todayDay  = now.getDate();         // 1–31
  const monthLabel = MONTH_NAMES[monthIdx];

  // Day of week for the 1st of this month (0 = Mon … 6 = Sun)
  const firstOfMonth = new Date(year, monthIdx, 1);
  const dowOffset    = (firstOfMonth.getDay() + 6) % 7; // Sun=6→6, Mon=0→0, Tue=1→1...

  const calendar = { year, monthIdx, todayDay, monthLabel, dowOffset };

  // Resolve the Member directory
  const memberDir = options.memberDir
    ?? (options.memberDirRelative
      ? path.join(options.memberDirRelative, 'Member')
      : path.join(process.cwd(), 'Member'));

  const activeDir   = path.join(memberDir, 'active');
  const inactiveDir  = path.join(memberDir, 'inactive');
  const errors       = [];

  // Extract members from the circle result
  const members = circleResult?.data?.members
    ?? circleResult?.data?.circle?.members
    ?? circleResult?.members
    ?? [];

  if (!Array.isArray(members) || members.length === 0) {
    return { success: false, active: 0, inactive: 0, errors: ['No members in circle data'] };
  }

  // Ensure directories exist
  fs.mkdirSync(activeDir, { recursive: true });
  fs.mkdirSync(inactiveDir, { recursive: true });

  let activeCount   = 0;
  let inactiveCount = 0;

  for (const member of members) {
    try {
      const df       = member.daily_fans ?? member.dailyFans ?? [];
      const isLeft   = isLeftMember(df, calendar.todayDay);
      const targetDir = isLeft ? inactiveDir : activeDir;
      writeMemberFile(member, targetDir, calendar);
      if (isLeft) inactiveCount++;
      else activeCount++;
    } catch (err) {
      const name = member?.trainer_name ?? member?.name ?? 'unknown';
      errors.push(`${name}: ${err.message}`);
    }
  }

  // Clean up stale files (members no longer in the circle)
  try {
    const knownNames = new Set(
      members.map(m => {
        const n = String(m.trainer_name ?? m.name ?? '').trim();
        return n.replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_');
      }).filter(Boolean),
    );

    for (const subdir of [activeDir, inactiveDir]) {
      if (!fs.existsSync(subdir)) continue;
      for (const entry of fs.readdirSync(subdir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const baseName = entry.name.replace(/\.md$/, '');
        if (!knownNames.has(baseName)) {
          fs.rmSync(path.join(subdir, entry.name));
        }
      }
    }
  } catch (cleanupErr) {
    // Non-fatal — stale files may remain.
    errors.push(`cleanup: ${cleanupErr.message}`);
  }

  return {
    success:  errors.every(e => !e.startsWith('No members')),
    active:   activeCount,
    inactive: inactiveCount,
    errors,
  };
}

/**
 * Convenience: fetch + update in one call.
 * Requires Miner to be available at the given import path.
 *
 * @param {string} circleId     — uma.moe circle ID
 * @param {object} [options]    — same as updateMemberDirectory options
 * @param {object} [minerModule] — imported Miner (so the caller controls the import path)
 */
export async function fetchAndUpdate(circleId, options = {}, minerModule) {
  if (!minerModule || typeof minerModule.fetchCircle !== 'function') {
    return {
      success: false, active: 0, inactive: 0,
      errors: ['Miner module not provided — pass it as third argument'],
    };
  }

  const circleResult = await minerModule.fetchCircle(circleId);
  if (!circleResult?.success) {
    return {
      success: false, active: 0, inactive: 0,
      errors: [circleResult?.error ?? 'circle fetch failed'],
    };
  }

  return updateMemberDirectory(circleResult, options);
}

// ─── Export the circle data shape the pipeline needs to supply ──────────────

/**
 * Contract: the pipeline MUST pass a circleResult with this shape:
 *
 * {
 *   success: true,
 *   data: {
 *     members: [
 *       {
 *         viewer_id: "705081600362",
 *         trainer_name: "DaJuicyKEBAB",
 *         daily_fans: [248840000, 251563984, ...],  // 31 slots, cumulative
 *       },
 *       ...
 *     ]
 *   }
 * }
 *
 * The pipeline already fetches this from Miner.fetchCircle(circleId).
 * Just pass the result directly:
 *
 *   import { updateMemberDirectory } from '../../Member/memberdataupdater.js';
 *   await updateMemberDirectory(circleResult, { memberDir: path.resolve('./Member') });
 */
