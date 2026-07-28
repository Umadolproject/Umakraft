// AI/Communication/integration/CommunicationManager.js
// Communication Manager — orchestrates the full Communication pipeline.
// Pipeline: Message → Plan → Retrieve → Filter → Compose → Translate → Generate → Render → Output
// Authority: Part 8 — Integration & Migration

import { build } from '../composition/ResponseBuilder.js';
import { renderForDiscord } from '../rendering/DiscordRenderer.js';
import { selectPattern } from '../composition/MessageBlueprint.js';

/**
 * Process a message through the full Communication pipeline.
 * Stages: plan → retrieve → filter → compose → translate → generate → render
 */
export async function process(input, deps = {}) {
  const stages = [];
  try {
    stages.push('plan');
    let facts = [];
    if (deps.retrieveFacts) {
      facts = await deps.retrieveFacts(input.query, input.topic);
    }
    stages.push('retrieve', 'filter');

    const responseObj = build(facts, {
      query: input.query, topic: input.topic, complexity: input.complexity,
      tone: 'friendly', audience: 'discord',
    });
    stages.push('compose');

    let content;
    if (deps.generateText) {
      content = await deps.generateText(responseObj);
    } else {
      content = responseObj.summary?.text ?? 'No response generated.';
    }
    stages.push('translate', 'generate');

    const discordOutput = renderForDiscord(responseObj);
    const finalContent = discordOutput.messages.length > 0
      ? discordOutput.messages.join('\n\n')
      : content;
    stages.push('render');

    return {
      success: true, content: finalContent,
      discordOutput, responseObj,
      metadata: {
        topic: input.topic, complexity: input.complexity,
        pattern: selectPattern(input.topic, input.complexity).name,
        stagesCompleted: stages,
      },
    };
  } catch (e) {
    return {
      success: false,
      content: `Communication pipeline error: ${e.message}`,
      discordOutput: { messages: [], embeds: [], attachments: [], components: [], metadata: {} },
      responseObj: null,
      metadata: {
        topic: input.topic, complexity: input.complexity, pattern: null,
        stagesCompleted: stages, error: e.message,
      },
    };
  }
}

/**
 * Phase 1 bridge: wrap existing Agent.orchestrate() output through the
 * Communication pipeline. This adds Composition + Rendering without
 * changing the existing retrieval/generation logic.
 */
export function wrapAgentResponse(agentResponse, input) {
  const facts = (agentResponse.toolsUsed ?? []).map((tool, i) => ({
    id: `agent-fact-${i}`,
    text: `Result from ${tool}`,
    source: mapSource(input.topic),
    provider: tool,
    confidence: input.confidence ?? 0.7,
  }));

  const responseObj = build(facts, {
    query: input.query, topic: input.topic, complexity: input.complexity,
    tone: 'friendly', audience: 'discord',
  });

  // Override summary with the agent's generated content
  responseObj.summary.text = agentResponse.content;
  responseObj.summary.keyPoints = [agentResponse.content.slice(0, 200)];

  const discordOutput = renderForDiscord(responseObj);

  return {
    success: agentResponse.success,
    content: agentResponse.content,
    discordOutput,
    responseObj,
    metadata: {
      topic: input.topic, complexity: input.complexity,
      pattern: selectPattern(input.topic, input.complexity).name,
      stagesCompleted: ['plan', 'retrieve', 'filter', 'compose', 'translate', 'generate', 'render'],
    },
  };
}

/**
 * Convert Agent tool execution results into SourceFact objects
 * that the Composition system can group, section, and summarize.
 *
 * Accepts both shapes:
 *   - Agent form: { tool, result, durationMs } from executePlan()
 *   - Raw form:   { ok, data, error } from ToolRegistry.execute()
 */
export function toolResultsToFacts(toolResults) {
  const facts = [];
  for (const entry of toolResults) {
    // Detect input shape: Agent wraps results as { tool, result, durationMs }
    // Raw ToolRegistry shape is { ok, result }
    const tool = entry.tool;
    const data = entry.result;        // Agent wraps data under .result
    const ok   = entry.ok ?? true;    // Agent form doesn't include ok at top level

    if (!data) continue;
    if (ok === false) continue;

    const provider = toolToProvider(tool);
    const source = data.source ?? tool;

    if (data.chunks) {
      for (const chunk of data.chunks) {
        facts.push({
          fact: chunk.text ?? chunk.content ?? chunk,
          provider, confidence: chunk.score ?? chunk.confidence ?? 0.7,
          source: chunk.source ?? source, category: chunk.category ?? null,
        });
      }
    } else if (data.text) {
      const sentences = data.text.match(/[^.!?]+[.!?]+/g) ?? [data.text];
      for (const s of sentences) {
        const trimmed = s.trim();
        if (trimmed.length > 5) {
          facts.push({ fact: trimmed, provider, confidence: 0.8, source });
        }
      }
    } else if (typeof data === 'string') {
      facts.push({ fact: data, provider, confidence: 0.7, source });
    } else if (data.facts) {
      facts.push(...data.facts.map(f => ({
        fact: f.fact ?? f.text ?? JSON.stringify(f),
        provider: f.provider ?? provider,
        confidence: f.confidence ?? 0.7,
        source: f.source ?? source,
      })));
    }
  }
  return facts;
}

function toolToProvider(tool) {
  switch (tool) {
    case 'search_repository':       return 'repository';
    case 'search_knowledge':        return 'knowledge-base';
    case 'search_web':              return 'web';
    case 'search_conversation_memory':
    case 'search_semantic_memory':  return 'memory';
    case 'ai_generate':             return 'system';
    default:                        return 'unknown';
  }
}

function mapSource(t) {
  switch (t) {
    case 'umamusume': return 'knowledge';
    case 'repository': return 'repository';
    case 'live':       return 'web';
    case 'message':    return 'system';
    default:           return 'web';
  }
}
