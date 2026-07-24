# Discord

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Discord
**Last Updated:** 2026-07-21

---

## Purpose

The **Discord** department is the platform adapter of the Distribution stage.

It owns the raw Discord API surface — every file that originates from or is registered directly with the Discord API lives here. It is the hard boundary between the Discord platform and the rest of the pipeline.

Discord does not process, orchestrate, validate, or deliver. It forwards incoming events to Commands and provides the shared Discord.js client and utilities that Commands and Dispatcher consume.

---

## Responsibilities

- Initialize and configure the Discord.js client with the correct gateway intents.
- Register all slash commands with the Discord API via the deploy script.
- Listen for raw Discord gateway events and forward them to the correct handlers.
- Export the active Discord client for use by Dispatcher when sending responses.
- Provide shared Discord platform utilities (permission helpers, attachment builders) consumed by Commands and Dispatcher.
- Load and register all event listeners on bot startup.
- Load all slash command definitions into the client's command collection on startup.

## Must Not

The Discord department must **never**:

- Validate business rules or command logic — that belongs to Commands.
- Orchestrate pipeline stages — that belongs to Coordinator.
- Construct final deliverable content — that belongs to Workshop.
- Deliver completed pipeline responses to Discord — that belongs to Dispatcher.
- Persist any data.
- Contain business logic of any kind.

---

## Technology

| Property | Value |
|----------|-------|
| Library | Discord.js v14 |
| Node.js | ≥ 20.0.0 |
| API version | Discord API v10 |

---

## Required Environment Variables

These must be configured as Replit Secrets before the bot can connect.

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application (client) ID from the Discord Developer Portal |
| `DISCORD_GUILD_ID` | Guild (server) ID for guild-scoped command registration during development |

---

## Gateway Intents

The bot requires the following Discord.js gateway intents:

| Intent | Required For |
|--------|-------------|
| `Guilds` | Guild context, channel resolution, role access |
| `GuildMembers` | Member list, join/leave events, member lookup |
| `GuildMessages` | Monitoring message events (timeline, warnings) |
| `MessageContent` | Reading message content for trigger detection |
| `GuildPresences` | Presence/online status for activity tracking (if used) |

`GuildMembers` and `MessageContent` are **privileged intents** — they must be explicitly enabled in the Discord Developer Portal under the bot settings.

---

## File Structure

```text
Distribution/Discord/
├── Discord.md              — this document
├── index.js                — bot entry point: client init, event loading, command loading
├── deploy-commands.js      — registers slash commands with Discord API
├── commands/               — slash command definitions (one file per command)
│   ├── commands.md         — command registry index
│   ├── fan_gain.md
│   ├── profile.md
│   └── ... (28 total)
└── events/                 — gateway event handlers (one file per event)
    ├── events.md           — event handler spec
    ├── interactionCreate.js
    ├── ready.js
    └── guildMemberAdd.js
```

---

## Bot Entry Point (`index.js`)

The entry point initializes the Discord client, loads all event files from `events/`, loads all command definitions into `client.commands`, and logs in with the bot token.

```javascript
// Distribution/Discord/index.js (structure)
import { Client, GatewayIntentBits, Collection } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Load event handlers from events/
// Load command definitions into client.commands
// client.login(process.env.DISCORD_TOKEN)
```

---

## Command Registration (`deploy-commands.js`)

Slash commands must be registered with the Discord API before they appear in Discord. The deploy script sends all command definitions to Discord via the REST API.

**Run once after any command definition change:**

```bash
node Distribution/Discord/deploy-commands.js
```

**Deployment modes:**

| Mode | Scope | Speed | Use When |
|------|-------|-------|----------|
| Guild commands | One specific server | Instant | Development and testing |
| Global commands | All servers the bot is in | Up to 1 hour | Production release |

Guild commands use `DISCORD_GUILD_ID`. Global commands omit it.

```javascript
// deploy-commands.js (structure)
import { REST, Routes } from 'discord.js';

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Guild (dev): Routes.applicationGuildCommands(clientId, guildId)
// Global:      Routes.applicationCommands(clientId)
await rest.put(route, { body: commands });
```

---

## GitHub Integration

To wire the bot to a Discord server via GitHub:

1. Create a Discord Application at [discord.com/developers](https://discord.com/developers/applications).
2. Enable **Bot** under the application. Copy the **Bot Token** → `DISCORD_TOKEN` secret.
3. Copy the **Application ID** → `DISCORD_CLIENT_ID` secret.
4. Enable privileged intents: **Server Members Intent** and **Message Content Intent**.
5. Generate an **OAuth2 URL** with scopes `bot` + `applications.commands` and invite the bot to the server.
6. Copy the **Guild (Server) ID** → `DISCORD_GUILD_ID` secret.
7. Run `node Distribution/Discord/deploy-commands.js` to register all 28 slash commands.
8. Start the bot: `node Distribution/Discord/index.js`.

For production, use a process manager (e.g. PM2) or configure the Replit workflow to run `index.js` as the persistent process.

---

## Workflow

```text
Discord API
    │
    ├── Gateway Events ──────────────────► events/
    │   (interactionCreate, ready,              │
    │    guildMemberAdd, ...)                   ▼
    │                                       Commands
    │
    └── Slash Command Registration ◄──── deploy-commands.js
        (run manually or on deploy)
```

---

## Design Principle

Discord is a **platform adapter**, not a pipeline stage.

Every file here exists because Discord requires it — a command definition, a gateway event handler, the deploy script, the client initialization. If a file exists to process what Discord delivers, it belongs in Commands.

Keeping all Discord-specific API concerns here allows Commands and Dispatcher to remain platform-agnostic in their logic.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority |
| `Distribution/Discord/events/events.md` | Gateway event handler spec |
| `Distribution/Discord/commands/commands.md` | Slash command registry |
| `Distribution/Commands/Commands.md` | Downstream — receives forwarded interactions |
| `Distribution/Dispatcher/Dispatcher.md` | Consumes Discord client for response delivery |
