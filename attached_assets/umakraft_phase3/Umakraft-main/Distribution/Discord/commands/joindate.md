# /joindate

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show when a member joined the circle, or list all members including former ones.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `list` | Boolean | ❌ | Show the full roster (active + former members) instead of a single lookup |
| `member` | User | ❌ | Discord member to look up (defaults to yourself) |
| `trainer` | String | ❌ | Uma.moe trainer name to look up |

---

## Output

- **Single lookup:** Public embed showing join date.
- **List mode (`list:true`):** Two image reports — current members and alumni.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch join date / roster data)
  │       │
  │       ▼
  │   Refinery (sort by join date, separate active vs alumni)
  │       │
  │       ▼ [list mode only]
  │   Workshop / Draftsman (render joindate blueprint)
  │
  ▼
Dispatcher (post embed or image(s) to channel)
```

---

## Behavior

- **Single lookup:** Posts an embed showing the member's join date and days active.
- **List mode (`list:true`):** Renders two image reports in parallel — current members and alumni — and posts both.
- Leave all options blank to check your own join date.
- Resolves `member` (Discord user) or `trainer` (Uma.moe name) — `member` takes priority if both are supplied.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Member is not linked | Ephemeral: "This member has not been linked to an Uma.moe account. Use `/link` to set one up." |
| Trainer name not found | Ephemeral: "Trainer not found. Check the spelling or use autocomplete." |
| No join date recorded | Ephemeral: "No join date is recorded for this member." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/joindate
/joindate member:@Trainer
/joindate trainer:SmartFalcon
/joindate list:true
```
