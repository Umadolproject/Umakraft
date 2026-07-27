// Distribution/Coordinator/actions/aiGateway.js
// AI Knowledge Service command gateway.

import { classify, offTopicMessage } from '../../../AI/TopicFilter.js';
import * as repositoryEngine from '../../../AI/RepositoryEngine.js';
import { getContext as knowledgeGetContext } from '../../../AI/KnowledgeEngine.js';
import { generate as messageGenerate } from '../../../AI/MessageSystem.js';
import { build as buildContext } from '../../../AI/ContextBuilder.js';
import { assemble as assemblePrompt } from '../../../AI/PromptSystem.js';
import { validate } from '../../../AI/ResponseValidator.js';
import { answer as localAnswer } from '../../../AI/aiService.js';
import { Router } from '../../../AI/router/Router.js';
import { getResponse, setResponse } from '../../../AI/Cache.js';
import { scopeUmaQuery } from '../../../AI/WebSearchEngine.js';
import config from '../../../AI/Configuration.js';
import { log as logQuestion } from '../../../Operation/AskLogger.js';
import log from '../../../core/log.js';
import { recordRequestStart, recordRequestEnd } from '../../../AI/AIObserver.js';
import {
  addConversationTurn,
  getConversationContext,
  formatWithCitations,
  formatConfidence,
  detectLanguage,
  instructionForLanguage,
} from '../../../AI/AdvancedFeatures.js';

// Agent Layer — opt-in via AI_AGENT_ENABLED=true
let _agent = null;
async function _getAgent() {
  if (!_agent) {
    try {
      const mod = await import('../../../AI/Agent.js');
      _agent = mod.orchestrate;
    } catch { /* Agent not available */ }
  }
  return _agent;
}

const DISCORD_MAX = 2000;
const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Track latest classification confidence for display in responses */
let _latestConfidence = null;

function resolvePromptMode(subcommand, topic, query) {
  switch (subcommand) {
    case 'search': return 'search';
    case 'docs': return 'docs';
    case 'live': return 'knowledge';
    case 'browse': return 'knowledge';
    default:
      // Detect command-help intents for /ask
      if (isCommandHelpQuery(query)) return 'assistant';
      if (topic === 'umamusume') return 'knowledge';
      if (topic === 'web') return 'web';
      return 'repository';
  }
}

/** Detect if a user query is asking for bot command help */
function isCommandHelpQuery(query) {
  const lower = query.toLowerCase();
  const patterns = [
    /link\s*(me|myself|my|please)/, /how.*(link|linked|linking)/,
    /(please|can you|how do I).*link/, /i('m| am) not linked/,
    /how.*(fan|fans|my fan|many fan)/, /how.*(profile|leaderboard)/,
    /(show|check|see).*(my|me).*(fan|profile|rank)/,
    /what (command|commands).*(link|fan|profile)/,
    /(help me|how to).*(link|bot|command)/,
  ];
  return patterns.some(p => p.test(lower));
}

function extractQuery(subcommand, options) {
  switch (subcommand) {
    case 'ask': return options.question ?? '';
    case 'search': return options.query ?? '';
    case 'docs': return options.file ?? '';
    case 'message': return options.type ?? '';
    case 'live': return options.query ?? '';
    case 'browse': return options.query ?? '';
    default: return options.question ?? options.query ?? '';
  }
}

function formatResponse(text, citations, topic, userId) {
  // Apply citation formatting (considers citation mode per-user)
  let content = formatWithCitations(text, citations ?? [], topic, userId);

  // Apply confidence score
  if (_latestConfidence != null) {
    content += formatConfidence(_latestConfidence, topic);
  }

  if (content.length > DISCORD_MAX) {
    content = `${content.slice(0, DISCORD_MAX - 3)}...`;
  }
  return content;
}

function errorEnvelope(message, interaction) {
  return {
    success: false,
    failedAt: 'AI/Gateway',
    error: 'AI_GATEWAY_ERROR',
    message,
    retriable: true,
    interaction,
  };
}

export async function aiCommand(payload) {
  const startTime = Date.now();
  const requestCtx = recordRequestStart();
  const { subcommand, options, interaction } = payload;
  const query = extractQuery(subcommand, options);

  // Helper: log the question outcome before returning
  const finalize = (result) => {
    // Record latency in AIObserver for health monitoring
    recordRequestEnd(requestCtx, {
      topic:     result._topic ?? 'unknown',
      cacheHit:  false,
      aiCalled:  false,
      aiFailed:  result.success === false,
      rejected:  result._topic === 'rejected',
    });

    logQuestion({
      userId:          payload.userId,
      username:        interaction?.user?.username ?? null,
      guildId:         payload.guildId ?? null,
      channelId:       payload.channelId ?? null,
      command:         subcommand === 'ask' ? '/ask' : `/ai ${subcommand}`,
      subcommand,
      query,
      topic:           result._topic ?? 'unknown',
      complexity:      result._complexity ?? null,
      responsePreview: result.content ?? null,
      citations:       result._citations ?? null,
      success:         result.success !== false,
      errorMessage:    result.error ?? result.message ?? null,
      durationMs:      Date.now() - startTime,
    }).catch(() => {}); // fire-and-forget — never block the response
    return result;
  };

  if (!query.trim()) {
    return finalize({
      success: true,
      content: '⚠️ Please provide a question or query.',
      ephemeral: true,
      interaction,
      _topic: 'empty',
    });
  }

  const commandOverride = subcommand === 'ask' ? '/ask'
    : `/ai ${subcommand}`;
  const classification = classify(query, commandOverride);

  // Track confidence for display in responses
  _latestConfidence = classification.confidence;

  log.info(
    `[AI/Gateway] user=${payload.userId} cmd=${commandOverride} ` +
    `topic=${classification.topic} complexity=${classification.complexity} ` +
    `confidence=${classification.confidence?.toFixed(2)}`
  );

  if (classification.rejected) {
    return finalize({
      success: true,
      content: classification.rejectionMessage ?? offTopicMessage(),
      ephemeral: true,
      interaction,
      _topic: 'rejected',
    });
  }

  if (classification.topic === 'message') {
    try {
      const variables = {
        trainerName: options.trainer_name ?? undefined,
        milestoneValue: options.milestone_value ?? undefined,
        achievementName: options.achievement_name ?? undefined,
        eventName: options.event_name ?? undefined,
        eventDate: options.event_date ?? undefined,
        deficitAmount: options.deficit_amount ?? undefined,
        topic: options.topic ?? undefined,
        topTrainers: [],
      };
      const { message } = await messageGenerate(options.type, variables);
      const content = message.length > DISCORD_MAX ? `${message.slice(0, DISCORD_MAX - 3)}...` : message;
      return finalize({ success: true, content, ephemeral: false, interaction, _topic: 'message', _complexity: 'simple' });
    } catch (err) {
      log.error(`[AI/Gateway] MessageSystem error: ${err.message}`);
      return finalize({ ...errorEnvelope(`Failed to generate message: ${err.message}`, interaction), _topic: 'message' });
    }
  }

  if (config.aiProvider === 'local') {
    const retrievalOverride = (subcommand === 'browse' || subcommand === 'search') ? 'web-only' : undefined;
    const localResult = await localAnswer({ query, subcommand, interaction, userId: payload.userId, retrievalOverride });

    // ── Feed into LearningManager ───────────────────────────────────────
    try {
      const lm = global.__learningManager;
      if (lm && payload.userId && localResult.success) {
        lm.process({
          userId:   payload.userId,
          query,
          response: localResult.content ?? '',
          metadata: { interactionId: interaction?.id, domain: classification.topic },
        }).catch(() => {});
      }
    } catch { /* learning is additive */ }

    return finalize({ ...localResult, _topic: classification.topic, _complexity: classification.complexity });
  }

  // ── Agent Layer path (opt-in via AI_AGENT_ENABLED=true) ────────────────
  if (config.aiAgentEnabled) {
    try {
      const orchestrate = await _getAgent();
      if (orchestrate) {
        log.info(`[AI/Gateway] Agent path — topic=${classification.topic} complexity=${classification.complexity}`);

        const agentResult = await orchestrate({
          query,
          subcommand,
          userId: payload.userId,
          channelId: payload.channelId,
          guildId: payload.guildId,
        });

        // Store in conversation memory
        if (payload.userId && payload.channelId && agentResult.success && agentResult.content) {
          addConversationTurn(payload.userId, payload.channelId, query, agentResult.content);
        }

        // ── Feed into LearningManager ───────────────────────────────────
        try {
          const lm = global.__learningManager;
          if (lm && payload.userId && agentResult.success) {
            lm.process({
              userId:   payload.userId,
              query,
              response: agentResult.content ?? '',
              metadata: {
                interactionId: interaction?.id,
                domain:        classification.topic,
                citations:     agentResult.citations,
              },
            }).catch(() => {});
          }
        } catch { /* learning is additive */ }

        return finalize({
          success: agentResult.success,
          content: agentResult.content ?? 'I was unable to process that request.',
          ephemeral: false,
          interaction,
          _topic: agentResult.topic ?? classification.topic,
          _complexity: agentResult.complexity ?? classification.complexity,
          _citations: agentResult.citations ?? [],
        });
      }
    } catch (err) {
      log.error(`[AI/Gateway] Agent path failed — falling back to classic: ${err.message}`);
    }
  }

  // ── Classic pipeline path (default) ────────────────────────────────────
  // ── Response cache check — same question = instant answer, no API calls ──
  const cached = getResponse(query, classification.topic, { subcommand });
  if (cached) {
    log.info(
      `[AI/Gateway] Cache HIT user=${payload.userId} topic=${classification.topic} ` +
      `query="${query.slice(0, 60)}"`
    );
    return finalize({
      success: true,
      content: formatResponse(cached.text, cached.citations ?? [], classification.topic, payload.userId),
      ephemeral: false,
      interaction,
      _topic: classification.topic,
      _complexity: classification.complexity,
      _citations: cached.citations ?? [],
    });
  }

  let chunks;
  const promptMode = resolvePromptMode(subcommand, classification.topic, query);

  try {
    // /browse and /search force web-only search
    if (subcommand === 'browse' || subcommand === 'search') {
      chunks = await Router.search(query);
    } else if (classification.topic === 'live' || classification.topic === 'web') {
      chunks = await Router.search(query);
      // Low-confidence web results often miss character names, game terms, etc.
      // Supplement with knowledge base so the AI has relevant domain context.
      if (classification.confidence < LOW_CONFIDENCE_THRESHOLD) {
        try {
          const kbChunks = knowledgeGetContext(query);
          if (kbChunks.length > 0) {
            chunks = [...kbChunks, ...chunks];
          }
        } catch { /* knowledge base is additive */ }
      }
    } else if (promptMode === 'assistant') {
      // Command-help query — use Knowledge Engine (includes Command Primer)
      chunks = knowledgeGetContext(query);
      // Also search repo for relevant command docs
      const repoChunks = await repositoryEngine.search(query);
      chunks = [...chunks, ...repoChunks];
    } else if (classification.topic === 'umamusume') {
      // Knowledge base as foundation
      chunks = knowledgeGetContext(query);
      // Always supplement with site-scoped web search (trusted uma sites only)
      try {
        const umaQuery = scopeUmaQuery(query);
        const webChunks = await Router.search(umaQuery);
        chunks = [...chunks, ...webChunks];
      } catch { /* web search is additive — fine if it fails */ }
    } else {
      chunks = await repositoryEngine.search(query);
      if (classification.confidence < LOW_CONFIDENCE_THRESHOLD && chunks.length < 3) {
        const webChunks = await Router.search(query);
        chunks = [...chunks, ...webChunks];
      }
    }
  } catch (err) {
    log.error(`[AI/Gateway] Engine retrieval error: ${err.message}`);
    return finalize({ ...errorEnvelope(`AI knowledge retrieval failed: ${err.message}`, interaction), _topic: classification.topic, _complexity: classification.complexity });
  }

  const { context, citations } = buildContext([chunks]);

  // ── Inject conversation memory from previous turns ──────────────────────
  // Only inject when confidence is adequate — low-confidence contexts
  // often contain incorrect answers that poison subsequent prompts.
  let memoryContext = '';
  if (payload.userId && payload.channelId && classification.confidence >= LOW_CONFIDENCE_THRESHOLD) {
    memoryContext = getConversationContext(payload.userId, payload.channelId);
  }
  const mergedContext = memoryContext
    ? `${memoryContext}\n\n---\n\n${context}`
    : context;

  // ── Detect user language for multi-language response ────────────────────
  const { lang: userLang } = detectLanguage(query);
  const langInstruction = instructionForLanguage(userLang);

  let prompt = assemblePrompt(promptMode, mergedContext, query);
  if (langInstruction) {
    prompt += langInstruction;
  }

  // ── Enrich with LearningManager memory context ─────────────────────────
  try {
    const lm = global.__learningManager;
    if (lm && payload.userId) {
      const memories = await lm.retrieveContext(query, payload.userId);
      if (memories && memories.length > 0) {
        const memoryLines = memories.slice(0, 5).map(m =>
          `- ${m.content} (${m.tier}, confidence: ${m.confidence?.toFixed(2) ?? '?'})`
        );
        prompt += `\n\n[Relevant memories from past interactions:]\n${memoryLines.join('\n')}`;
      }
    }
  } catch { /* memory enrichment is additive — fine if it fails */ }

  let text;
  try {
    const result = await Router.ai(prompt, { complexity: classification.complexity });
    text = result.text;
  } catch (err) {
    log.error(`[AI/Gateway] APIProvider error: ${err.message}`);
    return finalize({ ...errorEnvelope(err.message, interaction), _topic: classification.topic, _complexity: classification.complexity });
  }

  const validation = validate(text, classification.topic);
  if (validation.action === 'hard-reject') {
    log.warn(`[AI/Gateway] Hard-reject — ${validation.failureReasons.join(', ')}`);
    return finalize({ ...errorEnvelope(
      'The AI response failed safety validation and was not delivered. Please rephrase your question.',
      interaction
    ), _topic: classification.topic, _complexity: classification.complexity });
  }

  const showCitations = classification.topic === 'repository';

  // ── Cache the validated response for future identical questions ──
  setResponse(query, classification.topic, { text, citations, model: 'cloud', tokens: 0 }, { subcommand });
  log.info(
    `[AI/Gateway] Cache STORE topic=${classification.topic} query="${query.slice(0, 60)}"`
  );

  // ── Store this turn in conversation memory (only for confident answers) ──
  // Low-confidence responses may contain incorrect content that poisons
  // subsequent prompts. Skip storage to prevent answer repetition.
  if (payload.userId && payload.channelId && classification.confidence >= LOW_CONFIDENCE_THRESHOLD) {
    addConversationTurn(payload.userId, payload.channelId, query, text);
  }

  // ── Feed into LearningManager for cognitive learning ────────────────────
  try {
    const lm = global.__learningManager;
    if (lm && payload.userId) {
      lm.process({
        userId:   payload.userId,
        query,
        response: text,
        metadata: {
          interactionId: interaction?.id,
          domain:        classification.topic,
          sources:       citations,
          retrieved:     chunks,
        },
      }).catch(() => {}); // fire-and-forget
    }
  } catch { /* learning is additive — fine if it fails */ }

  return finalize({
    success: true,
    content: formatResponse(text, citations, classification.topic, payload.userId),
    ephemeral: false,
    interaction,
    _topic: classification.topic,
    _complexity: classification.complexity,
    _citations: citations,
  });
}
