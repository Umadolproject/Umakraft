// fantracking/milestone/tiers.js
// Milestone tier configuration — daily and monthly fan-gain thresholds.
//
// Daily:  reset every day, 5 tiers (1M → 3M → 5M → 7M → 10M)
// Monthly: cumulative per calendar month, 10 tiers (10M → 100M)
//
// Only the HIGHEST tier crossed fires per trainer per period.
// If trainer gains 11M daily → Legend fires (not Minimum through Competitive).
// If trainer hits 60M monthly → Diamond Guardian fires (not Tiers 1–5).
//
// Authority: Broadcast/archive-inspector/archive-inspector.md
// Spec:      AI/prompts/Milestone.md

// ---------------------------------------------------------------------------
// Daily milestone tiers — based on single-day fan gain
// ---------------------------------------------------------------------------

/**
 * @typedef {object} DailyTier
 * @property {number}  threshold    — fan gain required to trigger (inclusive)
 * @property {string}  label        — display name
 * @property {string}  emoji        — celebration emoji
 * @property {string}  tone         — message tone descriptor
 */

/** @type {DailyTier[]} */
export const DAILY_TIERS = [
  { threshold:  1_000_000, label: 'Minimum',     emoji: '⏳', tone: 'encouraging — "the grind begins"' },
  { threshold:  3_000_000, label: 'Good',         emoji: '👍', tone: 'affirming — "building real momentum"' },
  { threshold:  5_000_000, label: 'Excellent',    emoji: '⭐', tone: 'impressive — "leaderboard is noticing"' },
  { threshold:  7_000_000, label: 'Competitive',  emoji: '🔥', tone: 'elite — "setting the standard"' },
  { threshold: 10_000_000, label: 'Legend',        emoji: '👑', tone: 'legendary — "redefining what is possible"' },
];

// ---------------------------------------------------------------------------
// Monthly milestone tiers — based on cumulative monthly fan gain
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MonthlyTier
 * @property {number}  threshold    — fan gain required to trigger (inclusive)
 * @property {number}  tierNumber   — 1–10
 * @property {string}  label        — competitive title
 * @property {string}  emoji        — competitive emoji
 * @property {string}  tone         — message tone descriptor
 */

/** @type {MonthlyTier[]} */
export const MONTHLY_TIERS = [
  { threshold:  10_000_000, tierNumber: 1,  label: 'Unpopular Trainer',     emoji: '😴', tone: 'teasing — "wake up, the leaderboard is watching"' },
  { threshold:  20_000_000, tierNumber: 2,  label: 'Lazy Trainer',          emoji: '🥱', tone: 'playful nudge — "you could do better"' },
  { threshold:  30_000_000, tierNumber: 3,  label: 'Minimum Fan Hoarder',   emoji: '📦', tone: 'grudging respect — "okay, you are stacking"' },
  { threshold:  40_000_000, tierNumber: 4,  label: 'Elite Trainer',          emoji: '💪', tone: 'genuine respect — "now we are talking"' },
  { threshold:  50_000_000, tierNumber: 5,  label: 'Super Elite Trainer',    emoji: '⚡', tone: 'impressed — "elite among elites"' },
  { threshold:  60_000_000, tierNumber: 6,  label: 'Expert Hoarder',         emoji: '🏆', tone: 'acknowledging — "this is a serious operation"' },
  { threshold:  70_000_000, tierNumber: 7,  label: 'Super Expert Hoarder',   emoji: '🔥', tone: 'competitive fire — "nobody is catching you"' },
  { threshold:  80_000_000, tierNumber: 8,  label: 'Competitive',            emoji: '⚔️', tone: 'battle-ready — "you are a threat to everyone"' },
  { threshold:  90_000_000, tierNumber: 9,  label: 'Super Competitive',      emoji: '🔱', tone: 'dominant — "the circle fears your name"' },
  { threshold: 100_000_000, tierNumber: 10, label: 'Legendary',              emoji: '👑', tone: 'ultimate — "you are the standard. everyone else is chasing."' },
];

// ---------------------------------------------------------------------------
// Helper: resolve the highest tier crossed
// ---------------------------------------------------------------------------

/**
 * Find the highest tier a trainer crossed for the given fan gain.
 * Returns null if no tier was crossed.
 *
 * @param {number} fanGain          — fan gain amount (daily or monthly)
 * @param {'daily'|'monthly'} type
 * @returns {{ threshold: number, label: string, emoji: string, tone: string, tierNumber?: number, type: 'daily'|'monthly' } | null}
 */
export function resolveTier(fanGain, type = 'daily') {
  const tiers = type === 'monthly' ? MONTHLY_TIERS : DAILY_TIERS;

  // Tiers are sorted ascending — find the last (highest) one crossed
  let best = null;
  for (const tier of tiers) {
    if (fanGain >= tier.threshold) {
      best = tier;
    }
  }

  if (!best) return null;
  return { ...best, type };
}

/**
 * Get the highest threshold for each type (used for cap checks).
 */
export function maxThreshold(type = 'daily') {
  const tiers = type === 'monthly' ? MONTHLY_TIERS : DAILY_TIERS;
  return tiers[tiers.length - 1].threshold;
}

/**
 * Get the lowest threshold for each type (minimum bar to fire any milestone).
 */
export function minThreshold(type = 'daily') {
  const tiers = type === 'monthly' ? MONTHLY_TIERS : DAILY_TIERS;
  return tiers[0].threshold;
}

/**
 * Get all tier labels in order — used by the milestone UI/config display.
 */
export function allLabels(type = 'daily') {
  const tiers = type === 'monthly' ? MONTHLY_TIERS : DAILY_TIERS;
  return tiers.map(t => ({ label: t.label, threshold: t.threshold, emoji: t.emoji }));
}
