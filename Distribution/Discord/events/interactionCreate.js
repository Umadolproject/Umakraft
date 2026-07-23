// Distribution/Discord/events/interactionCreate.js
// Fires on every Discord interaction (slash command, button, autocomplete, etc.).
// Routes slash command interactions to the Commands department.

import { dispatch } from '../../Dispatcher/index.js';
import { coordinator } from '../../Coordinator/index.js';

export const name = 'interactionCreate';
export const once = false;
const INTERACTION_RESPONSE_HANDLED = Symbol('interactionResponseHandled');

/**
 * The command handlers predate the centralized acknowledgement below. Some
 * call deferReply() themselves and some call reply() during validation before
 * doing slower work. Once the boundary has acknowledged the interaction,
 * translate those legacy calls into safe no-op/edit operations.
 */
function acknowledgedInteraction(interaction) {
  return new Proxy(interaction, {
    get(target, property, receiver) {
      if (property === '__originalInteraction') {
        return target;
      }

      if (property === 'deferReply') {
        return async () => target;
      }

      if (property === 'reply') {
        return async (payload) => {
          const { ephemeral: _ephemeral, ...editPayload } = payload ?? {};
          await target.editReply(editPayload);
          return { [INTERACTION_RESPONSE_HANDLED]: true };
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export async function execute(interaction, client) {
  // Only handle slash commands here.
  // Buttons and selects are handled by their respective collectors.
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[interactionCreate] Unknown command: ${interaction.commandName}`);
    try {
      await interaction.reply({
        content: 'This command is not available in the current bot build. Please try again shortly.',
        ephemeral: true,
      });
    } catch (err) {
      console.error('[interactionCreate] Could not report unknown command:', err);
    }
    return;
  }

  const startedAt = Date.now();
  console.log(
    `[interactionCreate] Received /${interaction.commandName} ` +
    `(id=${interaction.id}, user=${interaction.user?.id ?? 'unknown'})`
  );

  try {
    // Discord requires an acknowledgement within three seconds. Do this
    // before validation, AI inference, image rendering, or data access.
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: command.ephemeral ?? false });
    }

    const safeInteraction = acknowledgedInteraction(interaction);

    // client is passed as a third arg so handlers can inject it into the
    // coordinator payload without importing Discord/index.js directly.
    const result = await command.execute(safeInteraction, coordinator, client);
    if (result?.[INTERACTION_RESPONSE_HANDLED]) {
      console.log(
        `[interactionCreate] Completed validation response for /${interaction.commandName} ` +
        `in ${Date.now() - startedAt}ms`
      );
      return;
    }

    if (!result || typeof result !== 'object') {
      throw new Error('Command returned no response envelope');
    }

    const dispatchableResult = result?.interaction?.__originalInteraction
      ? { ...result, interaction: result.interaction.__originalInteraction }
      : result;

    // Dispatcher turns the result envelope into a Discord response
    await dispatch(dispatchableResult);
    console.log(
      `[interactionCreate] Completed /${interaction.commandName} ` +
      `in ${Date.now() - startedAt}ms`
    );
  } catch (err) {
    console.error(`[interactionCreate] Unhandled error in /${interaction.commandName}:`, err);

    const errPayload = {
      success:     false,
      failedAt:    'Commands',
      error:       'UNEXPECTED_ERROR',
      message:     err.message,
      retriable:   false,
      interaction,
    };

    try {
      await dispatch(errPayload);
      console.log(
        `[interactionCreate] Error response sent for /${interaction.commandName} ` +
        `after ${Date.now() - startedAt}ms`
      );
    } catch (dispatchErr) {
      console.error('[interactionCreate] Dispatch also failed:', dispatchErr);
    }
  }
}
