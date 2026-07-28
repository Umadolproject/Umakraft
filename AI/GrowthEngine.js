// AI/GrowthEngine.js
// Growth Engine — autonomous curiosity, self-improvement tracking, and agent
// introspection. Implements the forward-looking concepts from Chapter 10:
// "Growing Beyond Intelligence."
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Chapter:  10 — Growing Beyond Intelligence
// Phase:    Agent Layer (Phase 8e)
//
// Capabilities:
//   1. Autonomous Curiosity — suggests relevant follow-up questions
//   2. Self-Improvement — tracks performance and surfaces insights
//   3. Agent Introspection — explains its own reasoning when asked
//
// Public API:
//   suggestFollowUps(query, topic, confidence)     → string[] (1-3 suggestions)
//   trackInteraction(metrics)                       → void
//   getImprovementInsights()                        → string[]
//   explainReasoning(query, topic, plan, tools, ...) → string
//   curiosityStats()                                → { total, byTopic }

import log from '../core/log.js';

// ──────────────────────────────────────────────────────────────────────────────
// Follow-up suggestion templates — topic-specific, varied
// ──────────────────────────────────────────────────────────────────────────────

const FOLLOW_UP_TEMPLATES = {
  umamusume: [
    "What's the best support card build for {topic}?",
    "How does {topic} compare to other strategies?",
    "Can you explain {topic} in more detail?",
    "What factors affect {topic} the most?",
    "How do top trainers handle {topic}?",
  ],
  repository: [
    "How does {topic} connect to the rest of the pipeline?",
    "What's the architecture behind {topic}?",
    "Can you show me a code example for {topic}?",
    "What were the design decisions for {topic}?",
    "How can I extend {topic} with a custom module?",
  ],
  live: [
    "How does {topic} compare to last week?",
    "What's driving the changes in {topic}?",
    "Show me the top 5 in {topic}",
  ],
  web: [
    "Can you search for more specific information about {topic}?",
    "What are the latest developments in {topic}?",
    "How reliable is the information about {topic}?",
  ],
  default: [
    "Can you tell me more about {topic}?",
    "What else should I know about {topic}?",
    "Is there a better way to approach {topic}?",
  ],
};

// ──────────────────────────────────────────────────────────────────────────────
// Curiosity topic extraction — pull a short topic phrase from the query
// ──────────────────────────────────────────────────────────────────────────────

function extractTopicPhrase(query) {
  // Remove question words and common prefixes
  let cleaned = query
    .replace(/^(what|how|why|when|where|who|can you|could you|please|tell me|explain|show me|i want to know|i need to know)\s+/i, '')
    .replace(/\?+$/, '')
    .trim();

  // For very long queries, take the key noun phrase
  if (cleaned.length > 60) {
    // Try to find the main subject
    const aboutMatch = cleaned.match(/(?:about|for|regarding)\s+(.+)/i);
    if (aboutMatch) cleaned = aboutMatch[1].trim();
    else cleaned = cleaned.slice(0, 60) + '...';
  }

  return cleaned || 'this topic';
}

// ──────────────────────────────────────────────────────────────────────────────
// Autonomous Curiosity — follow-up suggestions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate 1-3 relevant follow-up questions the user might want to ask next.
 * Uses template-based generation for speed (no additional AI call).
 *
 * @param {string} query      — original user query
 * @param {string} topic      — classification topic
 * @param {number} confidence — classification confidence
 * @returns {string[]}
 */
export function suggestFollowUps(query, topic, confidence = 0.7) {
  const phrase = extractTopicPhrase(query);
  const templates = FOLLOW_UP_TEMPLATES[topic] ?? FOLLOW_UP_TEMPLATES.default;

  // Pick 1-3 unique templates
  const count = confidence < 0.6 ? 1 : topic === 'umamusume' ? 3 : 2;
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, templates.length));

  const suggestions = selected.map(t => t.replace('{topic}', phrase));

  // Low confidence: add a self-aware suggestion
  if (confidence < 0.6) {
    suggestions.push("Could you rephrase that? I want to make sure I understand correctly.");
  }

  log.debug(`[GrowthEngine] Generated ${suggestions.length} follow-up(s) for topic=${topic}`);
  return suggestions.slice(0, 3);
}

// ──────────────────────────────────────────────────────────────────────────────
// Self-Improvement — performance tracking
// ──────────────────────────────────────────────────────────────────────────────

/** @type {Array<{timestamp: number, topic: string, confidence: number, reflectionAction: string, toolsFailed: number, latencyMs: number}>} */
const _interactions = [];

const MAX_TRACKED = 200;

/**
 * Record an interaction for performance analysis.
 *
 * @param {object} metrics
 * @param {string} metrics.topic
 * @param {number} metrics.confidence
 * @param {string} metrics.reflectionAction — 'send' | 're-search' | 're-phrase' | 'reject'
 * @param {number} metrics.toolsFailed
 * @param {number} metrics.latencyMs
 * @param {string} [metrics.query] — optional, for debugging
 */
export function trackInteraction({ topic, confidence, reflectionAction, toolsFailed = 0, latencyMs = 0, query = '' }) {
  _interactions.push({
    timestamp: Date.now(),
    topic,
    confidence,
    reflectionAction,
    toolsFailed,
    latencyMs,
  });

  // Keep only recent interactions
  if (_interactions.length > MAX_TRACKED) {
    _interactions.splice(0, _interactions.length - MAX_TRACKED);
  }
}

/**
 * Analyze tracked interactions and surface improvement insights.
 * Returns actionable suggestions based on performance patterns.
 *
 * @returns {string[]}
 */
export function getImprovementInsights() {
  if (_interactions.length < 10) return [];

  const insights = [];
  const now = Date.now();
  const recent = _interactions.filter(i => now - i.timestamp < 24 * 60 * 60 * 1000);

  // ── Reflection failure rate ──────────────────────────────────────────
  if (recent.length >= 5) {
    const failures = recent.filter(i => i.reflectionAction !== 'send');
    const failRate = failures.length / recent.length;
    if (failRate > 0.3) {
      insights.push(
        `Reflection triggers on ${Math.round(failRate * 100)}% of queries — ` +
        `consider expanding knowledge base for frequently failing topics.`
      );
    }
  }

  // ── Per-topic confidence analysis ────────────────────────────────────
  const byTopic = {};
  for (const i of recent) {
    if (!byTopic[i.topic]) byTopic[i.topic] = [];
    byTopic[i.topic].push(i);
  }
  for (const [topic, interactions] of Object.entries(byTopic)) {
    if (interactions.length < 5) continue;
    const avgConfidence = interactions.reduce((sum, i) => sum + i.confidence, 0) / interactions.length;
    if (avgConfidence < 0.5) {
      insights.push(
        `Topic "${topic}" averages ${Math.round(avgConfidence * 100)}% confidence — ` +
        `keyword list or knowledge base may need expansion.`
      );
    }
  }

  // ── Tool failure rate ────────────────────────────────────────────────
  const totalFailed = recent.reduce((sum, i) => sum + (i.toolsFailed ?? 0), 0);
  if (totalFailed > 0) {
    const failPct = Math.round((totalFailed / recent.length) * 100);
    if (failPct > 20) {
      insights.push(
        `${failPct}% tool failure rate — check API keys and network connectivity.`
      );
    }
  }

  // ── Latency spikes ───────────────────────────────────────────────────
  const slowOnes = recent.filter(i => i.latencyMs > 5000);
  if (slowOnes.length > recent.length * 0.2) {
    insights.push(
      `${slowOnes.length}/${recent.length} requests exceed 5s — ` +
      `consider caching or reducing tool chain depth.`
    );
  }

  return insights;
}

// ──────────────────────────────────────────────────────────────────────────────
// Agent Introspection — explain reasoning
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate a human-readable explanation of how the agent arrived at its answer.
 * Useful when a user asks "why did you answer that way?" or for debugging.
 *
 * @param {string} query           — original user query
 * @param {string} topic           — classification topic
 * @param {string[]} toolPlan      — list of tools in the plan
 * @param {string[]} toolsUsed     — tools that actually executed
 * @param {object|null} reflection — ReflectionEngine result
 * @param {number} confidence      — classification confidence
 * @returns {string}
 */
export function explainReasoning(query, topic, toolPlan = [], toolsUsed = [], reflection = null, confidence = 0) {
  const parts = [];

  // Classification
  parts.push(`I classified your question as **${topic}** (${Math.round(confidence * 100)}% confidence).`);

  // Plan
  if (toolPlan.length > 0) {
    const planDesc = toolPlan.map(t => {
      switch (t) {
        case 'search_knowledge': return 'searched my Umamusume knowledge base';
        case 'search_repository': return 'searched the Umakraft codebase';
        case 'search_web': return 'searched the web';
        case 'search_conversation_memory': return 'checked our conversation history';
        case 'search_semantic_memory': return 'searched my long-term memory';
        case 'ai_generate': return 'generated a response with AI';
        case 'generate_message': return 'used the message generator';
        default: return `ran the ${t} tool`;
      }
    });
    parts.push(`My plan was to: ${planDesc.join(' → ')}.`);
  }

  // Execution
  if (toolsUsed.length > 0) {
    const executed = toolsUsed.filter(t => toolPlan.includes(t));
    const failed = toolPlan.filter(t => !executed.includes(t));
    if (executed.length > 0) {
      parts.push(`Successfully executed: ${executed.join(', ')}.`);
    }
    if (failed.length > 0) {
      parts.push(`Skipped (unavailable or failed): ${failed.join(', ')}.`);
    }
  }

  // Reflection
  if (reflection) {
    if (reflection.action === 're-search') {
      parts.push(`My initial answer wasn't good enough (${reflection.reasons.join('; ')}), so I searched again before responding.`);
    } else if (reflection.action === 're-phrase') {
      parts.push(`I re-generated my answer because it needed improvement (${reflection.reasons.join('; ')}).`);
    } else if (reflection.passed) {
      parts.push('My answer passed all quality checks.');
    }
  }

  return parts.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Curiosity stats
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{ total: number, byTopic: object }}
 */
export function curiosityStats() {
  const byTopic = {};
  for (const i of _interactions) {
    byTopic[i.topic] = (byTopic[i.topic] ?? 0) + 1;
  }
  return { total: _interactions.length, byTopic };
}

// ──────────────────────────────────────────────────────────────────────────────
// Agent "growing beyond" check — should we proactively learn something new?
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if the agent should proactively suggest learning about a topic
 * that keeps coming up with low confidence. Returns a topic suggestion
 * or null.
 *
 * @returns {{ topic: string, reason: string }|null}
 */
export function shouldLearn() {
  if (_interactions.length < 20) return null;

  const recent = _interactions.slice(-50);
  const byTopic = {};
  for (const i of recent) {
    if (!byTopic[i.topic]) byTopic[i.topic] = { count: 0, lowConf: 0 };
    byTopic[i.topic].count++;
    if (i.confidence < 0.5) byTopic[i.topic].lowConf++;
  }

  for (const [topic, stats] of Object.entries(byTopic)) {
    if (stats.count >= 5 && stats.lowConf / stats.count > 0.4) {
      return {
        topic,
        reason: `${Math.round((stats.lowConf / stats.count) * 100)}% of "${topic}" queries have low confidence. Consider adding more training data.`,
      };
    }
  }

  return null;
}

log.info('[GrowthEngine] Initialized — curiosity + self-improvement + introspection');
