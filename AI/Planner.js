// AI/Planner.js
// Planning Engine — builds ordered, multi-step execution plans from classified
// intents. For complex queries, decomposes the problem into sub-goals with
// data-flow dependencies between steps.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Chapter:  05 — The Planning Engine
// Phase:    Agent Layer (Phase 8)
//
// Design: Template-based decomposition (deterministic, fast) rather than
// LLM-based planning (slow, non-deterministic) for real-time Discord bot.
//
// Public API:
//   plan(classification, ctx)       → ExecutionPlan
//   decompose(query, topic)         → ExecutionPlan — multi-step for complex
//   validatePlan(plan, toolRegistry)→ { valid, issues }
//   compressPlan(plan)              → ExecutionPlan — simplify when possible

import log from '../core/log.js';
import { ExecutionPlan } from './CognitiveContracts.js';

// ──────────────────────────────────────────────────────────────────────────────
// Decomposition patterns — query patterns → multi-step plans
// Each pattern has: test (regex), steps (array of tool calls with dependencies)
// ──────────────────────────────────────────────────────────────────────────────

const DECOMPOSITION_PATTERNS = [
  // ── Growth / improvement queries ────────────────────────────────────────
  {
    name: 'growth-strategy',
    test: /how\s+(to|do\s+i|can\s+i)\s+(grow|improve|increase|boost|raise|level\s*up|get\s+more|earn\s+more)/i,
    buildSteps: (query, topic) => [
      {
        id: 'step-1-search-kb',
        tool: topic === 'repository' ? 'search_repository' : 'search_knowledge',
        params: { query, topK: 5 },
        dependsOn: [],
        description: 'Search knowledge base for current state and requirements',
        outputKey: 'kb_results',
      },
      {
        id: 'step-2-search-web',
        tool: 'search_web',
        params: { query, maxResults: 3 },
        dependsOn: [],
        description: 'Search web for latest strategies and meta',
        outputKey: 'web_results',
      },
      {
        id: 'step-3-analyze',
        tool: 'ai_generate',
        params: { query: `Based on the search results, provide a step-by-step strategy for: ${query}`, complexity: 'complex' },
        dependsOn: ['step-1-search-kb', 'step-2-search-web'],
        description: 'Synthesize findings into a step-by-step strategy',
        outputKey: 'analysis',
      },
    ],
  },

  // ── Comparison queries ──────────────────────────────────────────────────
  {
    name: 'comparison',
    test: /(compare|difference|vs\.?|versus|or\s+should\s+i|which\s+is\s+better|what\'?s?\s+better)/i,
    buildSteps: (query, topic) => {
      const searchTool = topic === 'repository' ? 'search_repository' : 'search_knowledge';
      return [
        {
          id: 'step-1-search-primary',
          tool: searchTool,
          params: { query, topK: 5 },
          dependsOn: [],
          description: 'Search for comparison data',
          outputKey: 'primary_results',
        },
        {
          id: 'step-2-search-web',
          tool: 'search_web',
          params: { query, maxResults: 3 },
          dependsOn: [],
          description: 'Supplement with web search for broader context',
          outputKey: 'web_results',
        },
        {
          id: 'step-3-compare',
          tool: 'ai_generate',
          params: { query: `Compare and contrast, then recommend the best option. Question: ${query}`, complexity: 'complex' },
          dependsOn: ['step-1-search-primary', 'step-2-search-web'],
          description: 'Generate comparison and recommendation',
          outputKey: 'comparison',
        },
      ];
    },
  },

  // ── Recommendation / "best X" queries ───────────────────────────────────
  {
    name: 'recommendation',
    test: /(what\'?s?\s+the\s+best|what\s+is\s+the\s+best|best\s+way|recommend|should\s+i\s+(use|pick|choose|get|go\s+with)|which\s+(card|horse|girl|support|build|training))/i,
    buildSteps: (query, topic) => {
      const searchTool = topic === 'repository' ? 'search_repository' : 'search_knowledge';
      return [
        {
          id: 'step-1-search-options',
          tool: searchTool,
          params: { query, topK: 5 },
          dependsOn: [],
          description: 'Search for available options',
          outputKey: 'options',
        },
        {
          id: 'step-2-search-web',
          tool: 'search_web',
          params: { query, maxResults: 3 },
          dependsOn: [],
          description: 'Search web for community recommendations',
          outputKey: 'web_recommendations',
        },
        {
          id: 'step-3-synthesize',
          tool: 'ai_generate',
          params: { query: `Based on the retrieved information, recommend the best option(s). Question: ${query}`, complexity: 'complex' },
          dependsOn: ['step-1-search-options', 'step-2-search-web'],
          description: 'Synthesize recommendation from all sources',
          outputKey: 'recommendation',
        },
      ];
    },
  },

  // ── Step-by-step guide queries ──────────────────────────────────────────
  {
    name: 'step-by-step',
    test: /(step\s*by\s*step|walk\s*(me\s*)?through|guide\s*(me\s*)?through|how\s+exactly|detailed\s+guide|in\s*depth)/i,
    buildSteps: (query, topic) => {
      const searchTool = topic === 'repository' ? 'search_repository' : 'search_knowledge';
      return [
        {
          id: 'step-1-search-guide',
          tool: searchTool,
          params: { query, topK: 5 },
          dependsOn: [],
          description: 'Search for existing guides and documentation',
          outputKey: 'guide_results',
        },
        {
          id: 'step-2-search-web',
          tool: 'search_web',
          params: { query, maxResults: 3 },
          dependsOn: [],
          description: 'Search web for additional guides',
          outputKey: 'web_guides',
        },
        {
          id: 'step-3-search-memory',
          tool: 'search_conversation_memory',
          params: { query, maxResults: 3 },
          dependsOn: [],
          description: 'Check past interactions for relevant context',
          outputKey: 'memory',
        },
        {
          id: 'step-4-build-guide',
          tool: 'ai_generate',
          params: { query: `Create a detailed step-by-step guide. Question: ${query}`, complexity: 'complex' },
          dependsOn: ['step-1-search-guide', 'step-2-search-web'],
          description: 'Build comprehensive step-by-step answer',
          outputKey: 'guide',
        },
      ];
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Simple (non-decomposed) plan templates — same as original Agent.plan()
// ──────────────────────────────────────────────────────────────────────────────

function simplePlan(classification, ctx) {
  const { topic, confidence } = classification;
  const query = ctx.query;
  const steps = [];

  if (topic === 'message') {
    steps.push({ id: 'msg-1', tool: 'generate_message', params: { type: ctx.messageType ?? 'greeting', trainerName: ctx.trainerName, milestoneValue: ctx.milestoneValue }, dependsOn: [], description: 'Generate message', outputKey: 'message' });
    return steps;
  }

  if (topic === 'live' || topic === 'web') {
    steps.push({ id: 'web-1', tool: 'search_web', params: { query, maxResults: 5 }, dependsOn: [], description: 'Web search', outputKey: 'web' });
    return steps;
  }

  if (topic === 'umamusume') {
    steps.push({ id: 'kb-1', tool: 'search_knowledge', params: { query }, dependsOn: [], description: 'Search knowledge base', outputKey: 'knowledge' });
    if (confidence < 0.70) steps.push({ id: 'repo-1', tool: 'search_repository', params: { query, topK: 3 }, dependsOn: [], description: 'Search repository (supplement)', outputKey: 'repo' });
    steps.push({ id: 'web-1', tool: 'search_web', params: { query, maxResults: 3 }, dependsOn: [], description: 'Scoped web search', outputKey: 'web' });
    if (ctx.userId && ctx.channelId) steps.push({ id: 'mem-1', tool: 'search_conversation_memory', params: { userId: ctx.userId, channelId: ctx.channelId }, dependsOn: [], description: 'Conversation memory', outputKey: 'memory' });
    return steps;
  }

  // repository (default)
  steps.push({ id: 'repo-1', tool: 'search_repository', params: { query, topK: 5 }, dependsOn: [], description: 'Search repository', outputKey: 'repo' });
  if (ctx.userId && ctx.channelId) steps.push({ id: 'mem-1', tool: 'search_conversation_memory', params: { userId: ctx.userId, channelId: ctx.channelId }, dependsOn: [], description: 'Conversation memory', outputKey: 'memory' });
  steps.push({ id: 'sem-1', tool: 'search_semantic_memory', params: { query, limit: 3 }, dependsOn: [], description: 'Semantic memory', outputKey: 'semantic' });
  if (confidence < 0.65) steps.push({ id: 'web-1', tool: 'search_web', params: { query, maxResults: 3 }, dependsOn: [], description: 'Web fallback', outputKey: 'web' });
  return steps;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build an execution plan from classification results and context.
 * Automatically decomposes complex queries into multi-step sub-goal plans.
 *
 * @param {object} classification — IntentResult from TopicFilter
 * @param {object} ctx            — { query, userId, channelId, ... }
 * @returns {{ steps: Array, complexity: string, description: string, estimatedLatencyMs: number, isDecomposed: boolean }}
 */
export function plan(classification, ctx) {
  const { topic, complexity } = classification;
  const query = ctx.query ?? '';

  // Try decomposition for complex queries
  if (complexity === 'complex') {
    const decomposed = decompose(query, topic);
    if (decomposed) {
      log.info(`[Planner] Decomposed query → ${decomposed.steps.length} steps (pattern: ${decomposed.description})`);
      return decomposed;
    }
  }

  // Fall through to simple plan
  const steps = simplePlan(classification, ctx);
  const totalMs = steps.length * 250; // rough latency estimate

  const result = {
    steps,
    complexity: 'simple',
    description: `Simple plan for ${topic} query`,
    estimatedLatencyMs: totalMs,
    isDecomposed: false,
  };

  return result;
}

/**
 * Attempt to decompose a complex query into a multi-step plan using
 * pattern matching. Returns null if no pattern matches.
 *
 * @param {string} query
 * @param {string} topic
 * @returns {{ steps, complexity, description, estimatedLatencyMs, isDecomposed }|null}
 */
export function decompose(query, topic) {
  for (const pattern of DECOMPOSITION_PATTERNS) {
    if (pattern.test.test(query)) {
      const steps = pattern.buildSteps(query, topic);
      const totalMs = steps.length * 350; // decomposed steps take longer

      return {
        steps,
        complexity: 'complex',
        description: pattern.name,
        estimatedLatencyMs: totalMs + 1500, // + AI generation time
        isDecomposed: true,
      };
    }
  }

  // No pattern matched — complex but can't decompose (fall through to simple)
  log.debug(`[Planner] No decomposition pattern matched for query: "${query.slice(0, 80)}"`);
  return null;
}

/**
 * Validate that a plan is achievable with the available tools.
 *
 * @param {object} plan        — ExecutionPlan
 * @param {Map|object} toolRegistry — tool name → { alwaysAvailable }
 * @returns {{ valid: boolean, issues: string[] }}
 */
export function validatePlan(plan, toolRegistry) {
  const issues = [];
  const toolMap = toolRegistry instanceof Map ? toolRegistry : new Map(Object.entries(toolRegistry));

  if (!plan.steps || plan.steps.length === 0) {
    return { valid: true, issues: ['empty plan — accepting'] };
  }

  // Check all tools are registered
  for (const step of plan.steps) {
    const tool = toolMap.get ? toolMap.get(step.tool) : toolMap[step.tool];
    if (!tool) {
      issues.push(`unknown tool: ${step.tool} (step ${step.id})`);
      continue;
    }
    if (tool.alwaysAvailable !== undefined && !tool.alwaysAvailable) {
      // Tool may fail at runtime — flag as a risk
      issues.push(`tool ${step.tool} may not be available (step ${step.id})`);
    }
  }

  // Check dependency references are valid
  const stepIds = new Set(plan.steps.map(s => s.id));
  for (const step of plan.steps) {
    if (!step.dependsOn) continue;
    for (const depId of step.dependsOn) {
      if (!stepIds.has(depId)) {
        issues.push(`step ${step.id} depends on unknown step: ${depId}`);
      }
    }
  }

  // Check for circular dependencies (using CognitiveContracts)
  try {
    ExecutionPlan.validate(plan);
  } catch (err) {
    issues.push(`contract violation: ${err.message}`);
  }

  return {
    valid: issues.filter(i => i.startsWith('unknown tool') || i.includes('depends on unknown')).length === 0,
    issues,
  };
}

/**
 * Compress a plan — combine adjacent independent steps when possible.
 * Used when a query is marked complex but is actually simple.
 *
 * @param {object} plan — ExecutionPlan
 * @returns {object} ExecutionPlan
 */
export function compressPlan(plan) {
  if (!plan.isDecomposed || plan.steps.length <= 2) return plan;

  // If all steps are independent (no dependsOn), they can run in one pass
  const hasDependencies = plan.steps.some(s => s.dependsOn && s.dependsOn.length > 0);
  if (!hasDependencies) {
    const merged = {
      steps: [{
        id: 'compressed-all',
        tool: 'search_web',
        params: { query: 'combined', maxResults: 8 },
        dependsOn: [],
        description: `Compressed ${plan.steps.length} independent steps into one`,
        outputKey: 'compressed',
      }],
      complexity: 'simple',
      description: 'compressed-independents',
      estimatedLatencyMs: 500,
      isDecomposed: false,
    };
    log.info(`[Planner] Compressed ${plan.steps.length} independent steps → 1`);
    return merged;
  }

  return plan; // can't safely compress
}

// ──────────────────────────────────────────────────────────────────────────────
// Log initialization
// ──────────────────────────────────────────────────────────────────────────────

log.info(`[Planner] Initialized with ${DECOMPOSITION_PATTERNS.length} decomposition patterns`);
