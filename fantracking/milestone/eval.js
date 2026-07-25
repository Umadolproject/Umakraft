// fantracking/milestone/eval.js
// Milestone evaluation — determines if a trainer's fan gain crosses a tier.
//
// Rules:
//   - Daily:  highest tier crossed fires (1 message per trainer per day)
//   - Monthly: highest tier crossed fires (1 message per trainer per month)
//   - No duplicate fire — Archive check via `alreadyFired()` prevents repeats
//
// Authority: Broadcast/archive-inspector/archive-inspector.md
// Calls:     fantracking/milestone/tiers.js

import { DAILY_TIERS, MONTHLY_TIERS, resolveTier } from './tiers.js';
import log from '../../core/log.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a trainer's fan gain against the milestone tiers.
 * Returns the highest tier crossed, or null if none.
 *
 * @param {object} trainer
 * @param {string} trainer.trainerId
 * @param {string} trainer.trainerName
 * @param {number} trainer.dailyFanGain    — today's gain
 * @param {number} trainer.monthlyFanGain  — cumulative monthly gain
 * @param {string} trainer.circleId
 * @param {string} [trainer.circleName]
 * @returns {{ hit: boolean, daily: object|null, monthly: object|null }}
 */
export function evaluate(trainer) {
  const daily   = resolveTier(trainer.dailyFanGain,  'daily');
  const monthly = resolveTier(trainer.monthlyFanGain, 'monthly');

  const result = {
    hit:     !!(daily || monthly),
    daily:   daily   ? { ...daily,   trainerId: trainer.trainerId, trainerName: trainer.trainerName } : null,
    monthly: monthly ? { ...monthly, trainerId: trainer.trainerId, trainerName: trainer.trainerName } : null,
  };

  if (result.hit) {
    log.info(
      `[MilestoneEval] ${trainer.trainerName} ` +
      `daily=${daily?.label ?? 'none'} (${(trainer.dailyFanGain ?? 0).toLocaleString()}) ` +
      `monthly=${monthly?.label ?? 'none'} (${(trainer.monthlyFanGain ?? 0).toLocaleString()})`
    );
  }

  return result;
}

/**
 * Check if a specific milestone has already been fired for this trainer in this period.
 * Called by Archive-Inspector before announcing.
 *
 * @param {object} firedRecords  — list of existing milestone_fired records
 * @param {string} trainerId
 * @param {'daily'|'monthly'} type
 * @param {string} periodKey     — "YYYY-MM-DD" for daily, "YYYY-MM" for monthly
 * @returns {boolean}
 */
export function alreadyFired(firedRecords, trainerId, type, periodKey) {
  return firedRecords.some(r =>
    r.trainerId === trainerId &&
    r.type      === type      &&
    r.period    === periodKey
  );
}

/**
 * Generate the Archive claim key for a milestone notification.
 * Format: milestone:{circleId}:{trainerId}:{type}:{tierLabel}
 *
 * @param {string} circleId
 * @param {string} trainerId
 * @param {'daily'|'monthly'} type
 * @param {string} tierLabel
 * @returns {string}
 */
export function claimKey(circleId, trainerId, type, tierLabel) {
  return `milestone:${circleId}:${trainerId}:${type}:${tierLabel.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Get the period key for "already fired" checks.
 *
 * @param {'daily'|'monthly'} type
 * @returns {string}  "YYYY-MM-DD" or "YYYY-MM"
 */
export function periodKey(type) {
  const now = new Date();
  const y  = now.getFullYear();
  const m  = String(now.getMonth() + 1).padStart(2, '0');
  if (type === 'monthly') return `${y}-${m}`;
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
