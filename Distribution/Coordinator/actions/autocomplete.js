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

import { searchTrainers }   from '../../../umamoe/Miner/miner.js';
import { searchByName, upsertTrainers } from '../utils/trainerDb.js';

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

  // Discord sends an empty string on first focus — show nothing until
  // the user has typed at least 2 characters.
  if (q.length < 2) return [];

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
  if (byId.size < LOCAL_MIN_RESULTS) {
    const apiResult = await withTimeout(AUTOCOMPLETE_TIMEOUT_MS, () =>
      searchTrainers({ q, limit: 25 }),
    );

    if (apiResult?.success) {
      const raw = Array.isArray(apiResult.data)
        ? apiResult.data
        : (apiResult.data?.trainers ?? apiResult.data?.results ?? []);

      const validRaw = raw.filter(t => t?.id != null && t?.name);

      // Upsert API results into local DB (fire-and-forget; don't block response).
      upsertTrainers(validRaw.map(t => ({ id: t.id, name: t.name }))).catch(() => {});

      for (const t of validRaw) {
        if (!byId.has(String(t.id))) {
          byId.set(String(t.id), String(t.name));
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

  return [];
}
