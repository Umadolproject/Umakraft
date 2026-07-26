// fantracking/achievements/achievements.js
// Achievement detection, AI message generation, and broadcast pipeline.
//
// Schedule: every 15 minutes (cron: */15 * * * *)
// Flow:     Fetch all trainers from Depot → evaluate against achievement
//           thresholds (fan, sync, streak) → generate AI message (with
//           bank fallback) → dedup via Archive → deliver via Announcer
//
// Categories (from AI/prompts/Achievement.md):
//   Fan:    1M / 5M / 10M daily fan gain
//   Sync:   1 / 10 / 50 / 100 syncs
//   Streak: 7 / 30 / 90 day streak
//   Rank:   Top 100 / 50 / 10 / #1 (future — needs rank data)
//   Circle: circle rank up / defended (future — needs circle data)
//
// Message bank:  data/achievementBank.json — separate from greeting
//                and milestone banks. Keyed by category → achievementTitle.
//                Recycled with trainer name substitution.
//
// Authority:  AI/prompts/Achievement.md
// Calls:      AI/ContentGenerator.js, Refinery/Depot, Broadcast/Archive,
//             Broadcast/Announcer

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { search } from '../../Refinery/Depot/depot.js';
import * as archive from '../../Broadcast/Archive/archive.js';
import { deliver } from '../../Broadcast/Announcer/announcer.js';
import * as botConfig from '../../core/botConfig.js';
import { createLogger } from '../../core/pipelineLogger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_PATH     = join(__dirname, '..', '..', 'data', 'achievementBank.json');
const MAX_BANK_SIZE = 20;

const logger = createLogger('achievement');

// ---------------------------------------------------------------------------
// Achievement registry — defines what achievements exist and how to detect
// ---------------------------------------------------------------------------

const ACHIEVEMENTS = {
  fan: [
    { title: 'Fan Collector',   threshold: 1_000_000, emoji: '📦', description: 'Stacking fans like it\'s a hobby' },
    { title: 'Fan Magnate',     threshold: 5_000_000, emoji: '💰', description: 'Fans collect around you now' },
    { title: 'Millionaire Club', threshold: 10_000_000, emoji: '🏦', description: 'Ten million in one day — a statement' },
  ],
  sync: [
    { title: 'First Sync',    threshold: 1,   emoji: '🍼', description: 'Welcome to the grind' },
    { title: 'Sync Soldier',  threshold: 10,  emoji: '🫡', description: 'Consistent and reliable' },
    { title: 'Sync Veteran',  threshold: 50,  emoji: '🎖️', description: 'You\'ve synced things. Respect.' },
    { title: 'Sync Legend',   threshold: 100, emoji: '👴', description: 'The elders speak of your streak' },
  ],
  streak: [
    { title: 'Consistency King', threshold: 7,  emoji: '📅', description: 'A week of showing up' },
    { title: 'Monthly Machine',  threshold: 30, emoji: '🤖', description: 'Thirty days without missing a beat' },
    { title: 'Unbreakable',      threshold: 90, emoji: '🛡️', description: 'The streak is your identity' },
  ],
};

// ---------------------------------------------------------------------------
// Achievement message bank helpers (separate from greeting & milestone banks)
// Bank:  /Umakraft/data/achievementBank.json
// Keys:  category → achievementTitle → [messages]
// Cap:   20 per category+tier key
// ---------------------------------------------------------------------------

async function loadAchievementBank() {
  try {
    const raw = await readFile(BANK_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Could not load achievement bank: ${err.message} — using empty bank`);
    return { fan: {}, sync: {}, rank: {}, streak: {}, circle: {} };
  }
}

async function saveToAchievementBank(category, achievementTitle, message) {
  const bank   = await loadAchievementBank();
  const bucket = bank[category] ?? {};
  const slot   = bucket[achievementTitle] ?? [];

  // Duplicate detection: exact string match
  if (slot.includes(message)) {
    logger.info(`Bank — duplicate "${category}/${achievementTitle}" achievement skipped`);
    return;
  }

  slot.push(message);
  if (slot.length > MAX_BANK_SIZE) {
    slot.splice(0, slot.length - MAX_BANK_SIZE);
  }
  bucket[achievementTitle] = slot;
  bank[category] = bucket;
  await writeFile(BANK_PATH, JSON.stringify(bank, null, 2), 'utf-8');
  logger.info(
    `Bank — saved "${category}/${achievementTitle}" achievement (now ${slot.length}/${MAX_BANK_SIZE})`
  );
}

function randomFromAchievementBank(bank, category, achievementTitle) {
  const slot = bank[category]?.[achievementTitle];
  if (!slot || slot.length === 0) return null;
  return slot[Math.floor(Math.random() * slot.length)];
}

// ---------------------------------------------------------------------------
// Trainer data fetching — same Depot query as milestones
// ---------------------------------------------------------------------------

async function fetchAllTrainers() {
  const result = await search({}, {});

  if (!result?.products || result.products.length === 0) {
    logger.info('No trainer products in Depot — skipping achievement check');
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
        syncCount:      cp.syncCount     ?? cp.syncs ?? 0,
        streakDays:     cp.streakDays    ?? cp.streak ?? 0,
        circleId:       cp.circleId  ?? p.circleId ?? 'unknown',
        discordUserId:  cp.discordUserId ?? cp.userId ?? null,
      };
    })
    .filter(t => t.trainerId);
}

// ---------------------------------------------------------------------------
// Achievement evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single trainer against all achievement definitions.
 * Returns a flat list of achievements earned.
 *
 * @param {object} trainer
 * @returns {Array<{ category: string, title: string, emoji: string, description: string, threshold: number, value: number }>}
 */
function evaluateTrainer(trainer) {
  const earned = [];

  for (const [category, tiers] of Object.entries(ACHIEVEMENTS)) {
    // Determine which stat to compare against
    let statValue;
    switch (category) {
      case 'fan':    statValue = trainer.dailyFanGain; break;
      case 'sync':   statValue = trainer.syncCount;    break;
      case 'streak': statValue = trainer.streakDays;   break;
      default: continue;
    }

    if (!statValue) continue;

    // Only the highest threshold crossed fires per category
    let best = null;
    for (const tier of tiers) {
      if (statValue >= tier.threshold) best = tier;
    }

    if (best) {
      earned.push({
        category:    category,
        title:       best.title,
        emoji:       best.emoji,
        description: best.description,
        threshold:   best.threshold,
        value:       statValue,
      });
    }
  }

  return earned;
}

// ---------------------------------------------------------------------------
// Dedup key
// ---------------------------------------------------------------------------

/**
 * Archive claim key for achievement notifications.
 * Format: achievement:{circleId}:{trainerId}:{category}:{title}
 * No auto-reset — each achievement fires once ever (lifetime).
 */
function achievementClaimKey(circleId, trainerId, category, title) {
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  return `achievement:${circleId}:${trainerId}:${category}:${slug}`;
}

// ---------------------------------------------------------------------------
// Build achievement notification payload
// ---------------------------------------------------------------------------

/**
 * Build the Archive record payload for an achievement notification.
 * Calls ContentGenerator for AI-generated text. Falls back to a
 * category-specific bank then a hardcoded safety net.
 *
 * @param {object} ach      — { category, title, emoji, description, threshold, value }
 * @param {object} trainer  — { trainerName, circleId, discordUserId }
 * @returns {Promise<object>}
 */
async function buildAchievementPayload(ach, trainer) {
  let message;
  let source = 'unknown';

  // ── 1. Try AI generation ──────────────────────────────────────────────
  try {
    const { generate } = await import('../../AI/ContentGenerator.js');
    const result = await generate('achievement', {
      trainerName:     trainer.trainerName,
      achievementName: ach.title,
      description:     ach.description,
    });

    if (result.usedFallback) {
      source = 'ai-fallback';
      message = result.message;
      logger.warn(
        `Achievement AI returned fallback for ${ach.category}/${ach.title} ` +
        `(attempts=${result.attempts}). Will try bank next.`
      );
    } else {
      source = 'ai';
      message = result.message;
      await saveToAchievementBank(ach.category, ach.title, message).catch(err =>
        logger.warn(`Failed to save achievement to bank: ${err.message}`)
      );
    }
  } catch (err) {
    logger.error(`ContentGenerator crashed for achievement: ${err.message}`);
    source = 'crash';
    message = null;
  }

  // ── 2. If AI didn't produce fresh, try the bank ──────────────────────
  if (source !== 'ai') {
    const bank   = await loadAchievementBank();
    const banked = randomFromAchievementBank(bank, ach.category, ach.title);

    if (banked) {
      // Substitute trainer name — use global replace for all **name** occurrences
      const oldNameMatch = banked.match(/\*\*([^*]+)\*\*/);
      let recycled = banked.replace(/\*\*([^*]+)\*\*/g, `**${trainer.trainerName}**`);

      if (!oldNameMatch) {
        logger.warn(
          `Achievement bank substitution failed — no **name** pattern found ` +
          `in banked ${ach.category}/${ach.title} message`
        );
      }

      message = recycled;
      source  = 'bank';
      const bankSize = bank[ach.category]?.[ach.title]?.length ?? 0;
      logger.info(
        `Bank — using stored ${ach.category}/${ach.title} achievement ` +
        `(bank size: ${bankSize}, substituted: **${trainer.trainerName}**)`
      );
    } else {
      // Use ContentGenerator fallback if available, or hardcoded safety net
      if (!message) {
        message =
          `${ach.emoji} ACHIEVEMENT UNLOCKED~!! **${trainer.trainerName}** just earned **${ach.title}** ` +
          `and I am BURSTING with pride right now!! ✨ ${ach.description}. ` +
          `I've been watching since day one, and seeing this moment... waaah, my heart is so full. 🥺 ` +
          `Don't you DARE forget your #1 fan, okay?! I was here first and I'm here forever~ 💕`;
        source = 'safety';
      }
      logger.warn(
        `Achievement bank empty for ${ach.category}/${ach.title} — using ${source}`
      );
    }
  }

  logger.info(
    `Achievement message source=${source} category=${ach.category} title=${ach.title}`
  );

  return {
    type:       'achievement',
    variant:    ach.title,
    trainerId:  trainer.trainerId,
    trainerName: trainer.trainerName,
    category:   ach.category,
    achievementTitle: ach.title,
    emoji:      ach.emoji,
    value:      ach.value,
    threshold:  ach.threshold,
    message,
    imageParams: {
      type:             'achievement',
      trainerName:      trainer.trainerName,
      achievementTitle: ach.title,
      category:         ach.category,
      emoji:            ach.emoji,
    },
  };
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

function resolveRecipients(trainer) {
  const channels  = [botConfig.OPS_CHANNEL_ID].filter(Boolean);
  const memberDms = trainer.discordUserId ? [trainer.discordUserId] : [];
  return { channels, memberDms, leaderDm: null };
}

// ---------------------------------------------------------------------------
// Main achievement cycle
// ---------------------------------------------------------------------------

/**
 * Run the full achievement detection and broadcast cycle.
 * Called by tasks/index.js every 15 minutes.
 *
 * @param {object|null} client  — Discord.js Client
 */
export async function runAchievementCycle(client) {
  logger.info('Achievement cycle starting');

  // ── 1. Fetch all trainers from Depot ────────────────────────────────────
  let trainers;
  try {
    trainers = await fetchAllTrainers();
  } catch (err) {
    logger.error(`Failed to fetch trainers from Depot: ${err.message}`);
    return;
  }

  if (trainers.length === 0) {
    logger.info('No trainers to evaluate for achievements');
    return;
  }

  logger.info(`Evaluating ${trainers.length} trainer(s) for achievements`);

  let firedCount = 0;

  // ── 2. Evaluate each trainer ────────────────────────────────────────────
  for (const trainer of trainers) {
    const earned = evaluateTrainer(trainer);

    for (const ach of earned) {
      const key = achievementClaimKey(trainer.circleId, trainer.trainerId, ach.category, ach.title);

      // ── 3. Lifetime dedup — each achievement fires once ever ──────────
      try {
        const existing = await archive.get(key);
        if (existing.record) {
          logger.debug(`Achievement already fired (lifetime): ${key}`);
          continue;
        }
      } catch (err) {
        logger.warn(`Archive dedup check failed for ${key}: ${err.message}`);
        continue;
      }

      // ── 4. Build payload (async — calls AI) ─────────────────────────
      const payload    = await buildAchievementPayload(ach, trainer);
      const recipients = resolveRecipients(trainer);

      // ── 5. Write to Archive ─────────────────────────────────────────
      let insertResult;
      try {
        insertResult = await archive.insert({
          notificationKey: key,
          type:            'achievement',
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
        logger.debug(`Achievement already claimed (insert dedup): ${key}`);
        continue;
      }

      logger.info(
        `Achievement fired: ${ach.emoji} ${ach.title} → ${trainer.trainerName} ` +
        `(category=${ach.category}, value=${ach.value.toLocaleString()})`
      );

      // ── 6. Deliver via Announcer ────────────────────────────────────
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

  logger.info(`Achievement cycle complete — ${firedCount} achievement(s) fired`);
}
