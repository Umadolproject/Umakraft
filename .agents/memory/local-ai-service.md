---
name: Local AI service
description: SmolLM2-360M-Instruct local model integration — architecture, activation, and swap instructions.
---

## Rule
Set `AI_PROVIDER=local` to bypass the entire cloud pipeline (OpenAI/Gemini/Qdrant) and use a self-hosted model. No API keys needed.

**Why:** Railway 1GB service can't afford OpenAI quota; user wanted a free, self-hosted alternative with a clean swap layer.

**How to apply:**
- Wire-in point: `Distribution/Coordinator/actions/aiGateway.js` — early-exit before `classify()` when `process.env.AI_PROVIDER === 'local'`, calls `AI/aiService.js`'s `answer()`.
- Model swap: change only `AI/model.js` or set `AI_LOCAL_MODEL=<HuggingFace model ID>`. Any chat-template instruct model works.
- Pre-warm: `RepositoryEngine.initialize()` detects `config.aiProvider === 'local'` and calls `aiService.initialize()` instead of Qdrant/indexer. Model loads in background so bot comes online fast.
- Doc search: lexical (no embeddings) over `docs/` tree. Only Umacraft/Umamusume topics pass the guard.
- Cache: `AI/cache.js` (separate from cloud `AI/Cache.js`) — SHA-256 key, LRU 200 entries, 1hr TTL.

**Model cache on Railway:** set `HF_HOME=/data/.cache/huggingface` with a persistent volume so model doesn't re-download on every redeploy.

**Memory (SmolLM2-360M q4):** Node+Discord ~150MB + model ~200MB + Puppeteer peak ~100MB = ~450MB. Safe within 1GB.
