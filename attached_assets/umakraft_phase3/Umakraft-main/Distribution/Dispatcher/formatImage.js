// Distribution/Dispatcher/formatImage.js
// Converts a PNG buffer from the Workshop/Terminal into a Discord AttachmentBuilder.
// Does not modify the image content — only wraps it for Discord delivery.

import { AttachmentBuilder } from 'discord.js';

/**
 * formatImage(envelope)
 *
 * @param {object} envelope
 * @param {Buffer} envelope.png          — raw PNG buffer from Terminal
 * @param {string} envelope.blueprintKey — used to name the attachment
 * @param {object} [envelope.meta]       — optional trainer metadata
 * @returns {{ attachment: AttachmentBuilder, embed: null }}
 */
export function formatImage(envelope) {
  const { png, blueprintKey, meta } = envelope;

  // Filename shown in Discord (e.g. fan_gain_SmartFalcon.png)
  const trainerSlug = meta?.trainerName
    ? `_${meta.trainerName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`
    : '';
  const filename = `${blueprintKey}${trainerSlug}.png`;

  const attachment = new AttachmentBuilder(png, { name: filename });

  return { attachment, embed: null };
}
