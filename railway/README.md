# UmaKraft — Railway Deployment Guide

Railway builds this project using a **Dockerfile** (not Nixpacks) because
Puppeteer requires system Chromium and CJK fonts that Nixpacks can't reliably
provide. Everything is pre-configured in [`Dockerfile`](../Dockerfile) and
[`railway.toml`](../railway.toml).

---

## Quick start

```bash
npm i -g @railway/cli   # install Railway CLI (once)
railway login
railway link            # link this repo to a Railway project
# set secrets (see below)
railway up              # deploy
```

## Discord deployment and log notifications

The bot exposes two authenticated endpoints for posting Railway activity to
the operations channel (`OPS_CHANNEL_ID`, defaulting to
`1529852035590127686`):

```text
POST /webhooks/railway
POST /webhooks/railway/logs
Authorization: Bearer <matching secret>
```

Configure these after the service has a public Railway domain:

1. In Railway project settings, add a project webhook pointing to
   `https://<your-domain>/webhooks/railway`. Set the same value as
   `RAILWAY_WEBHOOK_SECRET` in the service variables.
2. Add a Railway log drain pointing to
   `https://<your-domain>/webhooks/railway/logs`. Set the same value as
   `RAILWAY_LOG_DRAIN_SECRET` in the service variables. The log bridge accepts
   JSON, arrays of JSON entries, and plain-text log payloads.
3. Ensure the Discord bot can view and send messages in channel
   `1529852035590127686`.

Deployment events are posted immediately. Runtime logs are redacted and
batched for up to two seconds, with error-like entries marked `ERROR`.
The bridge drops the oldest entries if Discord is unavailable or the queue
reaches its safety limit; Railway remains the source of truth for complete
logs.

---

## Required environment secrets

Set these in the Railway dashboard → **Variables**, or via CLI:
`railway variables set KEY=value`

### Discord

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application (client) ID |
| `DISCORD_GUILD_ID` | Guild (server) ID for guild-scoped slash commands |

### AI Knowledge Service

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Required for embeddings (`text-embedding-3-small`) and GPT-4o-mini |
| `OPENAI_API_KEY_2` | Backup OpenAI key — auto-rotated in when the primary hits a 429 |
| `GEMINI_API_KEY` | Used for the simple-tier model (gemini-1.5-flash) |
| `GEMINI_API_KEY_2` | Backup Gemini key — auto-rotated in when the primary hits a 429 |
| `QDRANT_URL` | Qdrant vector database URL |
| `QDRANT_API_KEY` | Qdrant API key |
| `QDRANT_COLLECTION` | Collection name (default: `umakraft`) |

> At minimum, `OPENAI_API_KEY` is needed — it powers both embeddings and the
> complex model tier. `GEMINI_API_KEY` is the simple-tier fallback.
> The `_2` backup keys are optional but recommended — they kick in automatically
> when the primary key returns a rate-limit error (HTTP 429), with no downtime.

### Web Search — `/ai live` command (optional)

| Variable | Description |
|---|---|
| `TAVILY_API_KEY` | Tavily search API (primary) |
| `TAVILY_API_KEY_2` | Backup Tavily key — auto-rotated in on 429 |
| `BRAVE_SEARCH_API_KEY` | Brave Search fallback |
| `BRAVE_SEARCH_API_KEY_2` | Backup Brave key — auto-rotated in on 429 |

### Puppeteer (set automatically by Dockerfile — do NOT override)

| Variable | Value | Set by |
|---|---|---|
| `PUPPETEER_SKIP_DOWNLOAD` | `true` | Dockerfile ENV |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | Dockerfile ENV |

These are baked into the image. Override them in Railway only if you know
exactly what you're doing.

### uma.moe API (optional tuning)

| Variable | Default | Description |
|---|---|---|
| `UMA_MOE_API_BASE_URL` | `https://uma.moe/api` | Base URL |
| `API_TIMEOUT_MS` | `30000` | Request timeout (ms) |
| `API_MAX_RETRIES` | `3` | Retry attempts |

### AI tuning (all optional)

| Variable | Default | Description |
|---|---|---|
| `AI_COMPLEX_MODEL` | `gpt-4o-mini` | Model for complex queries |
| `AI_SIMPLE_MODEL` | `gemini-1.5-flash` | Model for simple-tier queries |
| `AI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `AI_REINDEX_ON_STARTUP` | `false` | Force full re-index on every boot |
| `VDB_TOP_K` | `8` | Chunks returned per search |
| `VDB_MIN_SCORE` | `0.60` | Minimum similarity score (0–1) |

---

## Register slash commands

Run once after deployment so the commands appear in your Discord server:

```bash
# Guild commands — instant
bash railway/deploy-commands.sh

# Global commands — up to 1 hour to propagate
bash railway/deploy-commands.sh --global
```

---

## View logs

```bash
railway logs
```

---

## Docker build layers (what happens on `railway up`)

```
1. node:20-slim base image
2. apt-get: chromium + system libs + Noto CJK fonts
3. ENV: PUPPETEER_SKIP_DOWNLOAD=true, PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
4. npm ci --omit=dev
5. COPY source
6. CMD: node Distribution/Discord/index.js
```

Layer 2 is cached as long as the `apt-get` block in the Dockerfile doesn't
change — subsequent deploys only re-run from step 4 onward.

---

## Why Dockerfile and not Nixpacks?

The Workshop/Fabricator renders image cards via headless Chromium (Puppeteer).
Chromium requires a precise set of shared libraries (`libgbm1`, `libnss3`,
`libdrm2`, `libgtk-3-0`, etc.) and CJK fonts for Japanese character rendering.
Nixpacks cannot install these reliably. The Dockerfile gives exact control over
every system dependency, making renders deterministic across deployments.
