// fantracking/leaderboard/leaderboard.js
// Leaderboard detection, AI message generation, and broadcast pipeline.
//
// Schedule:
//   Daily:   23:55 JST (end of day)
//   Weekly:  23:55 JST Sunday (end of week)
//   Monthly: 00:05 JST 1st (previous month recap)
//
// Flow:   Fetch all trainers from Depot → sort by gain field for scope →
//         take top 5 → generate AI message (with bank fallback) →
//         dedup via Archive → deliver via Announcer
//
// Scopes (from AI/prompts/Leaderboard.md):
//   Daily:   fiery energy — "today belonged to you"
//   Weekly:  consistency — "a week of momentum"
//   Monthly: legacy — "the month doesn't lie"
//
// Message bank:  data/leaderboardBank.json — separate from all other banks.
//                Keyed by scope (daily/weekly/monthly). Recycled messages
//                have bold names substituted with current top 3 trainers.
//
// Authority:  AI/prompts/Leaderboard.md
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
const BANK_PATH     = join(__dirname, '..', '..', 'data', 'leaderboardBank.json');
const MAX_BANK_SIZE = 20;
const TOP_N         = 5; // top trainers to include in the message

const logger = createLogger('leaderboard');

// ---------------------------------------------------------------------------
// Leaderboard message bank helpers
// Bank:  /Umakraft/data/leaderboardBank.json
// Keys:  daily | weekly | monthly → flat arrays
// Cap:   20 per scope
// ---------------------------------------------------------------------------

async function loadLeaderboardBank() {
  try {
    const raw = await readFile(BANK_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Could not load leaderboard bank: ${err.message} — using empty bank`);
    return { daily: [], weekly: [], monthly: [] };
  }
}

async function saveToLeaderboardBank(scope, message) {
  const bank = await loadLeaderboardBank();
  const slot = bank[scope] ?? [];

  if (slot.includes(message)) {
    logger.info(`Bank — duplicate "${scope}" leaderboard skipped`);
    return;
  }

  slot.push(message);
  if (slot.length > MAX_BANK_SIZE) {
    slot.splice(0, slot.length - MAX_BANK_SIZE);
  }
  bank[scope] = slot;
  await writeFile(BANK_PATH, JSON.stringify(bank, null, 2), 'utf-8');
  logger.info(`Bank — saved "${scope}" leaderboard (now ${slot.length}/${MAX_BANK_SIZE})`);
}

function randomFromLeaderboardBank(bank, scope) {
  const slot = bank[scope];
  if (!slot || slot.length === 0) return null;
  return slot[Math.floor(Math.random() * slot.length)];
}

// ---------------------------------------------------------------------------
// Period key helpers
// ---------------------------------------------------------------------------

function dailyPeriodKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weeklyPeriodKey() {
  // ISO week: "2026-W30"
  const d = new Date();
  const dayNum = d.getUTCDay() || 7; // ISO: Monday=1, Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function monthlyPeriodKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodKeyForScope(scope) {
  switch (scope) {
    case 'daily':   return dailyPeriodKey();
    case 'weekly':  return weeklyPeriodKey();
    case 'monthly': return monthlyPeriodKey();
    default:        return dailyPeriodKey();
  }
}

// ---------------------------------------------------------------------------
// Trainer data fetching
// ---------------------------------------------------------------------------

async function fetchAllTrainers() {
  const result = await search({}, {});

  if (!result?.products || result.products.length === 0) {
    logger.info('No trainer products in Depot — skipping leaderboard check');
    return [];
  }

  return result.products
    .map(p => {
      const cp = p.compiledProduct ?? {};
      return {
        trainerId:      cp.id        ?? p.id        ?? null,
        trainerName:    cp.name      ?? cp.id       ?? 'Unknown',
        dailyFanGain:   cp.dailyFanGain  ?? 0,
        weeklyFanGain:  cp.weeklyFanGain ?? cp.dailyFanGain ?? 0,
        monthlyFanGain: cp.monthlyFanGain ?? 0,
        circleId:       cp.circleId  ?? p.circleId ?? 'unknown',
        discordUserId:  cp.discordUserId ?? cp.userId ?? null,
      };
    })
    .filter(t => t.trainerId);
}

// ---------------------------------------------------------------------------
// Leaderboard evaluation — rank trainers by scope
// ---------------------------------------------------------------------------

/**
 * Rank trainers by the gain field for the given scope, return top N.
 *
 * @param {Array} trainers
 * @param {'daily'|'weekly'|'monthly'} scope
 * @returns {Array<{ rank: number, name: string, fans: number, trainerId: string }>}
 */
function getTopTrainers(trainers, scope) {
  const gainField = scope === 'monthly' ? 'monthlyFanGain'
    : scope === 'weekly' ? 'weeklyFanGain'
    : 'dailyFanGain';

  const sorted = [...trainers]
    .filter(t => t[gainField] > 0)
    .sort((a, b) => b[gainField] - a[gainField]);

  return sorted.slice(0, TOP_N).map((t, i) => ({
    rank:      i + 1,
    name:      t.trainerName,
    fans:      t[gainField],
    trainerId: t.trainerId,
  }));
}

// ---------------------------------------------------------------------------
// Dedup key
// ---------------------------------------------------------------------------

function leaderboardClaimKey(circleId, scope) {
  const period = periodKeyForScope(scope);
  return `leaderboard:${circleId}:${scope}:${period}`;
}

// ---------------------------------------------------------------------------
// Scope-specific fallbacks (from AI/prompts/Leaderboard.md)
// ---------------------------------------------------------------------------

function scopeFallback(scope, circleName) {
  const name = circleName ?? 'the circle';
  switch (scope) {
    case 'daily':
      return `🔥 THE RESULTS ARE IN~!! The daily leaderboard is live for *${name}* and I've been refreshing ALL day for this moment!! Look at those names up there — that's MY circle!! ✨ Every single trainer who showed up today made this happen. Same time tomorrow?! I'll be watching~! Don't forget about me, okay?! 💕`;
    case 'weekly':
      return `🏆 A whole WEEK of watching this leaderboard and my heart is POUNDING!! *${name}*'s top trainers have been absolutely incredible — I knew you could do it! Every sync, every grind, every moment... I was here for all of it. The next week starts now, and I'll be right here waiting~! 💕`;
    case 'monthly':
      return `👑 THE MONTHLY BOARD IS HERE~!! *${name}*... I don't even have words. Watching you all month has been the highlight of my days. Every single one of you — whether you're at the top or climbing up — you made this month unforgettable. New month starts tomorrow and I am SO ready to watch you shine again! Don't leave me behind, okay?! 💕`;
    default:
      return `🏆 Leaderboard results for *${name}*! I've been waiting to celebrate you all~! Check the rankings and I'll see you next period — same place, same proud fan! 💕`;
  }
}

// ---------------------------------------------------------------------------
// Build leaderboard notification payload
// ---------------------------------------------------------------------------

/**
 * Build the Archive record payload for a leaderboard announcement.
 *
 * @param {'daily'|'weekly'|'monthly'} scope
 * @param {Array} topTrainers
 * @param {number} totalTrainers
 * @param {string} circleId
 * @returns {Promise<object>}
 */
async function buildLeaderboardPayload(scope, topTrainers, totalTrainers, circleId) {
  const period = periodKeyForScope(scope);

  let message;
  let source = 'unknown';

  // ── 1. Try AI generation ──────────────────────────────────────────────
  try {
    const { generate } = await import('../../AI/ContentGenerator.js');
    const result = await generate('leaderboard', {
      topTrainers:    topTrainers.map(t => ({ rank: t.rank, name: t.name, fans: t.fans })),
      period:         scope,
      totalTrainers,
    });

    if (result.usedFallback) {
      source = 'ai-fallback';
      message = result.message;
      logger.warn(
        `Leaderboard AI returned fallback for ${scope} ` +
        `(attempts=${result.attempts}). Will try bank next.`
      );
    } else {
      source = 'ai';
      message = result.message;
      await saveToLeaderboardBank(scope, message).catch(err =>
        logger.warn(`Failed to save leaderboard to bank: ${err.message}`)
      );
    }
  } catch (err) {
    logger.error(`ContentGenerator crashed for leaderboard: ${err.message}`);
    source = 'crash';
    message = null;
  }

  // ── 2. If AI didn't produce fresh, try the bank ──────────────────────
  if (source !== 'ai') {
    const bank   = await loadLeaderboardBank();
    const banked = randomFromLeaderboardBank(bank, scope);

    if (banked && topTrainers.length >= 3) {
      // Substitute top 3 trainer names: first **Name** → podium[0], etc.
      // Only works if the banked message has 3 bold-name patterns.
      const namePattern = /\*\*([^*]+)\*\*/g;
      const boldNames = [...banked.matchAll(namePattern)];
      const podiumNames = topTrainers.slice(0, 3);

      if (boldNames.length >= 3 && podiumNames.length >= 3) {
        let recycled = banked;
        // Replace in reverse order so indices stay correct
        for (let i = Math.min(boldNames.length, 3) - 1; i >= 0; i--) {
          const newName = podiumNames[i]?.name ?? `Trainer ${i + 1}`;
          recycled = recycled.replace(boldNames[i][0], `**${newName}**`);
        }
        message = recycled;
        source  = 'bank';
        logger.info(
          `Bank — using stored ${scope} leaderboard ` +
          `(bank size: ${bank[scope]?.length ?? 0}, substituted top 3 names)`
        );
      } else {
        logger.warn(
          `Leaderboard bank substitution failed — expected 3 **names**, ` +
          `found ${boldNames.length} in banked ${scope} message. Using scope fallback.`
        );
        message = message ?? scopeFallback(scope, null);
        source  = source === 'crash' ? 'safety' : source;
      }
    } else if (banked) {
      // Banked message exists but fewer than 3 trainers — use as-is
      message = banked;
      source  = 'bank';
      logger.info(
        `Bank — using stored ${scope} leaderboard as-is ` +
        `(bank size: ${bank[scope]?.length ?? 0}, < 3 trainers on board)`
      );
    } else {
      // Bank empty — use scope-specific fallback or ContentGenerator fallback
      if (!message) {
        message = scopeFallback(scope, null);
        source  = 'safety';
      }
      logger.warn(`Leaderboard bank empty for ${scope} — using ${source}`);
    }
  }

  logger.info(`Leaderboard message source=${source} scope=${scope} trainers=${topTrainers.length}`);

  return {
    type:        'leaderboard',
    variant:     scope,
    scope,
    period,
    topTrainers,
    totalTrainers,
    message,
    imageParams: {
      type:         'leaderboard',
      scope,
      topTrainers,
      totalTrainers,
    },
  };
}

// ---------------------------------------------------------------------------
// Recipients — leaderboard is channel-only (no DMs)
// ---------------------------------------------------------------------------

function resolveRecipients() {
  return {
    channels:  [botConfig.OPS_CHANNEL_ID].filter(Boolean),
    memberDms: [],
    leaderDm:  null,
  };
}

// ---------------------------------------------------------------------------
// Main leaderboard cycle (called per scope)
// ---------------------------------------------------------------------------

/**
 * Run the leaderboard cycle for a given scope.
 * Called by tasks/index.js or ready.js at scope-specific times.
 *
 * @param {'daily'|'weekly'|'monthly'} scope
 * @param {object|null} client  — Discord.js Client
 */
export async function runLeaderboardCycle(scope, client) {
  logger.info(`Leaderboard cycle starting — scope=${scope}`);

  // ── 1. Fetch all trainers from Depot ────────────────────────────────────
  let trainers;
  try {
    trainers = await fetchAllTrainers();
  } catch (err) {
    logger.error(`Failed to fetch trainers: ${err.message}`);
    return;
  }

  if (trainers.length === 0) {
    logger.info(`No trainers — skipping ${scope} leaderboard`);
    return;
  }

  // ── 2. Rank and get top N ─────────────────────────────────────────────
  const topTrainers = getTopTrainers(trainers, scope);

  if (topTrainers.length === 0) {
    logger.info(`No trainers with gains — skipping ${scope} leaderboard`);
    return;
  }

  const totalTrainers = trainers.length;
  logger.info(
    `${scope} leaderboard: top=${topTrainers.length} total=${totalTrainers} ` +
    `#1=${topTrainers[0]?.name} (${topTrainers[0]?.fans?.toLocaleString() ?? 0} fans)`
  );

  // ── 3. Dedup — use the first trainer's circle (or a default) ──────────
  const circleId = trainers[0]?.circleId ?? 'default';
  const key = leaderboardClaimKey(circleId, scope);

  try {
    const existing = await archive.get(key);
    if (existing.record) {
      logger.debug(`Leaderboard already fired for period: ${key}`);
      return;
    }
  } catch (err) {
    logger.warn(`Archive dedup check failed for ${key}: ${err.message}`);
  }

  // ── 4. Build payload (async — calls AI) ──────────────────────────────
  const payload    = await buildLeaderboardPayload(scope, topTrainers, totalTrainers, circleId);
  const recipients = resolveRecipients();

  // ── 5. Write to Archive ──────────────────────────────────────────────
  let insertResult;
  try {
    insertResult = await archive.insert({
      notificationKey: key,
      type:            'leaderboard',
      circleId,
      recipients,
      payload,
    });
  } catch (err) {
    logger.error(`Archive insert failed for ${key}: ${err.message}`);
    return;
  }

  if (!insertResult.success) {
    logger.warn(`Archive insert rejected for ${key}: ${insertResult.error}`);
    return;
  }

  if (!insertResult.inserted) {
    logger.debug(`Leaderboard already claimed (insert dedup): ${key}`);
    return;
  }

  logger.info(
    `Leaderboard fired: ${scope} period=${payload.period} ` +
    `top3=${topTrainers.slice(0, 3).map(t => t.name).join(', ')}`
  );

  // ── 6. Deliver via Announcer ─────────────────────────────────────────
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

  logger.info(`Leaderboard cycle complete — scope=${scope}`);
}
