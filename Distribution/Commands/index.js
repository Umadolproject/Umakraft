// Distribution/Commands/index.js
// Loads all slash command handlers from Distribution/Commands/handlers/ and
// exposes them as a Map<commandName, handler> for the Discord client.
//
// Each handler module must export:
//   name      {string}   — the slash command name (e.g. 'fan_gain')
//   defer     {boolean}  — legacy metadata; the boundary always acknowledges
//                         slash commands before invoking handlers
//   ephemeral {boolean}  — whether the deferred reply should be ephemeral
//   execute   {function} — async (interaction, coordinator, client) => envelope

import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const handlersPath = join(__dirname, 'handlers');
let _loadPromise = null;

function validateHandler(handler, file, seenNames) {
  const issues = [];

  if (!handler || typeof handler !== 'object') {
    issues.push('module did not export an object');
  }
  if (typeof handler?.name !== 'string' || handler.name.trim().length === 0) {
    issues.push('missing valid `name` export');
  }
  if (typeof handler?.execute !== 'function') {
    issues.push('missing `execute()` export');
  }
  if (typeof handler?.defer !== 'undefined' && typeof handler.defer !== 'boolean') {
    issues.push('`defer` must be a boolean when present');
  }
  if (typeof handler?.ephemeral !== 'undefined' && typeof handler.ephemeral !== 'boolean') {
    issues.push('`ephemeral` must be a boolean when present');
  }
  if (handler?.name && seenNames.has(handler.name)) {
    issues.push(`duplicate command name \`${handler.name}\``);
  }

  if (issues.length > 0) {
    const error = new Error(`[commands] Invalid handler ${file}: ${issues.join('; ')}`);
    error.issues = issues;
    throw error;
  }
}

export async function loadCommands(logger = console) {
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const files = readdirSync(handlersPath)
      .filter(file => file.endsWith('.js'))
      .sort((a, b) => a.localeCompare(b));

    const commands = new Map();
    const seenNames = new Set();
    const skipped = [];

    for (const file of files) {
      const moduleUrl = pathToFileURL(join(handlersPath, file)).href;

      try {
        const handler = await import(moduleUrl);
        validateHandler(handler, file, seenNames);

        seenNames.add(handler.name);
        commands.set(handler.name, {
          ...handler,
          sourceFile: file,
        });

        logger.log?.(`[startup] Loaded command: ${handler.name} (${file})`);
      } catch (err) {
        skipped.push({ file, error: err.message });
        logger.error?.(`[startup] Failed to load command handler ${file}: ${err.stack ?? err.message}`);
      }
    }

    if (commands.size === 0) {
      throw new Error('[startup] No valid command handlers were loaded.');
    }

    if (skipped.length > 0) {
      logger.warn?.(`[startup] Skipped ${skipped.length} invalid command handler(s).`);
    }

    return { commands, skipped };
  })();

  return _loadPromise;
}
