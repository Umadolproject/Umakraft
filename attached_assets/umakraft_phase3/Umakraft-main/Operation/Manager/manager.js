// Operation/Manager/manager.js
// Evaluates OperationalLogEntry objects and emits a single HealthDecision.
// Routes Critical, Failed, and Investigation Required decisions to
// Broadcast/Announcer for Discord delivery.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      Operation/Manager/Manager.md
// Version:   2.0.0

import log from '../../core/log.js';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Tasks subject to Critical-level stale detection. All others default to Warning. */
const CORE_TASKS = new Set(['dataSync', 'milestones']);

/** withRetry max from core/errors.js — failures beyond this count are "Failed". */
const WITHRETRY_MAX = 3;

// ─── Decision severity ordering ───────────────────────────────────────────────

const SEVERITY = {
  'Healthy':                0,
  'Warning':                1,
  'Critical':               2,
  'Failed':                 3,
  'Investigation Required': 4,
};

/**
 * Return whichever decision has higher severity.
 *
 * @param {string} current
 * @param {string} candidate
 * @returns {string}
 */
function promote(current, candidate) {
  return (SEVERITY[candidate] ?? 0) > (SEVERITY[current] ?? 0) ? candidate : current;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluates a set of OperationalLogEntries and emits one HealthDecision.
 *
 * Decision thresholds (in descending priority):
 *   - consecutiveFailures > WITHRETRY_MAX            → Failed
 *   - consecutiveFailures >= 2                        → Critical
 *   - consecutiveFailures === 1                       → Warning
 *   - stale core task (dataSync, milestones)          → Critical
 *   - stale non-core task                             → Warning
 *   - memoryPressure                                  → Warning
 *   - no signals                                      → Healthy
 *
 * @param {object[]} entries  OperationalLogEntry[]
 * @returns {object}          HealthDecision
 *
 * @typedef {Object} HealthDecision
 * @property {Date}     decidedAt
 * @property {string}   decision          — 'Healthy' | 'Warning' | 'Critical' | 'Failed' | 'Investigation Required'
 * @property {string[]} affectedSubjects  — task names / circle ids that triggered the decision
 * @property {string}   summary           — human-readable one-line summary
 * @property {object[]} logEntries        — the OperationalLogEntry objects that led to this decision
 */
export function evaluate(entries) {
  const decidedAt = new Date();
  let decision = 'Healthy';
  const affectedSubjects = [];
  const reasons = [];

  for (const entry of entries) {
    const { stage, consecutiveFailures, status, meta } = entry;

    // ── Failed — exhausted all retries ───────────────────────────────────
    if (consecutiveFailures > WITHRETRY_MAX) {
      decision = promote(decision, 'Failed');
      _addSubject(affectedSubjects, stage);
      reasons.push(`${stage} has exhausted all retries (${consecutiveFailures} consecutive failures)`);
      continue; // higher severity found; skip lower-threshold checks for this entry
    }

    // ── Critical — ≥ 2 consecutive failures ──────────────────────────────
    if (consecutiveFailures >= 2) {
      decision = promote(decision, 'Critical');
      _addSubject(affectedSubjects, stage);
      reasons.push(`${stage} has ${consecutiveFailures} consecutive failures`);
      continue;
    }

    // ── Warning — 1 consecutive failure ──────────────────────────────────
    if (consecutiveFailures === 1) {
      decision = promote(decision, 'Warning');
      _addSubject(affectedSubjects, stage);
      reasons.push(`${stage} has 1 consecutive failure`);
    }

    // ── Stale detection ───────────────────────────────────────────────────
    const staleSince = meta?.staleSince ?? null;
    if (status === 'stale' || (staleSince !== null && staleSince > 0)) {
      const isCore = CORE_TASKS.has(stage);
      decision = promote(decision, isCore ? 'Critical' : 'Warning');
      _addSubject(affectedSubjects, stage);
      const staleSeconds = Math.round((staleSince ?? 0) / 1000);
      reasons.push(`${stage} is stale (${staleSeconds}s since last run)`);
    }

    // ── Memory pressure ───────────────────────────────────────────────────
    if (meta?.memoryPressure === true) {
      decision = promote(decision, 'Warning');
      _addSubject(affectedSubjects, stage);
      reasons.push(`${stage} has memory pressure`);
    }
  }

  const summary = reasons.length > 0
    ? reasons.join('; ')
    : 'All systems nominal';

  /** @type {HealthDecision} */
  const healthDecision = {
    decidedAt,
    decision,
    affectedSubjects: [...new Set(affectedSubjects)],
    summary,
    logEntries: entries,
  };

  // Emit logs and route escalations
  _route(healthDecision);

  return healthDecision;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/**
 * Log the health decision and, for actionable states, escalate to Announcer.
 *
 * | Decision               | Action                                   |
 * |------------------------|------------------------------------------|
 * | Healthy                | log.info only                            |
 * | Warning                | log.warn only                            |
 * | Critical               | log.error + Broadcast/Announcer          |
 * | Failed                 | log.error + Broadcast/Announcer          |
 * | Investigation Required | log.warn  + Broadcast/Announcer          |
 *
 * @param {object} healthDecision
 */
function _route(healthDecision) {
  const { decision, summary, affectedSubjects, decidedAt } = healthDecision;
  const tag = `[Operation/Manager] decision=${decision}`;

  switch (decision) {
    case 'Healthy':
      log.info(`${tag} — ${summary}`);
      break;
    case 'Warning':
    case 'Investigation Required':
      log.warn(`${tag} — ${summary}`);
      if (decision === 'Investigation Required') {
        _escalateToAnnouncer({ decision, summary, affectedSubjects, decidedAt });
      }
      break;
    case 'Critical':
    case 'Failed':
      log.error(`${tag} — ${summary}`);
      _escalateToAnnouncer({ decision, summary, affectedSubjects, decidedAt });
      break;
  }
}

/**
 * Fire-and-forget Discord alert via Broadcast/Announcer.
 * Uses dynamic import so Operation has no hard dependency on Broadcast at load time.
 * If the Discord client is not yet available, Announcer falls back to log-only.
 *
 * @param {{ decision: string, summary: string, affectedSubjects: string[], decidedAt: Date }} alert
 */
async function _escalateToAnnouncer(alert) {
  try {
    const { announceOperationAlert } = await import('../../Broadcast/Announcer/announcer.js');

    // Attempt to retrieve the live Discord client from the bot entry point.
    // If the bot hasn't started yet (e.g. during tests) this will fail safely.
    let client = null;
    try {
      const discordMod = await import('../../Distribution/Discord/index.js');
      client = discordMod.client ?? null;
    } catch {
      // Startup or test environment — Announcer will log-only
    }

    await announceOperationAlert(alert, client);
  } catch (err) {
    log.error(`[Operation/Manager] Failed to escalate to Announcer: ${err.message}`);
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function _addSubject(arr, subject) {
  if (!arr.includes(subject)) arr.push(subject);
}
