# /test_milestone

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Preview a milestone announcement without posting it publicly — for testing milestone templates and thresholds.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `member` | User | ❌ | Discord member to simulate the milestone for (defaults to yourself) |
| `trainer` | String | ❌ | Uma.moe trainer name to simulate the milestone for |
| `milestone` | Choices | ❌ | Specific milestone type to preview (defaults to the next pending milestone for the member) |

---

## Output

Ephemeral image — visible only to the user who ran the command.

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
  ├── Umamoe (fetch member data for milestone simulation)
  │       │
  │       ▼
  │   Workshop / Draftsman (render milestone blueprint — preview mode)
  │
  ▼
Dispatcher (send ephemeral preview image)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Renders a milestone announcement card in preview mode without triggering any real announcement or recording the milestone as reached.
- Useful for checking that milestone templates render correctly before they fire in production.
- Defaults to simulating the next pending milestone for the target member.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to use this command." |
| Member is not linked | Ephemeral: "This member has not been linked to an Uma.moe account. Use `/link` to set one up." |
| No pending milestones | Ephemeral: "No pending milestones found for this member." |
| Render failure | Ephemeral: "Could not render the milestone preview right now. Please try again shortly." |

---

## Example

```
/test_milestone
/test_milestone member:@Trainer
/test_milestone trainer:SmartFalcon milestone:fan_count
```
