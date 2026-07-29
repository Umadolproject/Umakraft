// fantracking/milestone/milestones.js
// Milestone detection, broadcast, fan_gain integration, and reset logic.
//
// Schedule: every 10 minutes (cron: */10 * * * *)
// Flow:     Fetch all trainers from Depot → evaluate against tiers →
//           generate AI message (with bank fallback) → dedup via Archive →
//           deliver via Announcer
//
// Daily tiers:  1M / 3M / 5M / 7M / 10M  (reset at midnight by periodKey)
// Monthly tiers: 10M → 100M (10 tiers)     (reset on 1st by periodKey)
//
// Message bank:  data/milestoneBank.json — separate from greeting bank.
//                Stores AI-generated messages per type+tier; recycled with
//                trainer name/fan count substitution when the AI is down.
//
// Authority: Broadcast/Announcer/task/milestone.md
// Calls:     AI/ContentGenerator.js, fantracking/milestone/tiers.js,
//            fantracking/milestone/eval.js, Refinery/Depot,
//            Broadcast/Archive, Broadcast/Announcer

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { retrieve, search } from '../../Refinery/Depot/depot.js';
import * as archive from '../../Broadcast/Archive/archive.js';
import { deliver } from '../../Broadcast/Announcer/announcer.js';
import { resolveTier, DAILY_TIERS, MONTHLY_TIERS } from './tiers.js';
import { alreadyFired, claimKey, periodKey } from './eval.js';
import * as botConfig from '../../core/botConfig.js';
import { createLogger } from '../../core/pipelineLogger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_PATH = join(__dirname, '..', '..', 'data', 'milestoneBank.json');
const MAX_BANK_SIZE = 20;

const logger = createLogger('milestone');

// ---------------------------------------------------------------------------
// Milestone message bank helpers (separate from greeting bank)
// Bank path:  /Umakraft/data/milestoneBank.json
// Structure:  { "daily": { "Legend": [msg1, ...], ... }, "monthly": { ... } }
// Cap:        20 messages per type+tier key
// ---------------------------------------------------------------------------

async function loadMilestoneBank() {
  try {
    const raw = await readFile(BANK_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Could not load milestone bank: ${err.message} — using empty bank`);
    return { daily: {}, monthly: {} };
  }
}

async function saveToMilestoneBank(type, tierLabel, message) {
  const bank = await loadMilestoneBank();
  const bucket = bank[type] ?? {};
  const slot = bucket[tierLabel] ?? [];

  if (slot.includes(message)) {
    logger.info(`Bank — duplicate "${type}/${tierLabel}" milestone skipped`);
    return;
  }

  slot.push(message);
  if (slot.length > MAX_BANK_SIZE) {
    slot.splice(0, slot.length - MAX_BANK_SIZE);
  }
  bucket[tierLabel] = slot;
  bank[type] = bucket;
  await writeFile(BANK_PATH, JSON.stringify(bank, null, 2), 'utf-8');
  logger.info(`Bank — saved "${type}/${tierLabel}" milestone (now ${slot.length}/${MAX_BANK_SIZE})`);
}

function randomFromMilestoneBank(bank, type, tierLabel) {
  const slot = bank[type]?.[tierLabel];
  if (!slot || slot.length === 0) return null;
  return slot[Math.floor(Math.random() * slot.length)];
}

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
 * Calls ContentGenerator for AI-generated celebration text with its own
 * message bank (data/milestoneBank.json) for fallback variety.
 *
 * @param {object} milestone
 * @param {string} circleId
 * @returns {Promise<object>}
 */
async function buildMilestonePayload(milestone, circleId) {
  const isDaily = milestone.type === 'daily';
  const period  = periodKey(milestone.type);
  const label   = isDaily
    ? `${milestone.emoji} ${milestone.label}`
    : `${milestone.emoji} ${milestone.label} (Tier ${milestone.tierNumber})`;

  let message;
  let source = 'unknown';

  // ── 1. Try AI generation ──────────────────────────────────────────────
  try {
    const { generate } = await import('../../AI/ContentGenerator.js');
    const result = await generate('milestone', {
      trainerName:    milestone.trainerName,
      milestoneValue: milestone.fanGain,
      milestoneType:  milestone.type,
      tierLabel:      milestone.label,
      tierNumber:     milestone.tierNumber ?? undefined,
    });

    if (result.usedFallback) {
      source = 'ai-fallback';
      message = result.message;
      logger.warn(
        `Milestone AI returned fallback for ${milestone.type}/${milestone.label} ` +
        `(attempts=${result.attempts}). Will try bank next.`
      );
    } else {
      source = 'ai';
      message = result.message;
      await saveToMilestoneBank(milestone.type, milestone.label, message).catch(err =>
        logger.warn(`Failed to save milestone to bank: ${err.message}`)
      );
    }
  } catch (err) {
    logger.error(`ContentGenerator crashed for milestone: ${err.message}`);
    source = 'crash';
    message = null;
  }

  // ── 2. If AI didn't produce fresh, try the bank ──────────────────────
  if (source !== 'ai') {
    const bank = await loadMilestoneBank();
    const banked = randomFromMilestoneBank(bank, milestone.type, milestone.label);

    if (banked) {
      // Substitute trainer name and fan count from the banked message
      // so the recycled message matches the current trainer.
      // Both patterns use global replace — trainer name may appear in
      // bold tags in multiple places (heading + closing line).
      const fanStr = Number(milestone.fanGain).toLocaleString();
      const oldNameMatch = banked.match(/\*\*([^*]+)\*\*/);

      let recycled = banked
        .replace(/\*\*([^*]+)\*\*/g, `**${milestone.trainerName}**`)
        .replace(/\b[\d,]{5,20}\b/g, fanStr);

      if (!oldNameMatch) {
        logger.warn(
          `Milestone bank substitution failed — no **name** pattern found ` +
          `in banked ${milestone.type}/${milestone.label} message`
        );
      }

      message = recycled;
      source  = 'bank';
      logger.info(
        `Bank — using stored ${milestone.type}/${milestone.label} message ` +
        `(bank size: ${bank[milestone.type]?.[milestone.label]?.length ?? 0}, ` +
        `substituted: **${milestone.trainerName}** / ${fanStr})`
      );
    } else {
      // Use the ContentGenerator fallback if available, or hardcoded safety net
      if (!message) {
        message = isDaily
          ? `**${milestone.trainerName}**~! You just hit **${milestone.fanGain.toLocaleString()} fans TODAY** — ${milestone.emoji} ${milestone.label} tier!! ✨ I've been watching you work so hard and my heart is just so full right now. Every single fan you earned today is proof of your dedication. Tomorrow is a brand new day, and I'll be right here cheering for you~! You're doing amazing. 💕`
          : `🏆 **${milestone.trainerName}**... **${milestone.label}** — **${milestone.fanGain.toLocaleString()} fans** this month${milestone.tierNumber != null ? `, Tier ${milestone.tierNumber} of 10` : ''}. 🥺 I've watched every step of this journey and I'm just overwhelmed with pride. Seeing everything you've built... you inspire me, you really do. Please take care of yourself too, okay? Next month is coming and I'll be cheering just as loud~ 💕`;
        source = 'safety';
      }
      logger.warn(`Milestone bank empty for ${milestone.type}/${milestone.label} — using ${source}`);
    }
  }

  logger.info(`Milestone message source=${source} type=${milestone.type} tier=${milestone.label}`);

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
  // Post to ANNOUNCEMENT_CHANNEL_ID for public milestone posts.
  // Fall back to OPS_CHANNEL_ID if announcement channel is not configured.
  const announcementChannel = botConfig.ANNOUNCEMENT_CHANNEL_ID || botConfig.OPS_CHANNEL_ID;
  const channels  = [announcementChannel].filter(Boolean);
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

      // ── 4. Build payload (async — calls AI) ─────────────────────────
      const payload = await buildMilestonePayload(hit, trainer.circleId);
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
