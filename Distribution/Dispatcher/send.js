// Distribution/Dispatcher/send.js
// Sends a Discord response via the interaction object.
// Handles deferred replies, follow-ups, and one retry on rate-limit.

/**
 * send(interaction, payload, options)
 *
 * @param {object} interaction          — Discord.js Interaction
 * @param {object} payload              — { content?, embeds?, files? }
 * @param {object} options
 * @param {boolean} options.ephemeral   — whether the reply is ephemeral
 * @param {boolean} [options.followUp]  — force followUp instead of editReply
 */
export async function send(interaction, payload, { ephemeral = false, followUp = false } = {}) {
  const replyPayload = { ...payload, ephemeral };

  // If the interaction was deferred, use editReply.
  // Otherwise use reply (only valid if not already replied).
  const method = followUp
    ? 'followUp'
    : interaction.deferred || interaction.replied
      ? 'editReply'
      : 'reply';

  try {
    return await interaction[method](replyPayload);
  } catch (err) {
    if (err.code === 429) {
      // Rate-limited — wait the retry_after duration and try once more.
      const retryAfter = (err.retryAfter ?? 1) * 1000;
      console.warn(`[Dispatcher/send] Rate limited — retrying after ${retryAfter}ms`);
      await new Promise(r => setTimeout(r, retryAfter));
      return interaction[method](replyPayload);
    }

    if (err.code === 10062) {
      // Unknown interaction — the 3-second window has expired.
      console.warn('[Dispatcher/send] Interaction expired (10062) — cannot reply');
      return;
    }

    // Log and rethrow all other Discord API errors.
    console.error(`[Dispatcher/send] Discord API error (code ${err.code}):`, err.message);
    throw err;
  }
}
