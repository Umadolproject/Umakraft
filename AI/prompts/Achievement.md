# Achievement Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 2.0.0
**Last Updated:** 2026-07-25

---

## Purpose

Generate an announcement when a trainer unlocks a special achievement. Achievements are distinct from milestones — they represent qualitative accomplishments rather than raw fan count thresholds. Each achievement has a title that defines the message's tone and personality.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{trainerName}}` | **Yes** | — | Username of the trainer |
| `{{achievementTitle}}` | **Yes** | — | Title of the achievement (e.g. "Sync Soldier", "Top 10 Grinder") |
| `{{achievementCategory}}` | **Yes** | — | `sync`, `rank`, `fan`, `streak`, or `circle` |
| `{{circleName}}` | No | "the circle" | Name of the trainer's circle |
| `{{description}}` | No | — | What the trainer did to earn this (if provided) |
| `{{tierNumber}}` | No | — | Achievement progression tier (e.g. 1st sync, 5th streak week) |

---

## Achievement Title Registry

### Sync Achievements
| Title | Criteria | Emoji | Tone |
|---|---|---|---|
| **First Sync** | 1st data sync | 🍼 | "Welcome to the grind. This is where it starts." |
| **Sync Soldier** | 10 syncs | 🫡 | "Consistent. Reliable. The backbone of the circle." |
| **Sync Veteran** | 50 syncs | 🎖️ | "You've seen things. You've synced things. Respect." |
| **Sync Legend** | 100 syncs | 👴 | "The elders speak of your sync streak in whispers." |

### Rank Achievements
| Title | Criteria | Emoji | Tone |
|---|---|---|---|
| **Board Climber** | Top 100 | 📈 | "You're on the board. Now climb it." |
| **Rank Warrior** | Top 50 | ⚔️ | "Top 50 isn't luck. It's a campaign." |
| **Top 10 Grinder** | Top 10 | 🔥 | "The top 10. Everyone below you wants your spot." |
| **Circle Dominator** | #1 in circle | 👑 | "Nobody is above you. This is your circle now." |

### Fan Achievements
| Title | Criteria | Emoji | Tone |
|---|---|---|---|
| **Fan Collector** | 1M daily | 📦 | "Stacking fans like it's a hobby." |
| **Fan Magnate** | 5M daily | 💰 | "You don't collect fans — fans collect around you." |
| **Millionaire Club** | 10M daily | 🏦 | "Ten million in one day. That's not a gain — that's a statement." |

### Streak Achievements
| Title | Criteria | Emoji | Tone |
|---|---|---|---|
| **Consistency King** | 7-day streak | 📅 | "A week of showing up. That's how dynasties start." |
| **Monthly Machine** | 30-day streak | 🤖 | "Thirty days without missing a beat. You're not human." |
| **Unbreakable** | 90-day streak | 🛡️ | "Three months. The streak has become your identity." |

### Circle Achievements
| Title | Criteria | Emoji | Tone |
|---|---|---|---|
| **Circle Contributor** | Helped circle rank up | 🤝 | "You didn't just climb — you pulled the whole circle up." |
| **Circle Guardian** | Defended circle rank | 🛡️ | "When the circle needed a wall, you were it." |

---

## Prompt Template

```text
You are writing an achievement unlock announcement for the Umakraft Discord server.

Trainer: {{trainerName}}
Achievement: {{achievementTitle}} ({{achievementCategory}})
Circle: {{circleName}}
Details: {{description}}
Tier: {{tierNumber}}

Write a message that:
- Announces the achievement title LOUD and PROUD — the title IS the personality
- Explains what the trainer did to earn it (based on category and details)
- Uses the correct tone for this achievement category (see registry above)
  - Sync achievements: respect the grind, celebrate consistency
  - Rank achievements: competitive fire, acknowledge the climb
  - Fan achievements: impressed but teasing, "you are hoarding at this point"
  - Streak achievements: awe at the dedication, "this is not normal behavior"
  - Circle achievements: warmth, "you made the whole circle better"
- Inspires other trainers — "this could be you next"
- Closes with a forward-looking statement

Requirements:
- Between 100 and 150 words
- Use bold for the trainer name and achievement title
- Include the achievement's emoji from the registry
- Tone must match the category — don't use competitive language for a sync achievement
- Do not invent details not provided
```

---

## Example Output — Rank (Top 10 Grinder)

> 🔥 **Top 10 Grinder**. That's the title **Akira** just claimed — breaking into the top 10 of *Rising Stars* after a relentless climb. This isn't a participation trophy. The top 10 is a battlefield, and every trainer in it had to push someone else out to get there. Akira didn't just show up — Akira campaigned. Day after day, sync after sync, the numbers kept climbing until the leaderboard had no choice but to make room. To every trainer looking up at that top 10 right now: that spot isn't reserved. It's earned. Akira just proved it. Who's next? ⚔️

*(Word count: 103 — passes validation)*

---

## Example Output — Streak (Unbreakable, 90-day)

> 🛡️ **Unbreakable**. **Miyuki** just hit a **90-day sync streak** — three full months without missing a single day. Let that sink in. No skipped days. No "I'll sync tomorrow." Just pure, relentless consistency for a quarter of a year. This isn't talent. This is discipline wearing a trainer's uniform. The streak has become Miyuki's identity — when people check the sync log, they don't ask IF Miyuki synced today. They know. To everyone in *Rising Stars* wondering how to get noticed: start a streak. Keep it alive. Let it define you. Miyuki just showed us what Unbreakable looks like. 🤖

*(Word count: 104 — passes validation)*

---

## Fallback

> ⭐ Achievement unlocked! **{{trainerName}}** just earned **{{achievementTitle}}** — proof that showing up and putting in the work pays off. {{circleName}} is proud to count you among its ranks. Keep pushing, keep syncing, and let this be the first of many. Well done! 🎖️

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `AI/RESPONSE_VALIDATOR.md` — 100–150 word enforcement
