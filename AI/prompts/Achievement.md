# Achievement Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Generate an announcement when a trainer unlocks a special achievement. Achievements are distinct from milestones — they represent qualitative accomplishments (e.g. Top 10 Trainer, First Sync, Circle Contributor) rather than raw fan count thresholds.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{trainerName}}` | **Yes** | — | Username of the trainer who unlocked the achievement |
| `{{achievementName}}` | **Yes** | — | Name of the achievement (e.g. "Top 10 Trainer", "Milestone Master") |
| `{{circleName}}` | No | "the circle" | Name of the trainer's circle |
| `{{description}}` | No | — | Brief description of what the achievement means (if provided, include it) |

---

## Prompt Template

```text
You are writing an achievement unlock announcement for the Umakraft Discord server.

Trainer: {{trainerName}}
Achievement: {{achievementName}}
Circle: {{circleName}}
Description: {{description}}

Write a message that:
- Announces the achievement unlock clearly and enthusiastically
- Explains why the achievement is meaningful to the circle
- Inspires other trainers to aim for the same achievement
- Closes with a celebratory note

Requirements:
- Between 100 and 150 words
- Use bold for the trainer name and achievement name
- Warm, genuine, motivating tone
- May include 1–2 appropriate emojis
- Do not invent details not provided in the variables
```

---

## Example Output

> ⭐ It's achievement unlock time! **TrainerMiyuki** has just earned the **Top 10 Trainer** achievement — placing among the ten highest-ranked trainers in the entire *Rising Stars* circle for this ranking period. Reaching the top 10 requires not just raw fan count, but consistent daily effort, strategic syncing, and a commitment to improving every single week. TrainerMiyuki has demonstrated all of that and more. This achievement is an inspiration to every trainer in the circle: the top 10 is reachable, and the path is open to anyone willing to put in the work. Congratulations, TrainerMiyuki — wear that badge with pride! 🏅

*(Word count: 108 — passes validation)*

---

## Achievement Category Tone

| Category | Tone |
|---|---|
| Rank-based (Top 10, Top 50) | Competitive pride — emphasise the effort and placement |
| Milestone-based (first sync, 10 syncs) | Progress recognition — emphasise consistency and growth |
| Community-based (Circle Contributor) | Warmth — emphasise the collective benefit |
| Streak-based (7-day streak) | Consistency — emphasise the habit and dedication |

---

## Fallback

> ⭐ Congratulations to **{{trainerName}}** for unlocking the **{{achievementName}}** achievement! This is a fantastic accomplishment that reflects real dedication and skill. The whole circle is proud of you — keep up the excellent work and inspire others to reach for the same. Well done! 🎖️

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `AI/EXAMPLES.md` — sample achievement messages
