# UmaKraft

A constitutional Discord bot that runs a five-stage data pipeline (Extract → Refine → Render → Route → Deliver) for tracking Umamusume Pretty Derby fan statistics and providing an AI Knowledge Service via slash commands.

## How to run

```
npm start
```

This starts the Discord bot (`Distribution/Discord/index.js`). The bot also listens on `PORT` (default 3000) with a `/health` endpoint.

## Stack

- **Runtime:** Node.js ≥ 20 (ESM)
- **Discord:** discord.js
- **AI:** OpenAI (GPT-4o-mini) + Google Gemini (gemini-1.5-flash) with in-process fallback
- **Vector DB:** Qdrant Cloud (optional — falls back to in-memory)
- **Browser automation:** Puppeteer (data mining)
- **Deployment:** Configured for Railway (`railway.toml`) and Replit

## Architecture

Five pipeline stages:
1. **Umamoe** — Extract (Miner, Courier, Inspector, Vault)
2. **Refinery** — Transform (Refiner, Compiler, Depot)
3. **Workshop** — Render (Draftsman, Fabricator, Validator, Terminal)
4. **Distribution** — Route (Commands, Coordinator, Dispatcher)
5. **Broadcast** — Deliver (Broker, Inspector, Archive, Announcer)

AI support lives in `AI/` (RepositoryEngine, KnowledgeEngine, WebSearchEngine, APIProvider, etc.).

## Required secrets (environment variables)

Only actual API keys and tokens belong here. Set them in Railway Variables / Replit Secrets.

| Secret | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot authentication — **required** |
| `UMA_MOE_API_KEY` | Uma.moe API auth — **required** (unauthenticated requests are rate-limited / rejected) |
| `OPENAI_API_KEY` | Embeddings (optional — local model handles generation) |
| `OPENAI_API_KEY_2` | OpenAI backup key (optional) |
| `GEMINI_API_KEY` | Gemini Flash fallback (optional) |
| `GEMINI_API_KEY_2` | Gemini backup key (optional) |
| `QDRANT_URL` | Qdrant Cloud endpoint (optional — falls back to in-memory) |
| `QDRANT_API_KEY` | Qdrant Cloud auth (optional) |
| `TAVILY_API_KEY` | Web search — Tavily (optional) |
| `TAVILY_API_KEY_2` | Tavily backup key (optional) |
| `BRAVE_SEARCH_API_KEY` | Web search — Brave (optional) |
| `BRAVE_SEARCH_API_KEY_2` | Brave backup key (optional) |
| `GOOGLE_CSE_API_KEY` | Web search — Google CSE (optional) |
| `SERPAPI_API_KEY` | Web search — SerpAPI (optional) |
| `RAILWAY_WEBHOOK_SECRET` | Authenticates Railway deployment notifications (optional until Railway webhook is connected) |
| `RAILWAY_LOG_DRAIN_SECRET` | Authenticates Railway runtime log forwarding (optional until Railway log drain is connected) |

## Non-sensitive configuration (edit files, not secrets)

| Value | How to set |
|---|---|
| `DISCORD_CLIENT_ID` | `core/botConfig.js` or `DISCORD_CLIENT_ID` env var |
| `DISCORD_GUILD_ID` | `core/botConfig.js` or `DISCORD_GUILD_ID` env var |
| `OPS_CHANNEL_ID` | `OPS_CHANNEL_ID` env var — Discord channel for ops/alert messages |
| `ANNOUNCEMENT_CHANNEL_ID` | `ANNOUNCEMENT_CHANNEL_ID` env var — channel for milestone/fan-deficit alerts |
| `MESSAGE_CHANNEL_ID` | `MESSAGE_CHANNEL_ID` env var — channel for greetings/leaderboard posts |
| `CHAT_CHANNEL_ID` | `CHAT_CHANNEL_ID` env var — channel for @mention AI replies |
| `ANNOUNCEMENT_WEBHOOK_URL` | `ANNOUNCEMENT_WEBHOOK_URL` secret — webhook for cross-posting announcements (optional) |
| `MESSAGE_WEBHOOK_URL` | `MESSAGE_WEBHOOK_URL` secret — webhook for cross-posting messages (optional) |
| `CHAT_WEBHOOK_URL` | `CHAT_WEBHOOK_URL` secret — webhook for posting to bot-chat (optional) |
| `CONFIGURED_CIRCLES` | `core/botConfig.js` or `CONFIGURED_CIRCLES` env var (comma-separated) |
| AI model, cache, search tuning | `AI/Configuration.js` |
| Miner timeouts / retries | `umamoe/Miner/config.js` |

The AI provider is hardcoded to `'local'` (self-hosted HuggingFace model in-process). Change `aiProvider` in `AI/Configuration.js` to `'cloud'` to switch to OpenAI + Gemini.

## Commands

- `npm start` — start the bot
- `npm run deploy-commands` — register slash commands with your Discord guild
- `npm test` — run pipeline tests

## User preferences

<!-- Add user-specific preferences here -->
