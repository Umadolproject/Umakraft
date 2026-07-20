# Operation

Operation supervises the health of the UmaKraft pipeline.

## Components

- Investigator
- Logger
- Manager

Illustration:

Pipeline
    │
    ▼
Operation/Investigator
    │
    ▼
Operation/Logger
    │
    ▼
Operation/Manager
    │
    ▼
Broadcast/Announcer
    │
    ▼
Discord

Operation never communicates directly with Discord. Broadcast is responsible for automated delivery.
