// fantracking/warnings/warnings.js
// Warning detection, AI message generation, and PRIVATE DM delivery.
//
// ⚠️  DISCORD TOS SENSITIVE — DM-ONLY DELIVERY  ⚠️
// Warnings are sent exclusively as direct messages. They are NEVER posted
// to a public channel. Discord treats unsolicited DM spam as a TOS
// violation — this pipeline enforces DM-only delivery and per-period
// dedup to prevent spam.
//
// Schedule: every 30 minutes (cron: */30 * * * *)
// Flow:     Fetch all trainers from Depot → calculate deficit against
//           projected pace → map to deficit tier group →
//           dedup per trainer per tier-group per period →
//           generate AI message (with bank fallback) →
//           deliver via Announcer (DM only, NO CHANNEL)
//
// Deficit tier groups (from AI/prompts/Warning.md):
//   light:   Minor Slip (T1, <10K) / Falling Behind (T2, 10K-25K)
//   direct:  Gap Widening (T3, 25K-50K) / Red Zone (T4, 50K-100K)
//   urgent:  Critical Drop (T5, 100K-250K) / Emergency Drift (T6, >250K)
//
// Message bank:  data/warningBank.json — separate from all other banks.
//                Keyed by tier group (light/direct/urgent).
//                Recycled with trainer name + deficit + tier title
//                + circle name substitution.
//
// Authority:  AI/prompts/Warning.md
// Calls:      AI/ContentGenerator.js, Refinery/Depot, Broadcast/Archive,
//             Broadcast/Announcer (DM-only path)

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { search } from '../../Refinery/Depot/depot.js';
import * as archive from '../../Broadcast/Archive/archive.js';
import { deliver } from '../../Broadcast/Announcer/announcer.js';
import { createLogger } from '../../core/pipelineLogger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_PATH     = join(__dirname, '..', '..', 'data', 'warningBank.json');
const MAX_BANK_SIZE = 20;

// Default daily fan target per trainer (configurable via warningSettings)
const DEFAULT_DAILY_TARGET = 500_000;

const logger = createLogger('warning');

// ---------------------------------------------------------------------------
// Deficit tier registry (from AI/prompts/Warning.md)
// ---------------------------------------------------------------------------

const TIER_REGISTRY = [
  { label: 'Minor Slip',        min:         0, max:     9_999, group: 'light',  emoji: '📎' },
  { label: 'Falling Behind',    min:    10_000, max:    24_999, group: 'light',  emoji: '📉' },
  { label: 'Gap Widening',      min:    25_000, max:    49_999, group: 'direct', emoji: '⚠️' },
  { label: 'Red Zone',          min:    50_000, max:    99_999, group: 'direct', emoji: '🚨' },
  { label: 'Critical Drop',     min:   100_000, max:   249_999, group: 'urgent', emoji: '🔴' },
  { label: 'Emergency Drift',   min:   250_000, max: Infinity,   group: 'urgent', emoji: '🆘' },
];

// ---------------------------------------------------------------------------
// Warning message bank helpers
// Bank:  /Umakraft/data/warningBank.json
// Keys:  light | direct | urgent → flat arrays (3 tier groups, not 6 tiers)
//        Grouping gives more reuse: "Minor Slip" and "Falling Behind" share
//        the same light-tone bank, preventing cold-empty banks for rare tiers.
// Cap:   20 per group
// ---------------------------------------------------------------------------

async function loadWarningBank() {
  try {
    const raw = await readFile(BANK_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Could not load warning bank: ${err.message} — using empty bank`);
    return { light: [], direct: [], urgent: [] };
  }
}

async function saveToWarningBank(group, message) {
  const bank = await loadWarningBank();
  const slot = bank[group] ?? [];

  if (slot.includes(message)) {
    logger.info(`Bank — duplicate "${group}" warning skipped`);
    return;
  }

  slot.push(message);
  if (slot.length > MAX_BANK_SIZE) {
    slot.splice(0, slot.length - MAX_BANK_SIZE);
  }
  bank[group] = slot;
  await writeFile(BANK_PATH, JSON.stringify(bank, null, 2), 'utf-8');
  logger.info(`Bank — saved "${group}" warning (now ${slot.length}/${MAX_BANK_SIZE})`);
}

function randomFromWarningBank(bank, group) {
  const slot = bank[group];
  if (!slot || slot.length === 0) return null;
  return slot[Math.floor(Math.random() * slot.length)];
}

// ---------------------------------------------------------------------------
// Tier-group fallbacks (from AI/prompts/Warning.md)
// ---------------------------------------------------------------------------

function groupFallback(group, trainerName, deficitAmount, tierLabel, tierEmoji, circleName) {
  const circle = circleName ? `*${circleName}*` : 'everyone';
  const deficitStr = Number(deficitAmount).toLocaleString();

  switch (group) {
    case 'light':
      return `${tierEmoji} um... hey **${trainerName}**... i noticed you're **${deficitStr} fans** behind your projection. it's really not a big deal! everyone has slower days~ a quick sync would close this right up. i just wanted to mention it because i care. you've got this~! 💕`;
    case 'direct':
      return `${tierEmoji} ah... **${trainerName}**... you're **${deficitStr} fans** behind and i got a little worried. it's okay though! a quick sync would really help get things back on track. the whole ${circle} circle is here for you — no pressure at all. just wanted to check in~ 🥺💕`;
    case 'urgent':
      return `${tierEmoji} **${trainerName}**... hey... i noticed you're **${deficitStr} fans** behind and i couldn't stop thinking about it. please don't feel bad — it happens to everyone! a quick sync today would make such a big difference. i believe in you so much. the whole ${circle} circle does too. take it one step at a time, okay? 🥺💕`;
    default:
      return `📊 um... hey **${trainerName}**... you're **${deficitStr} fans** behind your projection. it's okay! just wanted to let you know gently. a quick sync would help a lot~ ${circle} is cheering for you. 🥺💕`;
  }
}

// ---------------------------------------------------------------------------
// Bank message substitution
// ---------------------------------------------------------------------------

/**
 * Substitute trainer-specific details from a banked warning message.
 * Handles: bold trainer name (1st), bold deficit amount (2nd), bold tier label
 * (3rd), italicized circle name.
 */
function substituteBankedWarning(banked, trainerName, deficitAmount, tierLabel, tierEmoji, circleName) {
  const deficitStr = Number(deficitAmount).toLocaleString();
  const circle = circleName ? `*${circleName}*` : 'the circle';

  const boldPattern = /\*\*([^*]+)\*\*/g;
  const boldMatches = [...banked.matchAll(boldPattern)];

  if (boldMatches.length < 3) {
    logger.warn(`Warning bank substitution — only ${boldMatches.length} bold patterns (need 3: name, deficit, tier)`);
    return `${tierEmoji} ${banked}`; // prepend emoji as best-effort fix
  }

  // Replace in reverse: tier label (3rd), deficit (2nd), trainer name (1st)
  let recycled = banked;
  recycled = recycled.replace(boldMatches[2][0], `**${tierLabel}**`);
  recycled = recycled.replace(boldMatches[1][0], `**${deficitStr}**`);
  recycled = recycled.replace(boldMatches[0][0], `**${trainerName}**`);

  // Replace italicized circle name
  recycled = recycled.replace(/\*(?:[\w\s]+|the circle)\*/g, circle);

  // Replace leading emoji with the correct tier emoji
  recycled = recycled.replace(/^[📎📉⚠️🚨🔴🆘]/, tierEmoji);

  return recycled;
}

// ---------------------------------------------------------------------------
// Trainer data fetching
// ---------------------------------------------------------------------------

async function fetchAllTrainers() {
  const result = await search({}, {});

  if (!result?.products || result.products.length === 0) {
    logger.info('No trainer products in Depot — skipping warning check');
    return [];
  }

  return result.products
    .map(p => {
      const cp = p.compiledProduct ?? {};
      return {
        trainerId:      cp.id        ?? p.id        ?? null,
        trainerName:    cp.name      ?? cp.id       ?? 'Unknown',
        dailyFanGain:   cp.dailyFanGain  ?? 0,
        circleId:       cp.circleId  ?? p.circleId ?? 'unknown',
        discordUserId:  cp.discordUserId ?? cp.userId ?? null,
      };
    })
    .filter(t => t.trainerId && t.discordUserId); // MUST have Discord ID for DM
}

// ---------------------------------------------------------------------------
// Deficit evaluation
// ---------------------------------------------------------------------------

/**
 * Calculate deficit and map to tier for a trainer.
 * Returns null if trainer is on track (no deficit).
 *
 * @param {object} trainer
 * @param {number} dailyTarget — configurable target per day
 * @returns {{ deficit: number, tier: object } | null}
 */
function evaluateDeficit(trainer, dailyTarget = DEFAULT_DAILY_TARGET) {
  const deficit = dailyTarget - trainer.dailyFanGain;

  // No deficit — trainer is on track or ahead
  if (deficit <= 0) return null;

  // Find the matching tier
  let matchedTier = null;
  for (const tier of TIER_REGISTRY) {
    if (deficit >= tier.min && deficit <= tier.max) {
      matchedTier = tier;
      break;
    }
  }

  // Deficit below smallest tier threshold — trainer is essentially on track
  if (!matchedTier) return null;

  return { deficit, tier: matchedTier };
}

// ---------------------------------------------------------------------------
// Dedup key
// ---------------------------------------------------------------------------

/**
 * Dedup key: one warning per trainer per tier group per day.
 * A trainer in "Falling Behind" (light) gets one warning per day —
 * not one every 30 minutes.
 */
function warningClaimKey(trainerId, group) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `warning:${trainerId}:${group}:${today}`;
}

// ---------------------------------------------------------------------------
// Build warning notification payload
// ---------------------------------------------------------------------------

async function buildWarningPayload(trainer, deficit, tier) {
  let message;
  let source = 'unknown';

  // ── 1. Try AI generation ──────────────────────────────────────────────
  try {
    const { generate } = await import('../../AI/ContentGenerator.js');
    const result = await generate('warning', {
      trainerName:   trainer.trainerName,
      deficitAmount: deficit,
      circleName:    trainer.circleId ?? undefined,
    });

    if (result.usedFallback) {
      source = 'ai-fallback';
      message = result.message;
      logger.warn(
        `Warning AI returned fallback for ${tier.label} (${tier.group}) ` +
        `attempts=${result.attempts}. Will try bank next.`
      );
    } else {
      source = 'ai';
      message = result.message;
      await saveToWarningBank(tier.group, message).catch(err =>
        logger.warn(`Failed to save warning to bank: ${err.message}`)
      );
    }
  } catch (err) {
    logger.error(`ContentGenerator crashed for warning: ${err.message}`);
    source = 'crash';
    message = null;
  }

  // ── 2. If AI didn't produce fresh, try the bank ──────────────────────
  if (source !== 'ai') {
    const bank   = await loadWarningBank();
    const banked = randomFromWarningBank(bank, tier.group);

    if (banked) {
      message = substituteBankedWarning(
        banked, trainer.trainerName, deficit, tier.label, tier.emoji, trainer.circleId
      );
      source  = 'bank';
      const bankSize = bank[tier.group]?.length ?? 0;
      logger.info(
        `Bank — using stored "${tier.group}" warning ` +
        `(bank size: ${bankSize}, ` +
        `substituted: ${trainer.trainerName} / ${deficit.toLocaleString()} / ${tier.label})`
      );
    } else {
      if (!message) {
        message = groupFallback(
          tier.group, trainer.trainerName, deficit, tier.label, tier.emoji, trainer.circleId
        );
        source = 'safety';
      }
      logger.warn(`Warning bank empty for "${tier.group}" — using ${source}`);
    }
  }

  logger.info(
    `Warning message source=${source} tier=${tier.label} group=${tier.group} ` +
    `deficit=${deficit.toLocaleString()}`
  );

  return {
    type:        'warning',
    variant:     tier.label,
    trainerId:   trainer.trainerId,
    trainerName: trainer.trainerName,
    tier:        tier.label,
    tierGroup:   tier.group,
    tierEmoji:   tier.emoji,
    deficit,
    message,
    imageParams: {
      type:         'warning',
      trainerName:  trainer.trainerName,
      tier:         tier.label,
      tierEmoji:    tier.emoji,
      deficit,
    },
  };
}

// ---------------------------------------------------------------------------
// Recipients — DM ONLY, never public channel
// ---------------------------------------------------------------------------

/**
 * ⚠️  CRITICAL: returns EMPTY channels array.
 * Warnings are DM-only. Discord TOS prohibits unsolicited server messages.
 * The empty channels array ensures _postChannel() is a no-op.
 */
function resolveRecipients(trainer) {
  return {
    channels:  [],                                           // NO public channel
    memberDms: [trainer.discordUserId],                      // DM the trainer
    leaderDm:  null,
  };
}

// ---------------------------------------------------------------------------
// Main warning cycle
// ---------------------------------------------------------------------------

/**
 * Run the full warning detection and DM delivery cycle.
 * Called by tasks/index.js every 30 minutes.
 *
 * @param {object|null} client — Discord.js Client
 */
export async function runWarningCycle(client) {
  if (!client) {
    logger.warn('No Discord client — skipping warning cycle (DMs require client)');
    return;
  }

  logger.info('Warning cycle starting');

  // ── 1. Fetch all trainers from Depot ────────────────────────────────────
  let trainers;
  try {
    trainers = await fetchAllTrainers();
  } catch (err) {
    logger.error(`Failed to fetch trainers: ${err.message}`);
    return;
  }

  if (trainers.length === 0) {
    logger.info('No trainers with Discord links — skipping warning check');
    return;
  }

  logger.info(`Evaluating ${trainers.length} trainer(s) for deficits`);

  let warnedCount = 0;
  let okCount     = 0;

  // ── 2. Evaluate each trainer ────────────────────────────────────────────
  for (const trainer of trainers) {
    const result = evaluateDeficit(trainer, DEFAULT_DAILY_TARGET);

    if (!result) {
      okCount++;
      continue;
    }

    const { deficit, tier } = result;
    const key = warningClaimKey(trainer.trainerId, tier.group);

    // ── 3. Dedup — one warning per trainer per tier group per day ───────
    try {
      const existing = await archive.get(key);
      if (existing.record) {
        logger.debug(`Warning already sent today: ${key}`);
        okCount++;
        continue;
      }
    } catch (err) {
      logger.warn(`Archive dedup check failed for ${key}: ${err.message}`);
      continue;
    }

    // ── 4. Build payload (async — calls AI) ──────────────────────────
    const payload    = await buildWarningPayload(trainer, deficit, tier);
    const recipients = resolveRecipients(trainer);

    // ── 5. Write to Archive ──────────────────────────────────────────
    let insertResult;
    try {
      insertResult = await archive.insert({
        notificationKey: key,
        type:            'warning',
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
      logger.debug(`Warning already claimed (insert dedup): ${key}`);
      continue;
    }

    logger.info(
      `Warning fired: ${tier.emoji} ${tier.label} → ${trainer.trainerName} ` +
      `(deficit=${deficit.toLocaleString()}, group=${tier.group})`
    );

    // ── 6. Deliver via Announcer — DM only (channels array is empty) ──
    try {
      const record = await archive.get(key);
      if (record.record && client) {
        deliver(record.record, client).catch(err =>
          logger.error(`Announcer DM delivery failed for ${key}: ${err.message}`)
        );
      }
    } catch (err) {
      logger.error(`Announcer dispatch failed for ${key}: ${err.message}`);
    }

    warnedCount++;
  }

  logger.info(
    `Warning cycle complete — ${warnedCount} warned, ${okCount} on track`
  );
}
