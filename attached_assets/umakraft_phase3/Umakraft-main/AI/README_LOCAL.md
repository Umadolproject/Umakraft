# Local AI Service

Runs a self-hosted language model inside the bot process — no API keys required.

## Quick start

Set one environment variable in Railway (or `.env`):

```
AI_PROVIDER=local
```

That's it. The bot will use **SmolLM2-135M-Instruct** by default and load it
only when the first AI command is used.

## How it works

```
/ai  ─►  aiGateway.js
           │
           ├─ AI_PROVIDER=local?  ──►  aiService.js
           │                              │
           │                         documentSearch.js   (searches docs/)
           │                              │
           │                         promptBuilder.js    (assembles messages array)
           │                              │
           │                         model.js            (local model via transformers.js)
           │                              │
           │                         cache.js            (LRU response cache)
           │
           └─ AI_PROVIDER=cloud  ──►  existing cloud pipeline (OpenAI / Gemini)
```

The document index loads at bot startup. The language model is loaded lazily
on the first `/ask` or `/ai` request and reused for subsequent requests.
Normal Discord commands never initialize the model.

## Swapping the model

Change the model without touching any other file:

```
AI_LOCAL_MODEL=Qwen/Qwen2.5-0.5B-Instruct
AI_LOCAL_MODEL=google/gemma-2-2b-it
AI_LOCAL_MODEL=HuggingFaceTB/SmolLM2-135M-Instruct
```

Any model on HuggingFace Hub that supports `text-generation` and a chat template works.

## Memory budget (1 GB Railway service)

| Component | RAM |
|-----------|-----|
| Node.js + Discord.js | ~150 MB |
| SmolLM2-135M q4 | ~100 MB (only after first AI request) |
| Puppeteer (peak, image commands) | ~100 MB |
| **Total** | **~450 MB** — safe margin |

For a larger response model, set `AI_LOCAL_MODEL=HuggingFaceTB/SmolLM2-360M-Instruct`.

## Model cache (avoid re-downloading on redeploy)

Add a persistent volume in Railway mounted at `/data`, then set:

```
HF_HOME=/data/.cache/huggingface
```

The model downloads once and survives redeploys.

## Files

| File | Purpose |
|------|---------|
| `AI/model.js` | HuggingFace model abstraction — swap here to change the model |
| `AI/documentSearch.js` | Lexical search over `docs/` (no embeddings needed) |
| `AI/promptBuilder.js` | Builds the system + user prompt |
| `AI/cache.js` | LRU response cache keyed by SHA-256 of the question |
| `AI/aiService.js` | Orchestrator — topic guard, cache, search, generate |

## What the AI can answer

Only questions about:
- UmaKraft / UmaKraft Circle Bot commands
- Umamusume Pretty Derby circle mechanics
- Content documented in `docs/`

Off-topic questions are rejected with a polite message before the model is called.
