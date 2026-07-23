// AI/aiService.js
// Local AI service — single entry point for AI_PROVIDER=local mode.
//
// Pipeline:
//   1. Extract query from payload
//   2. Topic guard (Umacraft / Umamusume only)
//   3. Response cache check
//   4. Document search (docs/ tree)
//   5. Prompt assembly
//   6. Local model generation
//   7. Cache store
//   8. Return Discord text envelope
//
// Swapping the model only requires changing AI/model.js.
// The rest of the bot (gateway, dispatcher, Discord layer) is untouched.
//
// Public API:
//   initialize()                        — pre-warm model + doc index on startup
//   answer(payload) → Discord envelope  — handles one /ai or /ask interaction

import { generate } from './model.js';
import { initialize as initDocs, search, isOnTopic } from './documentSearch.js';
import { build as buildPrompt } from './promptBuilder.js';
import { get as cacheGet, set as cacheSet } from './cache.js';
import log from '../core/log.js';

const DISCORD_MAX = 2000;
let _initializationPromise = null;

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

/**
 * Pre-warm the model and document index.
 * Called once from RepositoryEngine.js at bot startup when AI_PROVIDER=local.
 * Non-fatal — failures are logged, not thrown.
 */
export function initialize() {
  if (_initializationPromise) return _initializationPromise;

  _initializationPromise = (async () => {
    await initDocs();   // fast — reads files from disk
    log.info('[AI/LocalService] Document index ready; model will load on first AI request.');
  })();

  return _initializationPromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorEnvelope(message, interaction) {
  return {
    success:   false,
    failedAt:  'AI/LocalService',
    error:     'LOCAL_AI_ERROR',
    message,
    retriable: false,
    interaction,
  };
}

function formatText(text) {
  if (text.length > DISCORD_MAX) {
    return text.slice(0, DISCORD_MAX - 3) + '...';
  }
  return text;
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

/**
 * Handle an AI command using the local model.
 *
 * @param {{
 *   query:       string,
 *   subcommand:  string,
 *   interaction: object,
 *   userId:      string,
 * }} payload
 * @returns {Promise<object>} Discord envelope
 */
export async function answer({ query, subcommand, interaction, userId }) {
  log.info(`[AI/LocalService] user=${userId} cmd=${subcommand} query="${query.slice(0, 60)}"`);

  // ── 1. Topic guard ────────────────────────────────────────────────────────
  if (!isOnTopic(query)) {
    return {
      success:   true,
      content:   '⚠️ I can only answer questions about UmaKraft, the bot commands, or Umamusume Pretty Derby.',
      ephemeral: true,
      interaction,
    };
  }

  // ── 2. Cache check ────────────────────────────────────────────────────────
  const cached = cacheGet(query);
  if (cached) {
    log.info('[AI/LocalService] Serving from cache.');
    return {
      success:   true,
      content:   formatText(cached),
      ephemeral: false,
      interaction,
    };
  }

  // ── 3. Document search ────────────────────────────────────────────────────
  let docs = [];
  try {
    const result = await search(query);
    docs = result.docs;
    if (!result.relevant && docs.length === 0) {
      const noDoc = 'That information is not documented in the UmaKraft knowledge base.';
      cacheSet(query, noDoc);
      return { success: true, content: noDoc, ephemeral: false, interaction };
    }
  } catch (err) {
    log.error(`[AI/LocalService] Document search failed: ${err.message}`);
    // Continue with empty context — model will say "not documented"
  }

  // ── 5. Prompt assembly ────────────────────────────────────────────────────
  const messages = buildPrompt(query, docs);

  // ── 6. Generate ───────────────────────────────────────────────────────────
  let text;
  try {
    const result = await generate(messages, { maxNewTokens: 300, temperature: 0.2 });
    text = result.text;
  } catch (err) {
    log.error(`[AI/LocalService] Generation failed: ${err.message}`);
    return errorEnvelope(`AI generation failed: ${err.message}`, interaction);
  }

  if (!text || text.length < 5) {
    return errorEnvelope('The model returned an empty response.', interaction);
  }

  // ── 7. Cache + return ─────────────────────────────────────────────────────
  cacheSet(query, text);

  // Append source file references if docs were found
  let content = formatText(text);
  if (docs.length > 0) {
    const sources = docs.slice(0, 3).map(d => `\`${d.file}\``).join(', ');
    const footer  = `\n\n📄 Sources: ${sources}`;
    if ((content + footer).length <= DISCORD_MAX) content += footer;
  }

  return {
    success:   true,
    content,
    ephemeral: false,
    interaction,
  };
}
