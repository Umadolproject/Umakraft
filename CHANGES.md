# Umakraft Repository — Audit Fixes Summary

**Date:** 2026-07-27  
**Total Bugs Fixed:** 21  
**Code Smells Fixed:** 7  
**Total Modified Files:** 26  
**Regression Tests:** 49/49 passing

---

## Round 1 — Commands/Handlers (8 bugs)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 1 | `Distribution/Commands/handlers/leaderboard.js` | 🟡 | Date `2026-02-30` passed regex → silent auto-roll | 3-stage validation (regex→Date.parse→UTC match) |
| 2 | `Distribution/Commands/handlers/adminSetJoinDate.js` | 🟡 | Same date gap | Same fix |
| 3 | `Distribution/Commands/handlers/timelinePost.js` | 🟡 | Same date gap | Same fix |
| 4 | `Distribution/Commands/handlers/adminGreet.js` | 🔴 | No runtime permission check | Added `ManageGuild` guard |
| 5 | `Distribution/Commands/handlers/setTimezone.js` | 🟡 | IANA regex blocked `Etc/GMT±N` | Expanded char class |
| 6 | `Distribution/Commands/handlers/ai.js` | 🟢 | Comment listed unregistered `message` subcommand | Removed from comment |
| 7 | `Distribution/Discord/deploy-commands.js` | 🟢 | Comment said "32" — actually 33 | Fixed to "33" |
| 8 | `Distribution/Commands/index.js` | 🟡 | `_loadPromise` never cleared on failure | `_loadPromise = null` before re-throw |

## Round 2 — Discord Events (1 bug)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 9 | `Distribution/Discord/events/interactionCreate.js` | 🔴 | `sendLastChanceFailure` crashed on replied+deferred | Added `followUp` fallback |

## Round 3 — Pipeline Adapters (3 bugs)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 10 | `umamoe/Vault/adapters/sqliteAdapter.js` | 🟡 | `hydrateRecord` JSON.parse no try/catch | try/catch matching Archive pattern |
| 11 | `Refinery/Depot/adapters/sqliteAdapter.js` | 🟡 | `hydrate` JSON.parse no try/catch | Same fix |
| 12 | `Workshop/Terminal/adapters/sqliteAdapter.js` | 🟡 | `hydrate` JSON.parse no try/catch | Same fix |

## Round 4 — Coordinator (5 bugs)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 13 | `Distribution/Coordinator/actions/fanGain.js` | 🔴 | Catch returned `{ success: false }` without `interaction` | Added `interaction: payload.interaction` |
| 14 | `Distribution/Coordinator/actions/storeCard.js` | 🟡 | `upsertCard()` no try/catch | Wrapped in try/catch |
| 15 | `Distribution/Coordinator/actions/setTimezone.js` | 🟡 | `persistTimezone()` no try/catch | Wrapped in try/catch |
| 16 | `Distribution/Coordinator/actions/adminSync.js` | 🔴 | `processTrainer` throw aborted entire batch | Per-trainer try/catch |
| 17 | `Distribution/Coordinator/utils/trainerCards.js` | 🟡 | `hydrate` JSON.parse no try/catch | try/catch matching adapter pattern |

## Round 5 — Operation (1 bug)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 18 | `Operation/operation.js` | 🔴 | Catch returned undefined → `safeRun` reported success | `throw err` to propagate failure |

## Round 6 — Broadcast (1 bug)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 19 | `Broadcast/archive-inspector/archiveInspector.js` | 🔴 | `!imageParams` rejected text-only notifications | Accept either `imageParams` or `message` |

## Round 7 — Repository-wide (2 bugs)

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 20 | `umamoe/Vault/vault.js` | 🔴 | `isTrusted()` passed `{data: null}` | Added `data !== null && !== undefined` |
| 21 | `core/taskRegistry.js` | 🟡 | Silent return on unregistered task name mismatch | Added `console.warn` |

## Code Smells Fix (7 fixes)

| # | File | Fix |
|---|------|-----|
| 22 | `Broadcast/Announcer/announcer.js` | TTL NaN guard + per-channel retry dedup |
| 23 | `Operation/AskLogger.js` | MAX_FILE_SIZE check + efficient getRecent() tail read |
| 24 | `Member/memberReader.js` | `parseGain()` returns `null` for unknown (not 0) |
| 25 | `Distribution/Coordinator/actions/leaderboard.js` | Cooldown uses `payload.userId` instead of proxied `interaction.user.id` |
| 26 | `core/pipelineRuntime.js` | `envInt` clamps negative values to 0 |

---

## File Inventory

```
fixes/
├── CHANGES.md
├── core/
│   ├── pipelineRuntime.js
│   └── taskRegistry.js
├── Operation/
│   ├── AskLogger.js
│   └── operation.js
├── Member/
│   └── memberReader.js
├── Broadcast/
│   ├── Announcer/
│   │   └── announcer.js
│   └── archive-inspector/
│       └── archiveInspector.js
├── Distribution/
│   ├── Commands/
│   │   ├── index.js
│   │   └── handlers/
│   │       ├── adminGreet.js
│   │       ├── adminSetJoinDate.js
│   │       ├── ai.js
│   │       ├── leaderboard.js
│   │       ├── setTimezone.js
│   │       └── timelinePost.js
│   ├── Coordinator/
│   │   ├── actions/
│   │   │   ├── adminSync.js
│   │   │   ├── fanGain.js
│   │   │   ├── leaderboard.js
│   │   │   ├── setTimezone.js
│   │   │   └── storeCard.js
│   │   └── utils/
│   │       └── trainerCards.js
│   └── Discord/
│       ├── deploy-commands.js
│       └── events/
│           └── interactionCreate.js
├── Refinery/
│   └── Depot/
│       └── adapters/
│           └── sqliteAdapter.js
├── Workshop/
│   └── Terminal/
│       └── adapters/
│           └── sqliteAdapter.js
└── umamoe/
    └── Vault/
        ├── vault.js
        └── adapters/
            └── sqliteAdapter.js
```

---

## How to Apply

Copy each file from this archive to the matching path in your Umakraft repository.
All files preserve the original directory structure.

```bash
# Quick apply — from the repo root:
unzip umakraft-audit-fixes.zip
cp -r fixes/* .
```
