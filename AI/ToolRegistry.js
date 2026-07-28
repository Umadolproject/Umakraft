// AI/ToolRegistry.js
// Structured tool catalog — every existing AI capability registered as a named
// tool with input/output schemas so the Planner can select tools dynamically.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Phase:     Agent Layer (post-Phase 7)
//
// Public API:
//   listAll()              → ToolDefinition[] — every registered tool
//   listAvailable(scope)   → ToolDefinition[] — tools available for the given scope
//   get(name)              → ToolDefinition | null
//   register(tool)         → void — add a tool at runtime
//   execute(name, params)  → Promise<{ok, result, error?}>

import log from '../core/log.js';

// ──────────────────────────────────────────────────────────────────────────────
// Tool definition schema
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ToolDefinition
 * @property {string}    name          — unique identifier (e.g. 'search_repository')
 * @property {string}    description   — human-readable, used by Planner
 * @property {string}    category      — 'search' | 'generate' | 'memory' | 'knowledge' | 'utility'
 * @property {object}    parameters    — { paramName: { type, required, description } }
 * @property {Function}  execute       — async (params) => result
 * @property {boolean}   alwaysAvailable — false if requires API keys or initialization
 * @property {string[]}  returns       — description of what the tool returns
 * @property {string[]}  bestFor       — intent types this tool is best suited for
 */

// ──────────────────────────────────────────────────────────────────────────────
// Lazy imports — tools load their underlying modules on first use
// ──────────────────────────────────────────────────────────────────────────────

let _repositorySearch = null;
let _knowledgeContext  = null;
let _webSearch         = null;
let _messageGenerate   = null;
let _topicFilter       = null;
let _topicFilterAsync  = null;
let _memoryRecall      = null;
let _conversationCtx   = null;
let _aiGenerate        = null;

async function _imports() {
  if (!_repositorySearch) {
    const modRepo  = await import('./RepositoryEngine.js');
    const modKnow  = await import('./KnowledgeEngine.js');
    const modWeb   = await import('./managers/SearchManager.js');
    const modMsg   = await import('./MessageSystem.js');
    const modTf    = await import('./TopicFilter.js');
    const modConv  = await import('./AdvancedFeatures.js');
    _repositorySearch = modRepo.search;
    _knowledgeContext  = modKnow.getContext;
    _webSearch         = modWeb.search;
    _messageGenerate   = modMsg.generate;
    _topicFilter       = modTf.classify;
    _topicFilterAsync  = modTf.classifyAsync ?? modTf.classify;
    _conversationCtx   = modConv.getConversationContext;
  }
  if (!_aiGenerate) {
    const modAi = await import('./router/Router.js');
    _aiGenerate = modAi.Router.ai;
  }
  if (!_memoryRecall) {
    try {
      const modMem = await import('./managers/MemoryManager.js');
      _memoryRecall = modMem.recall;
    } catch { /* MemoryManager not available */ }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool definitions
// ──────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, ToolDefinition>} */
const _tools = new Map();

function _define(tool) {
  _tools.set(tool.name, tool);
}

// ── Search tools ──────────────────────────────────────────────────────────────

_define({
  name:        'search_repository',
  description: 'Semantic search across the Umakraft codebase and documentation. Returns file chunks with relevance scores. Best for questions about code architecture, pipeline stages, or module responsibilities.',
  category:    'search',
  parameters:  {
    query:      { type: 'string', required: true,  description: 'Search query' },
    topK:       { type: 'number', required: false, description: 'Max results (default 5)' },
    department: { type: 'string', required: false, description: 'Filter by department (e.g. refinery, workshop)' },
  },
  execute: async (params) => {
    await _imports();
    const chunks = await _repositorySearch(params.query, {
      topK:       params.topK       ?? 5,
      department: params.department ?? undefined,
    });
    return { chunks, count: chunks.length, source: 'repository' };
  },
  alwaysAvailable: true,
  returns:   ['Array of {content, filePath, heading, score} chunks'],
  bestFor:   ['answer_question', 'search_documentation', 'explain_code'],
});

_define({
  name:        'search_knowledge',
  description: 'Search the Umamusume domain knowledge base — glossary terms, game mechanics, and circle concepts. Best for Uma Musume: Pretty Derby questions about MANT, fan gain, circle ranks, trainer mechanics.',
  category:    'knowledge',
  parameters:  {
    query: { type: 'string', required: true, description: 'Umamusume-related question' },
  },
  execute: async (params) => {
    await _imports();
    const chunks = _knowledgeContext(params.query);
    return { chunks, count: chunks.length, source: 'knowledge-base' };
  },
  alwaysAvailable: true,
  returns:   ['Array of {content, filePath, heading, score} knowledge chunks'],
  bestFor:   ['answer_question', 'explain_code'],
});

_define({
  name:        'search_web',
  description: 'Search the live web for current information via Tavily/Brave/Google CSE. Best for real-time data, current rankings, patch notes, or anything the repository cannot answer.',
  category:    'search',
  parameters:  {
    query:      { type: 'string', required: true,  description: 'Search query (auto-scoped to umamusume domain)' },
    maxResults: { type: 'number', required: false, description: 'Max results (default 5)' },
  },
  execute: async (params) => {
    await _imports();
    const chunks = await _webSearch(params.query, { maxResults: params.maxResults ?? 5 });
    return { chunks, count: chunks.length, source: 'web' };
  },
  alwaysAvailable: false, // requires API keys
  returns:   ['Array of {content, filePath, heading, score} web search results'],
  bestFor:   ['search_web', 'search_documentation'],
});

// ── Generation tools ──────────────────────────────────────────────────────────

_define({
  name:        'generate_message',
  description: 'Generate a community message of a specific type. Supports greeting, milestone, achievement, leaderboard, warning, reminder, and documentation types.',
  category:    'generate',
  parameters:  {
    type:            { type: 'string', required: true,  description: 'Message type: greeting|milestone|achievement|leaderboard|warning|reminder|documentation' },
    trainerName:     { type: 'string', required: false, description: 'Trainer name (required for milestone, achievement, warning)' },
    milestoneValue:  { type: 'number', required: false, description: 'Fan milestone value' },
    achievementName: { type: 'string', required: false, description: 'Achievement name' },
    eventName:       { type: 'string', required: false, description: 'Event name (for reminders)' },
    eventDate:       { type: 'string', required: false, description: 'Event date YYYY-MM-DD' },
  },
  execute: async (params) => {
    await _imports();
    const variables = {
      trainerName:     params.trainerName     ?? undefined,
      milestoneValue:  params.milestoneValue  ?? undefined,
      achievementName: params.achievementName ?? undefined,
      eventName:       params.eventName       ?? undefined,
      eventDate:       params.eventDate       ?? undefined,
      topTrainers:     [],
    };
    const result = await _messageGenerate(params.type, variables);
    return { message: result.message, usedFallback: result.usedFallback, source: 'message-system' };
  },
  alwaysAvailable: true,
  returns:   ['{message, usedFallback}'],
  bestFor:   ['generate_message'],
});

_define({
  name:        'ai_generate',
  description: 'Generate a natural-language response using the AI model. Best for answering questions after relevant context has been retrieved by search tools.',
  category:    'generate',
  parameters:  {
    prompt:     { type: 'string', required: true, description: 'Assembled prompt with context and question' },
    complexity: { type: 'string', required: false, description: 'simple or complex (controls model selection)' },
  },
  execute: async (params) => {
    await _imports();
    const result = await _aiGenerate(params.prompt, { complexity: params.complexity ?? 'simple' });
    return { text: result.text, model: result.model, source: 'ai-model' };
  },
  alwaysAvailable: false, // requires API key
  returns:   ['{text, model, tokens}'],
  bestFor:   ['answer_question', 'explain_code', 'summarize'],
});

// ── Memory tools ──────────────────────────────────────────────────────────────

_define({
  name:        'search_conversation_memory',
  description: 'Retrieve recent conversation context from the current session. Best when the user asks a follow-up question referencing previous turns.',
  category:    'memory',
  parameters:  {
    userId:    { type: 'string', required: true, description: 'Discord user ID' },
    channelId: { type: 'string', required: true, description: 'Discord channel ID' },
  },
  execute: async (params) => {
    await _imports();
    const ctx = _conversationCtx(params.userId, params.channelId);
    return { context: ctx, hasHistory: ctx.length > 0, source: 'conversation-memory' };
  },
  alwaysAvailable: true,
  returns:   ['{context, hasHistory}'],
  bestFor:   ['answer_question', 'summarize'],
});

_define({
  name:        'search_semantic_memory',
  description: 'Semantic search across stored documents and past interactions in Qdrant. Best for questions that reference past events, stored knowledge, or historical context.',
  category:    'memory',
  parameters:  {
    query: { type: 'string', required: true, description: 'Semantic search query' },
    limit: { type: 'number', required: false, description: 'Max results (default 5)' },
  },
  execute: async (params) => {
    await _imports();
    if (!_memoryRecall) return { results: [], count: 0, source: 'semantic-memory', available: false };
    const results = await _memoryRecall(params.query, params.limit ?? 5);
    return { results, count: results.length, source: 'semantic-memory', available: true };
  },
  alwaysAvailable: true, // has in-memory fallback when Qdrant isn't available
  returns:   ['Array of {id, score, payload} search results'],
  bestFor:   ['search_memory', 'answer_question'],
});

// ── Classification tool ───────────────────────────────────────────────────────

_define({
  name:        'classify_intent',
  description: 'Classify a user request into a topic and complexity tier. Always run first — determines which tools are relevant.',
  category:    'utility',
  parameters:  {
    query:   { type: 'string', required: true, description: 'User message to classify' },
    command: { type: 'string', required: false, description: 'Command override (e.g. /ai search)' },
  },
  execute: async (params) => {
    await _imports();
    // Use classifyAsync for semantic embedding fallback on low-confidence queries.
    // Falls through to keyword-only classify() when classifyAsync is unavailable.
    const r = await _topicFilterAsync(params.query, params.command ?? null);
    return {
      topic:      r.topic,
      complexity: r.complexity,
      confidence: r.confidence,
      rejected:   r.rejected,
      rejectionMessage: r.rejectionMessage,
      method:     r.method,
    };
  },
  alwaysAvailable: true,
  returns:   ['{topic, complexity, confidence, rejected, rejectionMessage}'],
  bestFor:   ['answer_question', 'search_documentation', 'generate_message', 'search_web'],
});

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Return every registered tool.
 * @returns {ToolDefinition[]}
 */
export function listAll() {
  return [..._tools.values()];
}

/**
 * Return tools available for the given scope (intent).
 * Filters out tools whose `bestFor` doesn't include the intent and tools
 * that are not alwaysAvailable.
 *
 * @param {string} intent  — 'answer_question' | 'search_web' | 'generate_message' | etc.
 * @returns {ToolDefinition[]}
 */
export function listAvailable(intent) {
  return [..._tools.values()].filter(t =>
    t.alwaysAvailable && t.bestFor.includes(intent),
  );
}

/**
 * Look up a single tool by name.
 * @param {string} name
 * @returns {ToolDefinition|null}
 */
export function get(name) {
  return _tools.get(name) ?? null;
}

/**
 * Register a new tool at runtime. Useful for plugins or future additions.
 * @param {ToolDefinition} tool
 */
export function register(tool) {
  if (_tools.has(tool.name)) {
    log.warn(`[AI/ToolRegistry] Tool "${tool.name}" already registered — overwriting.`);
  }
  _tools.set(tool.name, tool);
  log.info(`[AI/ToolRegistry] Registered tool: ${tool.name} (${tool.category})`);
}

/**
 * Execute a tool by name with the given parameters.
 * @param {string} name
 * @param {object} params
 * @returns {Promise<{ok: boolean, result?: any, error?: string}>}
 */
export async function execute(name, params = {}) {
  const tool = _tools.get(name);
  if (!tool) return { ok: false, error: `Unknown tool: "${name}"` };

  try {
    const result = await tool.execute(params);
    return { ok: true, result };
  } catch (err) {
    log.error(`[AI/ToolRegistry] Tool "${name}" execution failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Get tool count for monitoring.
 * @returns {number}
 */
export function count() {
  return _tools.size;
}
