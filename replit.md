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

## Required secrets

| Secret | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot authentication |
| `DISCORD_CLIENT_ID` | Slash command registration |
| `DISCORD_GUILD_ID` | Guild-scoped command deployment |
| `OPENAI_API_KEY` | Embeddings + GPT-4o-mini (complex tier) |
| `GEMINI_API_KEY` | Gemini Flash (simple tier) |
| `QDRANT_URL` | Qdrant Cloud endpoint (optional) |
| `QDRANT_API_KEY` | Qdrant Cloud auth (optional) |

Optional search keys: `TAVILY_API_KEY`, `BRAVE_SEARCH_API_KEY`, `GOOGLE_CSE_API_KEY`, `SERPAPI_API_KEY`.

## Commands

- `npm start` — start the bot
- `npm run deploy-commands` — register slash commands with your Discord guild
- `npm test` — run pipeline tests

## User preferences

<!-- Add user-specific preferences here -->
