// Distribution/Discord/index.js
// Bot entry point — initialises the Discord.js client, loads all event
// handlers and slash command definitions, then connects to the Discord gateway.
//
// Required secrets: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID

// ─── Crash logger — must be first ─────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  process.exit(1);
});

import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { DISCORD_CLIENT_ID } from '../../core/botConfig.js';
import { readdirSync }  from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createServer }  from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Health-check server ───────────────────────────────────────────────────────
// Must bind to 0.0.0.0 (not localhost) so Railway's health check can reach it.
// Started before Discord login so Railway doesn't kill the process during startup.
const PORT = parseInt(process.env.PORT ?? '3000', 10);
let botReady = false;

const healthServer = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>UmaKraft Bot</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
             background: #111827; color: #f9fafb; }
      main { width: min(36rem, calc(100% - 3rem)); padding: 2.5rem;
             border: 1px solid #374151; border-radius: 1rem;
             background: #1f2937; box-shadow: 0 1rem 3rem #0005; }
      h1 { margin-top: 0; }
      .status { color: #86efac; font-weight: 700; }
      p { color: #d1d5db; line-height: 1.6; }
      code { color: #bfdbfe; }
    </style>
  </head>
  <body>
    <main>
      <h1>UmaKraft Bot</h1>
      <p class="status">Service online</p>
      <p>Discord bot status: <strong>${botReady ? 'ready' : 'starting'}</strong></p>
      <p>For machine-readable status, visit <code>/health</code>.</p>
    </main>
  </body>
</html>`);
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', botReady }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[startup] Health server listening on 0.0.0.0:${PORT}`);
});

// ─── Environment validation ────────────────────────────────────────────────────
console.log('[startup] Checking required environment variables...');

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('[startup] FATAL: DISCORD_TOKEN is not set — add it to Railway Variables');
  // Keep health server alive so logs are visible, then exit after flush
  setTimeout(() => process.exit(1), 2000);
  throw new Error('Missing DISCORD_TOKEN');
}
if (!DISCORD_CLIENT_ID) {
  console.error('[startup] FATAL: DISCORD_CLIENT_ID is not set — edit core/botConfig.js');
  setTimeout(() => process.exit(1), 2000);
  throw new Error('Missing DISCORD_CLIENT_ID');
}

console.log('[startup] Environment OK — DISCORD_TOKEN and DISCORD_CLIENT_ID present');

// ─── Discord client ────────────────────────────────────────────────────────────
// GuildMembers and MessageContent are privileged intents.
// Enable both in Discord Developer Portal → Bot → Privileged Gateway Intents.
console.log('[startup] Creating Discord client...');

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ─── Load events ──────────────────────────────────────────────────────────────
console.log('[startup] Loading event handlers...');

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
  console.log(`[startup] Registered event: ${event.name}`);
}

// ─── Load commands ─────────────────────────────────────────────────────────────
console.log('[startup] Loading command handlers...');

import { commandMap } from '../Commands/index.js';
for (const [name, handler] of commandMap) {
  client.commands.set(name, handler);
}
console.log(`[startup] Loaded ${client.commands.size} commands`);

// ─── Connect to Discord ────────────────────────────────────────────────────────
console.log('[startup] Logging in to Discord...');

client.once('clientReady', () => {
  botReady = true;
  console.log(`[startup] Bot is READY — ${client.user.tag}`);
});

client.on('error', (err) => {
  console.error('[discord] Client error:', err);
});

client.on('disconnect', () => {
  botReady = false;
  console.warn('[discord] Client disconnected');
});

await client.login(DISCORD_TOKEN);
console.log('[startup] Login call completed — waiting for ready event');
