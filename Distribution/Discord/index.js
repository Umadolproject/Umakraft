// Distribution/Discord/index.js
// Bot entry point — initialises the Discord.js client, loads all event
// handlers and slash command definitions, then connects to the Discord gateway.
//
// Discord login requires DISCORD_TOKEN. Without it, the health/preview server
// remains available in preview mode so Replit can still run the artifact.

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});
// Log unhandled rejections but do NOT exit — Discord.js reconnection logic and
// network interruptions can surface transient rejections that do not indicate
// an unrecoverable state. Exiting here consumes Railway's restartPolicyMaxRetries
// for every dropped packet or transient API error.
process.on('unhandledRejection', (reason) => {
  console.error('[WARN] Unhandled promise rejection (non-fatal):', reason);
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    const memory = process.memoryUsage();
    console.warn(
      `[shutdown] Received ${signal} — rss=${memory.rss} ` +
      `heap=${memory.heapUsed}/${memory.heapTotal}`
    );
    process.exit(0);
  });
}

import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { DISCORD_CLIENT_ID, DISCORD_GUILD_ID } from '../../core/botConfig.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createServer } from 'node:http';
import { loadCommands } from '../Commands/index.js';
import {
  announceRailwayDeployment,
  queueRailwayLog,
  getRailwayLogBridgeStats,
} from '../../Broadcast/Announcer/railwayLogBridge.js';
import {
  OPS_CHANNEL_ID,
  RAILWAY_WEBHOOK_SECRET,
  RAILWAY_LOG_DRAIN_SECRET,
} from '../../core/botConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT ?? '3000', 10);
let botReady = false;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN?.trim() || '';
const discordConfigured = Boolean(DISCORD_TOKEN);

function readRequestBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isAuthorized(req, configuredSecret) {
  if (!configuredSecret) return false;
  const authorization = req.headers.authorization || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = bearer || req.headers['x-railway-webhook-secret'] || req.headers['x-railway-log-drain-secret'];
  return typeof supplied === 'string' && supplied === configuredSecret;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const healthServer = createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
  } else if (req.method === 'POST' && req.url === '/webhooks/railway') {
    if (!isAuthorized(req, RAILWAY_WEBHOOK_SECRET)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    readRequestBody(req).then(async raw => {
      let payload;
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, { error: 'invalid JSON' });
        return;
      }
      try {
        const result = await announceRailwayDeployment(payload, client, OPS_CHANNEL_ID);
        sendJson(res, 202, { accepted: true, delivered: result.sent === true });
      } catch (error) {
        console.error(`[railway-webhook] Discord delivery failed: ${error.message}`);
        sendJson(res, 502, { error: 'Discord delivery failed' });
      }
    }).catch(error => {
      sendJson(res, error.statusCode || 400, { error: error.message });
    });
  } else if (req.method === 'POST' && req.url === '/webhooks/railway/logs') {
    if (!isAuthorized(req, RAILWAY_LOG_DRAIN_SECRET || RAILWAY_WEBHOOK_SECRET)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    readRequestBody(req).then(raw => {
      let payload;
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        // Some log drains send newline-delimited/plain text payloads.
        payload = { message: raw };
      }
      const entries = Array.isArray(payload) ? payload : [payload];
      const accepted = entries.reduce(
        (count, entry) => count + (queueRailwayLog(entry, client, OPS_CHANNEL_ID).accepted ? 1 : 0),
        0,
      );
      sendJson(res, 202, {
        accepted: true,
        queued: accepted,
        ...getRailwayLogBridgeStats(),
      });
    }).catch(error => {
      sendJson(res, error.statusCode || 400, { error: error.message });
    });
  } else if (req.url === '/') {
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
      <p>Discord bot status: <strong>${botReady ? 'ready' : (discordConfigured ? 'starting' : 'not configured')}</strong></p>
      <p>For machine-readable status, visit <code>/health</code>.</p>
    </main>
  </body>
</html>`);
  } else if (req.url === '/health') {
    // Return 503 when Discord is configured but the bot is not yet ready.
    // This lets Railway's health check detect a broken gateway connection
    // instead of always seeing 200 and assuming the bot is healthy.
    const httpStatus = discordConfigured && !botReady ? 503 : 200;
    res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: httpStatus === 200 ? 'ok' : 'starting', botReady, discordConfigured }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[startup] Health server listening on 0.0.0.0:${PORT}`);
});

console.log('[startup] Checking required environment variables...');

if (!DISCORD_TOKEN) {
  console.warn('[startup] DISCORD_TOKEN is not set — running health/preview server without Discord');
} else if (!DISCORD_CLIENT_ID) {
  console.error('[startup] FATAL: DISCORD_CLIENT_ID is not set — configure it in Railway Variables');
  // Give the health server a moment to serve the failure status before exiting.
  setTimeout(() => process.exit(1), 2000).unref();
} else if (!DISCORD_GUILD_ID) {
  console.warn('[startup] DISCORD_GUILD_ID is not set. Guild command deployment will not work until it is configured.');
}

export let client = null;

if (discordConfigured) {
  console.log('[startup] Environment OK — DISCORD_TOKEN and DISCORD_CLIENT_ID present');
  console.log('[startup] Creating Discord client...');

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.commands = new Collection();

  console.log('[startup] Loading command handlers...');
  const { commands, skipped } = await loadCommands(console);
  for (const [name, handler] of commands) {
    client.commands.set(name, handler);
  }
  console.log(`[startup] Loaded ${client.commands.size} command handler(s)`);
  if (skipped.length > 0) {
    console.warn(`[startup] ${skipped.length} command handler(s) were skipped during startup.`);
  }

  console.log('[startup] Loading event handlers...');
  const eventsPath = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of eventFiles) {
    const event = await import(join(eventsPath, file));
    if (!event?.name || typeof event.execute !== 'function') {
      console.warn(`[startup] Skipping invalid event module: ${file}`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => {
        Promise.resolve(event.execute(...args, client)).catch((err) => {
          console.error(`[discord] Unhandled ${event.name} event error:`, err);
        });
      });
    } else {
      client.on(event.name, (...args) => {
        Promise.resolve(event.execute(...args, client)).catch((err) => {
          console.error(`[discord] Unhandled ${event.name} event error:`, err);
        });
      });
    }

    console.log(`[startup] Registered event: ${event.name} (${file})`);
  }

  const interactionListenerCount = client.listeners('interactionCreate').length;
  if (interactionListenerCount !== 1) {
    console.warn(`[startup] Expected exactly 1 interactionCreate listener, found ${interactionListenerCount}`);
  } else {
    console.log('[startup] Verified exactly 1 interactionCreate listener');
  }

  console.log('[startup] Logging in to Discord...');

  // Update the health-server flag when the bot becomes ready.
  // ready.js (loaded above) handles task scheduling and logging;
  // this listener's only job is to flip the local botReady flag.
  client.once(Events.ClientReady, () => {
    botReady = true;
  });

  client.on('error', (err) => {
    console.error('[discord] Client error:', err);
  });

  // Session invalidated — another process has taken over this token's gateway
  // connection and discord.js cannot resume. Exit so Railway's restart policy
  // establishes a fresh session instead of hanging silently without events.
  client.on('invalidated', () => {
    console.error('[discord] Session invalidated — gateway stolen by another process. Exiting for restart.');
    process.exit(1);
  });

  // Discord.js v14 does not emit a 'disconnect' event on the Client.
  // Use shardDisconnect / shardResume to track gateway connection state.
  client.on('shardDisconnect', (_event, shardId) => {
    botReady = false;
    console.warn(`[discord] Shard ${shardId} disconnected`);
  });

  client.on('shardResume', (shardId) => {
    botReady = true;
    console.log(`[discord] Shard ${shardId} resumed`);
  });

  // Raw gateway probe — logs every dispatch event so we can confirm the gateway
  // is alive and delivering events. INTERACTION_CREATE gets a detailed line;
  // other dispatch events get a one-liner so the log stays readable.
  // Heartbeat ACKs (op 11) are silent to avoid noise.
  let _lastDispatchAt = null;
  client.on('raw', (event) => {
    if (event.op === 0 && event.t) {
      _lastDispatchAt = Date.now();
      if (event.t === 'INTERACTION_CREATE') {
        const name = event.d?.data?.name ?? 'unknown';
        console.log(`[discord/raw] interactionCreate received /${name} id=${event.d?.id}`);
      } else {
        // Skip extremely noisy events that fire constantly
        const silent = new Set(['PRESENCE_UPDATE', 'TYPING_START', 'MESSAGE_UPDATE']);
        if (!silent.has(event.t)) {
          console.log(`[discord/raw] ${event.t}`);
        }
      }
    }
  });

  // Gateway watchdog — if no dispatch events arrive for 8 minutes after the bot
  // is ready, the session is a zombie (connected but receiving nothing). Exit so
  // Railway's restart policy establishes a fresh gateway session.
  client.once(Events.ClientReady, () => {
    _lastDispatchAt = Date.now();
    const WATCHDOG_INTERVAL_MS = 60_000;
    const WATCHDOG_DEAD_MS     = 8 * 60_000;
    const watchdog = setInterval(() => {
      const elapsed = Date.now() - (_lastDispatchAt ?? 0);
      if (elapsed > WATCHDOG_DEAD_MS) {
        console.error(`[discord] Watchdog: no gateway dispatch events for ${Math.round(elapsed / 1000)}s — zombie session detected. Exiting for Railway restart.`);
        process.exit(1);
      }
    }, WATCHDOG_INTERVAL_MS);
    watchdog.unref();
  });

  await client.login(DISCORD_TOKEN);
  console.log('[startup] Login call completed — waiting for ready event');
} else {
  console.log('[startup] Preview mode active — Discord gateway login skipped');
}
