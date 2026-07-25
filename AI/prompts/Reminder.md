# Reminder Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 2.0.0
**Last Updated:** 2026-07-25

---

## Purpose

Generate an event reminder that creates urgency without panic. Every reminder is a mini-hype moment — trainers should feel like they're about to miss out on something good if they don't act, not like they're being nagged. Gamify the call to action: every reminder is a chance to gain an edge.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{eventName}}` | **Yes** | — | Name of the event or deadline |
| `{{eventDate}}` | **Yes** | — | Date of the event (ISO or friendly format) |
| `{{circleName}}` | No | "the circle" | Name of the circle |
| `{{details}}` | No | — | What trainers should do to prepare |
| `{{stakes}}` | No | — | What's at stake if they miss it (e.g. "lose your ranking spot") |
| `{{eventType}}` | No | `deadline` | One of: `deadline`, `meeting`, `sync`, `special` |

---

## Event Type Profiles

### ⏰ Ranking Deadline
**Vibe:** Competitive urgency. "The clock is ticking. Your spot isn't safe."
**Hook:** Position the deadline as the final boss of the period.
**Emojis:** ⏰ 🔥 ⚡
**Example openers:** "The countdown is on." / "Final hours." / "This is it."

### 📅 Circle Meeting
**Vibe:** Warm invitation. "We want you there. It's better with everyone."
**Hook:** Frame attendance as a community multiplier — everyone who shows up makes it better.
**Emojis:** 📅 🤝 🎯
**Example openers:** "Circle up." / "Everyone at the table." / "Your voice matters."

### 🔄 Sync Reminder
**Vibe:** Practical nudge. "A sync now is worth more than a panic sync later."
**Hook:** Frame syncing as gaining an edge, not a chore. "The trainers syncing right now are the ones climbing tomorrow."
**Emojis:** 🔄 📊 💡
**Example openers:** "Don't leave fans on the table." / "Sync now, climb later."

### 🎉 Special Event
**Vibe:** Pure hype. "You do NOT want to miss this."
**Hook:** Build anticipation — tease what's coming without spoiling it.
**Emojis:** 🎉 ✨ 🚀
**Example openers:** "Mark your calendar." / "This is the one." / "You'll regret missing this."

---

## Prompt Template

```text
You are writing an event reminder for the Umakraft Discord server.

Event: {{eventName}}
Date: {{eventDate}}
Type: {{eventType}}
Circle: {{circleName}}
Details: {{details}}
Stakes: {{stakes}}

Write a reminder that:
- Opens with energy matching {{eventType}} (see profiles above)
- Names the event and date clearly with bold formatting
- Tells trainers what's at stake — make them FEEL the urgency without panicking
- Gives a clear action item: "Here's what you need to do right now"
- Closes with a rallying call that involves the whole circle

Requirements:
- Between 100 and 150 words
- Bold the event name and date
- Include 1–2 emojis from the event type's approved set
- Never use nagging language ("don't forget", "you must", "required")
- Frame every reminder as an OPPORTUNITY to gain an edge over those who skip it
- The message should make trainers who were planning to skip it reconsider
```

---

## Example Output — Ranking Deadline

> ⏰ Final hours, *Rising Stars*. The **Monthly Ranking Deadline** locks in on **July 30, 2026** — and once it closes, every unsynced fan is gone forever. If you've been holding off on that sync, now is the moment. The trainers syncing right now are the ones climbing tomorrow. The ones waiting until the last second are the ones watching their rank slip away. Don't let someone else take your spot because they synced and you didn't. Check your numbers. Push for every last fan. And when the deadline hits and the leaderboard freezes — make sure your name is exactly where you want it. ⚡

*(Word count: 110 — passes validation)*

---

## Example Output — Sync Reminder

> 🔄 Quick sync check, *Rising Stars*. It's been a few hours since the last wave of data came through — and every trainer who syncs right now gets a jump on the leaderboard before the evening rush. This isn't busy work. This is positioning. The trainers who stay synced stay visible. The ones who let it slide? They fade off the board and spend the next day climbing back. A sync takes two minutes. The gap it creates in the rankings lasts all day. Don't leave fans on the table. Sync now. Check your gains. Let the numbers do the talking. 📊

*(Word count: 104 — passes validation)*

---

## Fallback — Per Event Type

### Deadline Fallback
> ⏰ Reminder: the **{{eventName}}** closes on **{{eventDate}}**. Sync your data now to lock in your ranking position. Every unsynced fan is a missed opportunity. Don't let the deadline catch you off guard. Let's finish strong, {{circleName}}! 🔥

### Meeting Fallback
> 📅 **{{eventName}}** is coming up on **{{eventDate}}**. We'd love to see every trainer there — the more voices, the stronger the circle. Clear your schedule and come ready to contribute. See you there, {{circleName}}! 🤝

### Sync Fallback
> 🔄 Time to sync, {{circleName}}! A quick sync now keeps your data fresh and your leaderboard position accurate. Don't let the gap grow — check in and keep climbing. 📊

### Special Event Fallback
> 🎉 **{{eventName}}** is happening on **{{eventDate}}** — and trust us, you do NOT want to miss this one. Mark it down. Tell your circle mates. Get ready. Something big is coming to {{circleName}}. 🚀

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `Broadcast/Broker/broker.md` — schedule trigger for reminders
