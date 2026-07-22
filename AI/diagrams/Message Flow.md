# Message Flow Diagram

**Department:** Knowledge — AI
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Community Message Generation Flow

```mermaid
flowchart TD
    CMD([/ai message type variables]) --> GW[Command Gateway]
    GW --> TF{Topic Filter}
    TF -->|message| MS[Message System]
    TF -->|other| OTH([Route to other handler])

    MS --> VT{Valid Type?}
    VT -->|no| ERR([Return valid type list])
    VT -->|yes| TR[Template Selector]

    TR --> TMPL[Load prompts/<Type>.md]
    TMPL --> VV{Variables Valid?}
    VV -->|missing required| VERR([Return missing variable error])
    VV -->|ok| CG[Content Generator]

    CG --> PS[Prompt System]
    PS --> SYS[Inject System Constraint]
    SYS --> CTX[Inject Variables]
    CTX --> AP[API Provider]

    AP --> RV[Response Validator]
    RV --> WC{Word Count 100-150?}

    WC -->|pass| PC{Prohibited Content?}
    WC -->|under 100| EXP[Re-generate: expand]
    WC -->|over 150| CON[Re-generate: condense]
    EXP --> AP
    CON --> AP

    PC -->|pass| SP{Secret Pattern?}
    PC -->|fail| HARD([Hard Reject])

    SP -->|pass| OUT([Return Message to Discord])
    SP -->|fail| ALERT([Hard Reject + Ops Alert])

    EXP --> RETRY{Attempt <= 2?}
    CON --> RETRY
    RETRY -->|no| FB([Return Fallback Message])

    style ERR fill:#ffd43b,color:#333
    style VERR fill:#ffd43b,color:#333
    style HARD fill:#ff6b6b,color:#fff
    style ALERT fill:#ff6b6b,color:#fff
    style FB fill:#ffd43b,color:#333
    style OUT fill:#51cf66,color:#fff
```

---

## Message Type Decision Tree

```mermaid
flowchart LR
    T{Message Type} --> G[greeting]
    T --> M[milestone]
    T --> A[achievement]
    T --> L[leaderboard]
    T --> W[warning]
    T --> R[reminder]
    T --> D[documentation]

    G --> GT[prompts/Greeting.md]
    M --> MT[prompts/Milestone.md]
    A --> AT[prompts/Achievement.md]
    L --> LT[prompts/Leaderboard.md]
    W --> WT[prompts/Warning.md]
    R --> RT[prompts/Reminder.md]
    D --> DT[prompts/Documentation.md]
```

---

## Re-generation Logic

| Attempt | Word Count | Action |
|---|---|---|
| 1 | < 100 | Re-generate with expand instruction |
| 1 | > 150 | Re-generate with condense instruction |
| 2 | < 100 or > 150 | Re-generate one final time |
| 3+ | Any | Return fallback message for the type |

---

## Validation Checks Applied to Messages

| Check | Applied | Notes |
|---|---|---|
| Word count (100–150) | ✅ | Primary enforcement for message type |
| Prohibited content | ✅ | Hard reject |
| Secret pattern | ✅ | Hard reject + ops alert |
| Scope check | ✅ | Message must not contain system-internal content |
| Citation check | ❌ | Not required for messages |
| Hallucination check | ❌ | Not applicable to generated messages |

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline detail
- `AI/RESPONSE_VALIDATOR.md` — validation checks
- `AI/prompts/` — all seven template files
- `AI/diagrams/Sequence.md` — full sequence including re-generation
