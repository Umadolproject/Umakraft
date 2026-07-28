// AI/CognitiveContracts.js
// Centralized type definitions and runtime validators for the Agent cognitive
// pipeline. Every subsystem that passes structured data through the agent
// loop (classify → plan → execute → reflect → reply) conforms to these
// contracts.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Chapter:  08 — Cognitive API & Intent Contracts
// Phase:    Agent Layer (Phase 8)
//
// Usage:
//   import { IntentResult, ExecutionPlan, CapabilityResult, CognitiveContext } from './CognitiveContracts.js';
//
//   // Opt-in runtime validation (dev mode):
//   if (config.devMode) IntentResult.validate(classification);
//
// Contracts:
//   IntentResult      — TopicFilter.classify() / classifyAsync() output
//   ExecutionPlan     — Planner plan output
//   CapabilityResult  — ToolRegistry.execute() result wrapper
//   CognitiveContext  — Shared context passed through the entire pipeline

import log from '../core/log.js';

// ──────────────────────────────────────────────────────────────────────────────
// ContractError — thrown by validators when a contract is violated
// ──────────────────────────────────────────────────────────────────────────────

export class ContractError extends Error {
  constructor(contract, message) {
    super(`[Contract:${contract}] ${message}`);
    this.name = 'ContractError';
    this.contract = contract;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Valid topics, complexity tiers, and methods
// ──────────────────────────────────────────────────────────────────────────────

const VALID_TOPICS = ['repository', 'umamusume', 'live', 'message', 'web', 'off-topic'];
const VALID_COMPLEXITIES = ['simple', 'complex', null];
const VALID_METHODS = ['keyword', 'semantic', 'hybrid', 'command-override', 'off-topic-indicator'];
const VALID_SUBTOPICS = ['bot_assist', null];

// ──────────────────────────────────────────────────────────────────────────────
// IntentResult — TopicFilter output
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} IntentResult
 * @property {'repository'|'umamusume'|'live'|'message'|'web'|'off-topic'} topic
 * @property {'simple'|'complex'|null} complexity
 * @property {number} confidence       — 0.0–1.0
 * @property {'keyword'|'semantic'|'hybrid'|'command-override'|'off-topic-indicator'} method
 * @property {'bot_assist'|null} subtopic
 * @property {boolean} rejected
 * @property {string|null} rejectionMessage
 */

export const IntentResult = {
  schema: {
    topic:            { type: 'string',   required: true,  values: VALID_TOPICS },
    complexity:       { type: 'string',   required: true,  values: VALID_COMPLEXITIES },
    confidence:       { type: 'number',   required: true,  range: [0, 1] },
    method:           { type: 'string',   required: true,  values: VALID_METHODS },
    subtopic:         { type: 'string',   required: true,  values: VALID_SUBTOPICS, nullable: true },
    rejected:         { type: 'boolean',  required: true },
    rejectionMessage: { type: 'string',   required: false, nullable: true },
  },

  /**
   * Validate an object against the IntentResult contract.
   * Throws ContractError on violation. Returns true on success.
   * @param {object} obj
   * @returns {boolean}
   */
  validate(obj) {
    if (!obj || typeof obj !== 'object') throw new ContractError('IntentResult', 'expected object');

    for (const [field, rule] of Object.entries(IntentResult.schema)) {
      if (!(field in obj)) throw new ContractError('IntentResult', `missing field: ${field}`);

      const value = obj[field];

      if (rule.type === 'number' && typeof value !== 'number') {
        throw new ContractError('IntentResult', `${field} must be number, got ${typeof value}`);
      }
      if (rule.type === 'string' && value !== null && typeof value !== 'string') {
        throw new ContractError('IntentResult', `${field} must be string, got ${typeof value}`);
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        throw new ContractError('IntentResult', `${field} must be boolean, got ${typeof value}`);
      }

      if (rule.range && value !== null) {
        if (value < rule.range[0] || value > rule.range[1]) {
          throw new ContractError('IntentResult', `${field}=${value} out of range [${rule.range}]`);
        }
      }

      if (rule.values && !(rule.nullable && value === null)) {
        if (!rule.values.includes(value)) {
          throw new ContractError('IntentResult', `${field}="${value}" not in [${rule.values.join(', ')}]`);
        }
      }

      // Check nullable constraints
      if (rule.nullable && value === null) continue;
      // Non-nullable null check
      if (value === null && !rule.nullable) {
        throw new ContractError('IntentResult', `${field} is null but not nullable`);
      }
    }

    return true;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// ExecutionPlan — Planner output
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ExecutionStep
 * @property {string}   id         — unique step ID (e.g. 'step-1-search-kb')
 * @property {string}   tool       — tool name from ToolRegistry
 * @property {object}   params     — parameters to pass to the tool
 * @property {string[]} dependsOn  — IDs of steps this step depends on
 * @property {string}   [description] — human-readable description
 * @property {string}   [outputKey] — key to store result under in shared context
 */

/**
 * @typedef {object} ExecutionPlan
 * @property {ExecutionStep[]} steps
 * @property {'simple'|'complex'} complexity
 * @property {string} description
 * @property {number} estimatedLatencyMs
 * @property {boolean} isDecomposed  — true if the plan has sub-goals
 */

export const ExecutionPlan = {
  schema: {
    steps:             { type: 'array',    required: true,  minLength: 0 },
    complexity:        { type: 'string',   required: true,  values: ['simple', 'complex'] },
    description:       { type: 'string',   required: true },
    estimatedLatencyMs: { type: 'number',  required: true },
    isDecomposed:      { type: 'boolean',  required: true },
  },

  stepSchema: {
    id:         { type: 'string',   required: true },
    tool:       { type: 'string',   required: true },
    params:     { type: 'object',   required: true },
    dependsOn:  { type: 'array',    required: false, default: [] },
    description: { type: 'string',  required: false },
    outputKey:  { type: 'string',   required: false },
  },

  /**
   * @param {object} obj
   * @returns {boolean}
   */
  validate(obj) {
    if (!obj || typeof obj !== 'object') throw new ContractError('ExecutionPlan', 'expected object');

    for (const [field, rule] of Object.entries(ExecutionPlan.schema)) {
      if (!(field in obj)) throw new ContractError('ExecutionPlan', `missing field: ${field}`);

      const value = obj[field];
      if (rule.type === 'array' && !Array.isArray(value)) {
        throw new ContractError('ExecutionPlan', `${field} must be array`);
      }
      if (rule.type === 'string' && typeof value !== 'string') {
        throw new ContractError('ExecutionPlan', `${field} must be string`);
      }
      if (rule.type === 'number' && typeof value !== 'number') {
        throw new ContractError('ExecutionPlan', `${field} must be number`);
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        throw new ContractError('ExecutionPlan', `${field} must be boolean`);
      }
      if (rule.values && !rule.values.includes(value)) {
        throw new ContractError('ExecutionPlan', `${field}="${value}" not in [${rule.values}]`);
      }
      if (rule.minLength !== undefined && Array.isArray(value) && value.length < rule.minLength) {
        throw new ContractError('ExecutionPlan', `${field} has ${value.length} items, min ${rule.minLength}`);
      }
    }

    // Validate each step
    const stepIds = new Set();
    for (const step of obj.steps) {
      if (!step.id) throw new ContractError('ExecutionPlan', 'step missing id');
      if (stepIds.has(step.id)) throw new ContractError('ExecutionPlan', `duplicate step id: ${step.id}`);
      stepIds.add(step.id);

      if (!step.tool) throw new ContractError('ExecutionPlan', `step ${step.id} missing tool`);
      if (!step.params || typeof step.params !== 'object') {
        throw new ContractError('ExecutionPlan', `step ${step.id} missing params`);
      }

      // Validate dependencies reference real steps
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (depId === step.id) {
            throw new ContractError('ExecutionPlan', `step ${step.id} depends on itself`);
          }
          // Allow forward references to steps not yet validated
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set();
    const inStack = new Set();
    function hasCycle(stepId) {
      if (inStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;
      visited.add(stepId);
      inStack.add(stepId);
      const step = obj.steps.find(s => s.id === stepId);
      if (step?.dependsOn?.length) {
        for (const depId of step.dependsOn) {
          if (hasCycle(depId)) return true;
        }
      }
      inStack.delete(stepId);
      return false;
    }
    for (const step of obj.steps) {
      if (hasCycle(step.id)) {
        throw new ContractError('ExecutionPlan', `circular dependency detected involving step ${step.id}`);
      }
    }

    return true;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// CapabilityResult — tool execution output wrapper
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CapabilityResult
 * @property {string} tool          — tool name that produced this result
 * @property {boolean} ok           — did execution succeed?
 * @property {*} data               — result payload (tool-specific shape)
 * @property {string|null} error    — error message if !ok
 * @property {number} durationMs    — execution time
 * @property {string} source        — data source (repository, web, knowledge-base, etc.)
 * @property {object} [metadata]    — optional extra info
 */

export const CapabilityResult = {
  schema: {
    tool:       { type: 'string',   required: true },
    ok:         { type: 'boolean',  required: true },
    data:       { type: 'any',      required: true },
    error:      { type: 'string',   required: true,  nullable: true },
    durationMs: { type: 'number',   required: true },
    source:     { type: 'string',   required: true },
    metadata:   { type: 'object',   required: false },
  },

  /**
   * @param {object} obj
   * @returns {boolean}
   */
  validate(obj) {
    if (!obj || typeof obj !== 'object') throw new ContractError('CapabilityResult', 'expected object');

    if (!('tool' in obj)) throw new ContractError('CapabilityResult', 'missing field: tool');
    if (!('ok' in obj))   throw new ContractError('CapabilityResult', 'missing field: ok');
    if (!('data' in obj)) throw new ContractError('CapabilityResult', 'missing field: data');

    if (typeof obj.ok !== 'boolean') throw new ContractError('CapabilityResult', 'ok must be boolean');
    if (typeof obj.tool !== 'string') throw new ContractError('CapabilityResult', 'tool must be string');
    if (typeof obj.durationMs !== 'number' && obj.durationMs !== undefined) {
      throw new ContractError('CapabilityResult', 'durationMs must be number');
    }

    if (!obj.ok && !obj.error) {
      throw new ContractError('CapabilityResult', `tool ${obj.tool} failed but has no error message`);
    }

    return true;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// CognitiveContext — shared context through the entire pipeline
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CognitiveContext
 * @property {string} query                  — original user query
 * @property {string} subcommand             — 'ask' | 'search' | 'docs' | etc.
 * @property {string|null} userId            — Discord user ID
 * @property {string|null} channelId         — Discord channel ID
 * @property {string|null} guildId           — Discord guild ID
 * @property {IntentResult} classification   — TopicFilter output
 * @property {ExecutionPlan} plan            — current plan being executed
 * @property {CapabilityResult[]} toolResults — results from executed tools
 * @property {object} [userProfile]          — UserProfileManager data
 * @property {string[]} conversationHistory  — recent messages in this channel
 * @property {object} [metadata]             — extensibility
 */

export const CognitiveContext = {
  schema: {
    query:               { type: 'string',   required: true },
    subcommand:          { type: 'string',   required: true },
    userId:              { type: 'string',   required: false, nullable: true },
    channelId:           { type: 'string',   required: false, nullable: true },
    guildId:             { type: 'string',   required: false, nullable: true },
    classification:      { type: 'object',   required: true },
    plan:                { type: 'object',   required: false },
    toolResults:         { type: 'array',    required: false },
    userProfile:         { type: 'object',   required: false, nullable: true },
    conversationHistory: { type: 'array',    required: false },
    metadata:            { type: 'object',   required: false },
  },

  /**
   * @param {object} obj
   * @returns {boolean}
   */
  validate(obj) {
    if (!obj || typeof obj !== 'object') throw new ContractError('CognitiveContext', 'expected object');

    if (!obj.query || typeof obj.query !== 'string') {
      throw new ContractError('CognitiveContext', 'missing or invalid query');
    }
    if (!obj.classification || typeof obj.classification !== 'object') {
      throw new ContractError('CognitiveContext', 'missing or invalid classification');
    }

    // Validate nested contracts
    try { IntentResult.validate(obj.classification); } catch (e) {
      throw new ContractError('CognitiveContext', `invalid classification: ${e.message}`);
    }

    if (obj.plan) {
      try { ExecutionPlan.validate(obj.plan); } catch (e) {
        throw new ContractError('CognitiveContext', `invalid plan: ${e.message}`);
      }
    }

    if (obj.toolResults) {
      for (let i = 0; i < obj.toolResults.length; i++) {
        try { CapabilityResult.validate(obj.toolResults[i]); } catch (e) {
          throw new ContractError('CognitiveContext', `invalid toolResult[${i}]: ${e.message}`);
        }
      }
    }

    return true;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Utility: create an empty CognitiveContext
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create a minimal valid CognitiveContext to start the pipeline.
 * @param {object} params
 * @param {string} params.query
 * @param {string} [params.subcommand]
 * @param {string} [params.userId]
 * @param {string} [params.channelId]
 * @param {string} [params.guildId]
 * @returns {CognitiveContext}
 */
export function createContext({ query, subcommand = 'ask', userId = null, channelId = null, guildId = null } = {}) {
  return {
    query,
    subcommand,
    userId,
    channelId,
    guildId,
    classification: null,
    plan: null,
    toolResults: [],
    userProfile: null,
    conversationHistory: [],
    metadata: {},
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility: build a CapabilityResult from an execution outcome
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} tool
 * @param {boolean} ok
 * @param {*} data
 * @param {string|null} error
 * @param {number} durationMs
 * @param {string} source
 * @returns {CapabilityResult}
 */
export function resultFor(tool, ok, data, error = null, durationMs = 0, source = 'unknown') {
  return { tool, ok, data, error, durationMs, source };
}

// ──────────────────────────────────────────────────────────────────────────────
// Export validation helper
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validate all contracts in a cognitive context, logging contract violations
 * as warnings rather than throwing. Use in production to detect drift without
 * breaking the pipeline.
 *
 * @param {CognitiveContext} ctx
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function softValidate(ctx) {
  const violations = [];
  try { CognitiveContext.validate(ctx); } catch (e) {
    violations.push(e.message);
  }
  if (violations.length > 0) {
    log.warn(`[CognitiveContracts] ${violations.length} contract violation(s): ${violations.join('; ')}`);
  }
  return { ok: violations.length === 0, violations };
}

log.info('[CognitiveContracts] Contracts registered: IntentResult, ExecutionPlan, CapabilityResult, CognitiveContext');
