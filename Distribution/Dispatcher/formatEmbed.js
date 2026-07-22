// Distribution/Dispatcher/formatEmbed.js
// Converts a structured result object from the Coordinator into a Discord EmbedBuilder.
// Used for utility and admin command responses that do not produce images.

import { EmbedBuilder } from 'discord.js';

// Brand colour used for all UmaKraft embeds (pink-purple)
const BRAND_COLOR = 0xe84393;

/**
 * formatEmbed(envelope)
 *
 * @param {object} envelope
 * @param {object} envelope.result — structured result from Coordinator action
 *   Expected shape:
 *   {
 *     title:       string,
 *     description: string,
 *     fields?:     Array<{ name, value, inline? }>,
 *     footer?:     string,
 *     color?:      number,  // override brand colour
 *   }
 * @returns {EmbedBuilder}
 */
export function formatEmbed(envelope) {
  const result = envelope.result ?? {};
  const embed = new EmbedBuilder()
    .setColor(result.color ?? BRAND_COLOR)
    .setTitle(result.title ?? 'UmaKraft')
    .setDescription(result.description ?? '');

  if (result.fields?.length) {
    embed.addFields(result.fields);
  }

  if (result.footer) {
    embed.setFooter({ text: result.footer });
  }

  if (result.timestamp !== false) {
    embed.setTimestamp();
  }

  return embed;
}
