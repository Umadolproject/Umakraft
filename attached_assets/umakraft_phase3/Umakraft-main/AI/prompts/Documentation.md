# Documentation Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Generate a concise, accessible explanation of a repository concept, Umamusume mechanic, or circle process for sharing in a Discord channel. This message type bridges the gap between technical documentation and community understanding — it should be readable by any circle member, not just developers.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{topic}}` | **Yes** | — | The topic to explain (e.g. "fan gain calculation", "how the Vault works", "MANT") |
| `{{context}}` | No | — | Additional context retrieved from the repository (injected by Context Builder) |
| `{{audience}}` | No | `"circle members"` | Target audience (e.g. "circle leaders", "new trainers", "developers") |

---

## Prompt Template

```text
You are writing a documentation explanation for the Umakraft Discord server.

Topic: {{topic}}
Audience: {{audience}}
Context from repository:
---
{{context}}
---

Write a clear, accessible explanation that:
- Introduces the topic in plain language
- Explains the key concept, process, or mechanic accurately
- Uses the repository context to ensure accuracy
- Avoids unnecessary technical jargon unless the audience is developers
- Ends with a practical takeaway or tip

Requirements:
- Between 100 and 150 words
- Accurate — do not state anything not supported by the repository context
- Plain language for non-technical audiences; technical for developer audiences
- May include 1 emoji if appropriate
- Do not include source citations in the message body (they are appended separately)
```

---

## Example Output — Fan Gain (Circle Members Audience)

> 📊 **Fan Gain** is the number of new fans a trainer earns over a specific time period. In Umakraft, fan gain is calculated by comparing a trainer's current fan count to their count from the previous sync. The difference is the gain. Trainers with consistent, high daily gains rise on the leaderboard faster than those who sync infrequently. The Refinery stage calculates your fan gain, trend tier, and projected growth each time your data is synced. To maximise your fan gain, sync regularly and check your trend — if you're in the "stable" or "emerging" tier, there's room to push harder and move up. 💪

*(Word count: 109 — passes validation)*

---

## Example Output — Vault (Developer Audience)

> The **Vault** is the trusted storage layer in Stage 1 (Umamoe). It applies a strict trust gate: only envelopes that pass Inspector validation (`accepted: true`, `inspectedAt` timestamp present) are stored. Untrusted envelopes are rejected with a `VAULT_UNTRUSTED_INPUT` error. The Vault uses an adapter pattern — the default is an in-memory store, switchable to SQLite for production. Data stored in the Vault is retrieved by the Refinery during Stage 2 for transformation and compilation. The Vault never modifies data; it is pure storage with a trust boundary enforced at the `receive()` entry point.

*(Word count: 99 — regenerate with expand instruction)*

---

## Audience Adaptation

| Audience | Language Level | Jargon | Example Focus |
|---|---|---|---|
| New trainers | Plain English | None | Game mechanics, what to do |
| Circle members | Accessible | Minimal | How the system affects their gameplay |
| Circle leaders | Semi-technical | Some | How to interpret data and act on it |
| Developers | Technical | Full | Code structure, interfaces, data flow |

---

## Fallback

> Here's a quick explanation of **{{topic}}**: this is a core part of how Umakraft works, and understanding it can help you make the most of your training. Check the full documentation in the repository for all the details, or ask another `/ask` question if you want to go deeper on any specific aspect.

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/REPOSITORY_ENGINE.md` — provides context for repository topics
- `AI/KNOWLEDGE_ENGINE.md` — provides context for Umamusume topics
- `AI/CONTEXT_BUILDER.md` — injects `{{context}}` from retrieved chunks
- `AI/EXAMPLES.md` — sample documentation explanations
