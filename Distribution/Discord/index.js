// Distribution/Discord/index.js
// Bot entry point — initialises the Discord.js client, loads all event
// handlers and slash command definitions, then connects to the Discord gateway.
//
// Required secrets: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID

// ─── Crash logger — must be first ─────────────────────────────────────────────
// Guarantees something is always written to Railway logs even on silent crashes.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  process.exit(1);
});

import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { readdirSync }  from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Client ────────────────────────────────────────────────────────────────────
// GuildMembers and MessageContent are privileged intents — they must be
// enabled in the Discord Developer Portal under the bot settings.

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Command Collection ────────────────────────────────────────────────────────
// Populated from Distribution/Commands/index.js so the interactionCreate
// event can route to the correct handler by commandName.

client.commands = new Collection();

// ─── Load Events ──────────────────────────────────────────────────────────────

const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = await import(join(eventsPath, file));
  if (!event.name) continue;
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ─── Load Commands ─────────────────────────────────────────────────────────────
// Commands/index.js exports a Map of commandName → { execute, defer, ephemeral }

import { commandMap } from '../Commands/index.js';
for (const [name, handler] of commandMap) {
  client.commands.set(name, handler);
}

// ─── Connect ───────────────────────────────────────────────────────────────────

const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN secret');

await client.login(DISCORD_TOKEN);
