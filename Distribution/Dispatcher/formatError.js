// Distribution/Dispatcher/formatError.js
// Translates a Coordinator error envelope into a user-facing Discord message.
// Raw pipeline error codes are never shown to the user.

// Mapping of pipeline error codes to user-facing messages.
const ERROR_MESSAGES = {
  // Member resolution
  MEMBER_NOT_LINKED:
    'This member has not been linked to an Uma.moe account. Use `/link` to set one up.',
  TRAINER_NOT_FOUND:
    'Trainer not found. Check the spelling or use autocomplete.',
  MEMBER_NOT_FOUND:
    'This Discord member does not appear to be in the server.',

  // Umamoe / data pipeline
  MINER_HTTP_ERROR:
    'Could not retrieve data from Uma.moe right now. Please try again shortly.',
  MINER_RATE_LIMITED:
    'Uma.moe is being rate-limited right now. Please try again shortly.',
  INSPECTOR_REJECTION:
    'The data returned from Uma.moe was not valid. Please try again shortly or contact an admin.',
  DEPOT_NOT_FOUND:
    'No data is available for this member yet. Try again after the next sync.',
  PIPELINE_STAGE_ERROR:
    'Could not retrieve data right now. Please try again shortly.',

  // Workshop
  FABRICATOR_RENDER_ERROR:
    'The image could not be generated. Please try again shortly.',
  VALIDATOR_REJECTION:
    'The image could not be validated after rendering. Please try again shortly.',
  TERMINAL_ALREADY_CLAIMED:
    'The result was already picked up. Please run the command again.',
  TERMINAL_NOT_FOUND:
    'The staged result could not be found. Please run the command again.',

  // Admin / config
  NO_CIRCLES_CONFIGURED:
    'No circles are configured for this server.',
  PERMISSION_DENIED:
    'You do not have permission to use this command.',

  // Fallback
  UNEXPECTED_ERROR:
    'Something went wrong. Please try again shortly.',
};

/**
 * formatError(envelope)
 *
 * @param {object} envelope
 * @param {string} envelope.error     — pipeline error code
 * @param {string} envelope.failedAt  — stage that failed
 * @param {boolean} envelope.retriable
 * @returns {{ content: string }}
 */
export function formatError(envelope) {
  const message = ERROR_MESSAGES[envelope.error] ?? ERROR_MESSAGES.UNEXPECTED_ERROR;

  // In development, append the raw error code for diagnostics.
  const suffix = process.env.NODE_ENV === 'development'
    ? `\n\`\`\`\nError: ${envelope.error} at ${envelope.failedAt}\n\`\`\``
    : '';

  return { content: message + suffix };
}
