# Security

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

This document defines the complete security model for the Umakraft AI Knowledge Service. The model is built on a single non-negotiable principle: the AI is read-only. Every security control described here enforces or protects that principle.

---

## Core Security Principle

**The AI has no write path. None.**

There is no configuration, no environment variable, no override, and no edge case under which the AI Knowledge Service may write to any file, database, or external system.

---

## Permission Matrix

| Operation | Allowed | Notes |
|---|---|---|
| Read repository files | ✅ | All file types; all directories (except excluded) |
| Read source code | ✅ | `.js`, `.ts`, `.md`, `.json`, `.yaml`, `.sql` |
| Read documentation | ✅ | Including governance documents |
| Read blueprints | ✅ | Workshop blueprint files |
| Read configuration documentation | ✅ | `.md` config docs — not live secrets |
| Generate text responses | ✅ | Via API Provider |
| Generate community messages | ✅ | Via Content Generator |
| Search the repository | ✅ | Via Repository Engine |
| Edit any file | ❌ | Absolutely forbidden |
| Delete any file | ❌ | Absolutely forbidden |
| Rename any file | ❌ | Absolutely forbidden |
| Execute shell commands | ❌ | Absolutely forbidden |
| Run scripts | ❌ | Absolutely forbidden |
| Commit to Git | ❌ | Absolutely forbidden |
| Push to GitHub | ❌ | Absolutely forbidden |
| Write to any database | ❌ | Absolutely forbidden |
| Modify Discord server settings | ❌ | Absolutely forbidden |
| Access environment secrets or tokens | ❌ | Absolutely forbidden |
| Call external APIs (other than AI provider) | ❌ | Absolutely forbidden |
| Read `.env` files | ❌ | Excluded from indexing |

---

## Read-Only Enforcement

### Mechanism

The AI Knowledge Service enforces read-only access through the system constraint block that is prepended to every prompt by the Prompt System:

```text
You are the Umakraft AI Knowledge Service.
You are a read-only assistant. You may read and explain repository content
and Umamusume knowledge. You may never modify files, execute code, access
secrets, write to databases, or perform Discord administration.
If asked to perform any forbidden action, politely decline and explain
your read-only role.
```

This block cannot be removed, overridden, or injected over by user input.

### Prompt Injection Protection

All user input is sanitised before inclusion in the prompt:
- No raw user strings may appear adjacent to the system constraint block
- User questions are placed in the `{{question}}` slot, structurally separated from instructions
- Double-brace variable injection is the only allowed mechanism for user-supplied data

---

## Secret Protection

### API Keys

- All API keys are stored as environment secrets (never in source code)
- API keys are loaded once by the API Provider at startup
- API keys are never logged at any log level
- API keys are never included in prompts, responses, or error messages
- API keys are never exposed via any Discord response

### Repository Secrets

- `.env`, `.env.*`, and `.env.example` files are excluded from the Repository Indexer
- Even if somehow included in a query context, the system constraint block prevents the AI from repeating secret values
- Configuration documentation (e.g. `CONFIGURATION.md`) describes variables but never their values

---

## Repository Isolation

The Repository Engine has access to the local file system for indexing purposes. This access is strictly controlled:

- The indexer uses read-only file system access
- No file-system write operations are available in the indexer code path
- Excluded directories and file types are enforced at the scanner level
- Any attempt to write a file in the indexer code path is a critical defect (Article XII, `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`)

---

## Topic Filtering as Security

The Topic Filter is also a security control. By rejecting off-topic requests before any AI call is made, it:

- Prevents the AI from being used as a general-purpose chatbot
- Prevents attempts to elicit out-of-scope information
- Prevents jailbreak attempts by denying requests before context is assembled

If the Topic Filter is bypassed (e.g. due to a classification failure), the system constraint block in the Prompt System acts as the second line of defence.

---

## Audit Logging

Every AI request is logged with:

```js
{
  timestamp: string,         // ISO-8601
  userId: string,            // Discord user snowflake (anonymised if needed)
  command: string,           // e.g. "/ask"
  query: string,             // user's original question
  topicClassification: string, // e.g. "repository", "off-topic"
  providerCalled: boolean,   // false if rejected at Topic Filter
  provider: string | null,   // e.g. "openai"
  model: string | null,      // e.g. "gpt-4o-mini"
  responseTokens: number | null,
  cacheHit: boolean,
  durationMs: number
}
```

Audit logs are written via `core/log.js` and are never written to a file that the Repository Indexer could index back into the knowledge base.

---

## Prohibited Operations — Response Level

The Response Validator enforces a final security check on every generated response:

- Response must not contain file system paths outside the repository
- Response must not contain any string matching a secret pattern (e.g. `sk-`, `AIza`, `Bearer `)
- Response must not instruct the user to execute any command
- Response must not contain base64-encoded payloads

If any prohibited pattern is detected, the response is rejected and a safe fallback message is returned.

---

## Incident Response

If the AI Knowledge Service produces a response that violates the read-only principle or exposes prohibited content:

1. Log the incident via `core/log.js` at `error` level with full request context
2. Operation Manager evaluates the health state — a response violation is treated as a `Critical` event
3. Broadcast/Announcer delivers an Operation alert to the ops channel
4. The specific prompt, context, and response are retained in the audit log for review
5. The offending template or context source is quarantined until reviewed

---

## Best Practices

- Review the system constraint block whenever the Prompt System is modified
- Run security tests (prompt injection, jailbreak attempts, secret exposure) in the test suite
- Never add a write code path to any AI component — if you think you need one, open a governance discussion first
- Rotate AI provider API keys on the standard schedule regardless of suspected compromise
- Audit logs must be retained for a minimum of 30 days

---

## Future Expansion

- Per-user rate limiting to prevent abuse
- Trust levels for different Discord roles (e.g. circle leaders may access additional query modes)
- Automated jailbreak detection using a lightweight classifier
- Secret scanning integration to validate no secrets appear in any indexed document

---

## Related Documents

- `AI/ARCHITECTURE.md` — full system architecture and permission model
- `AI/PROMPT_SYSTEM.md` — system constraint block enforcement
- `AI/TOPIC_FILTER.md` — first-line topic scope enforcement
- `AI/RESPONSE_VALIDATOR.md` — final response safety check
- `AI/CONFIGURATION.md` — environment variable and secret management
- `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` — Article XII (Bug Ownership), Article XIII (Health)

---

## Version History

- `v1.0.0` — Initial Security specification; full permission matrix; read-only enforcement; secret protection; prompt injection protection; audit logging schema; incident response procedure; prohibited response patterns
