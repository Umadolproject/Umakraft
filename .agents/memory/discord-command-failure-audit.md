---
name: Discord command failure audit
description: Bugs found and fixed during the July 2026 command-failure audit. Documents the log search strings, the raw probe location, and the architectural fixes applied.
---

# Discord command failure audit fixes

## Fixed bugs (July 2026)

**Why:** Railway logs showed no `[interactionCreate] Received /...` lines when commands were invoked. Audit identified 10 code-level issues that masked failures, broke diagnostics, or could crash the process.

**How to apply:** When diagnosing future command failures, use these exact search strings in Railway logs:
- `[discord/raw] interactionCreate received /<name>` — confirms Discord is delivering to this process
- `[interactionCreate] Received /<name>` — confirms the handler boundary received it
- `[interactionCreate] Completed /<name>` — confirms response was sent
- `[interactionCreate] Dispatch also failed` — both the response and the error fallback failed

## What was changed

1. **Raw gateway probe** (`Distribution/Discord/index.js`) — `client.on('raw', ...)` added; logs `[discord/raw] interactionCreate received /<name>` for every incoming interaction before Discord.js processing.

2. **Log prefix** (`Distribution/Discord/events/interactionCreate.js`) — changed from `[COMMAND]` to `[interactionCreate]` to match diagnostic search strings in `slashcommandfailuresample.md`.

3. **`unhandledRejection` no longer exits** (`index.js`) — was `process.exit(1)`; changed to `console.error` only. Discord.js reconnection emits transient rejections that were exhausting Railway's 5 restart retries.

4. **`disconnect` event removed** (`index.js`) — does not exist in Discord.js v14. Replaced with `shardDisconnect` / `shardResume` to correctly track `botReady`.

5. **Health endpoint returns 503 while starting** (`index.js`) — was always HTTP 200; now returns 503 when `discordConfigured && !botReady` so Railway health checks can detect a broken gateway.

6. **Command timeout added** (`interactionCreate.js`) — 10-minute `Promise.race` around `command.execute()`; prevents hung coordinator from leaving a deferred interaction with no response.

7. **Error 40060 swallowed in `send.js`** — "already acknowledged" is now a warn+return like 10062, not a throw.

8. **Redundant `clientReady` listener removed** (`index.js`) — was registered after `ready.js` was already loaded; kept a minimal version that only sets `botReady = true` (the log and task scheduling remain in `ready.js`).
