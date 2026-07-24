# Warning Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Generate a fan deficit warning message for a trainer who is falling behind their projected fan count. The message must be supportive and constructive — it is a prompt to act, not a criticism. Tone is warm and encouraging, not scolding.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{trainerName}}` | **Yes** | — | Username of the trainer with the deficit |
| `{{deficitAmount}}` | **Yes** | — | Fan deficit amount (e.g. 25000) |
| `{{circleName}}` | No | "the circle" | Name of the trainer's circle |
| `{{deadline}}` | No | — | Ranking period deadline (if provided, creates urgency) |

---

## Prompt Template

```text
You are writing a fan deficit warning for the Umakraft Discord server.

Trainer: {{trainerName}}
Deficit: {{deficitAmount}} fans behind projection
Circle: {{circleName}}
Deadline: {{deadline}}

Write a message that:
- Notifies the trainer of their current fan deficit
- Frames the deficit as a challenge to overcome, not a failure
- Offers encouragement and a forward-looking push
- Reminds the trainer that the circle is there to support them
- If a deadline is provided, gently creates urgency

Requirements:
- Between 100 and 150 words
- Supportive, warm tone — never scolding or negative
- Use bold for the trainer name and deficit amount
- Do not speculate on why the deficit occurred
- May include 1 gentle emoji (no celebration emojis — this is a warning)
```

---

## Example Output

> 📊 A quick heads-up for **TrainerAkira** — you're currently **25,000 fans** behind your projected pace for this ranking period. Don't worry — this is exactly the kind of information the tracker is here to provide, and the good news is there's still time to close the gap. Consistent daily syncing is the fastest way to rebuild momentum. The *Rising Stars* circle is behind you every step of the way — lean on the community, keep your training routine, and let's work together to get you back on track before the period ends. You've done it before, and you can do it again. Let's go, TrainerAkira! 💪

*(Word count: 110 — passes validation)*

---

## Tone Rules

- **Never** use language like "you failed", "you're losing", or "you're in trouble"
- **Always** frame the deficit as an opportunity to close the gap
- If a deadline exists, mention it once — briefly, not alarmingly
- The circle's support is always available — reference it

---

## Severity Adjustment

| Deficit Level | Tone Adjustment |
|---|---|
| < 10,000 fans | Gentle nudge — "small gap, easy to close" |
| 10,000 – 50,000 fans | Clear heads-up — "now is a good time to push" |
| 50,000 – 100,000 fans | More direct — "this is the moment to step it up" |
| > 100,000 fans | Urgent but still supportive — "the circle is rallying for you" |

---

## Fallback

> 📊 **{{trainerName}}**, you're currently **{{deficitAmount}} fans** behind your projected pace. Now is a great time to sync and push your training forward — the gap is closeable, and the circle is cheering you on. Keep going! 💪

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `Broadcast/Announcer/announcer.md` — delivers warning messages
- `AI/RESPONSE_VALIDATOR.md` — ensures no negative prohibited content
