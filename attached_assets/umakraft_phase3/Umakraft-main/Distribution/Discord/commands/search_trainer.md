# /search_trainer

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Search the trainer card database by name, rank, or skill count and browse paginated results.

---

## Permissions

None — available to all members.

> ⚠️ Reply is restricted to the designated trainer card channel (e.g. `#uma-results`). Using the command in any other channel returns an ephemeral error.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `trainer` | String | ❌ | Trainer name to search for — supports partial match |
| `rank` | Integer | ❌ | Filter results to a specific trainer rank |
| `whiteskills` | Integer (0–5) | ❌ | Filter by number of white skills on the trainer card |

At least one option must be provided.

---

## Output

Ephemeral image — visible only to the user who ran the command, with interactive pagination buttons to browse through results.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate at least one option present, validate whiteskills range)
  │
  ▼
Coordinator
  │
  └── Trainer card database (direct query — no Umamoe or Workshop)
        │
        ▼
Dispatcher (send ephemeral paginated result image)
```

> `/search_trainer` does not travel through Umamoe or Workshop. It queries the local trainer card database populated by `/store` and returns results directly.

---

## Behavior

- Reply is ephemeral — only visible to the user who ran the command.
- Reply is restricted to the designated trainer card channel. If used elsewhere, returns an ephemeral error.
- Returns paginated, interactive results — users navigate pages with Discord buttons.
- `trainer` performs a case-insensitive partial match on trainer name.
- `rank` filters to exact rank match.
- `whiteskills` filters to trainers with exactly that number of white skills on their stored card.
- Multiple options can be combined — all active filters are applied as AND conditions.
- Results show trainer name, rank, skill summary, and card stored date.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| No options provided | Ephemeral: "Please provide at least one search option: `trainer`, `rank`, or `whiteskills`." |
| `whiteskills` out of range (< 0 or > 5) | Ephemeral: "White skills must be between 0 and 5." |
| Command used in wrong channel | Ephemeral: "This command can only be used in #uma-results." |
| No results found | Ephemeral: "No trainer cards found matching your search." |
| Database query failure | Ephemeral: "Could not search the database right now. Please try again shortly." |

---

## Example

```
/search_trainer trainer:SmartFalcon
/search_trainer rank:1
/search_trainer whiteskills:3
/search_trainer trainer:Falcon whiteskills:2
```
