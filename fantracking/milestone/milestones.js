// fantracking/milestone/milestones.js
// Milestone detection, broadcast, fan_gain integration, and reset logic.
//
// Schedule: every 10 minutes (cron: */10 * * * *)
// Flow:     Fetch all trainers from Depot → evaluate against tiers →
//           dedup via Archive → deliver via Announcer
//
// Daily tiers:  1M / 3M / 5M / 7M / 10M  (reset at midnight by periodKey)
// Monthly tiers: 10M → 100M (10 tiers)     (reset on 1st by periodKey)
//
// Authority: Broadcast/Announcer/task/milestone.md
// Calls:     fantracking/milestone/tiers.js, fantracking/milestone/eval.js,
//            Refinery/Depot, Broadcast/Archive, Broadcast/Announcer

import { retrieve, search } from '../../Refinery/Depot/depot.js';
import * as archive from '../../Broadcast/Archive/archive.js';
import { deliver } from '../../Broadcast/Announcer/announcer.js';
import { resolveTier, DAILY_TIERS, MONTHLY_TIERS } from './tiers.js';
import { alreadyFired, claimKey, periodKey } from './eval.js';
import * as botConfig from '../../core/botConfig.js';
import { createLogger } from '../../core/pipelineLogger.js';

const logger = createLogger('milestone');

// ---------------------------------------------------------------------------
// Reset logic — handled implicitly by periodKey
// ---------------------------------------------------------------------------
// Daily milestones use periodKey('daily') → "YYYY-MM-DD"
// Monthly milestones use periodKey('monthly') → "YYYY-MM"
//
// When the day changes, periodKey returns a new key → old Archive records
// are no longer matched by alreadyFired() → fresh round of daily milestones.
// Same for month rollover. No explicit reset function needed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fan-gain integration: fetch trainers from Depot
// ---------------------------------------------------------------------------

/**
 * Fetch all trainer compiled products from the Depot for milestone evaluation.
 *
 * Uses Depot.search() to find all stored trainer products, then extracts
 * dailyFanGain and monthlyFanGain for each.
 *
 * @returns {Promise<Array<{ trainerId: string, trainerName: string, dailyFanGain: number, monthlyFanGain: number, circleId: string, discordUserId: string|null }>>}
 */
async function fetchAllTrainers() {
  // Search Depot for all trainer products
  // Products are stored by trainer ID — we query for all products with
  // the compiled stats we need for milestone evaluation.
  const result = await search({}, {});

  if (!result?.products || result.products.length === 0) {
    logger.info('No trainer products in Depot — skipping milestone check');
    return [];
  }

  return result.products
    .map(p => {
      const cp = p.compiledProduct ?? {};
      return {
        trainerId:      cp.id        ?? p.id        ?? null,
        trainerName:    cp.name      ?? cp.id       ?? 'Unknown',
        dailyFanGain:   cp.dailyFanGain  ?? 0,
        monthlyFanGain: cp.monthlyFanGain ?? 0,
        circleId:       cp.circleId  ?? p.circleId ?? 'unknown',
        discordUserId:  cp.discordUserId ?? cp.userId ?? null,
      };
    })
    .filter(t => t.trainerId && (t.dailyFanGain > 0 || t.monthlyFanGain > 0));
}

// ---------------------------------------------------------------------------
// Milestone evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single trainer against all milestone tiers.
 * Returns the highest daily tier crossed and highest monthly tier crossed.
 *
 * @param {object} trainer
 * @returns {{ daily: object|null, monthly: object|null }}
 */
function evaluateTrainer(trainer) {
  const daily   = resolveTier(trainer.dailyFanGain,   'daily');
  const monthly = resolveTier(trainer.monthlyFanGain, 'monthly');

  const result = { daily: null, monthly: null };

  if (daily) {
    result.daily = {
      ...daily,
      trainerId:    trainer.trainerId,
      trainerName:  trainer.trainerName,
      circleId:     trainer.circleId,
      fanGain:      trainer.dailyFanGain,
      discordUserId: trainer.discordUserId,
    };
  }

  if (monthly) {
    result.monthly = {
      ...monthly,
      trainerId:    trainer.trainerId,
      trainerName:  trainer.trainerName,
      circleId:     trainer.circleId,
      fanGain:      trainer.monthlyFanGain,
      discordUserId: trainer.discordUserId,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Archive dedup check
// ---------------------------------------------------------------------------

/**
 * Check if a milestone notification has already been fired.
 * Fetches existing fired records from Archive.
 *
 * @param {string} circleId
 * @param {string} trainerId
 * @param {'daily'|'monthly'} type
 * @param {string} tierLabel
 * @returns {Promise<boolean>}
 */
async function isAlreadyFired(circleId, trainerId, type, tierLabel) {
  const key = claimKey(circleId, trainerId, type, tierLabel);
  const existing = await archive.get(key);
  return !!existing.record;
}

// ---------------------------------------------------------------------------
// Build milestone notification payload
// ---------------------------------------------------------------------------

/**
 * Build the Archive record payload for a milestone notification.
 *
 * @param {object} milestone  — { type, label, emoji, threshold, tierNumber, trainerId, trainerName, fanGain, circleId, discordUserId }
 * @param {string} circleId
 * @returns {object}
 */
function buildMilestonePayload(milestone, circleId) {
  const isDaily = milestone.type === 'daily';
  const period  = periodKey(milestone.type);
  const label   = isDaily
    ? `${milestone.emoji} ${milestone.label}`
    : `${milestone.emoji} ${milestone.label} (Tier ${milestone.tierNumber})`;

  const message = isDaily
    ? `**${milestone.trainerName}** hit **${milestone.fanGain.toLocaleString()} fans TODAY** — ${milestone.emoji} ${milestone.label} tier!`
    : `**${milestone.trainerName}** reached **${milestone.fanGain.toLocaleString()} fans THIS MONTH** — ${milestone.emoji} ${milestone.label}, Tier ${milestone.tierNumber} of 10!`;

  return {
    type:           'milestone',
    variant:        isDaily ? milestone.threshold : milestone.tierNumber,
    trainerId:      milestone.trainerId,
    trainerName:    milestone.trainerName,
    tier:           milestone.label,
    tierNumber:     milestone.tierNumber ?? null,
    milestoneType:  milestone.type,
    fanGain:        milestone.fanGain,
    threshold:      milestone.threshold,
    period,
    message,
    imageParams: {
      type:         'milestone',
      trainerName:  milestone.trainerName,
      tier:         milestone.label,
      tierEmoji:    milestone.emoji,
      milestoneType: milestone.type,
      fanGain:      milestone.fanGain,
      threshold:    milestone.threshold,
      tierNumber:   milestone.tierNumber ?? null,
      period,
    },
  };
}

// ---------------------------------------------------------------------------
// Resolve notification recipients
// ---------------------------------------------------------------------------

/**
 * Determine who should receive this milestone notification.
 *
 * @param {object} milestone
 * @param {string} circleId
 * @returns {{ channels: string[], memberDms: string[], leaderDm: string|null }}
 */
function resolveRecipients(milestone, circleId) {
  const channels  = [botConfig.OPS_CHANNEL_ID].filter(Boolean);
  const memberDms = milestone.discordUserId ? [milestone.discordUserId] : [];
  const leaderDm  = null; // circle leader DM (configurable later)

  return { channels, memberDms, leaderDm };
}

// ---------------------------------------------------------------------------
// Main milestone cycle
// ---------------------------------------------------------------------------

/**
 * Run the full milestone detection and broadcast cycle.
 * Called by tasks/index.js every 10 minutes.
 *
 * @param {object|null} client  — Discord.js Client
 */
export async function runMilestoneCycle(client) {
  logger.info('Milestone cycle starting');

  // ── 1. Fetch all trainers from Depot ────────────────────────────────────
  let trainers;
  try {
    trainers = await fetchAllTrainers();
  } catch (err) {
    logger.error(`Failed to fetch trainers from Depot: ${err.message}`);
    return;
  }

  if (trainers.length === 0) {
    logger.info('No trainers with gains to evaluate');
    return;
  }

  logger.info(`Evaluating ${trainers.length} trainer(s) for milestones`);

  let firedCount = 0;

  // ── 2. Evaluate each trainer ────────────────────────────────────────────
  for (const trainer of trainers) {
    const { daily, monthly } = evaluateTrainer(trainer);

    const hits = [daily, monthly].filter(Boolean);

    for (const hit of hits) {
      const key = claimKey(trainer.circleId, trainer.trainerId, hit.type, hit.label);

      // ── 3. Dedup check ────────────────────────────────────────────────
      try {
        const already = await isAlreadyFired(trainer.circleId, trainer.trainerId, hit.type, hit.label);
        if (already) {
          logger.debug(`Milestone already fired: ${key}`);
          continue;
        }
      } catch (err) {
        logger.warn(`Archive dedup check failed for ${key}: ${err.message}`);
        continue;
      }

      // ── 4. Build payload ──────────────────────────────────────────────
      const payload = buildMilestonePayload(hit, trainer.circleId);
      const recipients = resolveRecipients(hit, trainer.circleId);

      // ── 5. Write to Archive ───────────────────────────────────────────
      let insertResult;
      try {
        insertResult = await archive.insert({
          notificationKey: key,
          type:            'milestone',
          circleId:        trainer.circleId,
          recipients,
          payload,
        });
      } catch (err) {
        logger.error(`Archive insert failed for ${key}: ${err.message}`);
        continue;
      }

      if (!insertResult.success) {
        logger.warn(`Archive insert rejected for ${key}: ${insertResult.error}`);
        continue;
      }

      if (!insertResult.inserted) {
        logger.debug(`Milestone already claimed (insert dedup): ${key}`);
        continue;
      }

      logger.info(`Milestone fired: ${key} — ${payload.message}`);

      // ── 6. Deliver via Announcer ──────────────────────────────────────
      try {
        const record = await archive.get(key);
        if (record.record && client) {
          deliver(record.record, client).catch(err =>
            logger.error(`Announcer delivery failed for ${key}: ${err.message}`)
          );
        }
      } catch (err) {
        logger.error(`Announcer dispatch failed for ${key}: ${err.message}`);
      }

      firedCount++;
    }
  }

  logger.info(`Milestone cycle complete — ${firedCount} milestone(s) fired`);
}

// ---------------------------------------------------------------------------
// Force-reset helpers (for admin/debug use)
// ---------------------------------------------------------------------------

/**
 * Force-clear all milestone records for today's daily period.
 * Used for testing or admin reset.
 *
 * @param {string} circleId
 */
export async function resetDailyMilestones(circleId) {
  const today = periodKey('daily');
  logger.warn(`Force-resetting daily milestones for ${circleId} period=${today}`);
  // Archive records are keyed per trainer-tier, not batch-deletable.
  // Individual records age out naturally via the periodKey dedup check.
  // This is a placeholder for future Archive-level batch operations.
}

/**
 * Force-clear all milestone records for the current month.
 *
 * @param {string} circleId
 */
export async function resetMonthlyMilestones(circleId) {
  const month = periodKey('monthly');
  logger.warn(`Force-resetting monthly milestones for ${circleId} period=${month}`);
}
