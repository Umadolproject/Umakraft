# Leaderboard Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Generate a leaderboard announcement that celebrates top performers and motivates the broader circle to stay competitive. This message accompanies the weekly or monthly leaderboard embed posted by the Broadcast stage.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{topTrainers}}` | **Yes** | — | Array of top trainer objects: `[{ name, rank, fans }]` (top 3–5) |
| `{{period}}` | No | "this period" | Ranking period (e.g. "this week", "July 2026") |
| `{{circleName}}` | No | "the circle" | Name of the circle |
| `{{totalTrainers}}` | No | — | Total number of active trainers in the circle |

---

## Prompt Template

```text
You are writing a leaderboard announcement for the Umakraft Discord server.

Circle: {{circleName}}
Period: {{period}}
Top Trainers: {{topTrainers}}

Write a message that:
- Celebrates the top-ranked trainers by name
- Acknowledges the competitive spirit of the whole circle
- Encourages trainers outside the top spots to keep pushing
- Ends with an energising forward-looking statement about the next period

Requirements:
- Between 100 and 150 words
- Mention the top 3 trainers by name and rank
- Use bold formatting for trainer names
- Competitive but inclusive tone — everyone's effort matters
- May include 1–2 appropriate emojis
- Do not invent fan counts or ranks not provided in the variables
```

---

## Example Output

> 🏆 The {{period}} leaderboard results are in for *Rising Stars*, and what a competition it has been! Leading the way is **TrainerAkira** in first place, followed closely by **TrainerMiyuki** in second and **TrainerRen** rounding out the podium in third. The gap between the top spots was tighter than ever, showing just how strong and competitive this circle has become. To every trainer outside the top three — your progress has not gone unnoticed. Every fan earned, every sync completed, and every day you show up builds the foundation for your breakthrough. The next period starts fresh. Who will rise to the top? 🔥

*(Word count: 112 — passes validation)*

---

## Leaderboard Tone Guidelines

- Celebrate the winners genuinely — don't understate their performance
- Be inclusive of non-podium trainers — they are the backbone of the circle
- Keep competition friendly — this is a community, not a zero-sum game
- Avoid exact fan count callouts in the message (they appear in the embed)

---

## Fallback

> 🏆 The {{period}} leaderboard is live for *{{circleName}}*! Congratulations to our top performers who set an incredible pace this period. Every trainer in this circle has contributed to our collective strength. Check the leaderboard embed above to see the full rankings, and let's get ready for the next period. The competition never stops — and neither do we! 🔥

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `Broadcast/Announcer/announcer.md` — delivers the leaderboard embed
