// AI/DailyGreeting.js
// Daily greeting system — 4 time-slotted AI-generated greetings with cache fallback.
//
// Schedule:  8 AM (morning), 12 PM (noon), 8 PM (night), 12 AM (midnight)
// Strategy:  Generate fresh → cache success → on failure, pick random from cache
//
// Cache file: /.nexus/tasks/daily-greetings/cache.json
//   { morning: [...], noon: [...], night: [...], midnight: [...] }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import log from '../core/log.js';
import { Router } from './router/Router.js';

// ---------------------------------------------------------------------------
// Time slot resolution
// ---------------------------------------------------------------------------

const TIME_SLOTS = {
  8:  'morning',
  12: 'noon',
  20: 'night',
  0:  'midnight',
};

/** @returns {'morning'|'noon'|'night'|'midnight'} */
export function getCurrentSlot() {
  const hour = new Date().getHours();
  return TIME_SLOTS[hour] ?? null;
}

// ---------------------------------------------------------------------------
// Prompt templates per time slot
// ---------------------------------------------------------------------------

const SLOT_PROMPTS = {
  morning: {
    vibe: 'energetic sunrise energy, fresh starts, new day of training',
    emojis: '🌅☀️🌄',
    themes: ['waking up to train', 'morning leaderboard check', 'fresh daily goals', 'breakfast motivation'],
  },
  noon: {
    vibe: 'midday momentum, lunch break check-in, afternoon push',
    emojis: '☀️🔥💪',
    themes: ['midday progress', 'afternoon grind', 'lunchtime leaderboard check', 'keeping the pace'],
  },
  night: {
    vibe: 'evening wind-down, reflecting on today\'s gains, rest and recovery',
    emojis: '🌙✨🌟',
    themes: ['winding down', 'reflecting on today', 'evening training recap', 'nighttime motivation'],
  },
  midnight: {
    vibe: 'late night dedication, the grind never stops, overnight gains',
    emojis: '🌌🦉🌠',
    themes: ['late night grind', 'overnight gains', 'dedication never sleeps', 'midnight leaderboard'],
  },
};

function buildPrompt(slot) {
  const s = SLOT_PROMPTS[slot];
  const theme = s.themes[Math.floor(Math.random() * s.themes.length)];

  return (
    `You are writing a daily greeting message for the Umakraft Discord server.\n\n` +
    `Time: ${slot} (${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })})\n` +
    `Vibe: ${s.vibe}\n` +
    `Theme: ${theme}\n` +
    `Available emojis: ${s.emojis}\n\n` +
    `Write a warm, engaging greeting that:\n` +
    `- Fits the ${slot} time of day — the right energy for this moment\n` +
    `- Mentions checking the leaderboard and pushing for higher fan counts\n` +
    `- Celebrates the circle's community spirit\n` +
    `- Ends with a motivating call to action\n` +
    `- Uses 1–2 emojis from the available set\n\n` +
    `Requirements:\n` +
    `- Between 80 and 150 words\n` +
    `- Start with \"@everyone\" on a blank line followed by the greeting\n` +
    `- Positive and community-appropriate tone\n` +
    `- Do NOT mention real-world events, politics, or anything outside Uma Musume / Umakraft\n` +
    `- End with a closing line like \"Let's go! 🔥\" or \"Train hard! 💪\"`
  );
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

const CACHE_DIR  = join(process.cwd(), '.nexus', 'tasks', 'daily-greetings');
const CACHE_FILE = join(CACHE_DIR, 'cache.json');
const MAX_CACHE_PER_SLOT = 10;

/** @returns {Promise<Record<string, string[]>>} */
async function loadCache() {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { morning: [], noon: [], night: [], midnight: [] };
  }
}

async function saveCache(cache) {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

/**
 * Store a successful greeting in the cache.
 * Keeps at most MAX_CACHE_PER_SLOT messages per time slot (FIFO eviction).
 */
export async function cacheMessage(slot, message) {
  if (!['morning', 'noon', 'night', 'midnight'].includes(slot)) return;

  const cache = await loadCache();
  cache[slot].push(message);
  if (cache[slot].length > MAX_CACHE_PER_SLOT) {
    cache[slot] = cache[slot].slice(-MAX_CACHE_PER_SLOT);
  }
  await saveCache(cache);
  log.info(`[DailyGreeting] Cached ${slot} greeting (${cache[slot].length} total for this slot).`);
}

/**
 * Get a random cached greeting for a time slot.
 * Returns null if no cached messages exist for this slot.
 */
export async function getFallbackMessage(slot) {
  const cache = await loadCache();
  const messages = cache[slot] ?? [];
  if (messages.length === 0) return null;

  const pick = messages[Math.floor(Math.random() * messages.length)];
  log.info(`[DailyGreeting] Random fallback from cache (${slot}, ${messages.length} cached).`);
  return pick;
}

/**
 * Get all cached messages for a slot.
 */
export async function getCachedMessages(slot) {
  const cache = await loadCache();
  return cache[slot] ?? [];
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Generate a daily greeting for the given time slot.
 *
 * Strategy:
 *   1. Try to generate a fresh AI greeting
 *   2. On success → cache it → return it
 *   3. On failure → pick random from cache → return it
 *   4. If no cache → return null (caller handles)
 *
 * @param {'morning'|'noon'|'night'|'midnight'} slot
 * @returns {Promise<{ message: string, source: 'ai'|'cache', cached: boolean } | null>}
 */
export async function generate(slot) {
  if (!SLOT_PROMPTS[slot]) {
    log.warn(`[DailyGreeting] Invalid slot: "${slot}"`);
    return null;
  }

  // ── 1. Try AI generation ──────────────────────────────────────────────
  try {
    log.info(`[DailyGreeting] Generating ${slot} greeting via AI...`);
    const prompt = buildPrompt(slot);
    const result = await Router.ai(prompt, { complexity: 'simple', maxTokens: 300 });

    const message = result.text?.trim();
    if (message && message.length > 20) {
      await cacheMessage(slot, message);
      log.info(`[DailyGreeting] AI generated ${slot} greeting (${message.length} chars).`);
      return { message, source: 'ai', cached: false };
    }
  } catch (err) {
    log.warn(`[DailyGreeting] AI generation failed for ${slot}: ${err.message}`);
  }

  // ── 2. Fall back to cache (random pick if 2+) ─────────────────────────
  const fallback = await getFallbackMessage(slot);
  if (fallback) {
    return { message: fallback, source: 'cache', cached: true };
  }

  log.error(`[DailyGreeting] No cache available for ${slot} — nothing to send.`);
  return null;
}
