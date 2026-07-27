# Railway Deploy Notes — v3 (Web Search + /browse + /search)

## What's New

| Feature | How to use |
|---|---|
| 🌐 **Web-first retrieval** | `AI_RETRIEVAL_MODE=web-first` (default) — AI answers from the web, falls back to local docs |
| `/browse <query>` | Public slash command — forces web-only search, skips local docs entirely |
| `/search <query>` | Same as `/browse` — explicit web search |
| 🔀 **Hybrid mode** | `AI_RETRIEVAL_MODE=hybrid` — searches web + local in parallel, merges results |
| @mentions online | `@UmaKraft` in #bot-chat now forces web search when API key is present |

## Env Vars — Add to Railway

### Required for web search (pick ONE):

```
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxx   # 1,000 free/mo → tavily.com
# OR
BRAVE_SEARCH_API_KEY=BSA-xxxxxxxxxx    # 2,000 free/mo → brave.com/search/api
# OR
SERPER_API_KEY=xxxxxxxxxxxxxxxx        # 2,500 free/mo → serper.dev
```

### Optional mode toggle:

```
AI_RETRIEVAL_MODE=web-first   # Default — web → local fallback
# AI_RETRIEVAL_MODE=hybrid    # Both in parallel, merged
# AI_RETRIEVAL_MODE=local-first  # Local → web fallback
# AI_RETRIEVAL_MODE=local-only   # No web search at all
```

If NO API key is set → auto-falls back to `local-only`. Everything still works from the knowledge base.

## Deploy Steps

1. **Add `TAVILY_API_KEY`** (or other provider) to Railway env vars
2. **Redeploy** on Railway
3. **Run deploy-commands**: `node Distribution/Discord/deploy-commands.js`
4. **Test**:
   - `/browse query: what are the best support cards for beginners`
   - `/search query: Oguri Cap character lore`
   - `@UmaKraft what skills should I use for Front Runner?`
   - `/status` → should show "🌐 Web Search: ✅ Configured"

## Test Locally Before Deploy

```bash
node test-web-search.js
```

This checks which providers are configured, simulates queries, and shows the routing for each command.

## Files Changed

| File | Change |
|---|---|
| `Commands/handlers/browse.js` | 🆕 `/browse` handler |
| `Commands/handlers/search.js` | 🆕 `/search` handler |
| `deploy-commands.js` | Registered `/browse`, `/search` (35 commands) |
| `aiGateway.js` | Browse/search → forces `retrievalOverride: web-only` |
| `aiService.js` | 4 retrieval modes + `web-only` override + improved fallbacks |
| `webSearch.js` | 🆕 Web search via Tavily → Brave → Serper → SerpAPI |
| `Configuration.js` | Added `aiRetrievalMode` config |
| `status.js` | Shows 🔍 Retrieval Mode + 🌐 Web Search status |
| `messageCreate.js` | @mentions force web search when API key available |
| `test-web-search.js` | 🆕 Standalone test script |

## Knowledge Base (unchanged)

8 guides in `AI/knowledge/`:
faq.md | characters.md | new-player-guide.md | skills-guide.md | trainees-guide.md | support-cards-guide.md | inheritance-guide.md | training-guide.md
