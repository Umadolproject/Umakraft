// AI/PromptSystem.js
// Assembles the final prompt sent to the AI provider.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/PROMPT_SYSTEM.md
//
// Public API:
//   assemble(mode, context, question, variables) — build and return the full prompt string

import log from '../core/log.js';
import { buildSafePrompt } from './Security.js';

// ---------------------------------------------------------------------------
// Token budget (chars ÷ 4 ≈ tokens; conservative estimate)
// ---------------------------------------------------------------------------

const MAX_PROMPT_CHARS = 32_000; // ~8k tokens — safe for all providers (8K–128K windows)

// ---------------------------------------------------------------------------
// Inline prompt templates by mode
// ---------------------------------------------------------------------------
// Each template uses {{context}} and {{question}} placeholders plus optional
// mode-specific variables (e.g. {{messagePrompt}}).
// Security.buildSafePrompt() prepends the system constraint block.

const TEMPLATES = {
  repository: `You are answering a question about the Umakraft repository.
Use ONLY the provided context to answer. Do not speculate or invent information not present in the context.
Cite your source files at the end of your answer using: "Source: <filePath>"

Context:
{{context}}

Question: {{question}}

Answer concisely and accurately. Cite at least one source.`,

  knowledge: `You are answering a question about Uma Musume: Pretty Derby game mechanics, terminology, or concepts.
Use the provided context as your primary source — it includes both the curated knowledge base and web search results.
If the context still doesn't cover the question, supplement with your training knowledge and label it as such.
Answer warmly and conversationally, like you're chatting with a fellow trainer.

Knowledge Context:
{{context}}

Question: {{question}}

Answer clearly and accurately. Define any technical terms you use.`,

  message: `{{messagePrompt}}`,

  search: `You are searching the Umakraft repository for content relevant to the query below.
Summarise the most relevant findings from the provided context, citing file paths.
If no relevant content is found, say so clearly.

Context:
{{context}}

Search query: {{question}}

List the most relevant files and summarise what each contains about the query.`,

  web: `You are the Umakraft Discord bot assistant, responding to a question.
Use the web search results below as your primary source. Answer helpfully, warmly, and concisely.
Keep answers natural and conversational — this is a Discord chat, not a technical report.
If the search results don't cover the question, supplement with general knowledge.

Here are examples of good answers:

Example 1:
Q: what is the capital of france
A: Paris! 🇫🇷 The capital and largest city of France, home to the Eiffel Tower, the Louvre, and amazing pastries~ 💕

Example 2:
Q: how fast is a cheetah
A: Cheetahs can sprint up to 70 mph (113 km/h) — they're the fastest land animals! 🐆

Example 3:
Q: what is machine learning
A: Machine learning is AI that learns patterns from data instead of being explicitly programmed 🧠 It powers recommendations, voice assistants, and even me~!

Now answer this question in the same warm, concise style:

Web Search Results:
{{context}}

Question: {{question}}`,

  explain: `You are explaining a concept from the Umakraft repository or Uma Musume game.
Use the provided context to give a clear, structured explanation.
If the concept spans both the repository and the game, address both.

Context:
{{context}}

Topic to explain: {{question}}

Structure your explanation with: Definition -> How it works -> Examples (if relevant) -> Related concepts.`,

  docs: `You are documenting a file or component from the Umakraft repository.
Use the provided context to produce a clear technical summary.

Context:
{{context}}

File or component: {{question}}

Include: Purpose, public API / key functions, inputs/outputs, and any governance notes.`,

  glossary: `You are looking up an Umamusume or Umakraft term in the knowledge base.
Use the provided knowledge context for the definition.
If the term is not found, say so explicitly — do not guess.

Knowledge Context:
{{context}}

Term: {{question}}

Provide: Definition, category, related terms, and source.`,

  assistant: `You are the Umakraft Discord bot assistant. A user needs help using the bot.

CRITICAL RULES:
- If the user is asking about linking, fan gain, profile, or anything that requires linking: FIRST check if they are linked. If they are NOT linked, explain they need an admin to /link them. NEVER claim the user can link themselves.
- If the user says "link me", "please link", or tags an admin for linking: acknowledge the request warmly but explain only admins can run /link.
- If the user asks about their own stats (fans, profile, rank) and they are not linked: tell them to ask an admin to link them first.
- Always be helpful, encouraging, and concise. Never scold.
- If you do not know something specific about the user (like their trainer ID), say so — do not make it up.

Knowledge Context (bot commands and linking info):
{{context}}

User question: {{question}}

Respond helpfully, tagging any mentioned users as needed. Keep it under 200 words.`,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble the full prompt for a given mode.
 *
 * @param {'repository'|'knowledge'|'message'|'search'|'explain'|'docs'|'glossary'|'assistant'} mode
 * @param {string} context  — assembled context block from ContextBuilder.build()
 * @param {string} question — original user question (not used for message mode)
 * @param {Record<string, string>} [variables] — additional template variables
 * @returns {string} fully assembled, safe prompt
 */
export function assemble(mode, context, question, variables = {}) {
  const template = TEMPLATES[mode];
  if (!template) {
    log.warn(`[AI/PromptSystem] Unknown prompt mode "${mode}" — falling back to repository mode.`);
    return assemble('repository', context, question, variables);
  }

  // Step 1: Inject context into the template
  let withVars = template.replace(/\{\{context\}\}/g, context || '(no context available)');

  // Step 2: Inject any extra variables (e.g. messagePrompt)
  for (const [key, value] of Object.entries(variables)) {
    withVars = withVars.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
      String(value ?? '')
    );
  }

  // Step 3: Assemble via buildSafePrompt
  //   - message mode: no user question — the entire prompt IS the instruction
  //   - all other modes: sanitize and inject the user question
  let prompt;
  if (mode === 'message') {
    // Message mode does NOT use the read-only assistant system constraint.
    // ContentGenerator builds the full persona prompt internally — the constraint
    // block's "read-only knowledge service" identity would contradict the persona.
    prompt = withVars;
  } else {
    prompt = buildSafePrompt(withVars, question || '', {});
  }

  // Step 4: Token budget guard with actual truncation
  if (prompt.length > MAX_PROMPT_CHARS) {
    const truncated = prompt.slice(0, MAX_PROMPT_CHARS);
    log.warn(
      `[AI/PromptSystem] Prompt (${prompt.length} chars) exceeds budget ` +
      `(${MAX_PROMPT_CHARS} chars) — TRUNCATED. ` +
      `Estimated tokens: ${Math.ceil(truncated.length / 4)}`
    );
    prompt = truncated;
  }

  log.info(
    `[AI/PromptSystem] Assembled mode="${mode}" prompt — ` +
    `${Math.ceil(prompt.length / 4)} estimated tokens`
  );

  return prompt;
}

/**
 * List all registered prompt modes.
 * @returns {string[]}
 */
export function listModes() {
  return Object.keys(TEMPLATES);
}
