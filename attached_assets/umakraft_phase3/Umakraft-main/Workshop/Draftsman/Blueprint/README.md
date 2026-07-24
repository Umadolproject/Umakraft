# Blueprint Department

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Document Type:** Operational Reference
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

The **Blueprint** directory stores the official design specifications for every product manufactured within the Workshop.

A blueprint describes **how a product should be constructed**, including its layout, components, visual structure, and presentation requirements.

Blueprints are design specifications only.

They never contain rendering logic or business logic.

---

## Responsibilities

Blueprints define:

- Product layout
- Visual hierarchy
- Component arrangement
- Required information
- Canvas dimensions
- Styling guidelines
- Rendering order
- Component relationships

---

## Does Not Do

Blueprints must never:

- Retrieve data
- Process statistics
- Render images
- Validate finished products
- Distribute products

---

## Input

Blueprints receive:

- Product requirements
- Design requirements
- Workshop standards

---

## Output

Blueprints provide:

- Product specifications
- Layout definitions
- Component requirements
- Manufacturing instructions for the Fabricator

---

## Relationship

```text
Assembler
    │
    ▼
Product
    │
    ▼
Draftsman
    │
    ▼
Blueprint
    │
    ▼
Fabricator
    │
    ▼
Rendered Product
```

---

## Available Blueprints

| Blueprint | Command / Trigger | Description |
|-----------|-------------------|-------------|
| `blueprint.md` | Base template | General-purpose image report base |
| `circle.md` | `/circle` | Trainer circle summary card |
| `club_gain.md` | `/club_gain` | 30-day club fan gain history |
| `fan_gain.md` | `/fan_gain` | Trainer fan gain metrics card |
| `greeting.md` | Automated | Personalized greeting / welcome card |
| `help.md` | `/help` | Command usage guide embed |
| `joindate.md` | `/joindate` | Trainer join date summary |
| `leaderboard.md` | `/leaderboard` | Circle / global fan gain leaderboard |
| `link.md` | `/link` | Discord ↔ trainer account link confirmation |
| `milestone.md` | Broadcast | Milestone achievement notification card |
| `profile.md` | `/profile` | Full trainer profile card |
| `set_fans.md` | `/set_fans` | Fan count update confirmation |
| `warning.md` | Broadcast | Warning / alert notification card |

---

## Design Principle

A Blueprint defines **what should be built**.

The Fabricator determines **how it is built**.
