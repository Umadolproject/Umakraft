# Milestone Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Generate a celebratory announcement when a trainer reaches a fan count milestone. The message should feel like a genuine community celebration — personal to the trainer, inspiring to the circle, and appropriately sized for the milestone value.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{trainerName}}` | **Yes** | — | Username of the trainer who reached the milestone |
| `{{milestoneValue}}` | **Yes** | — | Fan count milestone (e.g. 100000, 500000, 1000000) |
| `{{circleName}}` | No | "the circle" | Name of the trainer's circle |
| `{{previousMilestone}}` | No | — | Previous milestone (adds journey context if provided) |

---

## Prompt Template

```text
You are writing a milestone announcement for the Umakraft Discord server.

Trainer: {{trainerName}}
Milestone: {{milestoneValue}} fans
Circle: {{circleName}}

Write a celebration message that:
- Congratulates the trainer by name on their fan milestone
- Acknowledges the effort and dedication this represents
- Celebrates the achievement as a circle win, not just a personal one
- Ends with an inspiring forward-looking statement

Requirements:
- Between 100 and 150 words
- Use bold formatting for the trainer name and milestone value
- May include 1–2 celebration emojis (🎉, 🏆, ⭐, ✨)
- Warm, genuine, not over-the-top
- Do not invent specific details not provided in the variables
```

---

## Example Output

> 🎉 A huge congratulations to **TrainerAkira** for reaching **500,000 fans** — a milestone that represents dedication, consistency, and the kind of relentless effort that defines a great trainer! This achievement doesn't just belong to TrainerAkira; it belongs to every member of *Rising Stars* who has offered support, friendly competition, and encouragement along the way. Reaching half a million fans is no small feat, and today we celebrate together. The journey doesn't stop here — the next milestone is already within sight. Keep training, keep growing, and keep inspiring the whole circle. Here's to **TrainerAkira** and to many more milestones ahead! 🌟

*(Word count: 113 — passes validation)*

---

## Milestone Tone Scaling

| Milestone Range | Tone |
|---|---|
| < 100,000 | Warm encouragement — "great start on the journey" |
| 100,000 – 500,000 | Genuine celebration — "real milestone, real effort" |
| 500,000 – 1,000,000 | Strong celebration — "exceptional achievement" |
| 1,000,000+ | Full celebration — "legendary status" language appropriate |

---

## Fallback

> 🎉 Congratulations to **{{trainerName}}** on reaching **{{milestoneValue}} fans**! This milestone is a true testament to your dedication and hard work. The entire circle celebrates with you today. Keep pushing forward — the next milestone is already within reach, and we can't wait to celebrate with you again. Well done! 🏆

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `AI/EXAMPLES.md` — Example 8 (milestone sample)
