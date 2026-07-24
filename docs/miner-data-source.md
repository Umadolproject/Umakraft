# Miner Data Source Strategy

## Primary Source

The miner MUST use the circle endpoint as its first source.

**Primary URL**

```
https://uma.moe/circles/974470619
```

This endpoint should be treated as the source of truth.

---

## Priority Order

1. Circle Page
2. Missing Field Detection
3. Secondary APIs
4. Merge Results
5. Store

Never call secondary endpoints unless required.

---

## Data Expected From Circle

The miner should attempt to extract:

- Circle metadata
- Posts
- Comments
- Images
- Videos
- User references
- Tags
- Time stamps
- Attachments
- Statistics
- Pagination
- Relationships

If present here, **DO NOT** request another endpoint.

---

## Missing Data Policy

Only request another endpoint if:

- author profile missing
- reactions missing
- attachment metadata missing
- pagination token missing
- media information incomplete

Otherwise use only the circle response.

---

## Fetch Flow

```
Start

↓

GET Circle

↓

Parse JSON/HTML

↓

Normalize

↓

Validate

↓

Missing Fields?

No  →  Save

Yes →  Fetch Required Endpoint Only

       ↓

       Merge

       ↓

       Save
```

---

## Miner Responsibilities

`miner.js` should:

- Fetch circle
- Parse
- Normalize
- Detect missing data
- Fetch only required fallback endpoints
- Cache responses
- Store final unified object

---

## Architecture

```
miner.js

↓

CircleFetcher

↓

Parser

↓

Normalizer

↓

Validator

↓

Fallback Manager

↓

Database
```

---

## Recommended Modules

```
src/miner/

miner.js

fetchers/
    circleFetcher.js
    fallbackFetcher.js

parsers/
    circleParser.js

normalizers/
    normalizeCircle.js

validators/
    missingFields.js

cache/
    cache.js

storage/
    saveCircle.js
```

---

## Pseudocode

```
fetchCircle()

↓

parse()

↓

normalize()

↓

if (missingData) {

    fetchFallback()

    merge()

}

save()

Done
```

---

## Benefits

- One primary request
- Lower bandwidth
- Lower rate limit usage
- Easier maintenance
- Faster synchronization
- Simpler parser
- Single source of truth whenever possible

---

## Future Expansion

Additional endpoints should only exist as optional providers.

Priority:

```
Circle
    ↓
Profile
    ↓
Media
    ↓
Comments
    ↓
Statistics
```

Never reverse this order.
