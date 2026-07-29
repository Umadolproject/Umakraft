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
//     { success, content, topic, complexity, toolsUsed, toolPlan, reflection, latencyMs, citations }
//   withCommunication(request) → AgentResponse & CommunicationEnriched
//     + communicationResult, discordOutput, responseObj
//     Gracefully falls back to plain-text DiscordOutput if Communication wrapping fails.

import log from '../core/log.js';
import config from './Configuration.js';
import { execute } from './ToolRegistry.js';
import { reflect, shouldGenerate, shouldRetry } from './ReflectionEngine.js';
import { build as buildContext } from './ContextBuilder.js';
import { assemble as assemblePrompt } from './PromptSystem.js';
import { validate } from './ResponseValidator.js';
import { getResponse, setResponse } from './Cache.js';
import { formatWithCitations, formatConfidence } from './AdvancedFeatures.js';
import { plan as buildPlan } from './Planner.js';
import { softValidate } from './CognitiveContracts.js';
import { suggestFollowUps, trackInteraction } from './GrowthEngine.js';

// Lazy import — CommunicationManager for Phase 1 bridge
let _wrapCommResponse = null;
async function _getCommManager() {
  if (!_wrapCommResponse) {
    try {
      const mod = await import('./Communication/integration/CommunicationManager.js');
      _wrapCommResponse = mod.wrapAgentResponse;
    } catch { /* CommunicationManager not available */ }
  }
  return _wrapCommResponse;
}

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

// Lazy import — UserProfileManager for learning & experience
let _updateProfile = null;
let _enrichPrompt = null;
async function _getProfileManager() {
  if (!_updateProfile) {
    try {
      const mod = await import('./managers/UserProfileManager.js');
      _updateProfile = mod.updateFromInteraction;
      _enrichPrompt = mod.enrichPrompt;
    } catch { /* UserProfileManager not available */ }
  }
  return { updateFromInteraction: _updateProfile, enrichPrompt: _enrichPrompt };
}

// ──────────────────────────────────────────────────────────────────────────────
// Intent planning — delegated to Planner.js (Chapter 5)
// The Planner decomposes complex queries into multi-step sub-goal plans.
// Simple queries get flat tool chains as before.
// ──────────────────────────────────────────────────────────────────────────────

const MAX_TOOL_ATTEMPTS = 2;
const ORCHESTRATION_TIMEOUT_MS = 45_000; // 45 sec overall agent timeout

// plan() is now imported from ./Planner.js as buildPlan

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

function resolvePromptMode(topic, subcommand, subtopic) {
  switch (subcommand) {
    case 'search':   return 'search';
    case 'explain':  return 'explain';
    case 'docs':     return 'docs';
    case 'glossary': return 'glossary';
    case 'live':     return 'knowledge';
    default:
      if (subtopic === 'bot_assist') return 'assistant';
      if (topic === 'umamusume') return 'knowledge';
      if (topic === 'web') return 'web';
      return 'repository';
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
  const { query, subcommand = 'ask', userId, channelId, guildId } = request;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    log.warn('[AI/Agent] Orchestration timeout — aborting');
    controller.abort();
  }, ORCHESTRATION_TIMEOUT_MS);

  try {
  // Phase 0: validation
  if (!query || !query.trim()) {
    return { success: true, content: '⚠️ Please provide a question or query.', topic: 'empty', toolsUsed: [], latencyMs: 0 };
  }

  // ── Per-user rate limit check ───────────────────────────────────────────
  if (userId) {
    const { checkUserRateLimit } = await import('./APIProvider.js');
    try { checkUserRateLimit(userId); } catch (err) {
      if (err.code === 'USER_RATE_LIMITED') {
        return {
          success: true,
          content: '⏳ You\'re asking a bit too fast! Please wait a moment before your next question~ 💕',
          topic: 'rate-limited',
          toolsUsed: [],
          latencyMs: 0,
        };
      }
      throw err;
    }
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

  // ── Phase 2: Plan (via Planner.js — Chapter 5) ────────────────────────
  const planCtx = {
    query,
    userId,
    channelId,
    messageType: request.messageType ?? undefined,
    trainerName: request.messageOpts?.trainerName ?? undefined,
    milestoneValue: request.messageOpts?.milestoneValue ?? undefined,
    achievementName: request.messageOpts?.achievementName ?? undefined,
    eventName: request.messageOpts?.eventName ?? undefined,
    eventDate: request.messageOpts?.eventDate ?? undefined,
  };
  const executionPlan = buildPlan(classification, planCtx);
  let toolPlan = executionPlan.steps;

  log.info(`[AI/Agent] Plan: ${toolPlan.map(s => s.tool).join(' → ') || '(none)'} ` +
    `decomposed=${executionPlan.isDecomposed} pattern=${executionPlan.description}`);

  // ── Phase 3: Execute tools ─────────────────────────────────────────────
  const { results: toolResults, toolsUsed, totalChunks } = await executePlan(toolPlan);

  // Special case: message generation returns the message directly.
  // Wire through Communication pipeline for structured DiscordOutput.
  const msgResult = toolResults.find(r => r.tool === 'generate_message');
  if (msgResult?.result?.message) {
    const content = msgResult.result.message.length > DISCORD_MAX
      ? `${msgResult.result.message.slice(0, DISCORD_MAX - 3)}...`
      : msgResult.result.message;
    const latencyMs = Date.now() - startTime;

    // ── Enrich through Communication (Phase 1 bridge) ──────────────────
    let communicationResult = null;
    let discordOutput = null;
    try {
      const wrap = await _getCommManager();
      if (wrap) {
        communicationResult = wrap({
          success: true, content, topic, complexity, toolsUsed,
          toolPlan: toolPlan.map(s => s.tool),
        }, {
          query: query.slice(0, 200), topic, complexity,
          confidence: request.confidence ?? 0.9,
          userId, channelId, guildId: request.guildId,
        });
        discordOutput = communicationResult?.discordOutput ?? null;
      }
    } catch (err) {
      log.warn(`[AI/Agent] Communication wrapping failed for message: ${err.message}`);
    }

    // Fallback: plain-text DiscordOutput if wrapping failed
    if (!discordOutput) {
      discordOutput = {
        messages: [content], embeds: [], attachments: [],
        components: [], metadata: { topic, complexity },
      };
    }

    return {
      success:    true,
      content,
      topic,
      complexity,
      toolsUsed,
      toolPlan:   toolPlan.map(s => s.tool),
      latencyMs,
      communicationResult,
      discordOutput,
      responseObj: communicationResult?.responseObj ?? null,
    };
  }

  // ── Phase 4: Build context window ──────────────────────────────────────
  const { allChunks, memoryContext } = collectContext(toolResults);
  const promptMode = resolvePromptMode(topic, subcommand, classification.subtopic);

  let { context: mainContext, citations } = buildContext([allChunks]);
  if (memoryContext) {
    mainContext = `${memoryContext}\n\n---\n\n${mainContext}`;
  }

  // ── Phase 5: AI generation with reflection loop ────────────────────────
  let finalAnswer  = null;
  let finalReflect = null;
  let searchWebAttempted = toolsUsed.includes('search_web');
  const allExecutedTools = [...toolsUsed];

  // ── Enrich context with user profile (Chapter 7 — Learning) ─────────────
  const { enrichPrompt: enrich } = await _getProfileManager();
  if (enrich && userId) {
    mainContext = enrich(mainContext, userId);
  }

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
      const freshTools = toolPlan.filter(t => !allExecutedTools.includes(t.tool));
      if (freshTools.length > 0) {
        const extraResults = await executePlan(freshTools);
        const moreContext  = collectContext(extraResults.results);
        allChunks.push(...moreContext.allChunks);
        if (moreContext.memoryContext && !memoryContext) {
          mainContext = `${moreContext.memoryContext}\n\n---\n\n${mainContext}`;
        } else {
          const rebuilt = buildContext([allChunks]);
          mainContext = rebuilt.context;
          citations   = rebuilt.citations;
        }
        toolsUsed.push(...extraResults.toolsUsed);
        allExecutedTools.push(...extraResults.toolsUsed);
        searchWebAttempted = searchWebAttempted || toolsUsed.includes('search_web');
      }
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

  // ── Update user profile (Chapter 7 — Learning) ─────────────────────────
  if (userId) {
    _getProfileManager().then(({ updateFromInteraction }) => {
      if (updateFromInteraction) {
        updateFromInteraction(userId, query, finalAnswer, topic);
      }
    }).catch(() => {});
  }

  // ── Soft-validate contracts — always validate, log failures in all modes ──
  softValidate({
      query,
      subcommand,
      userId,
      channelId,
      guildId,
      classification,
      plan: { steps: toolPlan, complexity, description: `Plan for topic=${topic}`, estimatedLatencyMs: latencyMs, isDecomposed: false },
      toolResults: toolsUsed.map(t => ({ tool: t, ok: true, data: null, error: null, durationMs: 0, source: 'agent' })),
    });

  const latencyMs = Date.now() - startTime;

  // ── Growth: follow-up suggestions (Chapter 10) ──────────────────────────
  const followUps = suggestFollowUps(query, topic, confidence);
  if (followUps.length > 0) {
    const followUpText = followUps.map((q, i) => `  ${i + 1}. ${q}`).join('\n');
    content += `\n\n**Want to know more?** Try asking:\n${followUpText}`;
    if (content.length > DISCORD_MAX) {
      content = content.slice(0, DISCORD_MAX - 100);
      const remaining = DISCORD_MAX - content.length - 30;
      if (remaining > 20) {
        const trimmed = followUps.slice(0, Math.min(followUps.length, 2));
        const trimmedText = trimmed.map((q, i) => `  ${i + 1}. ${q}`).join('\n');
        content += `\n\n**Want to know more?**\n${trimmedText}`;
      }
      content = content.slice(0, DISCORD_MAX);
    }
  }

  // ── Growth: performance tracking (Chapter 10) ──────────────────
  trackInteraction({
    topic,
    confidence,
    reflectionAction: finalReflect?.action ?? 'send',
    toolsFailed: toolPlan.length - toolsUsed.length,
    latencyMs,
    query: query.slice(0, 120),
  });

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
  } finally {
    clearTimeout(timeoutId);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Communication bridge (Part 8 — Phase 1)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Orchestrate through the full Agent pipeline AND wrap the result through
 * the Communication subsystem (Composition + Rendering).
 *
 * This is the Phase 1 integration point — existing retrieval/generation
 * stays the same, but the response is enriched with a structured
 * ResponseObject and Discord-ready output.
 *
 * @param {object} request — same as orchestrate()
 * @returns {Promise<AgentResponse & { communicationResult: object|null }>}
 */
export async function withCommunication(request) {
  // 1. Run the normal Agent pipeline
  const agentResponse = await orchestrate(request);

  // 2. Try to wrap through Communication
  let communicationResult = null;
  try {
    const wrap = await _getCommManager();
    if (wrap) {
      communicationResult = wrap(agentResponse, {
        query: request.query ?? request.subcommand ?? '',
        topic: agentResponse.topic,
        complexity: agentResponse.complexity,
        confidence: request.confidence ?? 0.7,
        userId: request.userId,
        channelId: request.channelId,
        guildId: request.guildId,
      });
    }
  } catch (err) {
    log.warn(`[AI/Agent] Communication wrapping failed: ${err.message}`);
  }

  // 3. Enrich the response with Communication output
  agentResponse.communicationResult = communicationResult;
  if (communicationResult?.discordOutput) {
    agentResponse.discordOutput = communicationResult.discordOutput;
  } else {
    // Graceful fallback: wrap raw content as plain-text DiscordOutput
    // so callers always have a .discordOutput to pass to DiscordAdapter
    agentResponse.discordOutput = {
      messages: [agentResponse.content],
      embeds: [],
      attachments: [],
      components: [],
      metadata: { topic: agentResponse.topic, complexity: agentResponse.complexity },
    };
  }
  if (communicationResult?.responseObj) {
    agentResponse.responseObj = communicationResult.responseObj;
  } else {
    agentResponse.responseObj = null;
  }

  return agentResponse;
}
