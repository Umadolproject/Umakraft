// Distribution/Commands/index.js
// Loads all slash command handlers from Distribution/Commands/handlers/ and
// exposes them as a Map<commandName, handler> for the Discord client.
//
// Each handler module must export:
//   name     {string}   — the slash command name (e.g. 'fan_gain')
//   defer    {boolean}  — whether to call deferReply before execute
//   ephemeral {boolean} — whether the deferred reply is ephemeral
//   execute  {function} — async (interaction, coordinator) => envelope

import { readdirSync }   from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const handlersPath = join(__dirname, 'handlers');

const handlers = await Promise.all(
  readdirSync(handlersPath)
    .filter(f => f.endsWith('.js'))
    .map(f => import(join(handlersPath, f)))
);

export const commandMap = new Map(
  handlers.map(h => [h.name, h])
);
