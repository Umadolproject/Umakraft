// AI/MessageSystem.js
// Community message routing layer — manages the message type registry and
// delegates generation to ContentGenerator.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/MESSAGE_SYSTEM.md
//
// Public API:
//   generate(type, variables) → { message, attempts, usedFallback }
//   listTypes()               → string[]
//   formatForDiscord(text)    → string (already markdown-safe, validated)

import log from '../core/log.js';
import { generate as contentGenerate, VALID_TYPES } from './ContentGenerator.js';

// ---------------------------------------------------------------------------
// Message type registry (authoritative list)
// ---------------------------------------------------------------------------

const TYPE_DESCRIPTIONS = {
  greeting:      'Daily or session opening greeting for the circle',
  milestone:     'Trainer fan milestone announcement (requires trainerName, milestoneValue)',
  achievement:   'Achievement unlock announcement (requires trainerName, achievementName)',
  leaderboard:   'Weekly or monthly leaderboard summary (requires topTrainers array)',
  warning:       'Fan deficit warning message (requires trainerName, deficitAmount)',
  reminder:      'Upcoming event or deadline reminder (requires eventName, eventDate)',
  documentation: 'Documentation explanation message (requires topic)',
};

// ---------------------------------------------------------------------------
// Discord formatting
// ---------------------------------------------------------------------------

/**
 * Ensure the generated message is safe to post in a Discord channel.
 * Strips any zero-width or control characters, trims whitespace.
 * The message itself is already Markdown (bold/italic/emoji from the template).
 *
 * @param {string} text
 * @returns {string}
 */
function formatForDiscord(text) {
  // Remove control characters (except newlines and tabs)
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a community message and return it formatted for Discord.
 *
 * @param {'greeting'|'milestone'|'achievement'|'leaderboard'|'warning'|'reminder'|'documentation'} type
 * @param {Record<string, any>} [variables]
 * @returns {Promise<{ message: string, attempts: number, usedFallback: boolean }>}
 */
export async function generate(type, variables = {}) {
  if (!VALID_TYPES.includes(type)) {
    const list = VALID_TYPES.join(', ');
    const errorMsg =
      `Unknown message type \`${type}\`. ` +
      `Valid types: ${VALID_TYPES.map(t => `\`${t}\``).join(', ')}.`;
    log.warn(`[AI/MessageSystem] Invalid type requested: "${type}"`);
    // Return a user-facing error — do not throw so the Discord handler can send it
    return { message: errorMsg, attempts: 0, usedFallback: false };
  }

  log.info(`[AI/MessageSystem] Generating "${type}" message.`);
  const result = await contentGenerate(type, variables);
  return { ...result, message: formatForDiscord(result.message) };
}

/**
 * List all registered message types with descriptions.
 * @returns {Array<{ type: string, description: string }>}
 */
export function listTypes() {
  return VALID_TYPES.map(type => ({
    type,
    description: TYPE_DESCRIPTIONS[type] ?? '',
  }));
}

/**
 * Export the Discord formatter for use by callers that have a pre-generated message.
 */
export { formatForDiscord };
