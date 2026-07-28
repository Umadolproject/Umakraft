// AI/Communication/adapters/DiscordAdapter.js
// Discord Adapter — thin layer that translates DiscordOutput into
// actual discord.js API calls.
//
// The Renderer decides what the Discord response should look like.
// The Adapter is responsible only for calling the Discord API:
//   reply(), editReply(), followUp(), send()
//
// This separation means:
//   • You can unit-test rendering without connecting to Discord
//   • Discord API changes are isolated to one layer
//   • Future platforms (Slack, Telegram, CLI) only need new adapters
//   • Communication, Composition, and Rendering remain platform-independent
//
// Authority: Part 7 — Rendering System
// Spec:      DISCORD_RENDERER.md (Discord Adapter recommendation)

import log from '../../../core/log.js';

// ──────────────────────────────────────────────────────────────────────────────
// DiscordOutput shape
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} DiscordOutput
 * @property {string[]} messages      — text messages (≤2000 chars each)
 * @property {object[]} embeds        — Discord embed objects
 * @property {object[]} attachments   — { name, content, type }
 * @property {object[]} components    — buttons, select menus
 * @property {object}   metadata      — { topic, pattern, sourceCount }
 */

// ──────────────────────────────────────────────────────────────────────────────
// Send options
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SendOptions
 * @property {boolean} [ephemeral=false]  — only visible to the user
 * @property {boolean} [splitMessages=true] — send multiple messages if >2000 chars
 * @property {number}  [maxMessages=3]    — cap split messages
 * @property {boolean} [useEmbeds=false]  — send embeds when available
 */

// ──────────────────────────────────────────────────────────────────────────────
// DiscordAdapter
// ──────────────────────────────────────────────────────────────────────────────

export class DiscordAdapter {
  /**
   * @param {object} client — a discord.js Client or interaction object
   */
  constructor(client) {
    this.client = client;
  }

  // ── reply — respond to an interaction ──────────────────────────────────

  /**
   * Reply to a Discord interaction with Communication output.
   *
   * @param {object} interaction  — discord.js CommandInteraction
   * @param {DiscordOutput} output
   * @param {SendOptions} [opts]
   * @returns {Promise<object>} sent message(s)
   */
  async reply(interaction, output, opts = {}) {
    const { ephemeral = false, splitMessages = true, useEmbeds = false } = opts;
    const messages = output?.messages ?? [];
    const embeds   = output?.embeds   ?? [];
    const attachments = output?.attachments ?? [];

    if (messages.length === 0 && embeds.length === 0) {
      return interaction.reply({ content: '(empty response)', ephemeral });
    }

    // Send first message with initial reply
    const firstContent = messages[0] ?? '';
    const replyPayload = this._buildPayload(firstContent, embeds, attachments, ephemeral);

    if (messages.length <= 1 || !splitMessages) {
      return interaction.reply(replyPayload);
    }

    // Multi-message: reply with first chunk, followUp with rest
    await interaction.reply(replyPayload);

    for (let i = 1; i < Math.min(messages.length, (opts.maxMessages ?? 3)); i++) {
      await interaction.followUp({ content: messages[i], ephemeral });
    }

    log.info(
      `[DiscordAdapter] Sent reply: ${messages.length} message(s), ` +
      `${embeds.length} embed(s), ${attachments.length} attachment(s)`
    );

    return { messages, embeds };
  }

  // ── send — send to a channel (no interaction) ──────────────────────────

  /**
   * Send to a Discord channel.
   *
   * @param {object} channel — discord.js TextChannel
   * @param {DiscordOutput} output
   * @param {SendOptions} [opts]
   * @returns {Promise<object[]>} sent messages
   */
  async send(channel, output, opts = {}) {
    const messages = output?.messages ?? [];
    const embeds   = output?.embeds   ?? [];
    const attachments = output?.attachments ?? [];
    const sent = [];

    for (let i = 0; i < Math.min(messages.length, (opts.maxMessages ?? 3)); i++) {
      const payload = this._buildPayload(
        messages[i],
        i === 0 ? embeds : [],
        i === messages.length - 1 ? attachments : [],
        false
      );
      const msg = await channel.send(payload);
      sent.push(msg);
    }

    log.info(`[DiscordAdapter] Sent to channel: ${sent.length} message(s)`);
    return sent;
  }

  // ── editReply — update an existing interaction reply ────────────────────

  /**
   * Edit an existing interaction reply.
   *
   * @param {object} interaction — discord.js CommandInteraction
   * @param {DiscordOutput} output
   * @param {SendOptions} [opts]
   */
  async editReply(interaction, output, opts = {}) {
    const content  = output?.messages?.[0] ?? '';
    const embeds   = output?.embeds ?? [];
    const payload  = this._buildPayload(content, embeds, [], opts.ephemeral ?? false);

    await interaction.editReply(payload);

    log.info(`[DiscordAdapter] Edited reply: ${content.length} chars, ${embeds.length} embed(s)`);
  }

  // ── followUp — send a follow-up to an interaction ──────────────────────

  /**
   * Send a follow-up message to an existing interaction.
   *
   * @param {object} interaction — discord.js CommandInteraction
   * @param {DiscordOutput} output
   * @param {SendOptions} [opts]
   */
  async followUp(interaction, output, opts = {}) {
    const messages = output?.messages ?? [];
    const embeds   = output?.embeds ?? [];

    for (let i = 0; i < Math.min(messages.length, (opts.maxMessages ?? 3)); i++) {
      const payload = this._buildPayload(
        messages[i],
        i === 0 ? embeds : [],
        [],
        opts.ephemeral ?? false
      );
      await interaction.followUp(payload);
    }

    log.info(`[DiscordAdapter] Sent followUp: ${messages.length} message(s)`);
  }

  // ── defer — acknowledge an interaction while processing ────────────────

  /**
   * Defer an interaction reply (buy time for slow processing).
   *
   * @param {object} interaction — discord.js CommandInteraction
   * @param {boolean} [ephemeral=false]
   */
  async defer(interaction, ephemeral = false) {
    await interaction.deferReply({ ephemeral });
  }

  // ──────────────────────────────────────────────────────────────────────
  // Internal
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Build a discord.js-compatible message payload.
   */
  _buildPayload(content, embeds = [], attachments = [], ephemeral = false) {
    const payload = {};

    if (content) payload.content = content;
    if (embeds.length > 0) payload.embeds = embeds.slice(0, 10); // Discord max 10

    // Convert internal attachment format to discord.js AttachmentBuilder
    if (attachments.length > 0) {
      payload.files = attachments.map(a => ({
        name: a.name ?? 'response.md',
        attachment: Buffer.from(a.content ?? '', 'utf-8'),
      }));
    }

    // Components (buttons, selects) — future
    // if (output.components?.length > 0) payload.components = output.components;

    if (ephemeral) payload.ephemeral = true;

    return payload;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Singleton factory (for use in the existing gateway)
// ──────────────────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Get or create the DiscordAdapter singleton.
 * @param {object} [client] — discord.js client
 * @returns {DiscordAdapter}
 */
export function getAdapter(client = null) {
  if (!_instance && client) {
    _instance = new DiscordAdapter(client);
  }
  return _instance;
}

/**
 * Reset the adapter (for testing).
 */
export function resetAdapter() {
  _instance = null;
}

log.info('[DiscordAdapter] Initialized — Discord API bridge ready');
