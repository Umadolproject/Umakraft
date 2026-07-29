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
import { getResponse, setResponse, responseKey } from '../../../AI/Cache.js';
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

// ── Inline Synthesizer ───────────────────────────────────────────────────
// Deduplication-free synthesis: normalize -> filter junk -> score -> rank -> budget.
// The LLM handles semantic dedup naturally. No separate file = no import crash.

var SYNTH_MIN_LENGTH = 25;
var SYNTH_HIGH_CONF = 0.75;
var SYNTH_LOW_CONF  = 0.30;

var SYNTH_STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','shall',
  'should','may','might','must','can','could','it','its','this',
  'that','these','those','of','in','to','for','with','on','at',
  'by','from','as','into','about','like','through','after','before',
  'between','under','over','and','but','or','not','no','nor',
  'so','than','too','very','just','also','then','now','here',
  'there','when','where','why','how','all','each','every','both',
  'few','more','most','some','any','such','only','other',
]);

var SYNTH_BUDGET = {
  definition: { maxFacts: 2, maxWords: 120 },
  general:    { maxFacts: 3, maxWords: 180 },
  comparison: { maxFacts: 5, maxWords: 300 },
  'how-to':   { maxFacts: 4, maxWords: 250 },
  repository: { maxFacts: 3, maxWords: 300 },
  knowledge:  { maxFacts: 3, maxWords: 200 },
  web:        { maxFacts: 4, maxWords: 250 },
  default:    { maxFacts: 3, maxWords: 180 },
};

var SYNTH_JUNK = [
  /^(click|tap|learn more|read more|find out|discover|explore|check out)\b/i,
  /^\d{1,2}\s*(min read|minute ago|minutes ago|hour ago|hours ago|day ago|days ago)/i,
  /\b(sign up|subscribe|newsletter|advertisement|sponsored)\b/i,
  /\b(cookie|privacy policy|terms of service|accept all)\b/i,
  /\b(all rights reserved|copyright)\b/i,
  /^(search result|search results|showing result|showing results|we found)\b/i,
];

function synthNormalize(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^[^a-zA-Z0-9]*/, '')
    .trim();
}

function synthTokenize(text) {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9 \-]/g, '')
      .split(/\s+/)
      .filter(function(w) { return w.length > 2 && !SYNTH_STOP_WORDS.has(w); })
  );
}

function synthIsJunk(text) {
  for (var i = 0; i < SYNTH_JUNK.length; i++) {
    if (SYNTH_JUNK[i].test(text)) return true;
  }
  return false;
}

function synthesizeFacts(question, snippets, intent, maxFacts) {
  intent = intent || 'general';
  var budget = SYNTH_BUDGET[intent] || SYNTH_BUDGET.default;

  if (!snippets || snippets.length === 0) {
    return { facts: [], budget: budget, isHighConfidence: false };
  }

  var rawCount = snippets.length;

  var facts = snippets
    .map(function(s) { return synthNormalize(s); })
    .filter(function(f) { return f.length >= SYNTH_MIN_LENGTH; })
    .filter(function(f) { return !synthIsJunk(f); })
    .map(function(text, i) { return { id: i, text: text, tokens: synthTokenize(text) }; });

  if (facts.length === 0) {
    return { facts: [], budget: budget, isHighConfidence: false };
  }

  // Score relevance to question
  var qTokens = synthTokenize(question);
  var qtArr = [];
  qTokens.forEach(function(t) { qtArr.push(t); });

  for (var i = 0; i < facts.length; i++) {
    var f = facts[i];
    var overlap = qtArr.filter(function(t) { return f.tokens.has(t); });
    var relevance = qTokens.size > 0 ? overlap.length / qTokens.size : 0.5;
    var lenRatio = f.text.length / SYNTH_MIN_LENGTH;
    var lenPenalty = Math.max(0, (1 - Math.min(lenRatio, 2) / 2) * 0.10);
    f.confidence = Math.round(Math.max(0.10, Math.min(0.98, relevance - lenPenalty)) * 100) / 100;
  }

  facts = facts.filter(function(f) { return f.confidence >= SYNTH_LOW_CONF; });
  facts.sort(function(a, b) { return b.confidence - a.confidence; });

  var limit = maxFacts || budget.maxFacts;
  facts = facts.slice(0, limit);

  var isHigh = facts.length > 0 && facts.every(function(f) { return f.confidence >= SYNTH_HIGH_CONF; });

  log.info(
    '[Synthesizer] ' + rawCount + ' raw -> ' + facts.length + ' ranked (' +
    (isHigh ? 'high' : 'mixed') + ' confidence, ' + intent + ', <=' + budget.maxWords + 'w)'
  );

  return {
    facts: facts.map(function(f) {
      return { text: f.text, confidence: f.confidence, sourceCount: 1 };
    }),
    budget: budget,
    isHighConfidence: isHigh,
  };
}

function formatSynthesis(result) {
  if (result.facts.length === 0) return '';

  var facts = result.facts;
  var budget = result.budget;

  var confLabel = result.isHighConfidence
    ? 'high-confidence'
    : 'mixed confidence -- cross-check if uncertain';

  var lines = [
    '[Ranked knowledge (' + facts.length + ' facts, ' + confLabel +
    ', <=' + budget.maxWords + ' words):]',
  ];

  for (var i = 0; i < facts.length; i++) {
    lines.push('  - [' + Math.round(facts[i].confidence * 100) + '%] ' + facts[i].text);
  }

  lines.push('');
  lines.push('IMPORTANT: Do NOT list sources inline. Synthesize naturally.');

  return lines.join('\n');
}

const DISCORD_MAX = 2000;
const LOW_CONFIDENCE_THRESHOLD = 0.65;

/** Track latest classification confidence for display in responses */
let _latestConfidence = null;

function resolvePromptMode(subcommand, topic, query) {
  switch (subcommand) {
    case 'search':
    case 'web-search': return 'search';
    case 'docs': return 'docs';
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
    case 'search':
    case 'web-search': return options.query ?? '';
    case 'docs': return options.file ?? '';
    case 'message': return options.type ?? '';
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
    const retrievalOverride = (subcommand === 'browse' || subcommand === 'search' || subcommand === 'web-search') ? 'web-only' : undefined;
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
  let cached = getResponse(query, classification.topic, { subcommand });

  // ── Turso cache fallback — checks persisted cache on LRU miss ────────
  if (!cached) {
    try {
      const lm = global.__learningManager;
      if (lm?.memory) {
        const key = responseKey(query, classification.topic, { subcommand });
        const tursoHit = await lm.memory.getCachedResponse(key);
        if (tursoHit) {
          // Hydrate the in-memory LRU so next lookup is instant
          setResponse(query, classification.topic, tursoHit, { subcommand });
          cached = tursoHit;
          log.info(
            `[AI/Gateway] Cache HIT (Turso) user=${payload.userId} topic=${classification.topic} ` +
            `query="${query.slice(0, 60)}"`
          );
        }
      }
    } catch { /* Turso miss or unavailable — proceed to generation */ }
  }

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
    if (subcommand === 'browse' || subcommand === 'search' || subcommand === 'web-search') {
      chunks = await Router.search(query);
    } else if (classification.topic === 'web') {
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
        // [VERIFIED] = web-validated data — the most complete and accurate source.
        // [USER CORRECTION] = what the user claimed — confirmed correct but may lack detail.
        // Priority: bot learning from the best source > preserving user wording.
        const tagged = [];
        const seenContent = new Set();
        let correctionWordCount = 0;
        let verifiedWordCount = 0;
        for (const m of memories.slice(0, 8)) {
          const key = m.content?.slice(0, 60).toLowerCase();
          if (seenContent.has(key)) continue;
          seenContent.add(key);

          let prefix = '';
          const words = (m.content || '').split(/\s+/).length;
          if (m.type === 'correction') {
            prefix = '[USER CORRECTION] ';
            correctionWordCount += words;
          } else if (!m.protected && (m.confidence ?? 0) >= 0.7) {
            prefix = '[VERIFIED] ';
            verifiedWordCount += words;
          }
          tagged.push({ ...m, prefix });
        }
        // Sort: VERIFIED first (best learning source), then USER CORRECTION, then others
        tagged.sort((a, b) => {
          const rank = (p) => p === '[VERIFIED] ' ? 0 : p === '[USER CORRECTION] ' ? 1 : 2;
          return rank(a.prefix) - rank(b.prefix);
        });
        const memoryLines = tagged.slice(0, 5).map(m =>
          `- ${m.prefix}${m.content} (${m.tier}, confidence: ${m.confidence?.toFixed(2) ?? '?'})`
        );
        // Lacking = verified evidence has 1.5x+ more content than the correction
        const isLacking = verifiedWordCount > 0 && verifiedWordCount >= correctionWordCount * 1.5;
        if (isLacking) {
          prompt += `\n\n[Learned knowledge — the [VERIFIED] entry is the most complete and accurate answer (independently confirmed by web search). Use it as the primary source. The [USER CORRECTION] is a simplified version that was confirmed correct:]\n${memoryLines.join('\n')}`;
        } else {
          prompt += `\n\n[Learned knowledge — both entries below are verified and accurate. The [VERIFIED] entry is the primary learning source. Use the most complete one when answering:]\n${memoryLines.join('\n')}`;
        }
      }
    }
  } catch { /* memory enrichment is additive — fine if it fails */ }

  // ── Synthesize web results into deduplicated, ranked facts ────────────
  // Prevents the LLM from listing "According to Source A... Source B..."
  // when multiple sources agree. Runs in-process, no extra LLM calls.
  try {
    const webChunks = (chunks || []).filter(function(c) { return c && c.source === 'web'; });
    if (webChunks.length > 0) {
      const webSnippets = webChunks.map(c => c.content).filter(Boolean);
      const synthesis = synthesizeFacts(
        query,
        webSnippets,
        (classification && classification.topic) || 'general',
      );
      if (synthesis.facts.length > 0) {
        prompt += '\n\n' + formatSynthesis(synthesis);
      }
    }
  } catch { /* synthesis is additive — fine if it fails */ }

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
