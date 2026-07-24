# /set_fans

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Set the fan gain requirement for a specific circle and time period, or view current quota status.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `status` | Boolean | ❌ | Show current quota settings instead of changing them |
| `circle` | Choices | ❌ | Which circle to configure (defaults to the primary circle) |
| `scope` | Choices | ❌ | `daily`, `weekly`, or `monthly` |
| `amount` | Choices | ❌ | Preset fan amount to set |
| `custom_amount` | Integer | ❌ | Custom fan amount (overrides `amount`) |

---

## Output

- **Status mode (`status:true`):** Ephemeral embed showing current quota settings.
- **Set mode:** Ephemeral confirmation embed + public image report showing the new quota and member impact.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, check Manage Guild permission,
          require scope + amount or custom_amount when not status mode)
  │
  ▼
Coordinator
  │
  ├── [status mode] fetch current quota config → Dispatcher
  │
  └── [set mode]
        ├── Umamoe (fetch current member fan data for impact check)
        │       │
        │       ▼
        │   Refinery (count members below new threshold)
        │       │
        │       ▼
        │   Workshop / Draftsman (render set_fans confirmation blueprint)
        │
        └── Dispatcher (send ephemeral + post public image)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- After setting a quota, posts a public confirmation image and shows an impact check of how many current members would be below the new threshold.
- Use `status:true` to view the current quota configuration without making changes.
- `custom_amount` overrides `amount` if both are provided.
- At least one of `scope` + (`amount` or `custom_amount`) is required when not in status mode.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to use this command." |
| `scope` missing in set mode | Ephemeral: "Please specify a `scope` (`daily`, `weekly`, or `monthly`)." |
| Neither `amount` nor `custom_amount` in set mode | Ephemeral: "Please provide an `amount` or `custom_amount`." |
| `custom_amount` is negative or zero | Ephemeral: "Fan amount must be a positive number." |
| Data fetch failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/set_fans status:true
/set_fans scope:daily custom_amount:50000
/set_fans scope:monthly amount:1500000 circle:UmaKraft
```
