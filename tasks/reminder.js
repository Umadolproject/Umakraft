// tasks/reminder.js
// Reminder message generation and posting pipeline.
//
// Unlike milestones/achievements/leaderboard (which detect events from
// trainer data), reminders are event-driven — they're triggered by a
// schedule or manual call with a predefined event config.
//
// Event types (from AI/prompts/Reminder.md):
//   deadline — ranking deadlines, period cutoffs (⏰ 🔥 ⚡)
//   meeting  — circle meetings, community calls (📅 🤝 🎯)
//   sync     — sync nudges during active hours (🔄 📊 💡)
//   special  — one-off events, surprises (🎉 ✨ 🚀)
//
// Message bank:  data/reminderBank.json — separate from all other banks.
//                Keyed by eventType. Recycled with event name + date
//                + circle name substitution.
//
// Authority:  AI/prompts/Reminder.md
// Calls:      AI/ContentGenerator.js, Broadcast/Announcer

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deliver } from '../Broadcast/Announcer/announcer.js';
import * as archive from '../Broadcast/Archive/archive.js';
import * as botConfig from '../core/botConfig.js';
import log from '../core/log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_PATH     = join(__dirname, '..', 'data', 'reminderBank.json');
const MAX_BANK_SIZE = 20;

// ---------------------------------------------------------------------------
// Reminder message bank helpers
// Bank:  /Umakraft/data/reminderBank.json
// Keys:  deadline | meeting | sync | special → flat arrays
// Cap:   20 per event type
// ---------------------------------------------------------------------------

async function loadReminderBank() {
  try {
    const raw = await readFile(BANK_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    log.warn(`[reminder] Could not load bank: ${err.message} — using empty bank`);
    return { deadline: [], meeting: [], sync: [], special: [] };
  }
}

async function saveToReminderBank(eventType, message) {
  const bank = await loadReminderBank();
  const slot = bank[eventType] ?? [];

  if (slot.includes(message)) {
    log.info(`[reminder] Bank — duplicate "${eventType}" skipped`);
    return;
  }

  slot.push(message);
  if (slot.length > MAX_BANK_SIZE) {
    slot.splice(0, slot.length - MAX_BANK_SIZE);
  }
  bank[eventType] = slot;
  await writeFile(BANK_PATH, JSON.stringify(bank, null, 2), 'utf-8');
  log.info(`[reminder] Bank — saved "${eventType}" (now ${slot.length}/${MAX_BANK_SIZE})`);
}

function randomFromReminderBank(bank, eventType) {
  const slot = bank[eventType];
  if (!slot || slot.length === 0) return null;
  return slot[Math.floor(Math.random() * slot.length)];
}

// ---------------------------------------------------------------------------
// Event-type-specific fallbacks (from AI/prompts/Reminder.md)
// ---------------------------------------------------------------------------

function typeFallback(eventType, eventName, eventDate, circleName) {
  const circle = circleName ? `*${circleName}*` : 'everyone';
  switch (eventType) {
    case 'deadline':
      return `💕 hey~ I just wanted to remind you that **${eventName}** closes on **${eventDate}**. I know you've been working so hard, and I'd hate to see you miss this. A quick sync now will lock everything in. You've got this, ${circle}~! Take care, okay? 💕`;
    case 'meeting':
      return `📅 I was thinking about you and wanted to mention — **${eventName}** is coming up on **${eventDate}**. It really wouldn't be the same without you there, ${circle}~. I hope you can make it! No pressure though — just wanted you to know. 💕`;
    case 'sync':
      return `🔄 hey~ I noticed it's been a little while since your last sync. Everything okay? A quick sync now keeps everything fresh and accurate. Don't worry if you've been busy — it only takes a moment. I'm looking out for you, ${circle}~! 💕`;
    case 'special':
      return `✨ I've been looking forward to telling you about this! **${eventName}** is happening on **${eventDate}** and I'm so excited~! I saved you a spot in my thoughts, ${circle}. It's going to be something really special. I hope to see you there! 💕`;
    default:
      return `💕 just a gentle reminder — **${eventName}** is coming up on **${eventDate}**. I didn't want you to miss it, ${circle}~. Take care of yourself, okay? 💕`;
  }
}

// ---------------------------------------------------------------------------
// Bank message substitution
// ---------------------------------------------------------------------------

/**
 * Substitute event-specific details from a banked message so the recycled
 * text matches the current reminder config.
 *
 * Replaces: event name (first bold), event date (second bold), circle name
 * using regex patterns that match the AI's typical output format.
 */
function substituteBankedMessage(banked, eventName, eventDate, circleName) {
  const circle = circleName ? `*${circleName}*` : 'the circle';

  // Extract all **text** patterns from banked message
  const boldPattern = /\*\*([^*]+)\*\*/g;
  const boldMatches = [...banked.matchAll(boldPattern)];

  if (boldMatches.length < 2) {
    log.warn(`[reminder] Bank substitution warning — only ${boldMatches.length} bold patterns found (need 2: event name + date)`);
    return banked;
  }

  // Replace in reverse order so indices stay correct
  let recycled = banked;

  // Replace second bold (event date) first
  recycled = recycled.replace(boldMatches[1][0], `**${eventDate}**`);
  // Replace first bold (event name) second
  recycled = recycled.replace(boldMatches[0][0], `**${eventName}**`);

  // Replace italicized circle name: *CircleName* or the circle
  const italicCircle = /\*(?:[\w\s]+|the circle)\*/g;
  recycled = recycled.replace(italicCircle, circle);

  return recycled;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate and post a reminder message.
 *
 * Resolution order:
 *   1. AI generation → if successful, save to bank and post.
 *   2. Message bank   → if AI failed, pick random stored + substitute.
 *   3. Type fallback  → per-event-type fallback from Reminder.md spec.
 *
 * @param {import('discord.js').Client} client
 * @param {object} config
 * @param {string} config.eventName   — e.g. "Monthly Ranking Deadline"
 * @param {string} config.eventDate   — e.g. "July 30, 2026" or ISO
 * @param {'deadline'|'meeting'|'sync'|'special'} [config.eventType='deadline']
 * @param {string} [config.circleName]
 * @param {string} [config.details]    — what trainers should do
 * @param {string} [config.stakes]     — what's at stake
 * @param {string} [config.channelId]  — override OPS_CHANNEL_ID
 */
export async function runReminder(client, config = {}) {
  const {
    eventName  = 'Upcoming Event',
    eventDate  = 'TBD',
    eventType  = 'deadline',
    circleName,
    details,
    stakes,
    channelId  = botConfig.OPS_CHANNEL_ID,
  } = config;

  if (!eventName || !eventDate) {
    log.error('[reminder] Missing required config: eventName and eventDate');
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    log.error(`[reminder] Channel ${channelId} not found`);
    return;
  }

  // ── Build details string with eventType and stakes context ────────────
  const enrichedDetails = [
    details,
    stakes ? `What's at stake: ${stakes}` : null,
    `This is a ${eventType} reminder — ${eventType === 'deadline' ? 'a gentle heads-up because I care' : eventType === 'meeting' ? 'a warm invitation from the heart' : eventType === 'sync' ? 'a soft check-in because I noticed' : 'something special I wanted to share'}.`,
  ].filter(Boolean).join(' | ');

  let message = null;
  let source  = 'unknown';

  // ── 1. Try AI generation ──────────────────────────────────────────────
  try {
    const { generate } = await import('../AI/ContentGenerator.js');
    const result = await generate('reminder', {
      eventName,
      eventDate,
      circleName: circleName ?? undefined,
      details: enrichedDetails,
    });

    if (result.usedFallback) {
      source  = 'ai-fallback';
      message = result.message;
      log.warn(
        `[reminder] AI returned fallback for "${eventName}" (${eventType}) ` +
        `attempts=${result.attempts}. Will try bank next.`
      );
    } else {
      source  = 'ai';
      message = result.message;
      await saveToReminderBank(eventType, message).catch(err =>
        log.warn(`[reminder] Failed to save to bank: ${err.message}`)
      );
    }
  } catch (err) {
    log.error(`[reminder] ContentGenerator crashed: ${err.message}`);
    source  = 'crash';
    message = null;
  }

  // ── 2. If AI didn't produce fresh, try the bank ──────────────────────
  if (source !== 'ai') {
    const bank   = await loadReminderBank();
    const banked = randomFromReminderBank(bank, eventType);

    if (banked) {
      message = substituteBankedMessage(banked, eventName, eventDate, circleName);
      source  = 'bank';
      const bankSize = bank[eventType]?.length ?? 0;
      log.info(
        `[reminder] Bank — using stored "${eventType}" message ` +
        `(bank size: ${bankSize}, substituted: "${eventName}" / ${eventDate})`
      );
    } else {
      if (!message) {
        message = typeFallback(eventType, eventName, eventDate, circleName);
        source  = 'safety';
      }
      log.warn(`[reminder] Bank empty for "${eventType}" — using ${source}`);
    }
  }

  log.info(
    `[reminder] Posted "${eventName}" (${eventType}) source=${source} ` +
    `date=${eventDate}`
  );

  // ── 3. Post ───────────────────────────────────────────────────────────
  await channel.send({ content: message });
}

// ---------------------------------------------------------------------------
// Scheduled reminder wrappers
// ---------------------------------------------------------------------------

/**
 * Sync reminder — fires during active hours to nudge trainers to sync.
 * Called by ready.js at configured times.
 */
export function runSyncReminder(client) {
  const now = new Date();
  return runReminder(client, {
    eventName: 'Sync Check',
    eventDate: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    eventType: 'sync',
    details:  'A quick sync now keeps your data fresh and your leaderboard position accurate.',
    stakes:   'Trainers who stay synced stay visible. Those who skip it fade off the board.',
  });
}
