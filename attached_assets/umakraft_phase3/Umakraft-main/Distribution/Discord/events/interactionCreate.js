// Distribution/Discord/events/interactionCreate.js
// Central slash-command execution boundary.
// Owns acknowledgement timing, command routing, execution logging, and
// user-facing fallback handling for uncaught failures.

import { dispatch } from '../../Dispatcher/index.js';
import { coordinator } from '../../Coordinator/index.js';

export const name = 'interactionCreate';
export const once = false;
const INTERACTION_RESPONSE_HANDLED = Symbol('interactionResponseHandled');

function acknowledgedInteraction(interaction) {
  return new Proxy(interaction, {
    get(target, property) {
      if (property === '__originalInteraction') {
        return target;
      }

      if (property === 'deferReply') {
        return async () => target;
      }

      if (property === 'reply') {
        return async (payload = {}) => {
          const { ephemeral: _ephemeral, ...editPayload } = payload;
          await target.editReply(editPayload);
          return { [INTERACTION_RESPONSE_HANDLED]: true };
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

async function sendLastChanceFailure(interaction, message) {
  if (!interaction.deferred && !interaction.replied) {
    return interaction.reply({ content: message, ephemeral: true });
  }
  return interaction.editReply({ content: message });
}

export async function execute(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;
  const command = client.commands.get(commandName);
  const userTag = interaction.user?.tag ?? interaction.user?.username ?? 'unknown-user';
  const userId = interaction.user?.id ?? 'unknown-user-id';
  const startedAt = Date.now();

  console.log(`[COMMAND] /${commandName} by ${userTag} (${userId}) id=${interaction.id}`);

  if (!command) {
    console.warn(`[COMMAND] Unknown command received: /${commandName}`);
    try {
      await interaction.reply({
        content: 'This command is not available in the current bot build. Please redeploy commands and try again.',
        ephemeral: true,
      });
    } catch (err) {
      console.error(`[COMMAND] Failed to report unknown command /${commandName}:`, err);
    }
    return;
  }

  const shouldDefer = command.defer !== false;
  const ephemeral = command.ephemeral ?? false;

  try {
    if (shouldDefer && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral });
      console.log(`[COMMAND] Deferred /${commandName} (${ephemeral ? 'ephemeral' : 'public'})`);
    }

    const executionInteraction = shouldDefer
      ? acknowledgedInteraction(interaction)
      : interaction;

    const result = await command.execute(executionInteraction, coordinator, client);

    if (result?.[INTERACTION_RESPONSE_HANDLED]) {
      console.log(`[COMMAND] Replied inline for /${commandName} in ${Date.now() - startedAt}ms`);
      return;
    }

    if (!result || typeof result !== 'object') {
      throw new Error(`Command /${commandName} returned no response envelope`);
    }

    const dispatchableResult = result?.interaction?.__originalInteraction
      ? { ...result, interaction: result.interaction.__originalInteraction }
      : result;

    await dispatch(dispatchableResult);
    console.log(`[COMMAND] Reply sent successfully for /${commandName} in ${Date.now() - startedAt}ms`);
  } catch (err) {
    console.error(`[COMMAND] Unhandled error in /${commandName}:`, err);

    try {
      await dispatch({
        success: false,
        failedAt: 'Commands',
        error: 'UNEXPECTED_ERROR',
        message: err.message,
        retriable: false,
        interaction,
      });
      console.log(`[COMMAND] Error response sent for /${commandName} in ${Date.now() - startedAt}ms`);
    } catch (dispatchErr) {
      console.error(`[COMMAND] Dispatcher failed for /${commandName}:`, dispatchErr);
      try {
        await sendLastChanceFailure(
          interaction,
          'Something went wrong while processing this command. Check the bot logs and try again.'
        );
      } catch (lastChanceErr) {
        console.error(`[COMMAND] Last-chance response also failed for /${commandName}:`, lastChanceErr);
      }
    }
  }
}
