// Distribution/Dispatcher/send.js
// Sends a Discord response via the interaction object.
// Handles deferred replies, follow-ups, and one retry on rate-limit.

import log from '../../core/log.js';

export async function send(interaction, payload, { ephemeral = false, followUp = false } = {}) {
  const method = followUp
    ? 'followUp'
    : interaction.deferred || interaction.replied
      ? 'editReply'
      : 'reply';

  const replyPayload = method === 'editReply'
    ? { ...payload }
    : { ...payload, ephemeral };

  const startedAt = Date.now();

  try {
    const result = await interaction[method](replyPayload);
    log.info(`[Dispatcher/send] method=${method} success duration_ms=${Date.now() - startedAt}`);
    return result;
  } catch (err) {
    if (err.code === 429) {
      const retryAfter = (err.retryAfter ?? 1) * 1000;
      log.warn(`[Dispatcher/send] Rate limited — retrying method=${method} after ${retryAfter}ms`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return interaction[method](replyPayload);
    }

    if (err.code === 10062) {
      log.warn('[Dispatcher/send] Interaction expired (10062) — cannot reply');
      return;
    }

    if (err.code === 40060) {
      // Interaction was already acknowledged — this can happen if a handler
      // bypasses the proxy or if Discord.js fires a duplicate ack. Swallow
      // it silently so the user still sees the first reply.
      log.warn('[Dispatcher/send] Interaction already acknowledged (40060) — ignoring duplicate');
      return;
    }

    log.error(`[Dispatcher/send] Discord API error method=${method} code=${err.code ?? 'unknown'} message=${err.message}`);
    throw err;
  }
}
