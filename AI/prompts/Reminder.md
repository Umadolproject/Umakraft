# Reminder Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Generate an event reminder message for an upcoming circle event, ranking period deadline, or community activity. The reminder should create gentle urgency without being alarming, and should encourage participation from the whole circle.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{eventName}}` | **Yes** | — | Name of the event or deadline (e.g. "Monthly Ranking Deadline", "Circle Meeting") |
| `{{eventDate}}` | **Yes** | — | Date of the event (ISO or friendly format) |
| `{{circleName}}` | No | "the circle" | Name of the circle |
| `{{details}}` | No | — | Optional brief details about the event or what trainers should do to prepare |

---

## Prompt Template

```text
You are writing an event reminder for the Umakraft Discord server.

Event: {{eventName}}
Date: {{eventDate}}
Circle: {{circleName}}
Details: {{details}}

Write a reminder message that:
- Announces the upcoming event clearly
- Creates gentle urgency without causing panic
- Tells trainers what they should do to prepare (if details are provided)
- Encourages the whole circle to participate

Requirements:
- Between 100 and 150 words
- Clear, friendly, and action-oriented tone
- Bold the event name and date
- May include 1–2 appropriate emojis (📅, ⏰, 🔔)
- Do not invent specific details not provided in the variables
```

---

## Example Output

> 📅 Just a reminder that the **Monthly Ranking Deadline** is coming up on **July 30, 2026**! If you haven't already, now is the perfect time to sync your training data and make sure your fan count is as high as possible before the rankings lock in. Every sync you complete between now and the deadline counts toward your final placement. The leaderboard is tighter than ever this month, so don't leave any fans on the table. Check in, push for those last few thousand fans, and let's finish the month strong together, *Rising Stars*! ⏰

*(Word count: 101 — passes validation)*

---

## Tone Guidelines

- Clear and action-oriented — tell trainers exactly what to do
- Urgency should feel like an opportunity, not a threat
- Always frame the reminder as a community event, not an individual obligation
- Avoid language like "don't forget" or "you must" — prefer "now is a great time to"

---

## Event Type Tone

| Event Type | Tone |
|---|---|
| Ranking deadline | Competitive urgency — "push for the best possible placement" |
| Circle meeting | Warm invitation — "we'd love to see everyone there" |
| Sync reminder | Practical encouragement — "a quick sync now goes a long way" |
| Special event | Excitement — "this is one you don't want to miss" |

---

## Fallback

> 🔔 Reminder: the **{{eventName}}** is coming up on **{{eventDate}}**! Make sure you're prepared and ready to participate. Check in with your circle, review your progress, and let's make the most of this opportunity together. See you there, *{{circleName}}*! 📅

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `Broadcast/Broker/broker.md` — schedule trigger for reminders
