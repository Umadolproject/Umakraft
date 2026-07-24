// Distribution/Dispatcher/index.js
// Receives a finished deliverable or error envelope from the Coordinator
// and sends the appropriate response to Discord.
//
// Dispatcher owns delivery and nothing else.
// It does not modify content — only wraps it for Discord.

import { formatImage }  from './formatImage.js';
import { formatEmbed }  from './formatEmbed.js';
import { formatError }  from './formatError.js';
import { send }         from './send.js';

/**
 * dispatch(envelope) — main entry point.
 *
 * envelope is one of:
 *   { success: true,  png, blueprintKey, meta, interaction, ... }   — image deliverable
 *   { success: true,  type: 'embed', result, interaction }          — embed deliverable
 *   { success: false, failedAt, error, message, retriable, interaction } — error
 */
export async function dispatch(envelope) {
  const { interaction, success } = envelope;

  if (!success) {
    const payload = formatError(envelope);
    return send(interaction, payload, { ephemeral: true });
  }

  // Image deliverable
  if (envelope.png) {
    const { attachment, embed } = formatImage(envelope);
    const ephemeral = envelope.ephemeral ?? false;
    return send(interaction, { files: [attachment], embeds: embed ? [embed] : [] }, { ephemeral });
  }

  // Embed / result deliverable (utility commands)
  if (envelope.type === 'embed' || envelope.result) {
    const embedPayload = formatEmbed(envelope);
    const ephemeral = envelope.ephemeral ?? true;
    return send(interaction, { embeds: [embedPayload] }, { ephemeral });
  }

  // Text-only deliverable
  if (envelope.content != null) {
    const ephemeral = envelope.ephemeral ?? true;
    const content   = envelope.content.trim() || '*(No response was generated. Please try again.)*';
    return send(interaction, { content }, { ephemeral });
  }

  console.warn('[Dispatcher] Unrecognised envelope shape — no delivery performed', envelope);
}
