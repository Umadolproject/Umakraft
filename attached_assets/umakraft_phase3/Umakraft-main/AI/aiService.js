// AI/aiService.js
// Local AI service — single entry point for AI_PROVIDER=local mode.

import { generate, getModelStatus } from './model.js';
import { initialize as initDocs, search, isOnTopic, stats as documentSearchStats } from './documentSearch.js';
import { build as buildPrompt } from './promptBuilder.js';
import { get as cacheGet, set as cacheSet, stats as cacheStats } from './cache.js';
import { validate, hardRejectMessage } from './ResponseValidator.js';
import { classify, offTopicMessage } from './TopicFilter.js';
import config from './Configuration.js';
import log from '../core/log.js';

const DISCORD_MAX = 2000;
let _initializationPromise = null;

const _runtime = {
  requests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  retrievalCount: 0,
  retrievalErrors: 0,
  totalRetrievalMs: 0,
  lastRetrievalMs: null,
  generationCount: 0,
  generationFailures: 0,
  generationTimeouts: 0,
  totalGenerationMs: 0,
  lastGenerationMs: null,
  validationFailures: 0,
  docsOnlyFallbacks: 0,
  degradedUntil: 0,
  degradedReason: null,
  consecutiveFailures: 0,
  lastError: null,
  lastSuccessAt: null,
  lastRequestAt: null,
};

export function initialize() {
  if (_initializationPromise) return _initializationPromise;

  _initializationPromise = (async () => {
    await initDocs();
    log.info('[AI/LocalService] Document index ready; model will load on first AI request.');
  })();

  return _initializationPromise;
}

function errorEnvelope(message, interaction) {
  return {
    success: false,
    failedAt: 'AI/LocalService',
    error: 'LOCAL_AI_ERROR',
    message,
    retriable: false,
    interaction,
  };
}

function successEnvelope(content, interaction, ephemeral = false) {
  return {
    success: true,
    content,
    ephemeral,
    interaction,
  };
}

function formatText(text) {
  if (text.length > DISCORD_MAX) {
    return `${text.slice(0, DISCORD_MAX - 3)}...`;
  }
  return text;
}

function appendSources(content, docs) {
  if (!docs || docs.length === 0) return content;
  const sources = docs.slice(0, 3).map(doc => `\`${doc.file}\``).join(', ');
  const footer = `\n\n📄 Sources: ${sources}`;
  return (content + footer).length <= DISCORD_MAX ? content + footer : content;
}

function buildCacheContext(query, subcommand, retrievalMode = 'local_docs') {
  return {
    query,
    commandMode: subcommand || 'ask',
    retrievalMode,
  };
}

function resolveClassification(subcommand, query) {
  const overrides = {
    ask: '/ask',
    explain: '/ai explain',
    search: '/ai search',
    docs: '/ai docs',
    glossary: '/ai glossary',
    message: '/ai message',
    live: '/ai live',
  };

  return classify(query, overrides[subcommand] ?? '/ask');
}

function isDegraded() {
  return _runtime.degradedUntil > Date.now();
}

function clearDegradedIfExpired() {
  if (_runtime.degradedUntil && _runtime.degradedUntil <= Date.now()) {
    _runtime.degradedUntil = 0;
    _runtime.degradedReason = null;
    _runtime.consecutiveFailures = 0;
    log.info('[AI/LocalService] Degraded mode cleared.');
  }
}

function activateDegradedMode(reason) {
  _runtime.degradedUntil = Date.now() + config.localDegradedModeMs;
  _runtime.degradedReason = reason;
  log.warn(`[AI/LocalService] Degraded mode enabled for ${config.localDegradedModeMs}ms reason=${reason}`);
}

function registerFailure(reason) {
  _runtime.consecutiveFailures += 1;
  _runtime.lastError = reason;
  if (_runtime.consecutiveFailures >= config.localFailureThreshold) {
    activateDegradedMode(reason);
  }
}

function registerSuccess() {
  _runtime.consecutiveFailures = 0;
  _runtime.lastSuccessAt = new Date().toISOString();
}

function createDocsOnlyFallback({ docs, query, interaction, reason }) {
  _runtime.docsOnlyFallbacks += 1;

  if (!docs || docs.length === 0) {
    return successEnvelope(
      `The AI model is temporarily unavailable (${reason}). I don't have enough indexed documentation to answer safely right now.`,
      interaction,
      true,
    );
  }

  const snippets = docs
    .slice(0, 2)
    .map(doc => `• ${doc.file}: ${doc.excerpt.replace(/\s+/g, ' ').slice(0, 220)}`)
    .join('\n');

  const content = formatText(
    `AI is temporarily in degraded mode, so this answer is based on indexed documentation only.\n\n${snippets}`
  );

  log.warn(`[AI/LocalService] Returning docs-only fallback for query="${query.slice(0, 60)}" reason=${reason}`);
  return successEnvelope(appendSources(content, docs), interaction, false);
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`${label} timed out after ${timeoutMs}ms`);
          error.code = 'AI_TIMEOUT';
          reject(error);
        }, timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function generateValidatedResponse({ messages, classification, docs, interaction, query, subcommand }) {
  let workingMessages = messages;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const generationStartedAt = Date.now();
    let result;

    try {
      result = await withTimeout(
        generate(workingMessages, { maxNewTokens: 300, temperature: 0.2 }),
        config.localModelGenerationTimeoutMs,
        'Local model generation'
      );
    } catch (err) {
      const duration = Date.now() - generationStartedAt;
      _runtime.generationFailures += 1;
      _runtime.lastGenerationMs = duration;
      _runtime.totalGenerationMs += duration;
      if (err.code === 'AI_TIMEOUT') {
        _runtime.generationTimeouts += 1;
      }
      registerFailure(err.message);
      log.error(`[AI/LocalService] Generation failed after ${duration}ms: ${err.message}`);
      return { failure: err, envelope: createDocsOnlyFallback({ docs, query, interaction, reason: err.code === 'AI_TIMEOUT' ? 'generation timeout' : 'generation failure' }) };
    }

    const generationDuration = Date.now() - generationStartedAt;
    _runtime.generationCount += 1;
    _runtime.totalGenerationMs += generationDuration;
    _runtime.lastGenerationMs = generationDuration;

    const rawText = result?.text?.trim() ?? '';
    if (!rawText || rawText.length < 5) {
      _runtime.generationFailures += 1;
      registerFailure('The model returned an empty response.');
      return { failure: new Error('The model returned an empty response.'), envelope: createDocsOnlyFallback({ docs, query, interaction, reason: 'empty model response' }) };
    }

    const finalContent = appendSources(formatText(rawText), docs);
    const validation = validate(finalContent, classification.topic, { attempt });

    if (validation.passed) {
      registerSuccess();
      log.info(`[AI/LocalService] Validation passed attempt=${attempt} classification=${classification.topic} duration_ms=${generationDuration}`);
      return { content: finalContent };
    }

    _runtime.validationFailures += 1;
    log.warn(`[AI/LocalService] Validation ${validation.action} attempt=${attempt} reasons=${validation.failureReasons.join(' | ')}`);

    if (validation.action === 'regenerate' && validation.regenerateInstruction && attempt < 2) {
      workingMessages = [
        ...workingMessages,
        { role: 'assistant', content: finalContent },
        { role: 'user', content: validation.regenerateInstruction },
      ];
      continue;
    }

    registerFailure(`Validation failed: ${validation.failureReasons.join(' | ')}`);
    return {
      failure: new Error('Validation failed'),
      envelope: docs.length > 0
        ? createDocsOnlyFallback({ docs, query, interaction, reason: 'validation failure' })
        : successEnvelope(hardRejectMessage(), interaction, true),
    };
  }

  registerFailure('Validation retry budget exhausted.');
  return {
    failure: new Error('Validation retry budget exhausted.'),
    envelope: createDocsOnlyFallback({ docs: [], query, interaction, reason: 'validation retry exhausted' }),
  };
}

export async function answer({ query, subcommand, interaction, userId }) {
  clearDegradedIfExpired();
  _runtime.requests += 1;
  _runtime.lastRequestAt = new Date().toISOString();

  await initialize();

  const classification = resolveClassification(subcommand, query);
  log.info(`[AI/LocalService] user=${userId} cmd=${subcommand} classification=${classification.topic} degraded=${isDegraded()} query="${query.slice(0, 80)}"`);

  if (!isOnTopic(query) || classification.rejected) {
    return successEnvelope(offTopicMessage(), interaction, true);
  }

  const retrievalMode = 'local_docs';
  const cacheKey = buildCacheContext(query, subcommand, retrievalMode);
  const cached = cacheGet(cacheKey);
  if (cached) {
    _runtime.cacheHits += 1;
    registerSuccess();
    log.info(`[AI/LocalService] Cache hit cmd=${subcommand} retrieval=${retrievalMode}`);
    return successEnvelope(formatText(cached), interaction, false);
  }
  _runtime.cacheMisses += 1;

  let docs = [];
  const retrievalStartedAt = Date.now();
  try {
    const result = await search(query);
    docs = result.docs;
    _runtime.retrievalCount += 1;
    _runtime.lastRetrievalMs = Date.now() - retrievalStartedAt;
    _runtime.totalRetrievalMs += _runtime.lastRetrievalMs;
    log.info(`[AI/LocalService] Retrieval completed mode=${retrievalMode} docs=${docs.length} duration_ms=${_runtime.lastRetrievalMs}`);

    if (!result.relevant && docs.length === 0) {
      const noDoc = 'That information is not documented in the UmaKraft knowledge base.';
      cacheSet(cacheKey, noDoc);
      registerSuccess();
      return successEnvelope(noDoc, interaction, false);
    }
  } catch (err) {
    _runtime.retrievalErrors += 1;
    _runtime.lastRetrievalMs = Date.now() - retrievalStartedAt;
    log.error(`[AI/LocalService] Document search failed after ${_runtime.lastRetrievalMs}ms: ${err.message}`);
  }

  if (isDegraded()) {
    return createDocsOnlyFallback({ docs, query, interaction, reason: _runtime.degradedReason ?? 'degraded mode active' });
  }

  const messages = buildPrompt(query, docs);
  const generated = await generateValidatedResponse({
    messages,
    classification,
    docs,
    interaction,
    query,
    subcommand,
  });

  if (generated.content) {
    cacheSet(cacheKey, generated.content);
    return successEnvelope(generated.content, interaction, false);
  }

  if (generated.failure) {
    return generated.envelope ?? errorEnvelope(`AI generation failed: ${generated.failure.message}`, interaction);
  }

  return errorEnvelope('The local AI service was unable to produce a response.', interaction);
}

export function getServiceStatus() {
  clearDegradedIfExpired();

  const cache = cacheStats();
  const model = getModelStatus();
  const docs = documentSearchStats();
  const averageGenerationMs = _runtime.generationCount > 0
    ? Math.round(_runtime.totalGenerationMs / _runtime.generationCount)
    : null;
  const averageRetrievalMs = _runtime.retrievalCount > 0
    ? Math.round(_runtime.totalRetrievalMs / _runtime.retrievalCount)
    : null;

  return {
    initialized: Boolean(_initializationPromise),
    degraded: isDegraded(),
    degradedUntil: _runtime.degradedUntil ? new Date(_runtime.degradedUntil).toISOString() : null,
    degradedReason: _runtime.degradedReason,
    requests: _runtime.requests,
    cacheHits: _runtime.cacheHits,
    cacheMisses: _runtime.cacheMisses,
    cache,
    docs,
    model,
    lastRequestAt: _runtime.lastRequestAt,
    lastSuccessAt: _runtime.lastSuccessAt,
    lastError: _runtime.lastError,
    consecutiveFailures: _runtime.consecutiveFailures,
    generationCount: _runtime.generationCount,
    generationFailures: _runtime.generationFailures,
    generationTimeouts: _runtime.generationTimeouts,
    lastGenerationMs: _runtime.lastGenerationMs,
    averageGenerationMs,
    retrievalCount: _runtime.retrievalCount,
    retrievalErrors: _runtime.retrievalErrors,
    lastRetrievalMs: _runtime.lastRetrievalMs,
    averageRetrievalMs,
    validationFailures: _runtime.validationFailures,
    docsOnlyFallbacks: _runtime.docsOnlyFallbacks,
    timeoutMs: config.localModelGenerationTimeoutMs,
    failureThreshold: config.localFailureThreshold,
    degradedModeMs: config.localDegradedModeMs,
  };
}
