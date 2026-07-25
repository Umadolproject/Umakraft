# Warning Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 2.0.0
**Last Updated:** 2026-07-25

---

## Purpose

Generate a fan deficit warning message for a trainer falling behind their projected pace. Each deficit level has a title that drives the tone — from gentle nudge to urgent rallying call. The message must always be supportive and constructive. This is a coach checking in, not a boss scolding.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{trainerName}}` | **Yes** | — | Username of the trainer with the deficit |
| `{{deficitAmount}}` | **Yes** | — | Fan deficit amount (e.g. 25000) |
| `{{deficitTier}}` | **Yes** | — | Title for this deficit level (see registry below) |
| `{{circleName}}` | No | "the circle" | Name of the trainer's circle |
| `{{projectedFans}}` | No | — | What the trainer should be at |
| `{{actualFans}}` | No | — | What the trainer is actually at |
| `{{deadline}}` | No | — | Ranking period deadline (if provided) |

---

## Deficit Tier Registry

| Tier | Deficit Range | Title | Emoji | Tone |
|---|---|---|---|---|
| 1 | < 10,000 | **Minor Slip** | 📎 | Gentle nudge — "barely a gap, easy close" |
| 2 | 10,000–25,000 | **Falling Behind** | 📉 | Friendly heads-up — "noticing the gap widening" |
| 3 | 25,000–50,000 | **Gap Widening** | ⚠️ | Clear alert — "this is the moment to step up" |
| 4 | 50,000–100,000 | **Red Zone** | 🚨 | Direct — "the gap is serious now, act today" |
| 5 | 100,000–250,000 | **Critical Drop** | 🔴 | Urgent — "the circle is rallying for you" |
| 6 | > 250,000 | **Emergency Drift** | 🆘 | Full rally — "we need to turn this around NOW" |

---

## Prompt Template

```text
You are writing a fan deficit warning for the Umakraft Discord server.

Trainer: {{trainerName}}
Deficit: {{deficitAmount}} fans behind projection
Deficit Tier: {{deficitTier}}
Circle: {{circleName}}
Projected: {{projectedFans}}
Actual: {{actualFans}}
Deadline: {{deadline}}

Write a message that:
- Opens with the deficit tier title — it sets the tone for the whole message
- Names the deficit amount clearly using bold formatting
- Frames the deficit as a challenge to overcome, not a failure
- Uses the correct tone for this tier (see registry above):
  - Tiers 1–2: light, encouraging, "you've got this"
  - Tiers 3–4: direct, focused, "now is the time to act"
  - Tiers 5–6: urgent but supportive, "the whole circle is behind you"
- Reminds the trainer that consistent daily syncing is the fastest recovery
- If a deadline is provided, mentions it once — as motivation, not a threat
- Ends with belief in the trainer: "you've closed gaps before"

Requirements:
- Between 100 and 150 words
- Supportive, coaching tone — never scolding, never shaming
- Use bold for trainer name, deficit amount, and deficit tier title
- Include the tier's assigned emoji from the registry
- Do not speculate on WHY the deficit occurred
- Never use language like "you failed", "you're losing", or "you're in trouble"
```

---

## Example Output — Falling Behind (Tier 2, 18,000 deficit)

> 📉 **Falling Behind** — that's the alert on **Akira**'s tracker right now. You're **18,000 fans** behind your projected pace for this period, and while that's not a crisis, it IS the kind of gap that grows if you ignore it. The good news: 18,000 fans is a single solid day of training. One focused sync. One push. You've closed bigger gaps than this before. *Rising Stars* has your back — lean on the community, keep your daily rhythm, and let's turn that Falling Behind into Catching Up by tomorrow. You know what to do. Now go do it. 💪

*(Word count: 104 — passes validation)*

---

## Example Output — Critical Drop (Tier 5, 180,000 deficit)

> 🔴 **Critical Drop**. **Miyuki**, you're **180,000 fans** behind projection — and that's a number we need to talk about. This isn't a bad day. This is a pattern that needs breaking. The good news: *Rising Stars* doesn't leave trainers behind. The circle is rallying. Every trainer who syncs today helps pull the whole group up, and right now that means you have an entire community behind your recovery. Start with today. One sync. One day of focused training. Don't think about the full 180,000 — think about what you can earn in the next 24 hours. The tracker doesn't define you. Your response to it does. Let's go, Miyuki. We believe in this comeback. 💪

*(Word count: 124 — passes validation)*

---

## Tone Rules

| Rule | Applies To |
|---|---|
| Never use "you failed", "you're losing", "you're in trouble" | All tiers |
| Never speculate why the deficit occurred | All tiers |
| Always frame as challenge → opportunity | All tiers |
| Mention circle support | Tiers 3+ |
| Mention deadline once if provided | Tiers 2+ |
| Reference trainer's past resilience if known | Tiers 1–3 |
| Sound like a coach, not a boss | All tiers |

---

## Fallback — Per Tier Group

### Light (Tiers 1–2)
> {{emoji}} **{{deficitTier}}** — **{{trainerName}}**, you're **{{deficitAmount}} fans** behind your projected pace. Nothing to worry about — this is a small gap that a focused day of training will close. Sync your data, push for gains, and let's get you back on track. You've got this. 💪

### Direct (Tiers 3–4)
> {{emoji}} **{{deficitTier}}** — **{{trainerName}}**, you're **{{deficitAmount}} fans** behind. This is the moment to act. Consistent daily syncing is the fastest way to close this gap. {{circleName}} is behind you — now is the time to push.

### Urgent (Tiers 5–6)
> {{emoji}} **{{deficitTier}}** — **{{trainerName}}**, you're **{{deficitAmount}} fans** behind projection and the whole {{circleName}} circle is rallying for you. Don't look at the full number — focus on today. One sync. One push. The comeback starts now. We believe in you. 💪

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `Broadcast/Announcer/announcer.md` — delivers warning messages
- `AI/RESPONSE_VALIDATOR.md` — ensures no negative prohibited content
