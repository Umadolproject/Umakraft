# Leaderboard Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 2.0.0
**Last Updated:** 2026-07-25

---

## Purpose

Generate a leaderboard announcement that celebrates top performers and ignites competitive fire across the circle. This is not a polite list — it's a call to arms. The message must make podium trainers feel like champions while making everyone else want their spot.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{scope}}` | **Yes** | `daily` | One of: `daily`, `weekly`, `monthly` |
| `{{topTrainers}}` | **Yes** | — | Array of top 5 trainers: `[{ name, rank, fans, gainField }]` |
| `{{circleName}}` | No | "the circle" | Name of the circle |
| `{{totalTrainers}}` | No | — | Total active trainers in the circle |
| `{{gainField}}` | No | `dailyFanGain` | Field used for ranking |

---

## Scope-Based Tone

### Daily Leaderboard
**Energy:** "Today belongs to you. Tomorrow it resets."
**Focus:** Who dominated today. Quick hits. Daily grind energy.
**Emojis:** 🔥 ⚡ 📊

### Weekly Leaderboard
**Energy:** "A week of consistency. Momentum is building."
**Focus:** Who sustained performance. The consistent vs the flashy.
**Emojis:** 🏆 📈 💪

### Monthly Leaderboard
**Energy:** "This is the big one. The month doesn't lie."
**Focus:** Who ran the campaign. The long game. Respect the grind.
**Emojis:** 👑 🏆 🔱

---

## Prompt Template

```text
You are writing a {{scope}} leaderboard announcement for the Umakraft Discord server.

Circle: {{circleName}}
Scope: {{scope}}
Top Trainers (in order):
{{topTrainers}}
Total trainers: {{totalTrainers}}

Write a message that:
- Opens with the scope energy (see Scope-Based Tone above) — set the mood immediately
- Names the top 3 trainers with their ranks and calls out what makes each impressive
- For the podium trainers: make them feel UNSTOPPABLE — they earned this
- For everyone else: light the competitive fire — "this could be you next {{scope}}"
- Acknowledges that every trainer on the board contributed to the circle's strength
- Ends with a forward-looking statement about the next period

Requirements:
- Between 100 and 150 words
- Competitive, energetic tone — this is sports commentary, not a report
- Use bold for trainer names and their ranks
- Include 1–2 emojis from the scope's approved set
- Mention the gap between ranks if it's dramatic (e.g. "in first by a landslide")
- Never understate the winners — don't be polite, be impressed
- Do not invent fan counts or ranks not provided
```

---

## Example Output — Daily

> 🔥 The daily leaderboard is locked for *Rising Stars*, and today belonged to **Akira**. First place, top of the board, and the trainer everyone will be chasing tomorrow. **Miyuki** held strong in second — close enough to taste first but not quite there — and **Ren** rounds out the podium in third with a performance that says "I'm not going anywhere." 42 trainers synced today. 42 trainers contributed to the circle's daily total. But only one name sits at the very top tonight. Tomorrow the board resets. The question isn't who won today — it's who wants it more tomorrow. See you on the leaderboard. ⚡

*(Word count: 108 — passes validation)*

---

## Example Output — Monthly

> 👑 The monthly leaderboard doesn't lie. Thirty days of data. Thirty chances to climb or fall. And after all of it, **Akira** stands alone at #1 in *Rising Stars* — the undisputed ruler of this month's campaign. **Miyuki** put up a fight worthy of the top spot but settled into a razor-thin second place. **Ren** claimed third after a late-month surge that knocked a contender off the podium entirely. This is the board that matters. Daily wins are sweet, but monthly dominance is legacy. The leaderboard resets tomorrow. Akira's crown is up for grabs. The only question: who's taking it? 🔱

*(Word count: 106 — passes validation)*

---

## Fallback — Per Scope

### Daily Fallback
> 🔥 The daily leaderboard is in for {{circleName}}! Congratulations to our top trainers who owned today's rankings. Check the embed for full results. Remember: tomorrow the board resets, and every spot is up for grabs. Who's taking #1 next? See you on the leaderboard. ⚡

### Weekly Fallback
> 🏆 The weekly leaderboard results are live for {{circleName}}! A full week of grinding, syncing, and climbing — and our top performers have earned every bit of recognition. Check the full leaderboard above. Next week starts now. Who's making the podium? 💪

### Monthly Fallback
> 👑 The monthly leaderboard has spoken. {{circleName}}'s top trainers ran a campaign this month, and the numbers don't lie. Full rankings in the embed above. The crown resets tomorrow. New month, new board, new king. Who's taking it? 🔱

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `Broadcast/Announcer/announcer.md` — delivers the leaderboard embed
