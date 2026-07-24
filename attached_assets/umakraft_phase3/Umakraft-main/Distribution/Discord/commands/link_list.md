# /link_list

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show a paginated list of all linked Discord members and their associated Uma.moe trainer accounts.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `page` | Integer | ❌ | Page number to view (defaults to 1) |

---

## Output

Image report — posted publicly in the channel.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, check Manage Guild permission)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch all member link records)
  │       │
  │       ▼
  │   Refinery (paginate, sort alphabetically)
  │       │
  │       ▼
  │   Workshop / Draftsman (render link_list blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts a paginated image report.
- Each page lists Discord usernames alongside their linked Uma.moe trainer names and IDs.
- Useful for auditing links and finding unlinked or incorrectly linked members.
- Defaults to page 1 if `page` is not specified.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to use this command." |
| Page number out of range | Ephemeral: "Page `{n}` does not exist. There are `{total}` pages." |
| No linked members | Ephemeral: "No members are currently linked. Use `/link` to add them." |
| Data fetch failure | Ephemeral: "Could not retrieve the link list right now. Please try again shortly." |

---

## Example

```
/link_list
/link_list page:2
```
