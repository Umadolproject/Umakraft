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

Search the trainer card database by name, rank, or skills and display matching results.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | String | ❌ | Trainer card name to search (partial match supported) |
| `rank` | Choices | ❌ | Filter by card rank (e.g. SSR, SR, R) |
| `skill` | String | ❌ | Filter by skill name (partial match supported) |

---

## Output

Image report — posted publicly in the channel.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input — at least one option required)
  │
  ▼
Coordinator
  │
  ├── Umamoe (query trainer card database / cardCache)
  │       │
  │       ▼
  │   Refinery (filter and rank results)
  │       │
  │       ▼
  │   Workshop / Draftsman (render search_trainer blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Requires at least one of `name`, `rank`, or `skill` to be provided.
- Searches the in-memory `cardCache` populated by the last `/admin_syncCards` run.
- Returns a list of matching trainer cards with their rank, skills, and artwork thumbnail.
- Results are sorted by rank (SSR → SR → R) then alphabetically by name.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| No options provided | Ephemeral: "Please provide at least one search option — `name`, `rank`, or `skill`." |
| No results found | Ephemeral: "No trainer cards matched your search. Try a broader query." |
| Card database not loaded | Ephemeral: "The trainer card database has not been loaded yet. An admin can run `/admin_syncCards` to populate it." |
| Data fetch failure | Ephemeral: "Could not search the database right now. Please try again shortly." |

---

## Example

```
/search_trainer name:Silence Suzuka
/search_trainer rank:SSR
/search_trainer skill:Gold Medal
/search_trainer name:Teio rank:SSR
```
