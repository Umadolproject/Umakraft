---
name: Workspace ZIP updates
description: Safe handling of uploaded Replit workspace snapshots when applying application updates
---

When an uploaded ZIP is a full Replit workspace snapshot, treat it as a source of application changes rather than a replacement workspace. Compare source and documentation files against the current project, and do not import `.local` state, agent state, durable runtime files, caches, or generated workspace metadata.

**Why:** Full workspace exports can include platform state and session artifacts that are unrelated to the intended code update and can overwrite the active environment.

**How to apply:** Inspect archive contents and file-level diffs first; merge only the relevant application files, preserving the current project structure and active Replit configuration.