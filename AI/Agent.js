// AI/Agent.js
// Agent Layer — transforms the AI Knowledge Service from a passive
// retrieval-augmented Q&A pipeline into an agentic system that decides
// *how* to solve each request.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Phase:     Agent Layer (post-Phase 7)
//
// Pipeline:
//   Discord Event → Context → classify_intent → plan → execute tools →
//                   [search tools] → build context → assemble prompt →
//                   ai_generate → reflect → [retry?] → reply
//
// Public API:
//   orchestrate(request) → AgentResponse
//     { success, content, toolPlan, reflection, latencyMs, topic, complexity }

import log from '../core/log.js';
import { listAvailable, execute } from './ToolRegistry.js';
import { reflect, shouldGenerate, shouldRetry } from './ReflectionEngine.js';
import { build as buildContext } from './ContextBuilder.js';
import { assemble as assemblePrompt } from './PromptSystem.js';
import { validate } from './ResponseValidator.js';
import { getResponse, setResponse } from './Cache.js';
import { formatWithCitations, formatConfidence } from './AdvancedFeatures.js';

// Lazy import — MemoryManager may not be loaded at startup
let _storeConversationTurn = null;
async function _getMemoryStore() {
  if (!_storeConversationTurn) {
    try {
      const mod = await import('./managers/MemoryManager.js');
      _storeConversationTurn = mod.storeConversationTurn;
    } catch { /* MemoryManager not available */ }
  }
  return _storeConversationTurn;
}

// ──────────────────────────────────────────────────────────────────────────────
// Intent planning — maps intent → ordered tool chain
// ──────────────────────────────────────────────────────────────────────────────

const MAX_TOOL_ATTEMPTS = 2;

/**
 * Build an ordered plan (list of tool names + params) from the classification
 * result and Discord context.
 *
 * Rules (ordered by priority):
 *   1. rejected         → no tools, return rejection
 *   2. message          → generate_message only
 *   3. live             → search_web → then answer
 *   4. umamusume        → search_knowledge → (search_repository) → answer
 *   5. repository       → search_repository → search_conversation_memory → answer
 *   6. low confidence   → add search_web as supplement
 *
 * @param {object} classification — from classify_intent tool
 * @param {object} ctx            — Discord context { userId, channelId, query }
 * @returns {Array<{tool: string, params: object}>}
 */
function plan(classification, ctx) {
  const { topic, complexity, confidence } = classification;
  const steps = [];

  // ── Message generation: single-tool plan ───────────────────────────────
  if (topic === 'message') {
    steps.push({
      tool: 'generate_message',
      params: {
        type:            ctx.messageType      ?? 'greeting',
        trainerName:     ctx.trainerName      ?? undefined,
        milestoneValue:  ctx.milestoneValue   ?? undefined,
        achievementName: ctx.achievementName  ?? undefined,
        eventName:       ctx.eventName        ?? undefined,
        eventDate:       ctx.eventDate        ?? undefined,
      },
    });
    return steps;
  }

  // ── Live data → web search first ───────────────────────────────────────
  if (topic === 'live') {
    steps.push({ tool: 'search_web',       params: { query: ctx.query, maxResults: 5 } });
    return steps;
  }

  // ── Umamusume knowledge ────────────────────────────────────────────────
  if (topic === 'umamusume') {
    steps.push({ tool: 'search_knowledge',  params: { query: ctx.query } });
    // If knowledge base is thin, supplement with repo search
    if (confidence < 0.70) {
      steps.push({ tool: 'search_repository', params: { query: ctx.query, topK: 3 } });
    }
    return steps;
  }

  // ── Repository questions (default path) ────────────────────────────────
  steps.push({ tool: 'search_repository',   params: { query: ctx.query, topK: 5 } });

  // Add conversation memory if we have session context
  if (ctx.userId && ctx.channelId) {
    steps.push({ tool: 'search_conversation_memory', params: { userId: ctx.userId, channelId: ctx.channelId } });
  }

  // Always try semantic memory — low-cost, complements repo search
  steps.push({ tool: 'search_semantic_memory', params: { query: ctx.query, limit: 3 } });

  // Low-confidence → supplement with web search
  if (confidence < 0.65) {
    steps.push({ tool: 'search_web',        params: { query: ctx.query, maxResults: 3 } });
  }

  return steps;
}

// ──────────────────────────────────────────────────────────────────────────────
// Plan execution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Execute a tool plan sequentially. Each step's result is available to the
 * context builder. If a tool fails the plan continues — tools are additive.
 *
 * @param {Array<{tool: string, params: object}>} steps
 * @returns {Promise<{results: object[], toolsUsed: string[], totalChunks: number}>}
 */
async function executePlan(steps) {
  const results   = [];
  const toolsUsed = [];
  let totalChunks = 0;

  for (const step of steps) {
    const start = Date.now();
    const { ok, result, error } = await execute(step.tool, step.params);

    if (ok) {
      toolsUsed.push(step.tool);
      results.push({ tool: step.tool, result, durationMs: Date.now() - start });
      // Count chunks from search results
      if (result?.chunks) totalChunks += result.chunks.length;
      if (result?.results) totalChunks += result.results.length;
    } else {
      log.warn(`[AI/Agent] Tool "${step.tool}" failed: ${error}`);
    }
  }

  return { results, toolsUsed, totalChunks };
}

// ──────────────────────────────────────────────────────────────────────────────
// Context assembly from tool results
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Collect all chunks from executed tools into a single array for the Context Builder.
 * Also extracts conversation memory context.
 *
 * @param {object[]} toolResults
 * @returns {{ allChunks: object[], memoryContext: string, webChunks: object[] }}
 */
function collectContext(toolResults) {
  const allChunks    = [];
  const webChunks    = [];
  let   memoryContext = '';

  for (const { tool, result } of toolResults) {
    if (tool === 'search_conversation_memory' && result?.context) {
      memoryContext = result.context;
    }
    if (result?.chunks) {
      const chunks = result.chunks.map(c => ({
        ...c,
        source: result.source ?? 'tool',
      }));
      allChunks.push(...chunks);
      if (result.source === 'web') webChunks.push(...chunks);
    }
    // Semantic memory results — convert {id, score, payload} into chunk form
    if (tool === 'search_semantic_memory' && result?.results?.length) {
      for (const r of result.results) {
        const p = r.payload ?? {};
        const label = p.type === 'conversation_turn'
          ? `[Memory] ${p.queryPreview ?? p.text?.slice(0, 200) ?? 'past interaction'}`
          : `[Memory] ${p.text?.slice(0, 200) ?? 'stored document'}`;
        allChunks.push({
          content:  p.text ?? JSON.stringify(p),
          filePath: label,
          heading:  `Memory match (score: ${r.score?.toFixed(2) ?? '?'}, topic: ${p.topic ?? 'unknown'})`,
          score:    r.score ?? 0,
          source:   'semantic-memory',
        });
      }
    }
    // Knowledge engine results are already in chunk format
  }

  return { allChunks, memoryContext, webChunks };
}

// ──────────────────────────────────────────────────────────────────────────────
// Prompt mode resolution
// ──────────────────────────────────────────────────────────────────────────────

function resolvePromptMode(topic, subcommand) {
  switch (subcommand) {
    case 'search':   return 'search';
    case 'explain':  return 'explain';
    case 'docs':     return 'docs';
    case 'glossary': return 'glossary';
    case 'live':     return 'knowledge';
    default:
      return topic === 'umamusume' ? 'knowledge' : 'repository';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Orchestrator — main entry point
// ──────────────────────────────────────────────────────────────────────────────

const DISCORD_MAX = 2000;

/**
 * Orchestrate a full agent cycle: classify → plan → execute → build → generate → reflect → reply.
 *
 * @param {object} request
 * @param {string} request.query       — user's question
 * @param {string} request.subcommand  — 'ask' | 'explain' | 'search' | 'docs' | 'glossary' | 'message' | 'live'
 * @param {string} [request.userId]    — Discord user ID
 * @param {string} [request.channelId] — Discord channel ID
 * @param {string} [request.guildId]   — Discord guild ID
 * @param {string} [request.messageType] — for message generation: the type
 * @param {object} [request.messageOpts] — additional message generation options
 * @returns {Promise<object>} AgentResponse
 */
export async function orchestrate(request = {}) {
  const startTime = Date.now();
  const { query, subcommand = 'ask', userId, channelId } = request;

  // Phase 0: validation
  if (!query || !query.trim()) {
    return { success: true, content: '⚠️ Please provide a question or query.', topic: 'empty', toolsUsed: [], latencyMs: 0 };
  }

  // ── Phase 1: Classify intent ───────────────────────────────────────────
  const commandOverride = subcommand === 'ask' ? '/ask' : `/ai ${subcommand}`;
  const { ok: classifyOk, result: classification } = await execute('classify_intent', {
    query,
    command: commandOverride,
  });

  if (!classifyOk || !classification) {
    return { success: false, content: 'Failed to classify your request. Please try again.', topic: 'error', toolsUsed: [], latencyMs: Date.now() - startTime };
  }

  const { topic, complexity, confidence, rejected, rejectionMessage } = classification;

  log.info(
    `[AI/Agent] class=${topic} complexity=${complexity} ` +
    `confidence=${confidence?.toFixed(2)} rejected=${rejected}`
  );

  // Pre-flight check
  const preflight = shouldGenerate(classification);
  if (!preflight.proceed) {
    return {
      success: true,
      content: rejectionMessage ?? 'This request is outside my scope.',
      topic,
      complexity,
      toolsUsed: [],
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Phase 2: Plan ──────────────────────────────────────────────────────
  let toolPlan = plan(classification, {
    query,
    userId,
    channelId,
    messageType: request.messageType ?? undefined,
    trainerName: request.messageOpts?.trainerName ?? undefined,
    milestoneValue: request.messageOpts?.milestoneValue ?? undefined,
    achievementName: request.messageOpts?.achievementName ?? undefined,
    eventName: request.messageOpts?.eventName ?? undefined,
    eventDate: request.messageOpts?.eventDate ?? undefined,
  });

  log.info(`[AI/Agent] Plan: ${toolPlan.map(s => s.tool).join(' → ') || '(none)'}`);

  // ── Phase 3: Execute tools ─────────────────────────────────────────────
  const { results: toolResults, toolsUsed, totalChunks } = await executePlan(toolPlan);

  // Special case: message generation returns the message directly
  const msgResult = toolResults.find(r => r.tool === 'generate_message');
  if (msgResult?.result?.message) {
    const content = msgResult.result.message.length > DISCORD_MAX
      ? `${msgResult.result.message.slice(0, DISCORD_MAX - 3)}...`
      : msgResult.result.message;
    return {
      success: true,
      content,
      topic,
      complexity,
      toolsUsed,
      toolPlan: toolPlan.map(s => s.tool),
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Phase 4: Build context window ──────────────────────────────────────
  const { allChunks, memoryContext } = collectContext(toolResults);
  const promptMode = resolvePromptMode(topic, subcommand);

  let { context: mainContext, citations } = buildContext([allChunks]);
  if (memoryContext) {
    mainContext = `${memoryContext}\n\n---\n\n${mainContext}`;
  }

  // ── Phase 5: AI generation with reflection loop ────────────────────────
  let finalAnswer  = null;
  let finalReflect = null;
  let searchWebAttempted = toolsUsed.includes('search_web');

  for (let attempt = 1; attempt <= MAX_TOOL_ATTEMPTS + 1; attempt++) {
    const prompt = assemblePrompt(promptMode, mainContext, query);
    const { ok: genOk, result: genResult, error: genError } = await execute('ai_generate', {
      prompt,
      complexity,
    });

    if (!genOk || !genResult?.text) {
      log.error(`[AI/Agent] ai_generate failed on attempt ${attempt}: ${genError}`);
      return {
        success: false,
        content: 'AI generation failed. Please try again.',
        topic,
        complexity,
        toolsUsed,
        latencyMs: Date.now() - startTime,
      };
    }

    // ── Reflect ──────────────────────────────────────────────────────────
    const reflection = reflect({
      answer:     genResult.text,
      topic,
      confidence,
      attempt,
      context: {
        query,
        toolsUsed,
        chunksFound: totalChunks,
        searchWebAttempted,
      },
    });

    log.info(
      `[AI/Agent] Reflection attempt=${attempt} action=${reflection.action} ` +
      `reasons=${reflection.reasons.join('; ')}`
    );

    if (reflection.passed && reflection.action === 'send') {
      finalAnswer  = genResult.text;
      finalReflect = reflection;
      break;
    }

    if (reflection.action === 're-search' && reflection.adjustedPlan && shouldRetry(attempt, MAX_TOOL_ATTEMPTS + 1, toolsUsed)) {
      // Re-plan: add the suggested tools
      const addTools = reflection.adjustedPlan.addTools ?? [];
      for (const toolName of addTools) {
        if (!toolsUsed.includes(toolName)) {
          toolPlan.push({ tool: toolName, params: { query, maxResults: 5 } });
          log.info(`[AI/Agent] Re-plan: adding tool "${toolName}"`);
        }
      }
      const extraResults = await executePlan(toolPlan.slice(toolsUsed.length));
      const moreContext  = collectContext(extraResults.results);
      allChunks.push(...moreContext.allChunks);
      if (moreContext.memoryContext && !memoryContext) {
        mainContext = `${moreContext.memoryContext}\n\n---\n\n${mainContext}`;
      } else {
        // Rebuild context with new chunks
        const rebuilt = buildContext([allChunks]);
        mainContext = rebuilt.context;
        citations   = rebuilt.citations;
      }
      toolsUsed.push(...extraResults.toolsUsed);
      searchWebAttempted = searchWebAttempted || toolsUsed.includes('search_web');
      continue;
    }

    if (reflection.action === 're-phrase' && attempt < MAX_TOOL_ATTEMPTS + 1) {
      // Re-generate with a stronger prompt — no tool changes
      log.info('[AI/Agent] Re-phrase — regenerating with same context');
      continue;
    }

    // Last resort: send whatever we have with the reflection note
    finalAnswer  = genResult.text;
    finalReflect = reflection;
    break;
  }

  if (!finalAnswer) {
    return {
      success: false,
      content: "I wasn't able to generate a good answer. Please try rephrasing your question.",
      topic,
      complexity,
      toolsUsed,
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Phase 6: Validate ──────────────────────────────────────────────────
  const validation = validate(finalAnswer, topic);
  if (validation.action === 'hard-reject') {
    log.warn(`[AI/Agent] Hard-reject after reflection — ${validation.failureReasons.join(', ')}`);
    return {
      success: false,
      content: 'The response failed safety validation. Please rephrase your question.',
      topic,
      complexity,
      toolsUsed,
      latencyMs: Date.now() - startTime,
    };
  }

  // ── Phase 7: Format with citations + confidence ────────────────────────
  let content = formatWithCitations(finalAnswer, citations, topic, userId);
  content += formatConfidence(confidence, topic);

  if (content.length > DISCORD_MAX) {
    content = `${content.slice(0, DISCORD_MAX - 3)}...`;
  }

  // ── Cache the validated result ─────────────────────────────────────────
  try { setResponse(query, topic, { text: finalAnswer, citations, model: 'cloud', tokens: 0 }, { subcommand }); } catch {}

  // ── Store this interaction in semantic memory (fire-and-forget) ────────
  if (userId && channelId) {
    _getMemoryStore().then(storeFn => {
      if (storeFn) {
        storeFn({ userId, channelId, query, response: finalAnswer, topic, confidence })
          .catch(() => {});
      }
    }).catch(() => {});
  }

  const latencyMs = Date.now() - startTime;
  log.info(
    `[AI/Agent] Complete — topic=${topic} tools=[${toolsUsed.join(',')}] ` +
    `attempts=${finalReflect ? 'multi' : '1'} ` +
    `reflectAction=${finalReflect?.action ?? 'none'} latency=${latencyMs}ms`
  );

  return {
    success:    true,
    content,
    topic,
    complexity,
    toolsUsed,
    toolPlan:   toolPlan.map(s => s.tool),
    reflection: finalReflect,
    latencyMs,
    citations,
  };
}
