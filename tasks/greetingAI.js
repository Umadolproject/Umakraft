// tasks/greetingAI.js
// AI greeting — generates and posts an AI-written greeting to the
// announcement channel at 4 time slots: morning, noon, night, midnight.
//
// Every successfully AI-generated message is stored in a per-slot message
// bank (JSON file on disk). Duplicates are rejected. When the AI is
// unavailable, a random banked message is used instead of the same hardcoded
// fallback every time.
//
// Bank storage
//   Path:  /Umakraft/data/messageBank.json
//   Cap:   20 messages per slot (oldest evicted when full)
//   TTL:   permanent — messages persist until evicted by newer ones
//
// Scheduled via scheduleDailyAt() in ready.js.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import log from '../core/log.js';
import { OPS_CHANNEL_ID } from '../core/botConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_PATH  = join(__dirname, '..', 'data', 'messageBank.json');
const MAX_BANK_SIZE = 20;
const GREETING_CHANNEL_ID = process.env.GREETING_CHANNEL_ID || OPS_CHANNEL_ID;

// ---------------------------------------------------------------------------
// Message bank helpers
// ---------------------------------------------------------------------------

/**
 * Read the full message bank from disk.
 * Returns a default skeleton if the file is missing or unreadable.
 *
 * @returns {Promise<Record<string, string[]>>}
 */
async function loadBank() {
  try {
    const raw = await readFile(BANK_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    log.warn(`[greeting-ai] Could not load message bank: ${err.message} — using empty bank`);
    return { morning: [], noon: [], night: [], midnight: [] };
  }
}

/**
 * Save a message to the slot's bank, trimming to MAX_BANK_SIZE.
 * Duplicates are rejected — an exact match against any existing message in
 * the same slot is silently skipped.
 */
async function saveToBank(timeSlot, message) {
  const bank = await loadBank();
  const slot  = bank[timeSlot] ?? [];

  // ── Duplicate detection: exact string match ──────────────────────────
  if (slot.includes(message)) {
    log.info(`[greeting-ai] Bank — duplicate "${timeSlot}" message skipped (already in bank)`);
    return;
  }

  slot.push(message);
  if (slot.length > MAX_BANK_SIZE) {
    const evicted = slot.splice(0, slot.length - MAX_BANK_SIZE);
    log.info(`[greeting-ai] Bank — evicted ${evicted.length} old "${timeSlot}" message(s) to stay at cap ${MAX_BANK_SIZE}`);
  }
  bank[timeSlot] = slot;
  await writeFile(BANK_PATH, JSON.stringify(bank, null, 2), 'utf-8');
  log.info(`[greeting-ai] Bank — saved "${timeSlot}" message (now ${slot.length}/${MAX_BANK_SIZE} in bank)`);
}

/**
 * Pick a random stored message for the given time slot.
 * Returns null if the slot's bank is empty.
 */
function randomFromBank(bank, timeSlot) {
  const slot = bank[timeSlot];
  if (!slot || slot.length === 0) return null;
  return slot[Math.floor(Math.random() * slot.length)];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an AI greeting and post it to the configured channel.
 *
 * Resolution order:
 *   1. AI generation → if successful, save to bank and post.
 *   2. Message bank   → if AI failed, pick a random stored message for variety.
 *   3. Safety net     → absolute last resort (bank empty AND AI crashed).
 *
 * @param {import('discord.js').Client} client
 * @param {'morning'|'noon'|'night'|'midnight'} timeSlot
 */
export async function runGreetingAI(client, timeSlot = 'morning') {
  const channel = await client.channels.fetch(GREETING_CHANNEL_ID).catch(() => null);
  if (!channel) {
    log.error(`[greeting-ai] Channel ${GREETING_CHANNEL_ID} not found — skipping ${timeSlot} greeting`);
    return;
  }

  let message  = null;
  let source   = 'unknown';

  // ── 1. Try AI generation ──────────────────────────────────────────────
  try {
    const { generate } = await import('../AI/ContentGenerator.js');
    const result = await generate('greeting', { timeSlot });

    if (result.usedFallback) {
      // AI failed but ContentGenerator returned its own hardcoded fallback.
      // Don't store this — fallbacks don't go in the bank.
      source  = 'ai-fallback';
      message = result.message;
      log.warn(
        `[greeting-ai] ${timeSlot} — AI returned fallback ` +
        `(attempts=${result.attempts}). Will try bank next.`
      );
    } else {
      // AI succeeded — store the fresh message in the bank
      source  = 'ai';
      message = result.message;
      await saveToBank(timeSlot, message).catch(err =>
        log.warn(`[greeting-ai] Failed to save "${timeSlot}" message to bank: ${err.message}`)
      );
    }
  } catch (err) {
    log.error(`[greeting-ai] ContentGenerator crashed for "${timeSlot}": ${err.message}`);
    source  = 'crash';
    message = null;
  }

  // ── 2. If AI didn't produce a fresh message, try the bank ─────────────
  if (source !== 'ai') {
    const bank = await loadBank();
    const banked = randomFromBank(bank, timeSlot);

    if (banked) {
      if (message) {
        // We have the ContentGenerator fallback but a bank message exists —
        // prefer the bank for variety.
        log.info(
          `[greeting-ai] ${timeSlot} — using bank message over ContentGenerator fallback ` +
          `(bank size: ${bank[timeSlot].length})`
        );
      } else {
        log.info(
          `[greeting-ai] ${timeSlot} — AI crashed, using bank message ` +
          `(bank size: ${bank[timeSlot].length})`
        );
      }
      message = banked;
      source  = 'bank';
    } else {
      log.warn(
        `[greeting-ai] ${timeSlot} — bank is empty, falling through to safety net ` +
        `(source: ${source})`
      );
    }
  }

  // ── 3. Last resort: hardcoded safety net ──────────────────────────────
  if (!message) {
    const safety = {
      morning:  `🌅 Ohayou, minna~! A brand new day of training is here and I've been waiting to see everyone! ✨ Let's do our best together today, just like always~! Whether you're going for one million or ten, I'm cheering for every single one of you. Let's make today something special, okay? 💕`,
      noon:     `☀️ How's everyone doing~? The day's halfway through! I hope your training is going well — remember to take a little break too, mou~. Keep that energy up and let's finish the day strong together. I believe in you! 💕`,
      night:    `🌙 Another day together, minna~. Look at everything we accomplished today — every little bit counts. I'm so proud to be part of this circle with all of you. Rest well tonight, okay? Tomorrow I'll be right here waiting~! ✨💕`,
      midnight: `🌌 It's late, you know... but I couldn't sleep without saying goodnight to my favorite trainers~. You've done enough today. Please get some rest, okay? The leaderboard will be there tomorrow — and so will I. Sweet dreams, minna~! 🌠💕`,
    };
    message = safety[timeSlot] ?? safety.morning;
    source  = 'safety';
    log.warn(`[greeting-ai] ${timeSlot} — using hardcoded safety net message`);
  }

  // ── 4. Post ───────────────────────────────────────────────────────────
  await channel.send({ content: message });

  // Final stats
  const bankSize = (await loadBank())[timeSlot]?.length ?? 0;
  log.info(
    `[greeting-ai] Posted "${timeSlot}" → source=${source} bankSize=${bankSize}` +
    (source === 'bank' ? ' (recycled from bank)' : '')
  );
}
