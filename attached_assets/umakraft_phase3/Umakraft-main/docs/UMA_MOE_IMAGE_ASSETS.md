# uma.moe — Image & Icon Asset Reference

Compiled from live API probing and JS bundle analysis on 2026-07-20.
Everything here was verified against the real uma.moe endpoints with the bot's API key.

---

## 1. How uma.moe Serves Images

uma.moe is an **Angular SPA** with two completely separate auth systems:

| System | Base URL | Auth | What it serves |
|---|---|---|---|
| **JSON API** | `https://uma.moe/api/` | `X-API-Key` header | Fan data, circles, trainer profiles — **no images** |
| **Image CDN** | `https://uma.moe/resources/` | Cloudflare Turnstile (browser proof) | All image assets (characters, skills, support cards, etc.) |

These are **not the same auth system**. The `UMA_MOE_API_KEY` works for `/api/*` only.

---

## 2. The Cloudflare Turnstile Block

When a server (Node.js `fetch`) hits `/resources/`:

```http
GET https://uma.moe/resources/chara_stand_100101.webp
→ 403 application/json

{
  "error": "browser_proof_required",
  "status": 403,
  "message": "This endpoint requires a browser proof. Browser clients should wait for the Turnstile/browse..."
}
```

When a browser hits the same URL:
1. Cloudflare Turnstile JS challenge runs invisibly
2. Browser gets a `cf_clearance` proof token (cookie)
3. Same request → **200 image/webp** ✅

**This is why you can download icons manually but the bot cannot.**
The API key bypasses Turnstile on `/api/*` routes but does **not** grant access to `/resources/*`.

### Confirmed test results (live, 2026-07-20)

```
No auth:    403 {"error":"browser_proof_required"}
X-API-Key:  404 (bypasses Turnstile, but path format unclear)
Bearer:     403 {"error":"browser_proof_required"}
Cookie sim: 404 (no cf_clearance obtained — homepage sets no cookie server-side)
```

`/static/*` and `/img/*` paths returned `200 text/html` — **false positives**, that is the Angular SPA catch-all returning its own index page for all unknown routes. Not real images.

---

## 3. What the JSON API Actually Returns (No Images)

### `/api/v4/circles?circle_id={id}` — Circle endpoint

```json
{
  "club_rank": 5,              ← NUMBER only. No icon URL.
  "fans_to_next_tier": 12345,
  "fans_to_lower_tier": 6789,
  "circle": {
    "circle_id": 974470619,
    "name": "UmaKraft",
    "monthly_rank": 688,       ← NUMBER only.
    "monthly_point": 473365294,
    "last_month_rank": 595,
    "live_rank": 688
    // ... all text/numeric, zero image fields
  },
  "members": [
    {
      "viewer_id": 145447762932,
      "trainer_name": "Zidaneblueris",
      "daily_fans": [99234948, 99474675, ...]
      // no image fields
    }
  ]
}
```

### `/api/v4/user/profile/{viewer_id}` — Trainer profile

```
trainer.account_id              string
trainer.name                    string
trainer.leader_chara_dress_id   number  ← 6-digit dress ID, e.g. 100101
trainer.team_class              number  ← stadium rank tier (1–9)
trainer.team_evaluation_point   number
trainer.rank_score              number
trainer.best_team_class         number
trainer.follower_num            number
trainer.trophy_num_info         { g1, g2, g3, ex }
trainer.release_num_info        { act_num, card_num, chara_event_num, ... }

inheritance.main_parent_id      number  ← 6-digit dress ID
inheritance.parent_left_id      number
inheritance.parent_right_id     number
inheritance.parent_rank         number
inheritance.parent_rarity       number
inheritance.blue/pink/green/white_sparks  arrays of numbers
inheritance.blue/pink/green/white_stars   numbers

support_card.support_card_id    number  ← e.g. 20027
support_card.limit_break_count  number
support_card.experience         number

team_stadium[].trained_chara_id number  ← character ID per horse
team_stadium[].card_id          number
team_stadium[].speed/power/stamina/wiz/guts  numbers
team_stadium[].skills           array of numbers

circle.monthly_rank             number
circle.live_rank                number
```

**Zero image URLs anywhere in the entire profile response.**

---

## 4. Image Asset Filename Patterns (from JS bundle analysis)

The filenames below were extracted from uma.moe's compiled Angular JS chunks.
They exist at `https://uma.moe/resources/{filename}` — but require browser Turnstile proof to access.

### Character standing illustrations
```
chara_stand_{dress_id}.webp

Examples:
  chara_stand_100101.webp   ← Special Week (dress 1)
  chara_stand_100201.webp   ← Silence Suzuka (dress 1)
  chara_stand_104003.webp   ← Gold City
  chara_stand_113301.webp   ← Chrono Genesis
  chara_stand_108602.webp   ← Mejiro Ramonu
  chara_stand_111002.webp   ← Cesario

dress_id format: 6-digit number (e.g. 100101)
char_id = Math.floor(dress_id / 100)   → e.g. 100101 / 100 = 1001
```

### Support card full art
```
tex_support_card_{dress_id}.webp

Examples:
  tex_support_card_100101.webp
  tex_support_card_104003.webp
  tex_support_card_113301.webp
```

### Skill icons
```
utx_ico_skill_{skill_id}.webp

Examples:
  utx_ico_skill_10011.webp
  utx_ico_skill_10012.webp
  utx_ico_skill_20021.webp
  utx_ico_skill_1010011.webp

skill_id comes from inheritance spark arrays in the profile response.
```

### Club rank badges / circle rank icons
**Not found in any JS bundle.** `club_rank` from the API is a plain number (1–N).
No filename pattern was discovered for rank badge images.
Likely bundled inline in the Angular app or derived from CSS class names only.

---

## 5. Dress ID → Character Mapping

The `leader_chara_dress_id` in the profile response encodes both character and costume:

```
dress_id = CCCCCC  (6 digits)
char_id  = Math.floor(dress_id / 100)    → 4-digit character ID
costume  = dress_id % 100                → costume variant (01, 02, 03...)

Example: leader_chara_dress_id = 104003
  char_id = 1040  → Satono Diamond
  costume = 3     → costume variant 3
```

The bot's `utils/characterData.js` already handles this:
- `getCharByDressId(dressId)` → `{ en_name, jp_name, slug }`
- `charName(dressId)` → English name string
- `charIconUrl(charId)` → Gametora portrait URL (see note below)

---

## 6. Current Bot Icon Sources (what works today)

### Character portraits — Gametora
```js
// utils/characterData.js → charIconUrl(charId)
`https://gametora.com/images/umamusume/characters/${slug}.webp`
```

⚠️ **Status: UNVERIFIED as of 2026-07-20**
Live probe of `https://gametora.com/images/umamusume/characters/special-week.webp` returned **404**.
The URL slug format may have changed. Needs re-testing against a real character slug from `characters.json`.

### Club rank badges — NO CURRENT SOURCE
`club_rank` is fetched and stored as a number (in `umaCache.js`: `clubRank: payload.club_rank`).
No icon is currently fetched or displayed for it. Needs a source.

### Support card icons — NOT IMPLEMENTED
`support_card_id` is stored but no icon is fetched.

---

## 7. Options for Getting Icons in the Bot

### Option A — Bundle locally (recommended, no dependencies)
Download icons once via browser (bypasses Turnstile automatically), commit to `assets/` in the repo.

```
assets/
  characters/
    chara_stand_100101.webp
    chara_stand_100201.webp
    ...
  club_rank/
    rank_1.png
    rank_2.png
    ...
  support_cards/
    20027.webp
    ...
  skills/
    utx_ico_skill_10011.webp
    ...
```

Pros: Zero runtime dependency, no CDN failures, no auth issues.
Cons: Manual update when new characters/costumes release.

### Option B — Playwright headless browser
Run a real headless Chromium browser inside the bot. Playwright solves Turnstile automatically, then downloads images.

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://uma.moe/'); // triggers Turnstile
const cookies = await page.context().cookies();
// now fetch /resources/* with those cookies
```

Pros: Fully automated, always fresh.
Cons: +~300MB Chromium binary, significant memory overhead on Replit.

### Option C — Ask uma.moe to extend API key scope
Contact uma.moe dev to request that `X-API-Key` be honoured on `/resources/*` image routes.
The key already bypasses Turnstile on `/api/*` — this would be a natural extension.

Current test: `X-API-Key` on `/resources/chara_stand_100101.webp` → **404** (Turnstile bypassed, but file not found at that path or access denied differently).

### Option D — Gametora CDN (verify first)
Gametora hosts Uma Musume character assets. URL pattern:
```
https://gametora.com/images/umamusume/characters/{slug}.webp
```
Needs verification that the current slug format matches `characters.json` slugs.
No API key required — public CDN.

---

## 8. What the Bot Can and Cannot Fetch via API Key Today

| Asset | API field | Bot can fetch? | Notes |
|---|---|---|---|
| Fan data (daily, monthly) | `daily_fans[]` | ✅ Yes | Core feature, works |
| Circle rank (number) | `club_rank` | ✅ Yes | Number only, no badge |
| Trainer name | `trainer.name` | ✅ Yes | — |
| Leader character ID | `trainer.leader_chara_dress_id` | ✅ Yes | ID only |
| Stadium horses | `team_stadium[]` | ✅ Yes | IDs only |
| Support card ID | `support_card.support_card_id` | ✅ Yes | ID only |
| Character portrait image | `chara_stand_{id}.webp` | ❌ No | Turnstile blocks server-side |
| Club rank badge image | (not in API at all) | ❌ No | No source found in API |
| Support card art | `tex_support_card_{id}.webp` | ❌ No | Turnstile blocks server-side |
| Skill icons | `utx_ico_skill_{id}.webp` | ❌ No | Turnstile blocks server-side |

---

## 9. Key Files in This Bot Related to Icons/Characters

| File | Role |
|---|---|
| `utils/characterData.js` | dress_id → name/slug; `charIconUrl()` builds Gametora URL |
| `umamoe/umaClient.js` | Normalises profile response; extracts `leader_chara_dress_id` |
| `umamoe/umaCache.js` | Stores `clubRank` as a number from `payload.club_rank` |
| `tasks/updateGameData.js` | Refreshes `characters.json` from Gametora every 24h |
| `data/characters/characters.json` | Local char_id → `{ en_name, jp_name, slug }` map |
| `Workshop/Fabricator/reports/profile.js` | Renders profile cards (currently uses IDs, not images) |

---

## 10. Raw Test Evidence (2026-07-20)

```
# Without any auth
GET https://uma.moe/resources/chara_stand_100101.webp
→ 403 application/json  {"error":"browser_proof_required",...}

# With X-API-Key header
GET https://uma.moe/resources/chara_stand_100101.webp
→ 404 (Turnstile bypassed, but file not found at path)

# With Bearer token
GET https://uma.moe/resources/chara_stand_100101.webp
→ 403 application/json  {"error":"browser_proof_required",...}

# /api/* routes (JSON data) — API key works correctly
GET https://uma.moe/api/v4/circles?circle_id=974470619  + X-API-Key
→ 200 application/json  { circle: {...}, members: [...], club_rank: 5 }

GET https://uma.moe/api/v4/user/profile/145447762932  + X-API-Key
→ 200 application/json  { trainer: {...}, inheritance: {...}, support_card: {...}, ... }
```

---

*Last updated: 2026-07-20. Re-run probes when uma.moe updates its frontend (bundle filenames will change).*
