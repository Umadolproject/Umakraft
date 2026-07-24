# uma.moe — Uma Circle Bot

> Master Knowledge Base (Single Source of Truth)

Last Updated: 2026-07-08

---

# Overview

## Project Name
Uma Circle Bot (internal name: `uma-circle-bot`, bot account: `UmadolProject#4037`)

## Description
A Discord bot that manages the "UmaKraft" Uma Musume circles on **uma.moe**. It scrapes/syncs circle fan data from uma.moe, tracks each trainer's fan gains individually, posts leaderboards, fires per-trainer fan-count milestones, sends per-trainer daily goal warnings, tracks attendance/onboarding, and archives circle activity — all backed by local SQLite, running as a single always-on Discord bot process.

## Goals

- Maintain one source of truth for how the bot's systems fit together
- Document every scheduled task, command, and database
- Track known issues and outstanding TODOs
- Preserve project history and design decisions (e.g. why per-trainer, not per-circle)
- Simplify onboarding for anyone (human or agent) picking this repo up cold
- Prevent information loss across sessions

---

# Table of Contents

- Overview
- Vision
- Roadmap
- Architecture
- Features
- Tech Stack
- Repository Structure (Directory Tree)
- Development
- Deployment
- Database
- Slash Commands
- Frontend
- Backend
- Authentication
- Configuration
- Environment Variables
- Design System
- Assets
- Documentation
- Decisions
- Research
- Bugs / Known Issues
- TODO
- Ideas
- Changelog
- References
- Notes

---

# Vision

Give circle officers and members a zero-maintenance Discord companion that removes the manual spreadsheet/screenshot work of tracking fan gains on uma.moe: automatic hourly sync, automatic leaderboards, automatic milestone/warning notifications per trainer, and self-service linking between a Discord account and a uma.moe trainer ID. Long-term, scale from 2 hardcoded circles to a DB-backed registry supporting up to 10 circles without code changes per circle.

---

# Roadmap

## Planned

- [ ] Circle Expansion: SQLite-backed circle registry supporting up to 10 circles (see "Circle Expansion Roadmap" in `replitprojectnotes.md`) — 5 phases: Registry → Commands → Tasks → Storage → Observability. **Not started**, requires explicit user permission per phase.

- [ ] Decide on a long-term fix for the OpenAI key Fernet/Gist decryption failure (image classification currently disabled)

## In Progress

- Per-trainer notification correctness pass: achievement and warning tasks were both migrated from circle-summed triggers to per-trainer triggers (see Changelog / Decisions).

## Completed

- 2 circles (UmaKraft `974470619`, UmaKraft 2 `325938032`) fully operational
- Hourly/30-min uma.moe data sync → SQLite
- Per-trainer daily achievement milestones (10M–100M tiers, with 60M/80M/100M gated to top-3-per-circle-per-month)
- Per-trainer daily fan warning (below 1,000,000 goal) with escaped, mention-safe rendering
- Leaderboards (daily/weekly/monthly), attendance tracking, onboarding flow, image archiving, SQLite backups
- Automatic, zero-manual-secret Discord token loading (Fernet-encrypted, committed to repo)

---

# Architecture

```
uma.moe (external site)
      │  API
      ▼
STAGE 1 — Umamoe: Miner → Courier → Inspector → Vault
      │  Trusted Pipeline Record
      ▼
STAGE 2 — Refinery: Refiner → Compiler → Depot
      │  Compiled Product
      ├──────────────────────────────────────────────┐
      ▼                                              ▼
STAGE 3/4 — Workshop → Distribution         STAGE 5 — Broadcast
(command path)                              (notification path)
      │                                              │
      └──────────────────────┬───────────────────────┘
                             ▼
      Discord (channel posts, DMs, embeds, PNG image cards)
```

Two independent image pipelines exist and are never combined (see Design System / Image System below):
1. **Rendering** (Playwright/Chromium) — deterministic PNG cards for leaderboards, fan gains, warnings.
2. **Analysis** (GPT-4o Vision) — reads user-uploaded screenshots to extract trainer ID/name/rank.

---

# Features

## Data Sync
Status: ✅ Active
Notes: Polls uma.moe for circle member stats, computes each member's daily/weekly/monthly fan gain, and writes to the store database. Runs every 30 minutes (see cron table below). Join-day members (mid-month joiners with no prior baseline) have their carry-over fan count zeroed out so it doesn't inflate `todayGain`.

## Leaderboards
Status: ✅ Active
Notes: `/leaderboard` (on-demand) and scheduled daily/weekly/monthly auto-posts render circle-wide top rankings as PNG image cards via Pipeline 1.

## Daily Achievement Milestones
Status: ✅ Active — fixed to be per-trainer
Notes: Checks **each individual trainer's own** daily fan gain against tier thresholds (1M–10M, standard) independently — not a circle-wide sum. Dedup key is scoped `circle+trainer+tier+day`. Channel posts name/ping only that trainer (`allowedMentions` restricted); DM sent only if linked. Larger milestone tiers (10M/20M/30M/40M standard, 60M/80M/100M top-3-gated) are handled by separate milestone tasks.

## Daily Fan Warning
Status: ✅ Active — fixed to be per-trainer
Notes: Fires once per trainer per JST day if that trainer's own `todayGain` ends below the 1,000,000 fan goal. Uses 50 flavor-text variants (5 tones × 10), a personalised PNG card with HTML-escaped trainer/circle names, a channel post naming/pinging just that trainer, and an individual DM with one retry on transient failure.

## Warning Engine (pace/quota warnings)
Status: ✅ Active — already correct, reference implementation
Notes: Runs every 30 minutes and independently escalates each trainer's own pace/quota deficit through levels (reminder → warning → critical → final), with per-trainer anti-spam gating.

## Attendance Tracking
Status: ✅ Active
Notes: Daily 6AM JST check that reports who has/hasn't logged into Discord, tracked in the attendance database.

## Onboarding
Status: ✅ Active
Notes: Welcomes new members and starts onboarding; DMs members who haven't submitted a trainer card yet; tracked in the onboarding database.

## Account Linking
Status: ✅ Active
Notes: `/link`, `/unlink`, `/link_list`, `/store` map a Discord user ID to a uma.moe trainer (viewer) ID, stored in `linksDb`. Linking gates which notifications a trainer receives as a DM (channel posts still fire regardless of linking).

## Image Archiving
Status: ✅ Active
Notes: Preserves media from configured channels; cursors/hashes tracked in the image archive database to avoid re-processing.

## Database Backups
Status: ✅ Active
Notes: Runs a daily rotation of SQLite backups (03:30 JST).

## Timeline / News Feed
Status: ✅ Active
Notes: Playwright scrapes uma.moe/timeline on a schedule; posts are dedup-tracked per guild. Configured per-guild via `/timeline_setup`, manually triggerable via `/timeline_post`.

---

# Tech Stack

## Bot Framework
- Discord gateway client — slash commands, embeds, DMs
- Cron scheduler — all scheduled tasks, timezone-pinned to `Asia/Tokyo`

## Data Fetching / Scraping
- HTTP + HTML parsing for uma.moe stats
- Headless Chromium (Playwright) — timeline scraping, trainer profile screenshots, and PNG image-card rendering

## AI
- GPT-4o Vision — used only for Pipeline 2 (screenshot → trainer ID/name/rank extraction), never for Pipeline 1 rendering

## Database
- SQLite — the only persistence layer. No Postgres, Firebase, or other external DB is used or should be suggested.

## Hosting
- **Primary:** Replit (health check: `GET /health` on port 8080)
- **Secondary:** Railway (volume-mounted `/data`)

## CDN / Storage
- None — all image output is generated on-demand and sent directly as Discord attachments; no object storage or CDN is used. Local `milestone_images/` and `attached_assets/` hold static image pools committed to the repo.

---

# Repository Structure

```
UmaKraft/
├── GOVERNANCE/                  ← Constitutional authority (read first)
│   ├── ARCHITECTURE_AUTHORITY.md
│   ├── PIPELINE_REGISTRY.md
│   ├── PIPELINE_OPERATIONS.md
│   ├── PIPELINE_EVOLUTION.md
│   └── ARCHITECTURE_DECISIONS.md
│
├── umamoe/                      ← Stage 1: Extract, Transport, Validate & Store
│   ├── Miner/                   — HTTP extraction dept
│   ├── Courier/                 — Transport dept
│   ├── Inspector/               — Validation dept
│   └── Vault/                   — Trusted storage dept
│
├── Refinery/                    ← Stage 2: Transform & Compile
│   ├── Refiner/                 — Business logic & derived values
│   ├── Compiler/                — Product assembly
│   └── Depot/                   — Compiled product persistence
│
├── Workshop/                    ← Stage 3: Deliverable Manufacturing
│   ├── Draftsman/Blueprint/     — Deliverable specs (15 blueprints)
│   ├── Fabricator/              — Rendering dept
│   ├── Validator/               — Output validation dept
│   └── Terminal/                — Immutable staging area
│
├── Distribution/                ← Stage 4: Command Response Routing
│
├── Broadcast/                   ← Stage 5: Notification Pipeline
│   ├── Broker/                  — Cron/threshold trigger
│   ├── archive-inspector/       — Eligibility & dedup
│   ├── Archive/                 — Notification state storage
│   ├── archive_transporter/     — Record handoff
│   └── Announcer/               — Discord delivery
│
├── INFRASTRUCTURE/              ← Cross-cutting support layer
├── Operation/                   ← Health supervision
├── docs/                        ← Project documentation
├── milestone_images/            ← Static image pool for milestone cards
└── attached_assets/             ← Uploaded files and image pools
```

---

# Development

## Startup Sequence

1. Token loading (Fernet decrypt chain from committed encrypted secrets)
2. All databases initialized
3. Discord client created, event handlers registered
4. Health server started (port 8080)
5. Bot logs in → ready event → slash commands registered → scheduled tasks started

---

# Deployment

## Replit (primary)
- Health check: `GET /health` on port 8080
- Token loaded automatically — no manual secret entry needed on a fresh import

## Railway (secondary)
- Requires `DISCORD_TOKEN` or `DISCORD_BOT_TOKEN` set manually as an env var
- Requires a Volume mounted at `/data` with `DATA_DIR=/data` for database persistence
- Health check: `GET /health` on port 8080

---

# Database

All persistence is SQLite via `better-sqlite3`. **No external database (Postgres, Firebase, etc.) should ever be introduced** — this is an explicit, non-negotiable project rule (see `replit.md`).

## Files (under `DATA_DIR`, default `./data/`)

| File | Domain |
|---|---|
| Members & State | Members, daily gains, guild configs, bot state |
| Links | Discord user ID ↔ uma.moe trainer (viewer) ID |
| Circles | Circle registry / config |
| Trainers | Trainer profiles + skills |
| Milestones | Fired milestone send-state (exactly-once delivery) |
| Achievements | Per-trainer daily achievement tier dedup |
| Warnings | Fan-deficit warning dedup + officer summaries |
| Onboarding | Onboarding / trainer-card submission tracking |
| Attendance | Daily logins + streaks |
| Image Archive | Media archiver cursors/hashes |
| Leaderboard Snapshots | Leaderboard snapshots |
| Profile Sync | Profile sync state |
| Historical Cache | Historical fan data cache |
| Timeline Cache | News feed dedup/tracking |
| `the migration runner` | Shared minimalist migration runner |

Schemas are defined inline per module (no separate ORM).

---

# Slash Commands

| Command | Purpose |
|---|---|
| `/fan_gain` | Personal gain card image (Daily/Weekly/Monthly + rank) |
| `/leaderboard` | Circle-wide top rankings image |
| `/link` | Connect Discord account to a uma.moe trainer ID |
| `/unlink` | Disconnect a linked trainer ID |
| `/link_list` | List current account links |
| `/store` | Manually save a trainer ID (restricted to #uma-store) |
| `/search_trainer` | Query the trainer database with filters |
| `/set_fans` | Set/override a fan count |
| `/set_timezone` | Set a user's timezone |
| `/admin_setjoindate` | Admin: set a member's join date |
| `/admin_sync` | Admin: manually trigger data sync |
| `/admin_syncCards` | Admin: manually resync game support-card data |
| `/circle_master` | Leader-only circle administration tools |
| `/circle_status` | Circle-wide status overview |
| `/timeline_setup` | Configure the timeline/news-feed channel |
| `/timeline_post` | Manually trigger a timeline post |
| `/warningsettings` | Configure warning behavior |
| `/memberlist` | List circle members |
| `/profile` | View a trainer profile |
| `/joindate` | View/set a member's join date |
| `/keep` | Utility/admin command |
| `/help` | Interactive command guide |
| `/intercircleleaderboard` | Cross-circle leaderboard comparison |
| `/total_circlefan_gain` | Total circle fan gain summary |
| `/total_fan` | Total fan count lookup |
| `/test_milestone` | Admin: test-fire a milestone notification |

Registration runs on boot. If `GUILD_ID` is set, registration is guild-scoped (instant); otherwise global (up to ~1 hour to propagate).

---

# Frontend

None. This is a backend-only Discord bot; all UI is Discord-native (slash commands, embeds, PNG image attachments, DMs). There is no web frontend for the bot itself. (The `artifacts/mockup-sandbox` workflow present in this workspace is an unrelated design-preview tool, not part of the bot's product.)

---

# Backend

## Services
- uma.moe data-fetching + snapshot caching layer
- Per-member stat computation (gains, join-day carry-over handling)
- Persistence facade over member + link databases
- HTTP health server

## Controllers (command/event routing)
- Slash command + autocomplete routing
- Message creation, member join, presence update, ready event handlers

## Middleware / cross-cutting
- `safeRun()`, `withRetry()` — error handling utilities
- Global lock to prevent message collisions during bulk operations
- Channel permission checks

---

# Authentication

Method: Discord bot token (gateway auth), no user-facing login system.

Session: N/A — Discord manages user identity; the bot only maps Discord user IDs to uma.moe trainer IDs via `/link`.

JWT: Not used.

OAuth: Not used by the bot itself (Discord's own bot-token auth model is used, not an OAuth2 user flow).

Permissions: Discord role/permission checks gate admin-only commands (e.g. `/circle_master`, `/admin_sync`) via per-command guild permission checks.

---

# Configuration

## Environment Variables

Set in `.replit` `[userenv.shared]` on Replit — **no manual entry needed on a fresh import**:

| Variable | Example / Default | Purpose |
|---|---|---|
| `CIRCLE_ID` | `974470619` | Primary circle (UmaKraft) |
| `CIRCLE_2_ID` | `325938032` | Secondary circle (UmaKraft 2) |
| `CIRCLE_2_NAME` | `UmaKraft 2` | Secondary circle display name |
| `DATA_DIR` | `./data` (Replit) / `/data` (Railway) | SQLite database directory |
| `TIMEZONE` | `Asia/Tokyo` | All cron scheduling |
| `LOG_LEVEL` | `info` | Log verbosity (`debug`\|`info`\|`warn`\|`error`) |
| `DISCORD_CLIENT_ID` | app ID | Discord application ID |
| `GUILD_ID` | guild ID | Target guild for (instant) command registration |
| `ANNOUNCEMENT_CHANNEL` | `announcement` | Override auto-created announcement channel name |
| `RESULTS_CHANNEL` | `result-contribution` | Override auto-created results channel name |
| `DISCORD_TOKEN` / `DISCORD_BOT_TOKEN` | — | **Never set manually** — loaded automatically via the Fernet decrypt chain. If already present in env, the chain skips itself. |

`SESSION_SECRET` is also available as a Replit secret in this environment but is not currently wired into any code path found in this repo.

```env
# .env.example (local/manual override reference — not needed on Replit)
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-application-id-here
CIRCLE_ID=974470619
GUILD_ID=
ANNOUNCEMENT_CHANNEL=announcement
RESULTS_CHANNEL=result-contribution
DATA_DIR=./data
TIMEZONE=Asia/Tokyo
LOG_LEVEL=info
```

## Token Loading Chain (zero-setup)

```
secrets/token_enc.key  (committed — Fernet key)
      +
secrets/token.enc      (committed — Fernet-encrypted Discord token)
      ↓ Fernet decrypt
DISCORD_TOKEN → injected into process.env
      ↓
Bot starts
```

Security model: the Fernet key alone is useless without `token.enc`, and vice versa — both files must be compromised together to expose the real token.

An OpenAI key is also fetched via a Gist + Fernet decryption step at boot for Pipeline 2 (image classification).

---

# Design System

## Image System (the closest thing to a "design system" here)
Two deliberately separate pipelines — **never merge them**:

| | Pipeline 1 — Rendering (active) | Pipeline 2 — Analysis (active) |
|---|---|---|
| Engine | Playwright/Chromium, HTML/CSS templates | GPT-4o Vision (OpenAI) |
| Input | Structured game/circle data | User-uploaded screenshot URL |
| Output | PNG attachment | JSON: `screen_type`, `trainer_id`, `trainer_name`, `rank`, `confidence` |
| Engine | Headless Chromium (Playwright), HTML/CSS templates | GPT-4o Vision (OpenAI) |
| Nature | Deterministic | Probabilistic |

Per-feature card templates each render a personalised image card, with trainer/circle names HTML-escaped before interpolation.

## Milestone Tiers

| Tier | Type | Gate | Content |
|---|---|---|---|
| 10M / 20M / 30M / 40M | Standard | All qualifying members | 7 random message variants each |
| 60M | Special | Top 3 per circle per month | 1 message + dedicated image |
| 80M | Special | Top 3 per circle per month | 1 message + image (FalcoA pool) |
| 100M | Special | Top 3 per circle per month | 1 message + image (FalcoA pool) |

Both circles have independent 3-slot pools for special tiers (up to 6 recipients per tier per month); ties beyond 3 are resolved by random draw.

## Colors / Typography / Icons / Spacing
Not a web UI — visual styling is scoped to the HTML/CSS templates rendered into PNG cards under `utils/reports/`. No shared design-token system exists; each template defines its own inline styles.

---

# Assets

## Logos
None tracked separately — bot avatar is set directly on the Discord application.

## Images
- `milestone_images/` — dedicated milestone images (e.g. `Lovely_SmartFalcon` for the 60M tier)
- `attached_assets/` — additional milestone image pools (Falco pool, FalcoA pool) plus ad-hoc uploaded files (gitignored)

## Fonts
Whatever is bundled with the headless Chromium renderer / system fonts — no custom font files tracked in-repo.

---

# Documentation

## Installation
```bash
git clone <private-repo-url>
```

## Setup
```bash
npm install
```
No manual secrets required on Replit (token chain is self-sufficient). For Railway, set `DISCORD_TOKEN`/`DISCORD_BOT_TOKEN` manually and mount a `/data` volume.

## Run
```bash
```

Existing project docs (not auto-loaded, kept for reference/history):
`README.md`, `replitprojectnotes.md`, `replitchangeslog.md`, `REPLITCODEINDEX.md`, `REPLITCLEANUPREPORT.md`, `RepositoryOverviewReport.md`, `pipeline.md`, `PastHistoryTrainer.md`, `PreviousClubmember.md`, `SupportStandardTimeSetup.md`, `Joindate.md`, `docs/AutomaticTask.md`.

`replit.md` is the **authoritative** doc for agent behavior in this repo: it defines a strict permission protocol (no code changes without the user saying "yes" / "granted" / "permission granted"), the SQLite-only rule, and the token-loading rules. This knowledge base file summarizes the same facts for reference but does not override `replit.md`.

---

# Decisions

## ADR-001 — Per-trainer, not per-circle, for time-boxed notifications
Decision: Achievement and warning tasks must evaluate and dedup **per individual trainer**, never as a circle-wide sum.
Reason: Summing the whole circle's daily gain caused false-positive/false-negative tier fires (e.g. a 10M circle-wide milestone firing for the whole circle when no single trainer had actually crossed it) and mismatched blame/ping lists (channel post said "circle" while only pinging some members). The warning engine was already correctly per-trainer and served as the reference pattern.
Date: 2026-07 (see Changelog).

## ADR-002 — Mention-injection safety for unlinked trainer names
Decision: Any raw trainer display name interpolated into a Discord message or HTML render template must be escaped (`@` → zero-width-joined, HTML entities escaped) and channel posts must set `allowedMentions` to only the specific linked Discord user, never left unrestricted.
Reason: Unlinked trainers' raw uma.moe display names are untrusted input and could otherwise trigger unintended `@everyone`/`@here`/role pings or break card HTML layout.
Date: 2026-07.

## ADR-003 — Two separate image pipelines, never merged
Decision: Deterministic rendering (Chromium/Playwright) and probabilistic analysis (GPT-4o Vision) must stay fully separate — no routing rendered output through OpenAI, no Chromium fallback inside the classifier.
Reason: Keeps rendering costs/latency predictable and analysis failures isolated; documented explicitly in `replit.md` as a hard rule.
Date: pre-existing (documented in `replit.md`).

## ADR-004 — SQLite only, no external database
Decision: All persistence uses `better-sqlite3`; never introduce Postgres, Firebase, or any other external DB.
Reason: Explicit user preference — simplicity, zero external infra dependency, easy daily backups.
Date: pre-existing (documented in `replit.md`).

---

# Research

## Topic: Circle expansion (2 → 10 circles)
Notes: Current hardcoded `CIRCLE_ID`/`CIRCLE_2_ID` env-var approach doesn't scale past 2 circles cleanly. Planned approach is a SQLite-backed circle registry rather than adding `CIRCLE_3_ID`, `CIRCLE_4_ID`, etc. Full plan lives in `replitprojectnotes.md` → "Circle Expansion Roadmap" section. Explicitly gated: each of the 5 phases requires separate user permission before any code is written.

---

# Bugs / Known Issues

| ID | Status | Description |
|----|--------|-------------|
| BUG-001 | Open | Two test suite files reference repository modules that do not exist on disk — causes 2 of the test suites to fail to load. All individual tests in the other suites still pass. |
| BUG-002 | Open (not in scope per user) | OpenAI key retrieval via Gist fails Fernet HMAC verification at boot ("wrong key or corrupted data") — image classification (Pipeline 2) is disabled as a result. Does not affect bot login or core features. |
| BUG-003 | Open | `Environmental_variables.md` contains a stray, apparently unrelated Supabase URL + anon key committed to the repo (`VITE_SUPABASE_*`) — looks like leftover content from a different project template, not used anywhere in this codebase. Worth removing or at minimum confirming it's not sensitive/live. |
| BUG-004 (resolved) | Fixed | the stats computation module previously counted a mid-month joiner's full carry-over fan count as `todayGain`, inflating circle-wide sums past milestone thresholds. Fixed by zeroing the delta on detected join days; covered by regression tests. |
| BUG-005 (resolved) | Fixed | the daily achievement task fired milestone tiers based on the circle-wide summed gain instead of each trainer's own gain. Rewritten to per-trainer checks with per-trainer dedup, hoisted guild/channel resolution, and `allowedMentions` safety. |
| BUG-006 (resolved) | Fixed | the daily fan warning task had the same circle-sum-vs-per-member-blame mismatch as BUG-005. Rewritten to per-trainer checks; wording rewritten from circle-centric ("we", "our circle") to trainer-centric ("you", "your"); trainer/circle names now HTML-escaped in the rendered card. |

---

# TODO

- [ ] Restore or reimplement two repository modules, or update the tests that reference them if they're intentionally deprecated
- [ ] Investigate/fix the OpenAI Gist key decryption failure blocking Pipeline 2 (image classification), if the user wants that feature restored
- [ ] Review and likely remove or scrub the stray Supabase credentials in `Environmental_variables.md`
- [ ] Decide whether to begin Phase 1 (Registry) of the circle expansion roadmap

---

# Ideas

- Feature ideas: per-trainer weekly/monthly recap DM summarizing all achievements/warnings for the period
- UI ideas: consolidate the many root-level historical `.md` notes files into `docs/` for a cleaner repo root
- Infrastructure ideas: circle registry table to unlock scaling past 2 circles without new env vars per circle

---

# Changelog

## Per-trainer notification fix (2026-07)

- Diagnosed and fixed a bug where the daily achievement task computed milestone tiers from the circle's total daily fan gain rather than each trainer's own gain, causing incorrect tier fires.
- Rewrote the daily achievement task to check each trainer independently, with per-trainer dedup keys, hoisted (once-per-circle) guild/channel resolution, and Discord mention-injection safety (`allowedMentions`, escaped fallback names).
- Found and fixed the same class of bug in the daily fan warning task: circle-summed trigger condition despite per-member blame filtering in the delivery step. Rewrote to fully per-trainer logic matching the already-correct warning engine pattern.
- Rewrote all 50 warning message variants + shared footer from circle-centric ("we", "our circle", "everyone") to trainer-centric ("you", "your") wording to match the new per-trainer semantics.
- Added HTML escaping for `trainerName`/`circleName` in the warning card renderer (the warning card template).
- Verified via `node --check`, full `npx vitest run` (113/113 tests passing), and a clean `Discord Bot` workflow restart after each change.

---

# References

Documentation:
- `replit.md` — authoritative repo behavior/rules doc
- `.env.example`, `Environmental_variables.md` — environment variable references

Repositories:
- This repo (private GitHub, owner-only access per `replit.md`)

Articles:
- uma.moe (external site this bot scrapes/tracks) — no public API docs available; behavior inferred from the uma.moe client module

Tools:
- Discord Developer Portal (bot application: client ID `1499028508007989288`, target guild `1489093959044173935`)
- Replit (primary host) / Railway (secondary host)

---

# Notes

This document is the canonical knowledge base for the Uma Circle Bot project, reflecting the actual repository as of 2026-07-08. `replit.md` remains the authoritative source for agent operating rules (permission protocol, hard rules around the token chain and SQLite-only persistence) — if anything here ever conflicts with `replit.md`, `replit.md` wins and this file should be updated to match.
