# GOVERNANCE

**Architectural Authority & Operations Documentation**

This folder contains the constitutional governance documents for the UmaKraft repository. These documents define how the architecture is structured, evolved, and maintained.

## Documents

| Document | Purpose |
|----------|----------|
| **ARCHITECTURE_AUTHORITY.md** | Constitutional law governing all architectural decisions |
| **PIPELINE_REGISTRY.md** | Official registry of all pipeline departments and their ownership |
| **PIPELINE_OPERATIONS.md** | Operational standards and daily execution guidelines |
| **PIPELINE_EVOLUTION.md** | Rules for how architecture evolves and absorbs supporting modules |
| **ARCHITECTURE_DECISIONS.md** | Historical record of all architectural decisions (ADRs) |

## Reading Order

1. **Start here:** `ARCHITECTURE_AUTHORITY.md` — Understand the constitutional foundation
2. **Then read:** `PIPELINE_REGISTRY.md` — Learn about department ownership
3. **For operations:** `PIPELINE_OPERATIONS.md` — Understand daily execution
4. **For evolution:** `PIPELINE_EVOLUTION.md` — Learn how architecture grows
5. **Reference:** `ARCHITECTURE_DECISIONS.md` — Review historical decisions

## Key Principles

- **Ownership is exclusive** — Every responsibility has exactly one owner
- **Pipeline integrity** — Information flows forward; never backward
- **Architecture endures** — Features evolve, but architecture is protected
- **Governance before implementation** — Decide first, code second

## For AI Systems

All AI assistants must:
1. Read `ARCHITECTURE_AUTHORITY.md` before code generation
2. Consult `PIPELINE_REGISTRY.md` to identify ownership
3. Verify dependencies follow pipeline direction
4. Extend existing departments rather than create parallel implementations
5. Update `ARCHITECTURE_DECISIONS.md` for structural changes
