// Distribution/Discord/events/interactionCreate.js
// Fires on every Discord interaction (slash command, button, autocomplete, etc.).
// Routes slash command interactions to the Commands department.

import { dispatch } from '../../Dispatcher/index.js';
import { coordinator } from '../../Coordinator/index.js';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction, client) {
  // Only handle slash commands here.
  // Buttons and selects are handled by their respective collectors.
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[interactionCreate] Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    // command.execute defers the reply and returns the result envelope
    const result = await command.execute(interaction, coordinator);

    // Dispatcher turns the result envelope into a Discord response
    await dispatch(result);
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
    } catch (dispatchErr) {
      console.error('[interactionCreate] Dispatch also failed:', dispatchErr);
    }
  }
}
