# Greeting Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 2.0.0
**Last Updated:** 2026-07-25

---

## Purpose

Generate a time-of-day greeting message for the Umakraft Discord server. Four distinct time slots — morning, noon, night, midnight — each with their own energy and personality. The greeting must match the moment, motivate trainers, and feel like a genuine circle leader checking in.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{timeSlot}}` | **Yes** | `morning` | One of: `morning`, `noon`, `night`, `midnight` |
| `{{circleName}}` | No | "the circle" | Name of the circle receiving the greeting |
| `{{leaderName}}` | No | — | Circle leader name (personal touch if provided) |
| `{{date}}` | No | current date | Date of the greeting |

---

## Time Slot Profiles

### 🌅 Morning (8 AM)
**Vibe:** Energetic sunrise. Fresh starts. New day, new leaderboard.
**Themes:** Morning motivation, daily goals, leaderboard check, breakfast grind
**Emojis:** 🌅 ☀️ 🌄 ⏰
**Tone:** "Rise and grind. Today's leaderboard is blank. Fill it with your name."

### ☀️ Noon (12 PM)
**Vibe:** Midday momentum. Lunch break check-in. Afternoon push.
**Themes:** Midday progress, afternoon grind, keeping pace, who's leading so far
**Emojis:** ☀️ 🔥 💪 ⚡
**Tone:** "Half the day is gone. What have you done with it? The leaderboard doesn't nap."

### 🌙 Night (8 PM)
**Vibe:** Evening wind-down. Reflect on today. Rest and recovery.
**Themes:** Today's recap, evening gains, rest for tomorrow, who owned today
**Emojis:** 🌙 ✨ 🌟 🌠
**Tone:** "The day is done. The numbers are in. Rest well — tomorrow the grind continues."

### 🌌 Midnight (12 AM)
**Vibe:** Late night dedication. The grind never sleeps. Overnight gains.
**Themes:** Late night grind, overnight syncs, dedication, who's still awake training
**Emojis:** 🌌 🦉 🌠 👻
**Tone:** "The circle sleeps. But not you. The overnight grinders are a different breed."

---

## Prompt Template

```text
You are writing a {{timeSlot}} greeting for the Umakraft Discord server.

Circle: {{circleName}}
Time: {{timeSlot}} ({{date}})

Write a message that:
- Matches the exact vibe of {{timeSlot}} (see Time Slot Profiles above)
- Starts with a greeting that fits the time of day
- Mentions checking the leaderboard and pushing for higher fan counts
- Celebrates the circle's community spirit
- Ends with a motivating call to action that fits the time slot
- References the specific energy of this time — morning grind vs night wind-down vs midnight dedication

Requirements:
- Between 80 and 150 words
- Start with @everyone on its own line (this is how the daily greeting system delivers it)
- Match the tone to the time slot — don't use sleepy language at noon or hyper energy at midnight
- Include 1–2 emojis from the slot's approved set
- Never mention real-world events, politics, or anything outside Uma Musume / Umakraft
- The message must feel different every day — vary the theme within the slot
- Do not use the same opening line from a previous greeting
```

---

## Example Output — Morning

> @everyone
> 🌅 Good morning, *Rising Stars*! The day is fresh and the leaderboard is waiting. Every morning is a blank slate — another shot at climbing higher than you did yesterday. Check your fan gain, sync your data, and let the numbers do the talking. Whether you're gunning for Legend tier or just getting started, today counts. The trainers who show up every morning are the ones you'll see at the top of the leaderboard by nightfall. Let's make this a day to remember. Rise up! 🔥

*(Word count: 88 — passes validation)*

---

## Example Output — Midnight

> @everyone
> 🌌 Midnight check-in. While most of *Rising Stars* is asleep, some of you are still grinding — and we see you. The overnight syncers, the late-night leaderboard refreshers, the trainers who refuse to let a day end without one more push. This is when the gap widens. Every fan you earn right now is one your competition won't catch until morning. Keep the energy. Keep the pace. The sunrise crew has no idea what you've been building while they slept. Let them wake up to find your name at the top. 🌠

*(Word count: 91 — passes validation)*

---

## Fallback — Per Time Slot

### Morning Fallback
> @everyone
> 🌅 Good morning and welcome to a new day of training! The leaderboard awaits, and every fan you earn today brings {{circleName}} closer to its goals. Stay consistent, support each other, and let's make today count. The best trainers aren't just the ones with the most fans — they're the ones who show up every day and give their best. Let's go! 🔥

### Noon Fallback
> @everyone
> ☀️ Midday check-in, {{circleName}}! Half the day is gone — how's your leaderboard looking? There's still time to push for more. Sync your data, check your gains, and let's finish the second half of the day stronger than the first. Keep the momentum! 💪

### Night Fallback
> @everyone
> 🌙 Evening wrap-up, {{circleName}}. The day's numbers are in, and every trainer who synced today moved us forward. Reflect on your gains, get some rest, and come back tomorrow ready to climb even higher. Well played today — see you at sunrise. ✨

### Midnight Fallback
> @everyone
> 🌌 Midnight grind check, {{circleName}}. For those still awake and training — your dedication doesn't go unnoticed. The overnight gains are the ones that separate the good from the great. Keep pushing. The rest of the circle will wake up to your progress. 🌠

---

## Related Documents

- `AI/DailyGreeting.js` — scheduled greeting module (cache + fallback)
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `AI/RESPONSE_VALIDATOR.md` — 100–150 word enforcement
