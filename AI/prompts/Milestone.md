# Milestone Prompt Template

**Department:** Knowledge — AI
**Type:** Community Message
**Version:** 2.0.0
**Last Updated:** 2026-07-25

---

## Purpose

Generate a celebratory announcement when a trainer achieves a fan gain milestone. Two milestone tracks exist — **Daily** (per-day fan gain, repeats daily) and **Monthly** (cumulative monthly gain, fires once at the highest tier). The AI must tailor tone and language to the track and tier.

---

## Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `{{trainerName}}` | **Yes** | — | Username of the trainer |
| `{{milestoneValue}}` | **Yes** | — | Fan count the trainer hit (e.g. 5000000, 60000000) |
| `{{milestoneType}}` | **Yes** | `daily` | `daily` or `monthly` |
| `{{tierLabel}}` | **Yes** | — | Tier name (e.g. "Legend", "Tier 6") |
| `{{tierNumber}}` | No | — | Tier rank number (for monthly: 1–10) |
| `{{circleName}}` | No | "the circle" | Name of the trainer's circle |
| `{{gainPeriod}}` | No | "today" | Time context: "today" or "this month" |

---

## Daily Milestone Tiers

Daily milestones are based on a trainer's **single-day fan gain**. These reset every day — a trainer can hit the same tier again tomorrow. Only the **highest tier achieved that day** fires.

| Tier | Threshold | Label | Tone |
|---|---|---|---|
| 1 | 1,000,000 fans | ⏳ **Minimum** | "You showed up. You put in the work. This is where it starts." |
| 2 | 3,000,000 fans | 👍 **Good** | "Solid gains. You're building real momentum now." |
| 3 | 5,000,000 fans | ⭐ **Excellent** | "Outstanding pace. The leaderboard is noticing you." |
| 4 | 7,000,000 fans | 🔥 **Competitive** | "Elite-caliber performance. You're setting the standard." |
| 5 | 10,000,000 fans | 👑 **Legend** | "Legendary status. Today belongs to you. The circle salutes." |

**Rule:** Only 1 daily milestone fires per trainer per day — the highest tier they crossed. If a trainer gains 11M fans, the Legend (10M) milestone fires, not all five.

---

## Monthly Milestone Tiers

Monthly milestones are based on a trainer's **cumulative monthly fan gain**. These fire **once per month per trainer** at the highest tier achieved. Tone is tied to the title — lower tiers tease, mid tiers respect, top tiers awe.

| Tier | Threshold | Label | Tone |
|---|---|---|---|
| Tier 1 | 10,000,000 fans | 😴 **Unpopular Trainer** | Teasing — "wake up, the leaderboard is watching" |
| Tier 2 | 20,000,000 fans | 🥱 **Lazy Trainer** | Playful nudge — "you could do better, and you know it" |
| Tier 3 | 30,000,000 fans | 📦 **Minimum Fan Hoarder** | Grudging respect — "okay, you are stacking now" |
| Tier 4 | 40,000,000 fans | 💪 **Elite Trainer** | Genuine respect — "now we are talking — real gains" |
| Tier 5 | 50,000,000 fans | ⚡ **Super Elite Trainer** | Impressed — "elite among elites" |
| Tier 6 | 60,000,000 fans | 🏆 **Expert Hoarder** | Acknowledging — "this is a serious operation" |
| Tier 7 | 70,000,000 fans | 🔥 **Super Expert Hoarder** | Competitive fire — "nobody is catching you" |
| Tier 8 | 80,000,000 fans | ⚔️ **Competitive** | Battle-ready — "you are a threat to everyone" |
| Tier 9 | 90,000,000 fans | 🔱 **Super Competitive** | Dominant — "the circle fears your name" |
| Tier 10 | 100,000,000 fans | 👑 **Legendary** | Ultimate — "you ARE the standard. everyone else is chasing." |

**Rule:** Only 1 monthly milestone fires per trainer per month — the highest tier crossed. If a trainer has 60M fans that month, Tier 6 "Diamond Guardian" fires. If they reach 100M, "Circle Sovereign" fires instead — Tier 1–9 are skipped.

---

## Prompt Template — Daily Milestone

```text
You are writing a DAILY milestone announcement for the Umakraft Discord server.

Trainer: {{trainerName}}
Daily Gain: {{milestoneValue}} fans TODAY
Tier: {{tierLabel}} (Tier {{tierNumber}})
Circle: {{circleName}}

Write a celebration message that:
- Congratulates the trainer by name
- Names the tier they achieved (e.g. "Legend tier — 10M fans in a single day!")
- Acknowledges the effort this represents — 10M fans in one day is monumental
- Celebrates the achievement as a circle-wide moment
- Ends with "Tomorrow is another chance to climb higher"
- Uses the correct tone for this tier (see "Daily Milestone Tiers" table above)

Requirements:
- Between 100 and 150 words
- Use bold formatting for the trainer name, tier label, and fan count
- Include 1–2 celebration emojis appropriate to the tier
- Warm, genuine, community-celebratory tone
- Do NOT compare to leaderboard rankings (that's what leaderboard is for)
- Do not invent specific details not provided
```

---

## Prompt Template — Monthly Milestone

```text
You are writing a MONTHLY milestone announcement for the Umakraft Discord server.

Trainer: {{trainerName}}
Monthly Gain: {{milestoneValue}} fans THIS MONTH
Tier: {{tierLabel}} (Tier {{tierNumber}} of 10)
Circle: {{circleName}}

Write a COMPETITIVE, high-energy announcement that:
- Names the trainer and their NEW TITLE (e.g. "Elite Trainer — Tier 4")
- The title is NOT just decorative — it IS the personality of the message
  - Unpopular Trainer (10M) → tease them: "finally showed up"
  - Lazy Trainer (20M) → playful nudge: "you could do better"
  - Minimum Fan Hoarder (30M) → grudging respect: "okay, stacking"
  - Elite Trainer (40M) → genuine respect: "now we're talking"
  - Super Elite Trainer (50M) → impressed: "elite among elites"
  - Expert Hoarder (60M) → acknowledging: "serious operation"
  - Super Expert Hoarder (70M) → fire: "nobody is catching you"
  - Competitive (80M) → threat: "you are a threat to everyone"
  - Super Competitive (90M) → fear: "the circle fears your name"
  - Legendary (100M) → awe: "you ARE the standard"
- The tone MUST match the title — each tier has its own personality
- Frames the achievement in competitive terms
- Ends with a forward-looking statement aimed at the NEXT tier up

Requirements:
- Between 100 and 150 words
- COMPETITIVE tone — not just "congratulations" but "this is what champions do"
- Use bold for trainer name, tier label, and fan count
- Include 1–2 powerful emojis (🔥, ⚡, 👑, 🏆, 💎, 🛡️, 🔱)
- Frame as: the bar has been raised for the whole circle
- Do not invent specific details not provided
```

---

## Example Output — Daily (Legend, 10M)

> 👑 **Hana** just put up **LEGEND numbers** — **10,000,000 fans** in a single day! Tier 5 Legend status isn't just a milestone, it's a statement. When you drop double-digit millions in 24 hours, you're not just training — you're redefining what's possible. The entire *Rising Stars* circle stops to take notice when a trainer hits this level. Hana, you've set the bar sky-high today. Everyone else? The challenge has been issued. Rest up, sync your gains, and come back tomorrow ready to chase this standard. Because tomorrow is another chance to climb higher. What a performance! 🔥

*(Word count: 102)*

---

## Example Output — Monthly (Expert Hoarder, Tier 6, 60M)

> 🏆 **Expert Hoarder**. That's the title **Hana** just claimed — **60,000,000 fans** this month, Tier 6 of 10. This isn't casual training anymore. This is a full-scale fan-hoarding operation, and Hana is running it like a general. The monthly leaderboard doesn't lie — Hana has turned every single day into a campaign, and the results are stacking higher than anyone expected. The rest of *Rising Stars* better take notes, because Expert Hoarder isn't a title you stumble into — it's one you earn through relentless consistency. Next stop? Super Expert Hoarder at 70M. The bar keeps moving. Keep hoarding. 🔥

*(Word count: 107)*

---

## Example Output — Monthly (Legendary, Tier 10, 100M)

> 👑 **Legendary**. No qualifiers. No conditions. **Hana** has hit **100,000,000 fans** this month — Tier 10 of 10. There are no more tiers to climb because Hana IS the tier. This is the number every trainer in *Rising Stars* will be staring at for the rest of the month. Legendary isn't a title you get — it's a title you become. Every single day, every single sync, every single fan counted toward this moment. The circle doesn't just celebrate this — the circle studies it. Hana, you didn't just win the month. You redefined what winning looks like. 👑

---

## Example Output — Daily (Minimum, 1M)

> ⏳ The grind begins. **Hana** just crossed **1,000,000 fans** today — Tier 1 Minimum. Every legend starts somewhere, and today Hana put in the work that builds toward greatness. One million fans in a single day is the foundation — the proof that you showed up, you trained, and you pushed forward. *Rising Stars*, this is how momentum starts. One trainer, one day, one million at a time. Tomorrow, the bar moves higher. For now, let's celebrate the first step of today's journey. Keep climbing, Hana! 🌅

*(Word count: 89 — regenerate with expand)*

---

## Tone Scaling Summary

### Daily
| Tier | Fan Count | Tone |
|---|---|---|
| Minimum | 1M | Encouraging — "the grind begins" |
| Good | 3M | Affirming — "building real momentum" |
| Excellent | 5M | Impressive — "leaderboard is noticing" |
| Competitive | 7M | Elite — "setting the standard" |
| Legend | 10M | Legendary — "redefining what's possible" |

### Monthly
| Tier | Fan Count | Title | Tone |
|---|---|---|---|
| 1 | 10M | Unpopular Trainer | Teasing — "finally showed up" |
| 2 | 20M | Lazy Trainer | Playful nudge — "you could do better" |
| 3 | 30M | Minimum Fan Hoarder | Grudging respect — "okay, stacking" |
| 4 | 40M | Elite Trainer | Genuine respect — "now we're talking" |
| 5 | 50M | Super Elite Trainer | Impressed — "elite among elites" |
| 6 | 60M | Expert Hoarder | Acknowledging — "serious operation" |
| 7 | 70M | Super Expert Hoarder | Fire — "nobody is catching you" |
| 8 | 80M | Competitive | Threat — "you are a threat to everyone" |
| 9 | 90M | Super Competitive | Fear — "the circle fears your name" |
| 10 | 100M | Legendary | Awe — "you ARE the standard" |

---

## 1 Message Per Member Rule

- **Daily:** Only the highest daily tier fires. If a trainer gains 11M fans, only Legend (10M) fires — Minimum through Competitive are skipped.
- **Monthly:** Only the highest monthly tier fires. If a trainer has 60M, Diamond Guardian (Tier 6) fires — Tiers 1–5 are skipped. If later they hit 80M, Storm Lord (Tier 8) fires and the previous Tier 6 announcement is NOT repeated.
- **No duplicate fire:** The Archive-Inspector checks `milestone_fired` before announcing. Once a tier is announced for a trainer in that period (day or month), it never fires again.

---

## Fallback — Daily

> 👑 **{{trainerName}}** hit **{{milestoneValue}} fans** today — {{tierLabel}} tier! The circle celebrates this achievement and the dedication it represents. Every fan earned today moves us all forward. Tomorrow is another chance to climb higher. Well done, {{trainerName}}! 🔥

---

## Fallback — Monthly

> 🏆 **{{trainerName}}** — you are now **{{tierLabel}}** this month with **{{milestoneValue}} fans**, Tier {{tierNumber}} of 10. The title says it all. The entire {{circleName}} circle sees what you are building. The next tier is waiting. Keep going. 👑

---

## Related Documents

- `AI/MESSAGE_SYSTEM.md` — message type registry
- `AI/CONTENT_GENERATOR.md` — generation pipeline
- `Broadcast/Announcer/task/milestone.md` — task spec
- `Broadcast/archive-inspector/archive-inspector.md` — claim key format, tier config
- `AI/EXAMPLES.md` — Example 8 (milestone sample)
