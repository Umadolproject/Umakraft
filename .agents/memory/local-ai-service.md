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

**Deployment constraint:** Transformers.js 4.2.0 defaults to a cache under its installed package, which is read-only when the Railway image runs as `node`. The model loader must assign `env.cacheDir` from `HF_HOME` (with a writable local fallback) and force filesystem caching.

**Why:** Railway startup otherwise logs `EACCES: permission denied, mkdir '/app/node_modules/@huggingface/transformers/.cache'` and the local model never becomes ready.

**Memory:** Railway defaults to SmolLM2-135M-Instruct q4 to reduce restart/OOM risk; use `AI_LOCAL_MODEL` to opt into a larger model when the deployment has enough memory.

**Why:** The 360M model reached `Model ready` but Railway repeatedly restarted the container afterward, with no application exception in the logs.
