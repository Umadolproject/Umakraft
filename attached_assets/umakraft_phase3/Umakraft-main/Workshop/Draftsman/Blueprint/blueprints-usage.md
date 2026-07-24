# Blueprint Command Workflow

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Document Type:** Operational Reference
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This document explains how new Discord commands are added and how they connect to Blueprint definitions for image report generation.

---

## Process for Adding a New Command

1. Add the command spec under `Distribution/Discord/commands/`.
2. Create a new blueprint in `Workshop/Draftsman/Blueprint/` following the governance standard (see `club_gain.md` as the reference template).
3. Add a mapping entry in `Workshop/Draftsman/command-blueprints.json`.
4. Ensure `Workshop/Draftsman/blueprints.js` can resolve the command to the blueprint.
5. Register the new blueprint in `README.md` (this directory) and `GOVERNANCE/PIPELINE_REGISTRY.md`.
6. Record an ADR in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`.

---

## Governance Standard for New Blueprints

Every blueprint must include:

| Section | Required |
|---------|----------|
| Authority / Registry / Stage / Department / Status / Version / Last Updated header | ✅ |
| Purpose | ✅ |
| Product Overview | ✅ |
| Command / Trigger | ✅ |
| Parameters or Inputs | ✅ |
| Permissions | ✅ |
| Layout | ✅ |
| Data Contract | ✅ |
| Pipeline Ownership table | ✅ |
| Error Handling | ✅ |
| Workflow diagram | ✅ |
| Governance Compliance checklist | ✅ |

---

## Example Mapping

```json
{
  "fan_gain": "fan_gain",
  "profile": "profile",
  "circle": "circle",
  "set_fans": "set_fans",
  "link": "link",
  "club_gain": "club_gain",
  "new_command": "new_blueprint"
}
```

---

## How the Interaction Code Uses It

1. Receive Discord command `/new_command`
2. Validate request data
3. Resolve the blueprint:

```js
const { getBlueprintForCommand } = require('../Workshop/Draftsman/blueprints');
const blueprintText = await getBlueprintForCommand('/new_command');
```

4. Load product data for the requested command
5. Render the result according to the blueprint
6. Send the report back through Discord

---

## Notes

- The command file and blueprint file must be named consistently.
- The command mapping is centralized in `command-blueprints.json`.
- This keeps commands and blueprints decoupled but linked by the mapping.
- Blueprint files must use Unix line endings (LF) and UTF-8 encoding.
