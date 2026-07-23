// Distribution/Coordinator/actions/aiGateway.js
// AI Knowledge Service command gateway.
//
// Routes /ask and all /ai subcommands through the full AI pipeline:
//   TopicFilter → Engine → ContextBuilder → PromptSystem → APIProvider
//   → ResponseValidator → Discord text envelope
//
// Architecture: AI/ARCHITECTURE.md
// Owner: Distribution/Coordinator (pipeline stage 4)

import { classify, offTopicMessage }                          from '../../../AI/TopicFilter.js';
import * as repositoryEngine                                  from '../../../AI/RepositoryEngine.js';
import { getContext as knowledgeGetContext }                  from '../../../AI/KnowledgeEngine.js';
import { search as webSearch, searchFallback as webFallback } from '../../../AI/WebSearchEngine.js';
import { generate as messageGenerate }                        from '../../../AI/MessageSystem.js';
import { build as buildContext }                              from '../../../AI/ContextBuilder.js';
import { assemble as assemblePrompt }                         from '../../../AI/PromptSystem.js';
import { generate as apiGenerate }                            from '../../../AI/APIProvider.js';
import { validate }                                           from '../../../AI/ResponseValidator.js';
import { answer as localAnswer }                              from '../../../AI/aiService.js';
import config                                                 from '../../../AI/Configuration.js';
import log                                                    from '../../../core/log.js';

// Discord message content cap
const DISCORD_MAX = 2000;

// Confidence below which we augment repository results with a web fallback
const LOW_CONFIDENCE_THRESHOLD = 0.65;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pick the PromptSystem mode for the given subcommand / topic pair.
 */
function resolvePromptMode(subcommand, topic) {
  switch (subcommand) {
    case 'search':   return 'search';
    case 'explain':  return 'explain';
    case 'docs':     return 'docs';
    case 'glossary': return 'glossary';
    case 'live':     return 'knowledge';
    default:         return topic === 'umamusume' ? 'knowledge' : 'repository';
  }
}

/**
 * Pull the user's raw query string out of the options object.
 */
function extractQuery(subcommand, options) {
  switch (subcommand) {
    case 'ask':      return options.question ?? '';
    case 'explain':  return options.topic    ?? '';
    case 'search':   return options.query    ?? '';
    case 'docs':     return options.file     ?? '';
    case 'glossary': return options.term     ?? '';
    case 'message':  return options.type     ?? '';
    case 'live':     return options.query    ?? '';
    default:         return options.question ?? options.query ?? '';
  }
}

/**
 * Trim text to Discord's content limit and optionally append citations.
 */
function formatResponse(text, citations) {
  let content = text;
  if (citations && citations.length > 0) {
    content += '\n\n**Sources:** ' + citations.slice(0, 5).map(c => `\`${c}\``).join(', ');
  }
  if (content.length > DISCORD_MAX) {
    content = content.slice(0, DISCORD_MAX - 3) + '...';
  }
  return content;
}

/** Build a failure envelope passed to the Dispatcher's error formatter. */
function errorEnvelope(message, interaction) {
  return {
    success:   false,
    failedAt:  'AI/Gateway',
    error:     'AI_GATEWAY_ERROR',
    message,
    retriable: true,
    interaction,
  };
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

/**
 * AI command gateway — single entry point for /ask and all /ai subcommands.
 *
 * @param {{
 *   subcommand:   string,
 *   options:      object,
 *   interaction:  object,
 *   guildId:      string,
 *   userId:       string,
 *   channelId:    string,
 * }} payload
 */
export async function aiCommand(payload) {
  const { subcommand, options, interaction } = payload;

  const query = extractQuery(subcommand, options);

  if (!query.trim()) {
    return {
      success:   true,
      content:   '⚠️ Please provide a question or query.',
      ephemeral: true,
      interaction,
    };
  }

  // ── Local AI provider — bypass cloud pipeline entirely ───────────────────
  if (config.aiProvider === 'local') {
    return localAnswer({ query, subcommand, interaction, userId: payload.userId });
  }

  // ── 1. Classify ─────────────────────────────────────────────────────────
  const commandOverride = subcommand === 'ask' ? '/ask' : `/ai ${subcommand}`;
  const classification  = classify(query, commandOverride);

  log.info(
    `[AI/Gateway] user=${payload.userId} cmd=${commandOverride} ` +
    `topic=${classification.topic} complexity=${classification.complexity} ` +
    `confidence=${classification.confidence?.toFixed(2)}`
  );

  if (classification.rejected) {
    return {
      success:   true,
      content:   classification.rejectionMessage ?? offTopicMessage(),
      ephemeral: true,
      interaction,
    };
  }

  // ── 2. Message topic — delegate entirely to MessageSystem ────────────────
  if (classification.topic === 'message') {
    try {
      const variables = {
        trainerName:     options.trainer_name     ?? undefined,
        milestoneValue:  options.milestone_value  ?? undefined,
        achievementName: options.achievement_name ?? undefined,
        eventName:       options.event_name       ?? undefined,
        eventDate:       options.event_date        ?? undefined,
        deficitAmount:   options.deficit_amount   ?? undefined,
        topic:           options.topic            ?? undefined,
        topTrainers:     [],
      };
      const { message } = await messageGenerate(options.type, variables);
      const content = message.length > DISCORD_MAX
        ? message.slice(0, DISCORD_MAX - 3) + '...'
        : message;
      return { success: true, content, ephemeral: false, interaction };
    } catch (err) {
      log.error(`[AI/Gateway] MessageSystem error: ${err.message}`);
      return errorEnvelope(`Failed to generate message: ${err.message}`, interaction);
    }
  }

  // ── 3. Retrieve relevant chunks from the appropriate engine ──────────────
  let chunks = [];
  try {
    if (classification.topic === 'live') {
      chunks = await webSearch(query);
    } else if (classification.topic === 'umamusume') {
      // KnowledgeEngine.getContext() is synchronous
      chunks = knowledgeGetContext(query);
    } else {
      // repository — /ask, /ai search, /ai explain, /ai docs
      chunks = await repositoryEngine.search(query);
      // Augment with web results when local confidence is low
      if (classification.confidence < LOW_CONFIDENCE_THRESHOLD && chunks.length < 3) {
        const webChunks = await webFallback(query, classification.confidence);
        chunks = [...chunks, ...webChunks];
      }
    }
  } catch (err) {
    log.error(`[AI/Gateway] Engine retrieval error: ${err.message}`);
    return errorEnvelope(
      `AI knowledge retrieval failed: ${err.message}`,
      interaction
    );
  }

  // ── 4. Build context window ──────────────────────────────────────────────
  const { context, citations } = buildContext([chunks]);

  // ── 5. Assemble prompt ───────────────────────────────────────────────────
  const promptMode = resolvePromptMode(subcommand, classification.topic);
  const prompt     = assemblePrompt(promptMode, context, query);

  // ── 6. Generate via AI provider ──────────────────────────────────────────
  let text;
  try {
    const result = await apiGenerate(prompt, { complexity: classification.complexity });
    text = result.text;
  } catch (err) {
    log.error(`[AI/Gateway] APIProvider error: ${err.message}`);
    return errorEnvelope(err.message, interaction);
  }

  // ── 7. Validate response ─────────────────────────────────────────────────
  const validation = validate(text, classification.topic);

  if (validation.action === 'hard-reject') {
    log.warn(`[AI/Gateway] Hard-reject — ${validation.failureReasons.join(', ')}`);
    return errorEnvelope(
      'The AI response failed safety validation and was not delivered. Please rephrase your question.',
      interaction
    );
  }

  // Show source citations only for repository-scoped responses
  const showCitations = classification.topic === 'repository';

  return {
    success:   true,
    content:   formatResponse(text, showCitations ? citations : []),
    ephemeral: false,
    interaction,
  };
}
