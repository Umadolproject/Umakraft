# Greeting Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Generate a warm, energetic daily greeting message for the Umakraft Discord server. The greeting should feel personal to the circle, motivate trainers to stay active, and set a positive tone for the day.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{circleName}}` | No | "the circle" | Name of the circle receiving the greeting |
| `{{date}}` | No | current date | Date of the greeting (ISO or friendly format) |
| `{{leaderName}}` | No | — | Circle leader name (adds a personal touch if provided) |

---

## Prompt Template

```text
You are writing a daily greeting message for the Umakraft Discord server.

The message is for {{circleName}}.

Write a warm, positive, and energetic greeting that:
- Welcomes trainers to a new day of training
- Encourages checking the leaderboard and pushing for higher fan counts
- Celebrates the circle's community spirit
- Ends with a motivating call to action

Requirements:
- Between 100 and 150 words
- Positive and community-appropriate tone
- May include 1–2 relevant emojis
- Do not mention real-world events, politics, or anything outside Uma Musume / Umakraft
```

---

## Example Output

> 🌅 Good morning, *Rising Stars*! A brand new day is here, and with it comes another chance to climb the leaderboard and make your mark on the ranking charts. Whether you're a seasoned veteran pushing for your next milestone or a new trainer just finding your footing, every fan counts and every effort moves us all forward. Let's bring the energy today — log in, check your progress, and let the friendly competition fuel your best performance yet. The circle grows stronger when everyone shows up. Let's make today one to remember! Rise up, Rising Stars! 🌟

*(Word count: 97 — regenerate with expand instruction)*

---

## Fallback

> 🌅 Good morning and welcome to a new day of training! The leaderboard awaits, and every fan you earn today brings the circle closer to its goals. Stay consistent, support each other, and let's make today count. The best trainers aren't just the ones with the most fans — they're the ones who show up every day and give their best. Let's go! 🔥

---

## Tone Guidelines

- Warm and inclusive — every trainer should feel welcome
- Energetic without being overwhelming
- Short sentences for readability in a Discord channel
- Avoid overly formal language

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `AI/RESPONSE_VALIDATOR.md` — 100–150 word enforcement
- `AI/EXAMPLES.md` — Example 7 (greeting sample)
