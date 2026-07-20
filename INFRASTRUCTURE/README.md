# INFRASTRUCTURE

**Support Systems for Pipeline Operations**

This folder contains support modules and infrastructure that enable the pipeline to function. These are not pipeline stages themselves, but provide capabilities to the pipeline.

## Folders

| Folder | Purpose |
|--------|----------|
| **Adapters/** | Interface adapters and connectors |
| **Contracts/** | Interface contracts and specifications |
| **Policy/** | Policies and rules |
| **Errors/** | Error handling and definitions |
| **Telemetry/** | Monitoring, logging, and observability |
| **core/** | Core utilities and helpers |

## Principle

Infrastructure modules support the pipeline but do NOT bypass it. They strengthen pipeline departments through capability acquisition.

See `GOVERNANCE/PIPELINE_EVOLUTION.md` for how infrastructure integrates with pipeline ownership.
