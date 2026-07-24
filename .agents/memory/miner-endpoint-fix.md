---
name: Miner endpoint fix
description: The correct uma.moe API endpoints and the circle-first pipeline strategy
---

# Miner Endpoint Fix

## The rule
`/api/trainers/{id}` does not exist on uma.moe — it returns 404.
The correct individual trainer endpoint is `/api/v4/user/profile/{id}`.
In `umamoe/Miner/config.js`, `ENDPOINTS.trainer = '/v4/user/profile/{id}'` (paths are relative to baseUrl which already includes `/api`).

**Why:** Confirmed via live probe in `docs/UMA_MOE_IMAGE_ASSETS.md` (2026-07-20). The old endpoint was never valid.

**How to apply:** Any time `fetchTrainer` is called, it now hits the correct path. The profile response is nested `{ trainer: {...}, inheritance, support_card, team_stadium }` — `normalizeProfileResponse()` in `miner.js` flattens it to `{ id, name, fans:0, rank, ... }`. `fans` is a placeholder; real fan values come from circle enrichment.

## baseUrl convention
`API_CONFIG.baseUrl` includes `/api` (default: `https://uma.moe/api`).
`ENDPOINTS` paths must NOT include `/api/` — they are relative to baseUrl.
Mixing these causes double-prefix URLs like `https://uma.moe/api/api/v4/circles`.

## Circle-first pipeline
`processTrainer` in `umamoe/pipeline.js` now:
1. Fetches circle FIRST (`/v4/circles?circle_id=…`)
2. Extracts trainer from circle members (id, name, fans from daily_fans)
3. Only fetches profile if required fields (id/name/fans/rank) are missing
4. Merges: circle wins for fan values; profile fills rank + extended fields
5. `mergeCircleMemberGains` also sets absolute `fans` from `daily_fans[-1]`

## Railway persistence (links)
SQLite at `/data/umakraft.sqlite`. Without a Railway Volume at `/data`, data is wiped on redeploy.
Fix: Railway dashboard → service → Storage → Add Volume → Mount Path `/data`.
`UMAKRAFT_SQLITE_PATH` env var is now explicitly set in `railway.toml` comments.
