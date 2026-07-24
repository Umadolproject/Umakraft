// Distribution/Discord/events/interactionCreate.js
// Central interaction boundary — handles both slash commands and autocomplete.
// Owns acknowledgement timing, command routing, execution logging, and
// user-facing fallback handling for uncaught failures.

import { dispatch }     from '../../Dispatcher/index.js';
import { coordinator }  from '../../Coordinator/index.js';

export const name = 'interactionCreate';
export const once = false;
const INTERACTION_RESPONSE_HANDLED = Symbol('interactionResponseHandled');

// ─── Autocomplete ─────────────────────────────────────────────────────────────

async function handleAutocomplete(interaction) {
  const commandName   = interaction.commandName;
  const focusedOption = interaction.options.getFocused(true);

  try {
    const suggestions = await coordinator.autocomplete({
      commandName,
      focusedOption,
      interaction,
    });
    await interaction.respond(Array.isArray(suggestions) ? suggestions : []);
  } catch (err) {
    console.error(`[AUTOCOMPLETE] Error for /${commandName} option "${focusedOption?.name}":`, err);
    try { await interaction.respond([]); } catch { /* already responded */ }
  }
}

// ─── Slash commands ───────────────────────────────────────────────────────────

function acknowledgedInteraction(interaction) {
  return new Proxy(interaction, {
    get(target, property) {
      if (property === '__originalInteraction') return target;

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

// Maximum time (ms) a command handler is allowed to run before the deferred
// interaction is forcibly closed with an error. Discord interaction tokens
// expire after 15 minutes; this deadline is intentionally shorter so the user
// always gets a visible response rather than a silent expiry.
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function execute(interaction, client) {
  // ── Autocomplete ───────────────────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    return handleAutocomplete(interaction);
  }

  // ── Slash commands ─────────────────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;
  const command     = client.commands.get(commandName);
  const userTag     = interaction.user?.tag ?? interaction.user?.username ?? 'unknown-user';
  const userId      = interaction.user?.id  ?? 'unknown-user-id';
  const startedAt   = Date.now();

  // Matches the search strings in slashcommandfailuresample.md so log greps work.
  console.log(`[interactionCreate] Received /${commandName} from ${userTag} (${userId}) id=${interaction.id}`);

  // The boundary owns acknowledgement timing. Handler metadata may still
  // describe the desired visibility, but a handler must never be able to
  // opt out of the initial acknowledgement and risk an expired interaction.
  const ephemeral = command?.ephemeral ?? true;

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral });
      console.log(`[interactionCreate] Deferred /${commandName} (${ephemeral ? 'ephemeral' : 'public'})`);
    }

    if (!command) {
      console.warn(`[interactionCreate] Unknown command: /${commandName}`);
      await interaction.editReply({
        content: 'This command is not available in the current bot build. Please redeploy commands and try again.',
      });
      return;
    }

    const executionInteraction = acknowledgedInteraction(interaction);

    // Race the handler against a timeout so a hung coordinator action never
    // leaves a deferred interaction waiting silently until the token expires.
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Command /${commandName} timed out after ${COMMAND_TIMEOUT_MS / 1000}s`)),
        COMMAND_TIMEOUT_MS,
      );
    });

    const result = await Promise.race([
      command.execute(executionInteraction, coordinator, client),
      timeoutPromise,
    ]).finally(() => clearTimeout(timeoutId));

    if (result?.[INTERACTION_RESPONSE_HANDLED]) {
      console.log(`[interactionCreate] Replied inline for /${commandName} in ${Date.now() - startedAt}ms`);
      return;
    }

    if (!result || typeof result !== 'object') {
      throw new Error(`Command /${commandName} returned no response envelope`);
    }

    const dispatchableResult = result?.interaction?.__originalInteraction
      ? { ...result, interaction: result.interaction.__originalInteraction }
      : result;

    await dispatch(dispatchableResult);
    console.log(`[interactionCreate] Completed /${commandName} in ${Date.now() - startedAt}ms`);
  } catch (err) {
    console.error(`[interactionCreate] Unhandled error in /${commandName}:`, err);

    try {
      await dispatch({
        success:   false,
        failedAt:  'Commands',
        error:     'UNEXPECTED_ERROR',
        message:   err.message,
        retriable: false,
        interaction,
      });
      console.log(`[interactionCreate] Error response sent for /${commandName} in ${Date.now() - startedAt}ms`);
    } catch (dispatchErr) {
      console.error(`[interactionCreate] Dispatch also failed for /${commandName}:`, dispatchErr);
      try {
        await sendLastChanceFailure(
          interaction,
          'Something went wrong while processing this command. Check the bot logs and try again.',
        );
      } catch (lastChanceErr) {
        console.error(`[interactionCreate] Last-chance response also failed for /${commandName}:`, lastChanceErr);
      }
    }
  }
}
