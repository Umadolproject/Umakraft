// Distribution/Coordinator/actions/autocomplete.js
// Routes autocomplete interactions to the appropriate suggestion provider.
// Discord requires a response within 3 seconds — all providers use a hard
// 2 500 ms timeout and fall back to an empty list on any failure.

import { searchTrainers } from '../../../umamoe/Miner/miner.js';

const AUTOCOMPLETE_TIMEOUT_MS = Number.parseInt(
  process.env.AUTOCOMPLETE_TIMEOUT_MS ?? '2500',
  10,
);

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
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

// ─── Trainer search ───────────────────────────────────────────────────────────

/**
 * Search Uma.moe for trainer names matching `query`.
 * Returns up to 25 ApplicationCommandOptionChoiceData objects.
 *
 * @param {string} query
 * @returns {Promise<Array<{ name: string, value: string }>>}
 */
async function trainerSuggestions(query) {
  const q = (query ?? '').trim();

  // Discord sends an empty string on first focus — show nothing until
  // the user has typed at least 2 characters to avoid meaningless results.
  if (q.length < 2) return [];

  const result = await withTimeout(AUTOCOMPLETE_TIMEOUT_MS, () =>
    searchTrainers({ q, limit: 25 }),
  );

  if (!result?.success) {
    log('error', `trainer search failed for query="${q}"`, { error: result?.error });
    return [];
  }

  // The search endpoint may return a plain array or { trainers: [...] }
  const raw = Array.isArray(result.data)
    ? result.data
    : (result.data?.trainers ?? result.data?.results ?? []);

  return raw
    .filter(t => t?.id != null && t?.name)
    .slice(0, 25)
    .map(t => {
      const label = String(t.name);
      return {
        // Discord enforces a 100-character limit on choice labels
        name:  label.length > 100 ? `${label.slice(0, 97)}…` : label,
        value: String(t.id),
      };
    });
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Handle an autocomplete interaction.
 *
 * @param {{ commandName: string, focusedOption: { name: string, value: string } }} payload
 * @returns {Promise<Array<{ name: string, value: string }>>}
 */
export async function autocomplete({ commandName, focusedOption }) {
  const { name: optionName, value } = focusedOption;

  if (commandName === 'link' && optionName === 'trainer') {
    return trainerSuggestions(value);
  }

  // Extend here for other commands that need autocomplete:
  // if (commandName === 'fan_gain' && optionName === 'trainer') ...

  return [];
}
