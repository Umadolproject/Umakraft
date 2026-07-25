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
import config from '../../../AI/Configuration.js';
import { log as logQuestion } from '../../../Operation/AskLogger.js';
import log from '../../../core/log.js';

const DISCORD_MAX = 2000;
const LOW_CONFIDENCE_THRESHOLD = 0.65;

function resolvePromptMode(subcommand, topic, query) {
  switch (subcommand) {
    case 'search': return 'search';
    case 'explain': return 'explain';
    case 'docs': return 'docs';
    case 'glossary': return 'glossary';
    case 'live': return 'knowledge';
    default:
      // Detect command-help intents for /ask
      if (isCommandHelpQuery(query)) return 'assistant';
      return topic === 'umamusume' ? 'knowledge' : 'repository';
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
    case 'explain': return options.topic ?? '';
    case 'search': return options.query ?? '';
    case 'docs': return options.file ?? '';
    case 'glossary': return options.term ?? '';
    case 'message': return options.type ?? '';
    case 'live': return options.query ?? '';
    default: return options.question ?? options.query ?? '';
  }
}

function formatResponse(text, citations) {
  let content = text;
  if (citations && citations.length > 0) {
    content += '\n\n**Sources:** ' + citations.slice(0, 5).map(citation => `\`${citation}\``).join(', ');
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
  const { subcommand, options, interaction } = payload;
  const query = extractQuery(subcommand, options);

  // Helper: log the question outcome before returning
  const finalize = (result) => {
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

  const commandOverride = subcommand === 'ask' ? '/ask' : `/ai ${subcommand}`;
  const classification = classify(query, commandOverride);

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
    const localResult = await localAnswer({ query, subcommand, interaction, userId: payload.userId });
    return finalize({ ...localResult, _topic: classification.topic, _complexity: classification.complexity });
  }

  // ── Response cache check — same question = instant answer, no API calls ──
  const cached = getResponse(query, classification.topic, { subcommand });
  if (cached) {
    log.info(
      `[AI/Gateway] Cache HIT user=${payload.userId} topic=${classification.topic} ` +
      `query="${query.slice(0, 60)}"`
    );
    return finalize({
      success: true,
      content: formatResponse(cached.text, cached.citations ?? []),
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
    if (classification.topic === 'live') {
      chunks = await Router.search(query);
    } else if (promptMode === 'assistant') {
      // Command-help query — use Knowledge Engine (includes Command Primer)
      chunks = knowledgeGetContext(query);
      // Also search repo for relevant command docs
      const repoChunks = await repositoryEngine.search(query);
      chunks = [...chunks, ...repoChunks];
    } else if (classification.topic === 'umamusume') {
      chunks = knowledgeGetContext(query);
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
  const prompt = assemblePrompt(promptMode, context, query);

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

  return finalize({
    success: true,
    content: formatResponse(text, showCitations ? citations : []),
    ephemeral: false,
    interaction,
    _topic: classification.topic,
    _complexity: classification.complexity,
    _citations: showCitations ? citations : [],
  });
}
