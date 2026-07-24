# Events

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Discord → Events
**Last Updated:** 2026-07-21

---

## Purpose

The **Events** directory contains one file per Discord gateway event that the bot listens to.

Each event file binds to one Discord.js client event, receives the raw event payload, and forwards it to the appropriate Commands handler or startup routine. No business logic, pipeline calls, or response delivery lives here — only the raw event binding and forwarding.

---

## Responsibilities

- Register event listeners with the Discord client on startup via `client.on()` or `client.once()`.
- Receive raw Discord gateway event payloads.
- Extract the minimal context needed to identify the correct handler.
- Forward the payload to the correct Commands handler.
- Handle event registration order on startup (once-only events before recurring events).

## Must Not

- Validate command input — that belongs to Commands.
- Orchestrate pipeline calls — that belongs to Coordinator.
- Deliver responses to Discord — that belongs to Dispatcher.
- Contain any logic beyond receiving and forwarding the event.
- Import or call Umamoe, Refinery, or Workshop directly.

---

## Event File Registry

Each file in this directory corresponds to exactly one Discord gateway event.

| File | Event | Trigger | Forwards To |
|------|-------|---------|-------------|
| `ready.js` | `client.once('ready')` | Bot connected and ready | Startup log; registers scheduled jobs |
| `interactionCreate.js` | `client.on('interactionCreate')` | Slash command or button interaction received | Commands |
| `guildMemberAdd.js` | `client.on('guildMemberAdd')` | New member joins the guild | Commands (greeting trigger) |
| `guildMemberRemove.js` | `client.on('guildMemberRemove')` | Member leaves or is removed from the guild | Commands (departure handling) |
| `messageCreate.js` | `client.on('messageCreate')` | Message posted in a channel | Commands (if bot prefix or trigger word used) |

---

## Event File Structure

Each event file exports a `name`, a `once` flag, and an `execute` function. The bot's entry point (`index.js`) loads all files in this directory and registers them automatically.

```javascript
// events/interactionCreate.js
export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  await command.execute(interaction);
}
```

```javascript
// events/ready.js
export const name = 'ready';
export const once = true;

export async function execute(client) {
  console.log(`Ready — logged in as ${client.user.tag}`);
  // Register scheduled jobs (Broadcast cron triggers, warning engine, etc.)
}
```

```javascript
// events/guildMemberAdd.js
export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  // Forward to Commands greeting handler
  await Commands.execute('greeting', { member });
}
```

---

## Event Registration Pattern

The bot entry point (`index.js`) loads all event files at startup and registers them with the client:

```javascript
// index.js (event loading)
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const eventsPath = join(dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = await import(join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}
```

---

## Design Principle

Event handlers are **wires, not workers**.

Each file receives one signal from Discord and passes it on. Nothing more. The moment conditional logic, data lookups, or response construction appear inside an event file, that logic belongs in Commands.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority |
| `Distribution/Discord/Discord.md` | Platform adapter — owns client init and event loading |
| `Distribution/Commands/Commands.md` | Downstream — receives forwarded interactions |
