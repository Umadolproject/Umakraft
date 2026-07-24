// Distribution/Coordinator/actions/autocomplete.js
// Routes autocomplete interactions to the appropriate suggestion provider.
// Discord requires a response within 3 seconds — all providers use a hard
// 2 500 ms timeout and fall back to an empty list on any failure.
//
// Trainer autocomplete strategy (local-first):
//   1. Query the local trainer DB (instant, no network).
//   2. If fewer than LOCAL_MIN_RESULTS found, also query the Uma.moe API and
//      upsert the results into the local DB for future queries.
//   3. Merge and deduplicate by trainer ID, return up to 25.

import { searchTrainers, fetchCircle } from '../../../umamoe/Miner/miner.js';
import { searchByName, upsertTrainers } from '../utils/trainerDb.js';
import { CONFIGURED_CIRCLES } from '../../../core/botConfig.js';
import { parseCircleId } from '../utils/parseCircle.js';

const AUTOCOMPLETE_TIMEOUT_MS = Number.parseInt(
  process.env.AUTOCOMPLETE_TIMEOUT_MS ?? '2500',
  10,
);

// Minimum local results before we bother hitting the live API.
const LOCAL_MIN_RESULTS = 8;

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'autocomplete',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

/**
 * Race `fn` against a timeout; resolve to null on timeout or error.
 */
async function withTimeout(ms, fn) {
  return Promise.race([
    fn().catch(() => null),
    new Promise(resolve => { setTimeout(() => resolve(null), ms); }),
  ]);
}

// ─── Trainer search (returns ID as value) ────────────────────────────────────
//
// Used by all trainer options EXCEPT ai.trainer_name.
// value = String(trainer.id)  — numeric trainer ID.
// Consumers detect a pure-numeric value and skip the name-search step.

/**
 * Search for trainer suggestions, local DB first, falling back to live API.
 *
 * @param {string} query
 * @returns {Promise<Array<{ name: string, value: string }>>}
 */
async function trainerSuggestions(query) {
  const q = (query ?? '').trim();

  // Always show local-DB results even for empty/short queries.
  // Only skip the live API call for very short queries (< 2 chars) to avoid
  // sending noisy API requests before the user has typed anything meaningful.

  // ── 1. Query local DB ────────────────────────────────────────────────────
  const localRows = await withTimeout(
    AUTOCOMPLETE_TIMEOUT_MS,
    () => searchByName(q, 25),
  ) ?? [];

  // Build a Map keyed by trainer_id to make deduplication easy.
  const byId = new Map(
    localRows.map(r => [r.trainer_id, r.trainer_name]),
  );

  // ── 2. Supplement with live API when local results are thin ──────────────
  if (q.length >= 2 && byId.size < LOCAL_MIN_RESULTS) {
    const apiResult = await withTimeout(AUTOCOMPLETE_TIMEOUT_MS, () =>
      searchTrainers({ q, limit: 25 }),
    );

    if (apiResult?.success) {
      // Search endpoint returns { items: [...], total, page, ... }
      // Each item has account_id and trainer_name (not id/name).
      const raw = apiResult.data?.items
        ?? (Array.isArray(apiResult.data) ? apiResult.data : []);

      const validRaw = raw.filter(t => t?.account_id != null && t?.trainer_name);

      // Upsert API results into local DB (fire-and-forget; don't block response).
      upsertTrainers(validRaw.map(t => ({ id: t.account_id, name: t.trainer_name }))).catch(() => {});

      for (const t of validRaw) {
        if (!byId.has(String(t.account_id))) {
          byId.set(String(t.account_id), String(t.trainer_name));
        }
      }
    } else {
      log('error', `trainer API search failed for query="${q}"`, {
        error: apiResult?.error,
      });
    }
  }

  // ── 3. Format and return up to 25 results ────────────────────────────────
  return [...byId.entries()]
    .slice(0, 25)
    .map(([id, name]) => {
      const label = String(name);
      return {
        name:  label.length > 100 ? `${label.slice(0, 97)}…` : label,
        value: id,
      };
    });
}

// ─── Trainer name search (returns display name as value) ─────────────────────
//
// Used only by ai.trainer_name, where the AI message generator needs the
// human-readable name, not the numeric ID.

/**
 * Like trainerSuggestions but returns the trainer's name as the value.
 *
 * @param {string} query
 * @returns {Promise<Array<{ name: string, value: string }>>}
 */
async function trainerNameSuggestions(query) {
  const suggestions = await trainerSuggestions(query);
  // Swap value from ID to display name (name field already holds the display name).
  return suggestions.map(s => ({ name: s.name, value: s.name }));
}

// ─── Circle autocomplete ──────────────────────────────────────────────────────
//
// Strategy:
//   1. Maintain a module-level cache of configured circle info (id → name).
//   2. On first call, fetch all configured circles from the API (fire-and-forget
//      subsequent refreshes keep the cache warm).
//   3. If the user typed a uma.moe/circles/{id} URL, parse the ID and suggest it.
//   4. Otherwise filter the cached list by partial ID or name match.

/** @type {Map<string, string>} circleId → display name */
const circleCache = new Map();
let circleCacheReady = false;
let circleCachePending = false;

async function warmCircleCache() {
  if (circleCacheReady || circleCachePending) return;
  circleCachePending = true;
  try {
    for (const id of CONFIGURED_CIRCLES) {
      const result = await withTimeout(AUTOCOMPLETE_TIMEOUT_MS, () => fetchCircle(id));
      if (!result?.success) continue;
      const d = result.data ?? {};
      const name =
        d.circle_name ?? d.name ?? d.title ?? d.circle?.name ?? d.circle?.circle_name ?? null;
      circleCache.set(String(id), name ? String(name) : `Circle ${id}`);
    }
    circleCacheReady = true;
  } catch {
    // Leave circleCache with whatever partial data we managed to fetch.
  } finally {
    circleCachePending = false;
  }
}

// Kick off cache warm immediately so the first interaction is fast.
warmCircleCache().catch(() => {});

/**
 * Suggest circles for the `circle` option.
 * value is always the plain numeric circle ID string.
 *
 * @param {string} query
 * @returns {Array<{ name: string, value: string }>}
 */
function circleSuggestions(query) {
  const q = (query ?? '').trim();

  // If the user pasted a URL, extract the ID and suggest it immediately.
  const parsed = parseCircleId(q);
  if (parsed && parsed !== q) {
    // URL was transformed — the extracted ID is the suggestion.
    const label = circleCache.get(parsed) ?? `Circle ${parsed}`;
    return [{ name: `${label} (${parsed})`, value: parsed }];
  }

  // Build candidates from the cache.
  const candidates = [];
  for (const [id, name] of circleCache) {
    candidates.push({ id, name });
  }

  // If nothing is cached yet, fall back to configured IDs.
  if (candidates.length === 0) {
    for (const id of CONFIGURED_CIRCLES) {
      candidates.push({ id: String(id), name: `Circle ${id}` });
    }
  }

  // Filter: empty / short query → return all; otherwise match by ID or name.
  const filtered = q.length < 2
    ? candidates
    : candidates.filter(c =>
        c.id.includes(q) || c.name.toLowerCase().includes(q.toLowerCase()),
      );

  return filtered.slice(0, 25).map(c => ({
    name:  c.name.length > 100 ? `${c.name.slice(0, 97)}…` : c.name,
    value: c.id,
  }));
}

// ─── Commands + option names that use trainer autocomplete ───────────────────

// value = String(trainer.id)
const TRAINER_ID_AUTOCOMPLETE = new Map([
  ['link',              new Set(['trainer'])],
  ['fan_gain',          new Set(['trainer'])],
  ['profile',           new Set(['trainer'])],
  ['total_fan',         new Set(['trainer'])],
  ['joindate',          new Set(['trainer'])],
  ['search_trainer',    new Set(['trainer'])],
  ['admin_setjoindate', new Set(['trainer'])],
  ['test_milestone',    new Set(['trainer'])],
]);

// value = trainer display name (string)
const TRAINER_NAME_AUTOCOMPLETE = new Map([
  ['ai', new Set(['trainer_name'])],
]);

// ─── Commands + option names that use circle autocomplete ────────────────────

const CIRCLE_AUTOCOMPLETE = new Map([
  ['fan_gain',             new Set(['circle'])],
  ['profile',              new Set(['circle'])],
  ['leaderboard',          new Set(['circle'])],
  ['total_fan',            new Set(['circle'])],
  ['total_circlefan_gain', new Set(['circle'])],
  ['circle_master',        new Set(['circle'])],
  ['memberlist',           new Set(['circle'])],
  ['link',                 new Set(['circle'])],
  ['set_fans',             new Set(['circle'])],
]);

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Handle an autocomplete interaction.
 *
 * @param {{ commandName: string, focusedOption: { name: string, value: string } }} payload
 * @returns {Promise<Array<{ name: string, value: string }>>}
 */
export async function autocomplete({ commandName, focusedOption }) {
  const { name: optionName, value } = focusedOption;

  if (TRAINER_ID_AUTOCOMPLETE.get(commandName)?.has(optionName)) {
    return trainerSuggestions(value);
  }

  if (TRAINER_NAME_AUTOCOMPLETE.get(commandName)?.has(optionName)) {
    return trainerNameSuggestions(value);
  }

  if (CIRCLE_AUTOCOMPLETE.get(commandName)?.has(optionName)) {
    // Refresh the cache in the background if it has gone stale.
    if (!circleCacheReady) warmCircleCache().catch(() => {});
    return circleSuggestions(value);
  }

  return [];
}
