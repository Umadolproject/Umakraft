# Message System

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

The Message System is responsible for generating community-facing messages for the Umakraft Discord server. It manages the message type registry, output formatting, and length enforcement. All generated messages are 100–150 words — long enough to feel personal and complete, short enough to read comfortably in a Discord channel.

---

## Scope

| In Scope | Out of Scope |
|---|---|
| Daily greeting messages | Moderation messages |
| Milestone announcement messages | Administrative notices |
| Achievement unlock messages | System error messages |
| Leaderboard announcement messages | Direct message delivery (handled by Broadcast) |
| Fan deficit warning messages | Storing messages in Archive |
| Event reminder messages | |
| Documentation explanation messages | |

---

## Responsibilities

- Maintain the message type registry
- Route message generation requests to the Content Generator
- Enforce 100–150 word output length via the Response Validator
- Format messages for Discord (plain text or Markdown)
- Support all seven message types defined in `AI/prompts/`
- Never generate messages that reference out-of-scope content

---

## Architecture

```mermaid
flowchart LR
    CMD[/ai message <type>] --> TF[Topic Filter]
    TF -->|Message| MS[Message System]
    MS --> TR[Template Registry]
    TR --> PS[Prompt System]
    PS --> AP[API Provider]
    AP --> RV[Response Validator]
    RV --> OUT[Formatted Message]
```

---

## Message Type Registry

| Type Key | Template File | Description |
|---|---|---|
| `greeting` | `prompts/Greeting.md` | Daily or session opening greeting |
| `milestone` | `prompts/Milestone.md` | Trainer fan milestone announcement |
| `achievement` | `prompts/Achievement.md` | Achievement unlock announcement |
| `leaderboard` | `prompts/Leaderboard.md` | Weekly or monthly leaderboard summary |
| `warning` | `prompts/Warning.md` | Fan deficit warning message |
| `reminder` | `prompts/Reminder.md` | Upcoming event or deadline reminder |
| `documentation` | `prompts/Documentation.md` | Documentation explanation message |

---

## Workflow

1. User sends `/ai message <type>` with optional parameters
2. Topic Filter classifies the request as Message-type
3. Message System looks up the type key in the Template Registry
4. If the type is not found, a polite error is returned listing valid types
5. The matching prompt template is loaded from `AI/prompts/`
6. Variables (trainer name, milestone value, etc.) are injected
7. Content Generator calls the Prompt System to build the full prompt
8. API Provider generates the message
9. Response Validator confirms the output is 100–150 words and within scope
10. The formatted message is returned to the Discord channel

---

## Technical Design

### Message Output Format

All messages follow this structure:

```text
[Opening line — establishes context or celebrates the subject]

[Body — 2–3 sentences expanding on the event or theme]

[Closing line — call to action or warm sign-off]
```

### Variable Schema

Each message type accepts variables:

```js
{
  type: 'milestone',
  variables: {
    trainerName: string,     // e.g. "TrainerAkira"
    milestoneValue: number,  // e.g. 500000
    circleName: string,      // e.g. "Rising Stars"
    date: string,            // e.g. "2026-07-22"
  }
}
```

### Length Enforcement

The Response Validator counts words in the generated message. If the count falls outside 100–150:

- Under 100 words → re-generate with an "expand" instruction
- Over 150 words → re-generate with a "condense" instruction
- Maximum 2 re-generation attempts before returning a graceful fallback

### Discord Formatting

Messages support:

```text
**bold** — trainer names, milestone values
*italic* — event names, circle names
> blockquote — optional inspirational quote
```

Emojis are allowed if the prompt template includes them. All formatting must render correctly in a standard Discord channel.

---

## Examples

### Milestone Message

**Input:** `/ai message milestone trainerName=TrainerAkira milestone=500000`

**Output:**
> Congratulations to **TrainerAkira** for reaching **500,000 fans** — a truly remarkable achievement in the *Rising Stars* circle! This milestone is a testament to your dedication and consistency over many months of hard training. The entire circle celebrates with you today. Keep pushing forward — the next milestone is already within reach. 🎉

*(Word count: 52 — too short, validator triggers re-generation)*

---

## Best Practices

- Always include the trainer name and milestone value when generating milestone or achievement messages
- Keep tone positive, warm, and community-focused
- Avoid repeating the same phrase structure across consecutive messages
- Test all seven message types in the test suite before deployment
- Log every generation attempt, including re-generation triggers

---

## Future Expansion

- Multi-language message generation
- Personalized message style (formal, casual, energetic)
- Message history to avoid repetition across sessions
- Scheduled auto-generation linked to Broadcast cron triggers
- A/B testing of message variants for engagement tracking

---

## Related Documents

- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `AI/PROMPT_SYSTEM.md` — prompt building and template management
- `AI/RESPONSE_VALIDATOR.md` — length and scope enforcement
- `AI/prompts/` — all seven prompt template files
- `Broadcast/Announcer/announcer.md` — delivery pipeline

---

## Version History

- `v1.0.0` — Initial Message System specification; seven message types; template registry; variable schema; 100–150 word length enforcement; re-generation logic
