// AI/IntentRouter.js
// LLM-based intent classifier for @mention natural language command routing.
//
// Architecture: instead of keyword matching, the user's message is sent to the
// LLM as a classification task. The LLM returns the best matching command name
// and a confidence score. Only high-confidence matches (>= 0.80) are routed to
// the coordinator; everything else falls through to the AI chat pipeline.
//
// Admin commands (ai, adminSync, adminSyncCards, warningSettings, etc.) are
// intentionally excluded from the registry — they are never reachable via @mention.

import { generate } from './APIProvider.js';
import log from '../core/log.js';

// Confidence below this threshold falls through to AI chat.
export const INTENT_CONFIDENCE_THRESHOLD = 0.80;

/**
 * Non-admin, member-facing command registry.
 * Each entry declares what the command does — the LLM uses this as its
 * classification context. Adding a new command here is all that is needed to
 * make it routable via @mention.
 */
export const INTENT_REGISTRY = [
  {
    name: 'fan_gain',
    description: 'Show fan gain stats (daily/weekly/monthly) for a trainer',
    examples: [
      'how is my fan gain', 'fan progress', 'how many fans do I have',
      'show my fan gain', 'check fan gain', 'fan statistics',
      'what is my daily gain', 'how many fans did I gain today',
      "how's my fan gain", 'fan gain for [name]', 'check [name] fan gain',
    ],
  },
  {
    name: 'profile',
    description: 'Show full trainer profile with gains, PRs, milestones and history',
    examples: [
      'show my profile', 'my stats', 'my trainer profile',
      'show my trainer stats', 'what are my stats', 'my performance',
      'profile', 'show profile', 'full stats',
    ],
  },
  {
    name: 'leaderboard',
    description: 'Show the fan gain leaderboard for the server',
    examples: [
      'show leaderboard', 'leaderboard', 'who is winning',
      'top trainers', 'fan gain ranking', 'who has the most fans',
      'server rankings', 'show rankings', 'ranking list',
    ],
  },
  {
    name: 'total_fan',
    description: 'Show total lifetime fan count for a trainer',
    examples: [
      'total fans', 'how many total fans', 'lifetime fans',
      'all time fans', 'total fan count', 'my total fans',
    ],
  },
  {
    name: 'total_circle_fan_gain',
    description: 'Show total fan gain across the entire circle',
    examples: [
      'circle fan gain', 'total circle fans', 'circle progress',
      'how is the circle doing', 'circle total', 'circle gain total',
    ],
  },
  {
    name: 'circle_master',
    description: 'Show the circle master information',
    examples: [
      'who is circle master', 'circle master', 'who leads the circle',
      'show circle master', 'circle leader',
    ],
  },
  {
    name: 'inter_circle_leaderboard',
    description: 'Show leaderboard comparing multiple circles against each other',
    examples: [
      'inter circle leaderboard', 'circle rankings', 'compare circles',
      'how does our circle compare', 'circle competition',
    ],
  },
  {
    name: 'club_gain',
    description: 'Show club fan gain',
    examples: [
      'club gain', 'club fan gain', 'how is the club doing', 'club progress',
    ],
  },
  {
    name: 'join_date',
    description: 'Show when a trainer joined',
    examples: [
      'when did I join', 'my join date', 'when did I start',
      'join date', 'when did [name] join',
    ],
  },
  {
    name: 'member_list',
    description: 'Show the list of circle members',
    examples: [
      'member list', 'list members', 'who is in the circle',
      'circle members', 'show members', 'all members',
    ],
  },
  {
    name: 'search_trainer',
    description: 'Search for a trainer by name in the database',
    examples: [
      'search trainer [name]', 'find trainer [name]',
      'look up trainer [name]', 'find [name] in the database',
    ],
  },
  {
    name: 'search',
    description: 'Search for game information using AI and web search',
    examples: [
      'search for [topic]', 'look up [topic]', 'find info about [topic]',
      'search [topic]', 'web search [topic]',
    ],
  },
  {
    name: 'status',
    description: 'Show bot and data pipeline status',
    examples: [
      'status', 'bot status', 'is the bot working',
      'system status', 'pipeline status', 'are you ok',
    ],
  },
  {
    name: 'circle_status',
    description: 'Show circle status and membership information',
    examples: [
      'circle status', 'how is the circle', 'circle info', 'show circle status',
    ],
  },
  {
    name: 'help',
    description: 'Show available commands and how to use the bot',
    examples: [
      'help', 'what can you do', 'list commands',
      'how do I use you', 'commands', 'show commands', 'what commands',
    ],
  },
  {
    name: 'link',
    description: 'Link your Discord account to your game trainer account',
    examples: [
      'link my account', 'connect my trainer', 'link [id]',
      'how do I link', 'register my account',
    ],
  },
  {
    name: 'unlink',
    description: 'Unlink your Discord account from your trainer account',
    examples: [
      'unlink', 'disconnect my account', 'remove my link', 'unregister',
    ],
  },
  {
    name: 'link_list',
    description: 'Show which Discord users are linked to trainer accounts',
    examples: [
      'show linked accounts', 'who is linked', 'link list', 'linked users',
    ],
  },
  {
    name: 'set_timezone',
    description: 'Set your timezone for data display',
    examples: [
      'set timezone to [tz]', 'change my timezone', 'set my timezone to [tz]',
    ],
  },
];

// Build the command list string once at module load time.
const COMMAND_LIST_TEXT = INTENT_REGISTRY
  .map(i => `- ${i.name}: ${i.description}`)
  .join('\n');

/**
 * Classify a user message into a command intent using the LLM.
 *
 * @param {string} query  Cleaned message text (bot mention already stripped).
 * @returns {Promise<{
 *   intent:     string,          // command name or 'CHAT'
 *   confidence: number,          // 0.0 – 1.0
 *   args: {
 *     trainer?: string | null,   // trainer/player name extracted from message
 *     circle?:  string | null,   // circle name extracted from message
 *     query?:   string | null,   // search query extracted from message
 *   }
 * }>}
 */
export async function classify(query) {
  const prompt =
`You are an intent classifier for a Discord bot called UmaKraft (an Umamusume Pretty Derby fan-gain tracker).

Available commands:
${COMMAND_LIST_TEXT}
- CHAT: general question or conversation — not a specific command

User message: "${query.replace(/"/g, '\\"')}"

Reply with ONLY this JSON (no markdown, no extra text):
{"intent":"<command_name or CHAT>","confidence":<0.0-1.0>,"trainer":<name string or null>,"circle":<name string or null>,"query":<search string or null>}

Classification rules:
- intent must be exactly one of the command names listed above, or CHAT
- confidence: 0.9+ = very clear match; 0.75-0.9 = likely; below 0.75 = unsure (use CHAT)
- trainer: if the user is asking about a specific person by name, put that name here; if asking about themselves, null
- circle: if a circle name is mentioned, extract it; otherwise null
- query: for search or search_trainer, the thing to search for; otherwise null`;

  try {
    const { text } = await generate(prompt, { maxTokens: 100, temperature: 0.1 });
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      log.warn(`[IntentRouter] Non-JSON LLM response: ${text.slice(0, 100)}`);
      return { intent: 'CHAT', confidence: 0, args: {} };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const intent     = String(parsed.intent ?? 'CHAT');
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const args = {
      trainer: parsed.trainer ?? null,
      circle:  parsed.circle  ?? null,
      query:   parsed.query   ?? null,
    };

    log.info(`[IntentRouter] "${query.slice(0, 60)}" → ${intent} (${(confidence * 100).toFixed(0)}%)`);
    return { intent, confidence, args };

  } catch (err) {
    log.warn(`[IntentRouter] classify error: ${err.message}`);
    return { intent: 'CHAT', confidence: 0, args: {} };
  }
}
